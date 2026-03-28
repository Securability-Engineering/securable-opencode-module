"use strict";

const fs = require("fs");
const path = require("path");

function readJsonFromStdin() {
  const input = fs.readFileSync(0, "utf8").trim();
  if (!input) {
    return {};
  }

  try {
    return JSON.parse(input);
  } catch (error) {
    throw new Error(`Invalid JSON input: ${error.message}`);
  }
}

function writeJson(output) {
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
}

function normalizeWorkspaceRoot(explicitRoot) {
  if (explicitRoot && explicitRoot.trim()) {
    return path.resolve(explicitRoot);
  }
  return path.resolve(__dirname, "..", "..");
}

function readFileIfExists(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return fs.readFileSync(filePath, "utf8");
}

function listFilesRecursively(baseDir, fileFilter) {
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  const results = [];
  const stack = [baseDir];

  while (stack.length > 0) {
    const current = stack.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".git" || entry.name === "node_modules" || entry.name === "venv" || entry.name === ".venv") {
          continue;
        }
        stack.push(fullPath);
      } else if (!fileFilter || fileFilter(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

function extractYamlFrontmatter(markdownText) {
  if (!markdownText.startsWith("---\n")) {
    return { frontmatter: {}, body: markdownText };
  }

  const end = markdownText.indexOf("\n---\n", 4);
  if (end === -1) {
    return { frontmatter: {}, body: markdownText };
  }

  const yaml = markdownText.slice(4, end).trim();
  const body = markdownText.slice(end + 5);
  const frontmatter = {};

  for (const line of yaml.split(/\r?\n/)) {
    const separator = line.indexOf(":");
    if (separator <= 0) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim();
    frontmatter[key] = value.replace(/^"|"$/g, "");
  }

  return { frontmatter, body };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

module.exports = {
  clamp,
  extractYamlFrontmatter,
  listFilesRecursively,
  normalizeWorkspaceRoot,
  readFileIfExists,
  readJsonFromStdin,
  writeJson
};
