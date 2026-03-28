#!/usr/bin/env node
"use strict";

// Minimal MCP (Model Context Protocol) server — zero external dependencies.
// Implements JSON-RPC 2.0 over stdio with Content-Length framing.

const fiasseLookup = require("./fiasse_lookup");
const securabilityReview = require("./securability_review");
const secureGenerate = require("./secure_generate");
const prdSecurabilityEnhance = require("./prd_securability_enhance");

// ---------------------------------------------------------------------------
// Tool registry
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    name: "fiasse_lookup",
    description:
      "Look up FIASSE/SSEM sections and practical guidance by topic keyword or section identifier.",
    inputSchema: {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description:
            "Topic, keyword, or section id (e.g. integrity, trust boundaries, S3.2.2)"
        },
        maxSections: {
          type: "number",
          description: "Maximum sections to return (default 5)"
        }
      },
      required: ["topic"]
    },
    handler: fiasseLookup.run
  },
  {
    name: "securability_review",
    description:
      "Analyze code for securable engineering qualities using the SSEM framework. Scores nine attributes across three pillars (Maintainability, Trustworthiness, Reliability) on a 0\u201310 scale.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceRoot: {
          type: "string",
          description: "Workspace root path (defaults to cwd)"
        },
        targetPath: {
          type: "string",
          description: "Relative path to analyze (defaults to .)"
        }
      }
    },
    handler: securabilityReview.run
  },
  {
    name: "secure_generate",
    description:
      "Build a securability-constrained generation contract for implementation tasks using FIASSE/SSEM constraints.",
    inputSchema: {
      type: "object",
      properties: {
        request: {
          type: "string",
          description: "Code generation request text"
        },
        language: {
          type: "string",
          description: "Target language (e.g. TypeScript, Python)"
        },
        framework: {
          type: "string",
          description: "Target framework (e.g. Express, FastAPI)"
        }
      },
      required: ["request"]
    },
    handler: secureGenerate.run
  },
  {
    name: "prd_securability_enhance",
    description:
      "Enhance PRD features with ASVS requirement mapping and FIASSE/SSEM securability annotations.",
    inputSchema: {
      type: "object",
      properties: {
        workspaceRoot: {
          type: "string",
          description: "Workspace root path (defaults to cwd)"
        },
        prdPath: {
          type: "string",
          description: "Path to the PRD markdown file"
        },
        asvsLevel: {
          type: "number",
          description: "ASVS assurance level: 1, 2, or 3 (default 2)"
        },
        maxRequirementsPerFeature: {
          type: "number",
          description: "Max ASVS requirements per feature (default 6)"
        }
      },
      required: ["prdPath"]
    },
    handler: prdSecurabilityEnhance.run
  }
];

const TOOL_MAP = {};
for (const tool of TOOLS) {
  TOOL_MAP[tool.name] = tool;
}

// ---------------------------------------------------------------------------
// JSON-RPC helpers
// ---------------------------------------------------------------------------

function makeResponse(id, result) {
  return { jsonrpc: "2.0", id, result };
}

function makeError(id, code, message) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

// ---------------------------------------------------------------------------
// MCP message handling
// ---------------------------------------------------------------------------

const SERVER_INFO = {
  name: "securable",
  version: "1.0.0"
};

const CAPABILITIES = {
  tools: {}
};

function handleMessage(msg) {
  const { id, method, params } = msg;

  if (method === "initialize") {
    return makeResponse(id, {
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: CAPABILITIES,
      serverInfo: SERVER_INFO
    });
  }

  if (method === "notifications/initialized") {
    return null; // notification — no response
  }

  if (method === "ping") {
    return makeResponse(id, {});
  }

  if (method === "tools/list") {
    const list = TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema
    }));
    return makeResponse(id, { tools: list });
  }

  if (method === "tools/call") {
    const toolName = params && params.name;
    const args = (params && params.arguments) || {};
    const tool = TOOL_MAP[toolName];

    if (!tool) {
      return makeResponse(id, {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: `Unknown tool: ${toolName}` }) }],
        isError: true
      });
    }

    try {
      const result = tool.handler(args);
      return makeResponse(id, {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        isError: !result.ok
      });
    } catch (err) {
      return makeResponse(id, {
        content: [{ type: "text", text: JSON.stringify({ ok: false, error: err.message }) }],
        isError: true
      });
    }
  }

  if (id !== undefined) {
    return makeError(id, -32601, `Method not found: ${method}`);
  }

  return null; // unknown notification — ignore
}

// ---------------------------------------------------------------------------
// Content-Length framed stdio transport
// ---------------------------------------------------------------------------

function send(obj) {
  const body = JSON.stringify(obj);
  const header = `Content-Length: ${Buffer.byteLength(body, "utf8")}\r\n\r\n`;
  process.stdout.write(header + body);
}

function startTransport() {
  let buffer = "";

  process.stdin.setEncoding("utf8");
  process.stdin.on("data", (chunk) => {
    buffer += chunk;

    while (true) {
      const headerEnd = buffer.indexOf("\r\n\r\n");
      if (headerEnd === -1) break;

      const header = buffer.slice(0, headerEnd);
      const match = header.match(/Content-Length:\s*(\d+)/i);
      if (!match) {
        buffer = buffer.slice(headerEnd + 4);
        continue;
      }

      const contentLength = parseInt(match[1], 10);
      const bodyStart = headerEnd + 4;

      if (Buffer.byteLength(buffer.slice(bodyStart), "utf8") < contentLength) {
        break; // wait for more data
      }

      // Extract exactly contentLength bytes
      const bodyBytes = Buffer.from(buffer.slice(bodyStart), "utf8");
      const bodyText = bodyBytes.slice(0, contentLength).toString("utf8");
      const consumed = bodyStart + Buffer.from(bodyText, "utf8").length;
      buffer = buffer.slice(consumed);

      let msg;
      try {
        msg = JSON.parse(bodyText);
      } catch {
        continue;
      }

      const response = handleMessage(msg);
      if (response) {
        send(response);
      }
    }
  });

  process.stdin.on("end", () => {
    process.exit(0);
  });
}

startTransport();
