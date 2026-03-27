#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function runTool(toolScriptPath, payload) {
  const result = spawnSync(process.execPath, [toolScriptPath], {
    input: JSON.stringify(payload),
    encoding: "utf8"
  });

  if (result.status !== 0) {
    return {
      ok: false,
      error: {
        code: "TOOL_EXECUTION_FAILED",
        message: result.stderr || `Failed to run tool: ${toolScriptPath}`
      }
    };
  }

  try {
    return JSON.parse(result.stdout || "{}");
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "TOOL_OUTPUT_PARSE_ERROR",
        message: error.message,
        rawOutput: result.stdout
      }
    };
  }
}

function interpolate(value, context) {
  if (typeof value !== "string") {
    return value;
  }

  return value.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const parts = key.split(".");
    let current = context;
    for (const part of parts) {
      current = current && Object.prototype.hasOwnProperty.call(current, part) ? current[part] : undefined;
    }
    return current === undefined || current === null ? "" : String(current);
  });
}

function getByPath(context, pathExpr) {
  const parts = String(pathExpr).split(".");
  let current = context;
  for (const part of parts) {
    current = current && Object.prototype.hasOwnProperty.call(current, part) ? current[part] : undefined;
  }
  return current;
}

function main() {
  const moduleRoot = path.resolve(__dirname, "..");
  const configPath = path.join(moduleRoot, "config.json");
  const config = loadJson(configPath);

  const workflowName = process.argv[2];
  if (!workflowName) {
    process.stderr.write("Usage: node scripts/run-workflow.js <workflowId> [input.json]\n");
    process.exit(1);
  }

  const workflowMeta = config.workflows.find((wf) => wf.id === workflowName);
  if (!workflowMeta) {
    process.stderr.write(`Workflow not found: ${workflowName}\n`);
    process.exit(1);
  }

  let input = {};
  const inputArg = process.argv[3];
  if (inputArg) {
    input = loadJson(path.resolve(process.cwd(), inputArg));
  }

  const workflow = loadJson(path.join(moduleRoot, workflowMeta.file));
  const state = {
    input,
    steps: {}
  };

  for (const step of workflow.steps) {
    if (step.type === "require_input") {
      const value = getByPath(state, step.path);
      if (value === undefined || value === null || value === "") {
        process.stdout.write(JSON.stringify({
          ok: false,
          requiresInput: true,
          step: step.id,
          field: step.path,
          prompt: step.prompt
        }, null, 2) + "\n");
        process.exit(0);
      }
      continue;
    }

    if (step.type === "branch") {
      const actual = getByPath(state, step.path);
      const expected = step.equals;
      if (actual !== expected && step.onMismatch === "stop") {
        process.stdout.write(JSON.stringify({
          ok: false,
          stoppedAt: step.id,
          reason: step.reason || "Branch mismatch"
        }, null, 2) + "\n");
        process.exit(0);
      }
      continue;
    }

    if (step.type === "tool") {
      const toolMeta = config.tools.find((tool) => tool.id === step.toolId);
      if (!toolMeta) {
        process.stdout.write(JSON.stringify({
          ok: false,
          error: {
            code: "TOOL_NOT_FOUND",
            message: `Tool not found in config: ${step.toolId}`
          }
        }, null, 2) + "\n");
        process.exit(0);
      }

      const payload = {};
      for (const [key, value] of Object.entries(step.input || {})) {
        payload[key] = interpolate(value, state);
      }

      const toolOutput = runTool(path.join(moduleRoot, toolMeta.script), payload);
      state.steps[step.id] = toolOutput;

      if (!toolOutput.ok && step.onError !== "continue") {
        process.stdout.write(JSON.stringify({
          ok: false,
          step: step.id,
          error: toolOutput.error || { message: "Tool failed" }
        }, null, 2) + "\n");
        process.exit(0);
      }
      continue;
    }

    if (step.type === "emit") {
      const result = {};
      for (const [key, value] of Object.entries(step.output || {})) {
        if (typeof value === "string" && value.startsWith("$")) {
          result[key] = getByPath(state, value.slice(1));
        } else {
          result[key] = interpolate(value, state);
        }
      }

      process.stdout.write(JSON.stringify({ ok: true, workflow: workflow.id, result }, null, 2) + "\n");
      process.exit(0);
    }
  }

  process.stdout.write(JSON.stringify({ ok: true, workflow: workflow.id, state }, null, 2) + "\n");
}

main();
