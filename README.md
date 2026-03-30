# Securable OpenCode Module

An OpenCode-compatible module that provides securability engineering tools via MCP (Model Context Protocol).

Capabilities:
- **Securability engineering review** — language-aware FIASSE/SSEM scoring workflow
- **Securable code generation** — constraint-driven generation contract wrapper
- **PRD securability enhancement** — requirement-level ASVS + SSEM + FIASSE annotations
- **FIASSE reference lookup** — topic keyword and section identifier search

## Module Layout

```text
opencode.json              ← OpenCode configuration (MCP + commands + agents)
instructions.md            ← Agent instructions loaded by OpenCode
tools/
  mcp_server.js            ← MCP server exposing all tools (JSON-RPC 2.0 / stdio)
  fiasse_lookup.js         ← FIASSE/SSEM reference lookup
  securability_review.js   ← SSEM scoring and review
  secure_generate.js       ← Securability-constrained generation contract
  prd_securability_enhance.js ← PRD enhancement with ASVS mapping
  lib/
    common.js              ← Shared helpers (zero external deps)
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

Place this module in your project root. OpenCode reads `opencode.json` and:

1. **Starts the MCP server** — exposing four tools to the agent
2. **Loads instructions** — from `instructions.md`
3. **Registers commands** — `/securability-review`, `/secure-generate`, `/fiasse-lookup`, `/prd-enhance`
4. **Registers agents** — `securability-reviewer` (read-only analysis agent)

### MCP Tools

| Tool | Description |
|------|-------------|
| `fiasse_lookup` | Look up FIASSE/SSEM sections by topic or section id |
| `securability_review` | Score code against 9 SSEM attributes across 3 pillars |
| `secure_generate` | Generate a securability-constrained code generation contract |
| `prd_securability_enhance` | Enhance PRD features with ASVS + FIASSE/SSEM annotations |

### Commands

Run these from the OpenCode prompt:

| Command | Description |
|---------|-------------|
| `/securability-review` | Run SSEM analysis on the current workspace |
| `/secure-generate` | Run end-to-end securable generation: PRD enhancement, FIASSE-guided implementation, review execution, and final scoring |
| `/fiasse-lookup` | Look up FIASSE/SSEM reference material |
| `/prd-enhance` | Annotate a PRD with ASVS + FIASSE/SSEM |

### Agents

| Agent | Description |
|-------|-------------|
| `securability-reviewer` | Read-only agent that can analyze but not edit files |

## Direct Tool Usage

Each tool also accepts JSON from stdin and emits JSON to stdout:

```bash
echo '{"topic":"transparency"}' | node tools/fiasse_lookup.js
echo '{"request":"Build a secure file upload handler","language":"Python"}' | node tools/secure_generate.js
echo '{"workspaceRoot":".","targetPath":"."}' | node tools/securability_review.js
echo '{"workspaceRoot":".","prdPath":"docs/prd.md","asvsLevel":2}' | node tools/prd_securability_enhance.js
```

## Limitations

1. SSEM scores are heuristic estimates based on static text signals and code shape. Validate with manual engineering review.
2. Full semantic code review requires language-aware AST parsers and dynamic analysis beyond what this module provides.
3. ASVS requirement mapping uses text-similarity heuristics; requirement-by-requirement traceability requires manual validation.
