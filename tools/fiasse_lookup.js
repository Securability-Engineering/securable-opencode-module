#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  extractYamlFrontmatter,
  readJsonFromStdin,
  writeJson
} = require("./lib/common");

function run(input) {
  const topic = String(input.topic || "").trim();
  const maxSections = Number.isFinite(input.maxSections) ? Number(input.maxSections) : 5;

  if (!topic) {
    return {
      ok: false,
      error: {
        code: "MISSING_TOPIC",
        message: "Provide a topic, section id, or keyword (for example: integrity, trust boundaries, S3.2.2)."
      }
    };
  }

  const dataDir = path.resolve(__dirname, "..", "data", "fiasse");
  if (!fs.existsSync(dataDir)) {
    return {
      ok: false,
      error: {
        code: "FIASSE_DATA_NOT_FOUND",
        message: `Expected FIASSE data directory at ${dataDir}`
      }
    };
  }

  const query = topic.toLowerCase();
  const files = fs.readdirSync(dataDir)
    .filter((name) => name.endsWith(".md"))
    .map((name) => path.join(dataDir, name));

  const matches = [];

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const { frontmatter, body } = extractYamlFrontmatter(raw);
    const sectionName = path.basename(filePath, ".md");
    const haystack = `${sectionName}\n${frontmatter.title || ""}\n${raw}`.toLowerCase();

    if (!haystack.includes(query)) {
      continue;
    }

    const lines = body.split(/\r?\n/).filter(Boolean);
    const summary = lines.slice(0, 4).join(" ").slice(0, 420);

    matches.push({
      section: sectionName,
      title: frontmatter.title || sectionName,
      path: path.relative(path.resolve(__dirname, ".."), filePath).replace(/\\/g, "/"),
      summary
    });
  }

  const sorted = matches
    .sort((a, b) => a.section.localeCompare(b.section, undefined, { numeric: true }))
    .slice(0, Math.max(1, maxSections));

  if (sorted.length === 0) {
    return {
      ok: true,
      topic,
      matches: [],
      guidance: "No direct section match. Try a broader keyword such as integrity, resilience, transparency, or a section id like S3.2.3."
    };
  }

  const guidance = [
    `Topic '${topic}' maps to ${sorted.length} FIASSE section(s).`,
    "Use the listed sections as primary references and apply trust-boundary discipline plus transparency controls in implementation and review outputs."
  ].join(" ");

  return {
    ok: true,
    topic,
    matches: sorted,
    guidance
  };
}

if (require.main === module) {
  writeJson(run(readJsonFromStdin()));
}

module.exports = { run };

module.exports = { run };
