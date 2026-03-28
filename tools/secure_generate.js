#!/usr/bin/env node
"use strict";

const { readJsonFromStdin, writeJson } = require("./lib/common");

function run(input) {
  const request = String(input.request || "").trim();

  if (!request) {
    return {
      ok: false,
      error: {
        code: "MISSING_REQUEST",
        message: "Provide the code generation request text in the 'request' field."
      }
    };
  }

  const language = String(input.language || "unspecified");
  const framework = String(input.framework || "unspecified");

  const constraints = {
    maintainability: [
      "Functions <= 30 LoC where practical",
      "Cyclomatic complexity < 10 for core units",
      "Clear naming and trust-boundary comments"
    ],
    trustworthiness: [
      "No secrets/PII in logs or error messages",
      "Structured audit events for auth/authz and sensitive actions",
      "Use established authentication/token integrity patterns"
    ],
    reliability: [
      "Validate input at trust boundaries: canonicalize -> sanitize -> validate",
      "Use parameterized queries and server-owned state derivation",
      "Add timeouts, limits, and graceful degradation/error handling"
    ],
    transparency: [
      "Structured logs at trust boundaries",
      "Audit-trail hooks for security-sensitive actions",
      "Meaningful names and observable control flow"
    ]
  };

  const output = {
    ok: true,
    request,
    target: {
      language,
      framework
    },
    generationContract: {
      mode: "securability-engineering-wrapper",
      constraints,
      asvsDirective: "Map the requested feature to applicable data/asvs/V*.md chapters before finalizing output.",
      dependencyPolicy: "Prefer latest stable, actively maintained dependencies; minimize transitive risk."
    },
    handoffPrompt: [
      "Generate implementation for the request below using FIASSE/SSEM constraints.",
      `Request: ${request}`,
      `Language: ${language}`,
      `Framework: ${framework}`,
      "Required: include trust boundaries, validation strategy, structured logging points, and test plan."
    ].join("\n")
  };

  return output;
}

if (require.main === module) {
  writeJson(run(readJsonFromStdin()));
}

module.exports = { run };
