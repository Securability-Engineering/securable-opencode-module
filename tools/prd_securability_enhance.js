#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const {
  extractYamlFrontmatter,
  normalizeWorkspaceRoot,
  readJsonFromStdin,
  writeJson
} = require("./lib/common");

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((part) => part.length > 2);
}

function parseAsvsCatalog(workspaceRoot) {
  const asvsDir = path.resolve(workspaceRoot, "data", "asvs");
  if (!fs.existsSync(asvsDir)) {
    return [];
  }

  const files = fs.readdirSync(asvsDir)
    .filter((name) => /^V\d+\.\d+\.md$/i.test(name))
    .map((name) => path.join(asvsDir, name));

  const requirements = [];

  for (const filePath of files) {
    const raw = fs.readFileSync(filePath, "utf8");
    const { frontmatter } = extractYamlFrontmatter(raw);
    const chapter = frontmatter.asvs_chapter || path.basename(filePath, ".md");
    const tableRowRegex = /\|\s*\*\*?(\d+\.\d+\.\d+)\*\*?\s*\|\s*(.*?)\s*\|\s*(\d)\s*\|/g;
    let match = null;

    while ((match = tableRowRegex.exec(raw)) !== null) {
      const id = match[1];
      const description = match[2].replace(/\s+/g, " ").trim();
      const level = Number(match[3]);
      requirements.push({
        id: `V${id}`,
        chapter,
        family: chapter.split(".")[0],
        level,
        description,
        tokens: tokenize(`${chapter} ${description}`)
      });
    }
  }

  return requirements;
}

function classifyFeature(line) {
  const lower = line.toLowerCase();
  const mappings = [];

  if (/(login|log in|sign\s?in|auth|password|session|oauth|mfa)/.test(lower)) mappings.push("V2", "V3", "V7");
  if (/(access|role|permission|authorize|rbac)/.test(lower)) mappings.push("V4");
  if (/(input|form|upload|search|query|payload|request)/.test(lower)) mappings.push("V5", "V8");
  if (/(crypto|encrypt|decrypt|hash|token|certificate|secret|key)/.test(lower)) mappings.push("V6");
  if (/(log|audit|trace|monitor)/.test(lower)) mappings.push("V9", "V10");
  if (/(api|service|endpoint|rest|graphql)/.test(lower)) mappings.push("V13");
  if (/(config|deployment|infra|container)/.test(lower)) mappings.push("V14");
  if (/(business|workflow|logic|state)/.test(lower)) mappings.push("V1");

  if (mappings.length === 0) {
    mappings.push("V1", "V5", "V9");
  }

  return [...new Set(mappings)];
}

function scoreRequirement(featureTokens, requirement) {
  const featureSet = new Set(featureTokens);
  let overlap = 0;
  for (const token of requirement.tokens) {
    if (featureSet.has(token)) {
      overlap += 1;
    }
  }

  const chapterBoost = featureSet.has(requirement.family.toLowerCase()) ? 0.2 : 0;
  return overlap + chapterBoost;
}

function mapFeatureRequirements(featureTitle, asvsLevel, catalog, maxRequirementsPerFeature) {
  const families = classifyFeature(featureTitle);
  const featureTokens = tokenize(featureTitle);

  const candidates = catalog
    .filter((item) => item.level <= asvsLevel)
    .filter((item) => families.includes(item.family))
    .map((item) => ({
      ...item,
      score: scoreRequirement(featureTokens, item)
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.level !== b.level) return a.level - b.level;
      return a.id.localeCompare(b.id, undefined, { numeric: true });
    });

  const selected = candidates.slice(0, Math.max(1, maxRequirementsPerFeature));
  return {
    families,
    requirements: selected.map((item) => ({
      id: item.id,
      chapter: item.chapter,
      level: item.level,
      description: item.description
    }))
  };
}

function parseFeatures(prdText) {
  const lines = prdText.split(/\r?\n/);
  const features = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed) || /^#+\s+/.test(trimmed)) {
      const title = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+\.\s+/, "").replace(/^#+\s+/, "").trim();
      if (title.length > 5) {
        features.push(title);
      }
    }
  }

  return [...new Set(features)].slice(0, 25);
}

