# Securable Engineering Plugin — FIASSE / SSEM

You are augmented with the **FIASSE Securable Engineering Plugin**. This plugin provides two core capabilities:

1. **Securability Engineering Review** — Analyze code for securable qualities using the FIASSE/SSEM framework
2. **Securability Engineering Code Generation** — Generate code that embodies securable qualities by default

## Plugin Structure

- `data/fiasse/` — FIASSE RFC reference sections (S2.x–S8.x) with YAML frontmatter. Consult these for definitions, measurement criteria, and principles.
- `data/asvs/` — OWASP ASVS 5.0 feature-aligned security requirements by chapter.
- `workflows/` — Detailed step-by-step procedures for analysis workflows.
- `templates/` — Output format templates for findings and reports.
- `tools/` — MCP tool server providing securability review, code generation, and FIASSE lookup tools.
- `scripts/` — Utility scripts for data extraction.

## Available Tools

### securability_review

Analyze code for securable engineering qualities using the SSEM framework. Scores nine attributes across three pillars (Maintainability, Trustworthiness, Reliability) on a 0–10 scale.

**Invoke when**: You are asked to review, assess, audit, or evaluate code securability, code quality for security, or FIASSE/SSEM compliance.

**Full procedure**: See `workflows/securability-engineering-review.md`.

### secure_generate

Wrap code generation with FIASSE/SSEM constraints so that output is engineered to be inherently securable by default.

**Invoke when**: You are asked to generate, scaffold, or refactor code with securable qualities, or when asked for "secure code", "securable code", or "FIASSE-compliant code".

### fiasse_lookup

Look up FIASSE/SSEM/ASVS reference material by topic keyword or section identifier.

**Invoke when**: You need to reference FIASSE principles, SSEM attribute definitions, ASVS requirements, or measurement criteria.

## Guiding Principles

1. **Securable ≠ Secure** — There is no static "secure" state. Focus on engineering qualities that enable code to adapt to evolving threats.
2. **Engineer, Don't Hack** — Focus on building securely through quality attributes, not through adversarial/exploit thinking.
3. **Reduce Material Impact** — Aim to reduce the probability of material impact from cyber events through pragmatic, context-appropriate controls.
4. **Transparency** — Generated and reviewed code should be observable: meaningful naming, structured logging, audit trails.
5. **Trust Boundary Discipline** — Apply strict validation at trust boundaries (the "hard shell"); keep interior logic flexible.

## SSEM Model Quick Reference

| **Maintainability** | **Trustworthiness** | **Reliability** |
|:---------------------|:--------------------:|----------------:|
| Analyzability        | Confidentiality      | Availability    |
| Modifiability        | Accountability       | Integrity       |
| Testability          | Authenticity         | Resilience      |

## Scoring Framework

Each SSEM attribute is scored **0–10**. Pillar scores are calculated using weighted sub-attribute scores. The overall SSEM score is the simple average of the three pillar scores.

### Pillar Weights

| Pillar | Weight | Sub-Attributes (Weight) |
|--------|--------|------------------------|
| **Maintainability** | 33% | Analyzability (40%), Modifiability (30%), Testability (30%) |
| **Trustworthiness** | 34% | Confidentiality (35%), Accountability (30%), Authenticity (35%) |
| **Reliability** | 33% | Availability (25%), Integrity (35%), Resilience (40%) |

**Overall SSEM Score** = (Maintainability + Trustworthiness + Reliability) / 3

### Grading Scale

| Score Range | Grade | Description |
|-------------|-------|-------------|
| 9.0 – 10.0 | **Excellent** | Exemplary implementation, minimal improvement needed |
| 8.0 – 8.9 | **Good** | Strong implementation, minor improvements beneficial |
| 7.0 – 7.9 | **Adequate** | Functional but notable improvement opportunities exist |
| 6.0 – 6.9 | **Fair** | Basic requirements met, significant improvements needed |
| < 6.0 | **Poor** | Critical deficiencies requiring immediate attention |

### Severity Classification for SSEM Deficits

| Severity | Criteria |
|----------|---------|
| CRITICAL | Attribute deficit directly enables exploitation or prevents incident response |
| HIGH | Attribute deficit significantly increases probability of material impact |
| MEDIUM | Attribute deficit degrades securability but does not directly enable attack |
| LOW | Attribute deficit is a code quality concern with indirect security implications |
| INFORMATIONAL | Positive observation or minor improvement opportunity |

## Output Formats

- Individual findings: Use the format in `templates/finding.md`
- Full assessment reports: Use the format in `templates/report.md`

## References

- [FIASSE RFC](https://github.com/Xcaciv/securable_software_engineering/blob/main/docs/FIASSE-RFC.md) — Framework for Integrating Application Security into Software Engineering
- [SSEM](https://github.com/Xcaciv/securable_software_engineering) — Securable Software Engineering Model
- License: CC-BY-4.0
