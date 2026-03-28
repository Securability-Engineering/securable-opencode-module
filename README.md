# Securable OpenCode Module

An OpenCode-compatible module that provides securability engineering tools via MCP (Model Context Protocol).

Capabilities:
- **Securability engineering review** — language-aware FIASSE/SSEM scoring workflow
- **Securable code generation** — constraint-driven generation contract wrapper
- **PRD securability enhancement** — requirement-level ASVS + SSEM + FIASSE annotations
- **FIASSE reference lookup** — topic keyword and section identifier search

## Module Layout

```text
opencode.json              ← OpenCode configuration (MCP server entry point)
config.json                ← Module metadata and tool registry
instructions.md            ← Agent instructions for FIASSE/SSEM usage
tools/
  mcp_server.js            ← MCP server exposing all tools
  fiasse_lookup.js         ← FIASSE/SSEM reference lookup
  securability_review.js   ← SSEM scoring and review
  secure_generate.js       ← Securability-constrained generation contract
  prd_securability_enhance.js ← PRD enhancement with ASVS mapping
  lib/
    common.js              ← Shared helpers (zero external deps)
workflows/                 ← Workflow definitions for the script runner
scripts/
  run-workflow.js          ← CLI workflow orchestrator
  extract_fiasse_sections.py ← Data extraction utility
data/
  fiasse/                  ← FIASSE RFC reference sections
  asvs/                    ← OWASP ASVS 5.0 requirements
templates/
  finding.md               ← Security finding output format
  report.md                ← Assessment report output format
```

## Prerequisites

- Node.js 18+
- No external npm dependencies required

## Usage with OpenCode

Place this module in your project root. OpenCode reads `opencode.json` and starts the MCP server automatically. The four tools are then available to the agent:

| Tool | Description |
|------|-------------|
| `fiasse_lookup` | Look up FIASSE/SSEM sections by topic or section id |
| `securability_review` | Score code against 9 SSEM attributes across 3 pillars |
| `secure_generate` | Generate a securability-constrained code generation contract |
| `prd_securability_enhance` | Enhance PRD features with ASVS + FIASSE/SSEM annotations |

## Run Workflows (CLI)

Workflows can also be executed standalone via the CLI:

```bash
node scripts/run-workflow.js <workflow-id> <input-json-file>
```

Workflow IDs:
- `fiasse-lookup`
- `securability-review`
- `secure-generate`
- `prd-securability-enhance`

### Example Inputs

`lookup-input.json`
```json
{
  "topic": "integrity",
  "maxSections": 3
}
```

`review-input.json`
```json
{
  "workspaceRoot": ".",
  "targetPath": "src"
}
```

`generate-input.json`
```json
{
  "request": "Create a user registration API endpoint",
  "language": "TypeScript",
  "framework": "Express"
}
```

`prd-input.json`
```json
{
  "workspaceRoot": ".",
  "prdPath": "docs/prd.md",
  "asvsLevel": 2,
  "maxRequirementsPerFeature": 6
}
```

## Call Tools Directly

Each tool accepts JSON from stdin and emits JSON to stdout:

```bash
echo {"topic":"transparency"} | node tools/fiasse_lookup.js
```

```bash
echo {"request":"Build a secure file upload handler","language":"Python"} | node tools/secure_generate.js
```

```bash
echo {"workspaceRoot":".","targetPath":"."} | node tools/securability_review.js
```

```bash
echo {"workspaceRoot":".","prdPath":"docs/prd.md","asvsLevel":2} | node tools/prd_securability_enhance.js
```

## Limitations

1. SSEM scores are heuristic estimates based on static text signals and code shape. Validate with manual engineering review.
2. Full semantic code review requires language-aware AST parsers and dynamic analysis beyond what this module provides.
3. ASVS requirement mapping uses text-similarity heuristics; requirement-by-requirement traceability requires manual validation.
