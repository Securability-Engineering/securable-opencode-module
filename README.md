# Securable Engineering — OpenCode Module

An OpenCode-compatible module for secure code generation and securability analysis using the FIASSE/SSEM framework. Converted from the [securable-claude-plugin](https://github.com/Xcaciv/securable-claude-plugin).

## Overview

This module augments OpenCode with two capabilities:

1. **Securability Engineering Review** — Analyze existing code for securable qualities using the nine SSEM attributes across three pillars (Maintainability, Trustworthiness, Reliability), producing scored assessments with actionable findings.
2. **Securability Engineering Code Generation** — Generate new code that embodies securable qualities by default, applying FIASSE principles as engineering constraints.

## Installation

### 1. Clone or copy the module

```bash
# Clone the repository
git clone https://github.com/Xcaciv/securable-claude-plugin.git

# The OpenCode module is in the opencode-module/ directory
cd securable-claude-plugin/opencode-module
```

### 2. Copy into your project

Copy or symlink the `opencode-module/` directory into your project root, or merge the `opencode.json` configuration into your existing OpenCode config:

```bash
# Option A: Copy the entire module into your project
cp -r opencode-module/ /path/to/your/project/.securable/

# Option B: Symlink
ln -s /path/to/opencode-module /path/to/your/project/.securable
```

### 3. Configure OpenCode

Merge the contents of `opencode.json` into your project's OpenCode configuration. If you don't have an existing config, copy it directly:

```bash
cp opencode.json /path/to/your/project/opencode.json
```

If you already have an `opencode.json`, add the `securable` MCP server entry to your existing `mcpServers` section:

```json
{
  "mcpServers": {
    "securable": {
      "command": "python",
      "args": ["./.securable/tools/mcp_server.py"],
      "env": {
        "SECURABLE_DATA_DIR": "./.securable/data",
        "SECURABLE_TEMPLATES_DIR": "./.securable/templates",
        "SECURABLE_WORKFLOWS_DIR": "./.securable/workflows"
      }
    }
  }
}
```

Also add the instructions reference:

```json
{
  "instructions": "./.securable/instructions.md"
}
```

### 4. Verify Python is available

The MCP server requires Python 3.10+. No external packages are needed — the server uses only the Python standard library.

```bash
python --version  # Should be 3.10+
```

## Tools

### `securability_review`

Loads the complete SSEM securability engineering review workflow for analyzing code.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `target` | string | No | Description of the code/system being reviewed |
| `focus` | string | No | Focus area: `maintainability`, `trustworthiness`, `reliability`, or specific attributes |

**Example invocation:**
> "Run a securability review on the authentication module, focusing on trustworthiness"

**Returns:** The full review workflow procedure, scoring framework, finding template, report template, and relevant FIASSE reference sections.

### `secure_generate`

Loads FIASSE/SSEM code generation constraints for producing inherently securable code.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `feature` | string | No | Description of the feature/code to generate |
| `language` | string | No | Target programming language/framework |
| `context` | string | No | Additional context (data sensitivity, exposure, system type) |

**Example invocation:**
> "Generate a securable REST API endpoint for user registration in Python/FastAPI"

**Returns:** SSEM attribute enforcement rules, trust boundary handling guidance, generation checklist, foundational principles, and relevant FIASSE/ASVS reference data.

### `fiasse_lookup`

Looks up FIASSE/SSEM/ASVS reference material by topic or section identifier.

**Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `query` | string | No | Search topic (e.g., "integrity", "trust boundary", "input validation") |
| `section` | string | No | Specific section ID (e.g., `S3.2.1`, `V6.2`, `S6.4`) |

**Example invocations:**
> "Look up the FIASSE definition of integrity"
> "Show me ASVS section V6.2 on password security"

**Returns:** Matching FIASSE/SSEM/ASVS section content with metadata.

## Workflows

### Securability Engineering Review

Located at `workflows/securability-engineering-review.md`, this is the complete step-by-step procedure for performing an SSEM securability assessment. The `securability_review` tool loads this automatically.

**Steps:**
1. Scope & Context
2. SSEM Attribute Assessment — Maintainability (Analyzability, Modifiability, Testability)
3. SSEM Attribute Assessment — Trustworthiness (Confidentiality, Accountability, Authenticity)
4. SSEM Attribute Assessment — Reliability (Availability, Integrity, Resilience)
5. Transparency Assessment
6. Code-Level Threat Identification
7. Dependency Securability
8. Produce Findings (scored, with SSEM attribution)

**Output:**
- Part 1: SSEM Score Summary (overall score, pillar breakdowns)
- Part 2: Detailed Findings per pillar
- Part 3: 45-item Evaluation Checklist

## SSEM Model

| **Maintainability** | **Trustworthiness** | **Reliability** |
|:---------------------|:--------------------:|----------------:|
| Analyzability        | Confidentiality      | Availability    |
| Modifiability        | Accountability       | Integrity       |
| Testability          | Authenticity         | Resilience      |

Each attribute is scored 0–10. Pillar scores are weighted averages. The overall SSEM score is the average of the three pillar scores.

## Project Structure

```
opencode-module/
├── opencode.json                        # OpenCode configuration (MCP server + instructions)
├── instructions.md                      # System instructions loaded by OpenCode
├── tools/
│   └── mcp_server.py                   # MCP tool server (stdio JSON-RPC)
├── workflows/
│   └── securability-engineering-review.md  # Full review procedure
├── data/
│   ├── fiasse/                          # FIASSE RFC reference sections (S2.x–S8.x)
│   │   ├── README.md
│   │   ├── S2.1.md ... S8.2.md
│   └── asvs/                            # OWASP ASVS 5.0 sections (V1.x–V17.x)
│       ├── README.md
│       ├── V1.1.md ... V17.3.md
├── templates/
│   ├── finding.md                       # Individual finding format
│   └── report.md                        # Full assessment report format
├── scripts/
│   └── extract_fiasse_sections.py       # Utility to extract sections from FIASSE RFC
└── README.md                            # This file
```

## Mapping: Claude Code Plugin → OpenCode Module

| Claude Code Concept | OpenCode Equivalent | Location |
|---------------------|---------------------|----------|
| `CLAUDE.md` (entry point) | `instructions.md` (system instructions) | `instructions.md` |
| Skills (`skills/*/SKILL.md`) | MCP tool definitions in server | `tools/mcp_server.py` |
| Plays (`plays/code-analysis/*.md`) | Workflow documents | `workflows/` |
| Slash commands (`/securability-review`) | MCP tool: `securability_review` | `tools/mcp_server.py` |
| Slash commands (`/secure-generate`) | MCP tool: `secure_generate` | `tools/mcp_server.py` |
| Slash commands (`/fiasse-lookup`) | MCP tool: `fiasse_lookup` | `tools/mcp_server.py` |
| FIASSE data (`data/fiasse/`) | Same (copied) | `data/fiasse/` |
| ASVS data (`data/asvs/`) | Same (copied) | `data/asvs/` |
| Templates (`templates/`) | Same (copied) | `templates/` |
| Claude-specific YAML frontmatter in skills | Tool `inputSchema` in MCP server | `tools/mcp_server.py` |
| Claude Code extension manifest | `opencode.json` | `opencode.json` |
| Anthropic message roles | Removed; standard MCP JSON-RPC protocol | `tools/mcp_server.py` |

## Architecture Notes

### What Changed

1. **Skills → MCP Tools**: The two Claude Code skills (`securability-engineering-review` and `securability-engineering`) are now exposed as MCP tools (`securability_review` and `secure_generate`) via a Python stdio server. The skill logic (constraints, checklists, enforcement rules) is embedded in the tool handlers.

2. **Plays → Workflows**: The play document (`securability-engineering-review.md`) is preserved as-is in `workflows/` and loaded by the `securability_review` tool when invoked.

3. **Slash Commands → MCP Tools**: The three Claude Code slash commands are now MCP tools callable by OpenCode's agent loop.

4. **System Prompt → Instructions**: `CLAUDE.md` is replaced by `instructions.md` with Claude-specific references removed and OpenCode-compatible framing.

5. **No Claude-Specific Dependencies**: The MCP server uses only Python standard library. No Anthropic SDK, no Claude-specific message formats.

### What's Preserved

- All FIASSE/SSEM reference data (35 sections)
- All OWASP ASVS 5.0 data (80 sections)
- Full review workflow with scoring rubrics and checklists
- Code generation constraints with SSEM attribute enforcement
- Finding and report templates
- FIASSE section extraction utility script
- YAML frontmatter search for topic-based lookups

## References

- [FIASSE RFC](https://github.com/Xcaciv/securable_software_engineering/blob/main/docs/FIASSE-RFC.md) — Framework for Integrating Application Security into Software Engineering
- [Xcaciv/securable_software_engineering](https://github.com/Xcaciv/securable_software_engineering) — Source repository
- [OpenCode](https://opencode.ai) — Terminal-based AI coding assistant

## License

CC-BY-4.0 — See [LICENSE](../LICENSE)
