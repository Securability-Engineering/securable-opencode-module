# Claude Code Plugin → OpenCode Module Conversion Prompt

Copy-paste the prompt below when you need an AI agent to convert a different Claude Code plugin into a self-contained OpenCode module.

---

## Reusable Conversion Prompt

```
You are converting a Claude Code plugin into a self-contained OpenCode module.

## Source plugin structure to read first
- `CLAUDE.md` — entry point; lists skills, plays, commands, data directories
- `.claude/commands/*.md` — each file is one slash-command: read its name, description, and procedure
- `skills/<name>/SKILL.md` — skill definitions: trigger conditions, input/output contracts, references to plays
- `plays/**/*.md` — step-by-step procedures that skills execute
- `data/` — static reference data (JSON, Markdown, YAML) read at runtime by skill logic
- `templates/` — output format templates the skills produce

## Target output: `opencode-module/`
Create exactly this layout:

```
opencode-module/
  config.json               ← module registry (see schema below)
  README.md                 ← installation + CLI usage
  tools/<skill_name>.js     ← one Node.js script per skill/command
  tools/lib/common.js       ← shared helpers (no external deps)
  workflows/<name>.workflow.json  ← one workflow per command/skill
  scripts/run-workflow.js   ← CLI orchestrator
```

## Tool script rules
- Runtime: Node.js ≥ 18, CommonJS (`require`), zero npm dependencies
- Contract: read JSON from stdin (`process.stdin`), write JSON to stdout (`process.stdout`)
- Input/output shapes must match the skill's stated contract
- Read reference data files from `data/` using `path.resolve(workspaceRoot, 'data/...')`
- Export `{ok: true, ...result}` on success; `{ok: false, error: "..."}` on failure
- No Anthropic/Claude SDK calls — all logic is pure computation or file I/O

## `tools/lib/common.js` must expose
- `readJsonFromStdin()` → Promise<object>
- `writeJson(obj)` → void (writes to stdout)
- `normalizeWorkspaceRoot(input)` → string (resolves cwd if blank)
- `listFilesRecursively(dir, exts[])` → string[] (skips node_modules/.git)
- `extractYamlFrontmatter(text)` → {meta, body} (parses ---...--- block)
- `clamp(n, lo, hi)` → number

## Workflow JSON schema
```json
{
  "id": "<workflow-id>",
  "description": "...",
  "steps": [
    { "id": "...", "type": "require_input",  "field": "fieldName", "prompt": "..." },
    { "id": "...", "type": "tool",           "toolId": "...", "input": {"key": "{{input.field}}"} },
    { "id": "...", "type": "branch",         "path": "steps.<id>.ok", "equals": true, "onMismatch": "stop" },
    { "id": "...", "type": "emit",           "output": {"key": "$steps.<id>.field"} }
  ]
}
```
Step type rules:
- `require_input` — gate on a required user input field; skip if already provided
- `tool` — invoke a tool script; result fields available as `$steps.<id>.<field>`
- `branch` — evaluate a boolean path; `onMismatch: "stop"` halts with a reason message
- `emit` — collect final output fields from prior step results using `$steps.<id>.<field>` paths

## `config.json` schema
```json
{
  "module":  { "id": "...", "name": "...", "version": "...", "runtime": "node>=18" },
  "agentMessageFormat": { "schema": "opencode-agent-message-v1", "roles": ["system","agent","user","tool"] },
  "paths":   { "tools": "tools", "workflows": "workflows", "scripts": "scripts" },
  "tools":   [ { "id": "...", "script": "tools/x.js", "invocation": { "input": {}, "output": {} }, "mappedFrom": {} } ],
  "workflows": [ { "id": "...", "file": "workflows/x.workflow.json", "mappedFrom": {} } ],
  "commands":  [ { "name": "/x", "workflowId": "...", "mappedFrom": { "claudeCommand": "/x" } } ]
}
```
`mappedFrom` records the original Claude artifact (skill name, play path, command name) for traceability.

## `scripts/run-workflow.js` rules
- Usage: `node scripts/run-workflow.js <workflowId> [input.json]`
- Load workflow JSON from `workflows/<id>.workflow.json`
- Loop steps in order; dispatch by `step.type`
- Interpolate `{{input.field}}` in tool inputs before calling the tool script
- Resolve `$steps.<id>.<field>` paths in emit outputs
- Call tool scripts as child processes or inline `require()` with JSON on stdin
- Exit 0 on success, 1 on error

## Validation
After generating all files, run each workflow with a minimal input JSON to confirm:
1. `node scripts/run-workflow.js <id> input.json` exits 0
2. Stdout contains valid JSON with `ok: true`
3. The primary output field (scores, matches, contract, enhancedPrd, etc.) is non-empty

## What to strip / not carry over
- All Anthropic/Claude SDK imports, MCP server wrappers, and tool_use message formats
- `.claude/` directory references (settings, permissions, ignore files)
- Role-specific message payloads (Anthropic `role: "assistant"` / `"user"` wrapping)
- Agent-loop logic (tools call themselves back) — each tool is stateless and terminal

## README.md must include
- Module overview (one paragraph)
- Prerequisites (Node ≥ 18, no npm install needed)
- CLI usage examples for every workflow
- A mapping table: Original Claude artifact → OpenCode equivalent
```

---

## Applied example (this repo)

This module (`opencode-module/`) was created using the prompt above from the `securable-claude-plugin`.

| Claude Artifact | OpenCode Equivalent |
|---|---|
| `/fiasse-lookup` command | `tools/fiasse_lookup.js` + `workflows/fiasse-lookup.workflow.json` |
| `skills/securability-engineering-review` + play | `tools/securability_review.js` + `workflows/securability-review.workflow.json` |
| `skills/securability-engineering` | `tools/secure_generate.js` + `workflows/secure-generate.workflow.json` |
| `skills/prd-securability-enhancement` + play | `tools/prd_securability_enhance.js` + `workflows/prd-securability-enhance.workflow.json` |

Key implementation notes recorded from the actual conversion:

- **ASVS requirement parsing**: `data/asvs/V*.md` files contain Markdown tables with rows like `| 2.1.1 | Verify that… | 1 |`. Parse with regex `\|\s*([\d.]+)\s*\|([^|]+)\|.*?(\d+)\s*\|` to get `{id, description, level}`.
- **Language-aware review**: Detect language by file extension (`.js/.ts/.py/.java/.cs/.go/.rs/.cpp`), then apply per-language regex patterns for validation, authentication, and error-handling hints rather than a single generic set.
- **SSEM score weights** used: maintainability (analyzability 0.4, modifiability 0.3, testability 0.3), trustworthiness (confidentiality 0.35, accountability 0.3, authenticity 0.35), reliability (availability 0.25, integrity 0.35, resilience 0.4).
- **Token overlap scoring** for PRD→ASVS mapping: tokenize each PRD feature sentence and each ASVS requirement description, compute intersection size, divide by `sqrt(featureTokens * reqTokens)`, filter to matching ASVS level.