function renderFeatureSection(featureTitle, asvsLevel, families, requirements) {
  const chapterRefs = families.map((c) => `${c} (L${asvsLevel}+)`).join(", ");
  const requirementRefs = requirements.length === 0
    ? "- None auto-selected; perform manual mapping review."
    : requirements.map((req) => `- ${req.id} (${req.chapter}, L${req.level}): ${req.description}`);

  return [
    `### ${featureTitle}`,
    "",
    `**ASVS Mapping**: ${chapterRefs}`,
    "**ASVS Requirement Mapping**:",
    ...requirementRefs,
    "",
    "**Coverage Status**: Partial (requirement-level baseline; manual verification required)",
    "",
    "**SSEM Implementation Notes**:",
    "- Analyzability: Keep trust-boundary handlers explicit and readable.",
    "- Modifiability: Centralize security controls in reusable modules.",
    "- Testability: Define unit and integration tests for rejection and failure paths.",
    "- Confidentiality: Classify sensitive data and enforce least-privilege access.",
    "- Accountability: Emit structured logs for security-sensitive decisions.",
    "- Authenticity: Validate identity/session/token authenticity for every privileged action.",
    "- Availability: Define timeouts, throttling, and graceful degradation behavior.",
    "- Integrity: Canonicalize, sanitize, and validate boundary inputs; derive server-owned state.",
    "- Resilience: Handle faults predictably and recover without data corruption.",
    "",
    "**FIASSE Tenet Annotations**:",
    "- S2.1: Requirement avoids static secure assumptions and supports adaptation.",
    "- S2.2: Requirement preserves computing value under stress and change.",
    "- S2.3: Requirement lowers probability of material cyber impact.",
    "- S2.4: Requirement mandates scalable engineering controls over ad-hoc fixes.",
    "- S2.6: Requirement includes observability and auditable behavior expectations.",
    "",
    "**Acceptance Criteria Additions**:",
    "- Security behavior is testable with positive and negative cases.",
    "- Trust-boundary validation and failure semantics are explicitly defined.",
    "- Auditability requirements are measurable and reviewable.",
    ""
  ].join("\n");
}

function run(input) {
  const workspaceRoot = normalizeWorkspaceRoot(input.workspaceRoot);
  const prdPath = input.prdPath ? path.resolve(workspaceRoot, input.prdPath) : null;
  const maxRequirementsPerFeature = Number.isFinite(Number(input.maxRequirementsPerFeature))
    ? Number(input.maxRequirementsPerFeature)
    : 6;

  if (!prdPath || !fs.existsSync(prdPath)) {
    return {
      ok: false,
      error: {
        code: "MISSING_PRD",
        message: "Provide an existing PRD path via 'prdPath'."
      }
    };
  }

  const asvsLevel = Number(input.asvsLevel || 2);
  if (![1, 2, 3].includes(asvsLevel)) {
    return {
      ok: false,
      error: {
        code: "INVALID_ASVS_LEVEL",
        message: "asvsLevel must be 1, 2, or 3."
      }
    };
  }

  const prdText = fs.readFileSync(prdPath, "utf8");
  const features = parseFeatures(prdText);
  const asvsCatalog = parseAsvsCatalog(workspaceRoot);

  if (features.length === 0) {
    return {
      ok: false,
      error: {
        code: "NO_FEATURES_FOUND",
        message: "No feature-like entries were found. Add headings or bullet features in the PRD."
      }
    };
  }

  if (asvsCatalog.length === 0) {
    return {
      ok: false,
      error: {
        code: "ASVS_CATALOG_EMPTY",
        message: "No ASVS section files were parsed from data/asvs."
      }
    };
  }

  const featureMappings = features.map((feature, index) => {
    const mapped = mapFeatureRequirements(feature, asvsLevel, asvsCatalog, maxRequirementsPerFeature);
    return {
      id: `F-${String(index + 1).padStart(2, "0")}`,
      title: feature,
      asvsChapters: mapped.families,
      asvsRequirements: mapped.requirements
    };
  });

  const matrixRows = featureMappings
    .map((item) => {
      const reqIds = item.asvsRequirements.map((req) => req.id).join(", ");
      return `| ${item.id} | ${item.title} | ${item.asvsChapters.join(", ")} | ${reqIds || "(manual)"} | ${asvsLevel} | Partial | Clarify criteria and add missing controls |`;
    })
    .join("\n");

  const enhancedBody = [
    "## ASVS Level Decision",
    "",
    `Selected baseline level: **L${asvsLevel}**`,
    "",
    "Rationale:",
    `- Level ${asvsLevel} selected based on requested enhancement baseline.`,
    "- Features with elevated assurance needs can be escalated to higher-level requirements.",
    "",
    "## Feature-ASVS Coverage Matrix",
    "",
    "| Feature | Title | ASVS Chapters | ASVS Requirement IDs | Level | Coverage | PRD Change Needed |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    matrixRows,
    "",
    "## Enhanced Feature Specifications",
    "",
    ...featureMappings.map((item) => renderFeatureSection(item.title, asvsLevel, item.asvsChapters, item.asvsRequirements)),
    "## Global Securability Requirements",
    "",
    "- Enforce trust-boundary validation for all ingress points.",
    "- Require structured security event logs without sensitive data leakage.",
    "- Maintain explicit incident traceability for privileged and state-mutating operations.",
    "- Define resilience expectations for degraded dependencies and transient failure states.",
    "",
    "## Open Gaps and Assumptions",
    "",
    "- This enhancement is generated from PRD text heuristics and must be manually validated.",
    "- Requirement-level mappings are relevance-ranked from textual signals and still require manual validation.",
    "- Threat modeling outcomes should be incorporated before final sign-off.",
    ""
  ].join("\n");

  return {
    ok: true,
    prdPath,
    asvsLevel,
    asvsCatalogSize: asvsCatalog.length,
    featuresDetected: featureMappings,
    enhancedPrd: enhancedBody
  };
}

if (require.main === module) {
  writeJson(run(readJsonFromStdin()));
}

module.exports = { run };
