# Securable OpenCode Module

OpenCode-compatible conversion of the original Claude Code plugin in this repository.

This module preserves the original capabilities:
- Securability engineering review (language-aware FIASSE/SSEM scoring workflow)
- Securable code generation wrapper (constraint-driven generation contract)
- PRD securability enhancement (requirement-level ASVS + SSEM + FIASSE annotations)
- FIASSE reference lookup by topic

## Module Layout

```text
opencode-module/
  config.json
  tools/
    fiasse_lookup.js
    securability_review.js
    secure_generate.js
    prd_securability_enhance.js
    lib/
      common.js
  workflows/
    fiasse-lookup.workflow.json
    securability-review.workflow.json
    secure-generate.workflow.json
    prd-securability-enhance.workflow.json
  scripts/
    run-workflow.js
  README.md
```

## Install

1. Ensure Node.js 18+ is available.
2. Keep this module in the same repository root so it can read `data/fiasse` and `data/asvs`.
3. No external dependencies are required.

## Run Workflows

All workflows are executed via:

```bash
node opencode-module/scripts/run-workflow.js <workflow-id> <input-json-file>
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
  "targetPath": "skills"
}
```

Review output includes `languageBreakdown` with per-language function/class and control-signal hints.

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
  "prdPath": "examples/prd-enhancement/input-prd.md",
  "asvsLevel": 2,
  "maxRequirementsPerFeature": 6
}
```

PRD enhancement output now includes concrete ASVS requirement IDs (for example `V2.1.1`) per detected feature.

## Call Tools Directly

Each tool accepts JSON from stdin and emits JSON to stdout:

```bash
echo {"topic":"transparency"} | node opencode-module/tools/fiasse_lookup.js
```

```bash
echo {"request":"Build a secure file upload handler","language":"Python"} | node opencode-module/tools/secure_generate.js
```

```bash
echo {"workspaceRoot":".","targetPath":"."} | node opencode-module/tools/securability_review.js
```

```bash
echo {"workspaceRoot":".","prdPath":"examples/prd-enhancement/input-prd.md","asvsLevel":2} | node opencode-module/tools/prd_securability_enhance.js
```

## Claude Plugin to OpenCode Mapping

| Claude Artifact | OpenCode Artifact | Notes |
| --- | --- | --- |
| `skills/securability-engineering-review/SKILL.md` | `tools/securability_review.js` + `workflows/securability-review.workflow.json` | Skill logic converted to callable tool and workflow |
| `skills/securability-engineering/SKILL.md` | `tools/secure_generate.js` + `workflows/secure-generate.workflow.json` | Generation constraints surfaced as generation contract |
| `skills/prd-securability-enhancement/SKILL.md` | `tools/prd_securability_enhance.js` + `workflows/prd-securability-enhance.workflow.json` | Play logic converted to enhancement workflow |
| `plays/code-analysis/securability-engineering-review.md` | `workflows/securability-review.workflow.json` | Multi-step review flow converted |
| `plays/requirements-analysis/prd-fiasse-asvs-enhancement.md` | `workflows/prd-securability-enhance.workflow.json` | Feature-by-feature enhancement flow converted |
| `.claude/commands/securability-review.md` | Command `securability-review` in `config.json` | Slash command translated to workflow command |
| `.claude/commands/secure-generate.md` | Command `secure-generate` in `config.json` | Slash command translated to workflow command |
| `.claude/commands/prd-securability-enhance.md` | Command `prd-securability-enhance` in `config.json` | Slash command translated to workflow command |
| `.claude/commands/fiasse-lookup.md` | Command `fiasse-lookup` in `config.json` | Slash command translated to workflow command |
| Claude/MCP tool protocol assumptions | `config.json` tool registry + local executable tool scripts | MCP binding removed |
| Anthropic-specific role semantics | `agentMessageFormat` in `config.json` | Replaced with generic OpenCode JSON message roles |

## Removed Claude-Specific Elements

- No Anthropic API usage.
- No MCP server bindings.
- No Claude extension manifest fields.
- No Claude-only message role payloads.

## Feature Gaps and Recommended Alternatives

1. Exact MCP runtime parity is not possible without the target OpenCode host's proprietary runtime contracts.
Alternative: use `config.json` + workflow runner here as an adapter layer, then bind host-specific adapters in your OpenCode runtime.

2. Full semantic code review requires language-aware parsers and dynamic analysis.
Alternative: integrate AST analyzers and test runners as additional OpenCode tools, while keeping current SSEM workflow structure intact.

3. Requirement-level ASVS mapping is heuristic in current converter tool.
Alternative: add a dedicated parser that reads chapter requirement IDs from `data/asvs/V*.md` and enforces requirement-by-requirement traceability.
