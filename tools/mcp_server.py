#!/usr/bin/env python3
"""
Securable Engineering MCP Server for OpenCode.

Provides three tools via the Model Context Protocol (MCP) over stdio:
  - securability_review: Load the full SSEM review workflow and relevant data
  - secure_generate: Load FIASSE/SSEM code generation constraints
  - fiasse_lookup: Look up FIASSE/SSEM/ASVS reference material by topic or section

This server reads reference data from the local data/ directory and returns
structured content that the AI agent uses to perform securability analysis
and code generation.

Requires: pip install mcp
"""

import json
import os
import re
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Resolve data directories relative to this script
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("SECURABLE_DATA_DIR", SCRIPT_DIR / "data"))
TEMPLATES_DIR = Path(os.environ.get("SECURABLE_TEMPLATES_DIR", SCRIPT_DIR / "templates"))
WORKFLOWS_DIR = Path(os.environ.get("SECURABLE_WORKFLOWS_DIR", SCRIPT_DIR / "workflows"))

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _read_file(path: Path) -> str:
    """Read a text file, returning empty string if not found."""
    try:
        return path.read_text(encoding="utf-8")
    except (FileNotFoundError, PermissionError):
        return ""


def _read_yaml_frontmatter(text: str) -> dict:
    """Extract YAML frontmatter from markdown text as a dict (simple parser)."""
    if not text.startswith("---"):
        return {}
    end = text.find("---", 3)
    if end == -1:
        return {}
    fm_text = text[3:end].strip()
    result = {}
    current_key = None
    current_list = None
    for line in fm_text.splitlines():
        stripped = line.strip()
        if stripped.startswith("- ") and current_key:
            if current_list is None:
                current_list = []
                result[current_key] = current_list
            current_list.append(stripped[2:].strip().strip('"').strip("'"))
        elif ":" in stripped:
            parts = stripped.split(":", 1)
            key = parts[0].strip()
            val = parts[1].strip().strip('"').strip("'")
            current_key = key
            current_list = None
            if val:
                result[key] = val
        elif stripped:
            if current_key and current_key in result and isinstance(result[current_key], str):
                result[current_key] += " " + stripped.strip('"').strip("'")
    return result


def _list_data_files(subdir: str) -> list[Path]:
    """List all .md files in a data subdirectory, sorted."""
    d = DATA_DIR / subdir
    if not d.is_dir():
        return []
    return sorted(d.glob("*.md"))


def _search_data_files(subdir: str, query: str) -> list[tuple[Path, dict, str]]:
    """
    Search data files in a subdirectory for a query string.
    Returns list of (path, frontmatter, content) tuples where
    the query matches the title, when_to_use, summary, ssem_attributes,
    or section content (case-insensitive).
    """
    results = []
    query_lower = query.lower()
    query_terms = [t.strip() for t in re.split(r"[,\s]+", query_lower) if t.strip()]

    for path in _list_data_files(subdir):
        text = _read_file(path)
        fm = _read_yaml_frontmatter(text)

        # Build searchable text from frontmatter fields
        searchable_parts = [
            fm.get("title", ""),
            fm.get("summary", ""),
            fm.get("fiasse_section", ""),
            fm.get("asvs_chapter", ""),
        ]
        for attr in fm.get("ssem_attributes", []) if isinstance(fm.get("ssem_attributes"), list) else []:
            searchable_parts.append(attr)
        for use in fm.get("when_to_use", []) if isinstance(fm.get("when_to_use"), list) else []:
            searchable_parts.append(use)
        for threat in fm.get("threats", []) if isinstance(fm.get("threats"), list) else []:
            searchable_parts.append(threat)

        searchable = " ".join(searchable_parts).lower()

        # Check if any query term matches frontmatter or content
        content_lower = text.lower()
        if any(term in searchable or term in content_lower for term in query_terms):
            results.append((path, fm, text))

    return results


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

def securability_review(target: str = "", focus: str = "") -> str:
    """
    Load the full SSEM securability engineering review workflow.
    Returns the complete review procedure, scoring framework,
    finding template, and report template.

    Args:
        target: Description of the code/system being reviewed
        focus: Optional focus area (e.g., "maintainability", "trustworthiness",
               "reliability", or specific attributes like "integrity")
    """
    sections = []

    # 1. Load the review workflow
    workflow_path = WORKFLOWS_DIR / "securability-engineering-review.md"
    workflow = _read_file(workflow_path)
    if workflow:
        sections.append("# REVIEW WORKFLOW\n\n" + workflow)
    else:
        sections.append("# REVIEW WORKFLOW\n\n[Workflow file not found at: "
                        f"{workflow_path}]")

    # 2. Load finding template
    finding_template = _read_file(TEMPLATES_DIR / "finding.md")
    if finding_template:
        sections.append("# FINDING TEMPLATE\n\n" + finding_template)

    # 3. Load report template
    report_template = _read_file(TEMPLATES_DIR / "report.md")
    if report_template:
        sections.append("# REPORT TEMPLATE\n\n" + report_template)

    # 4. Load relevant FIASSE reference sections
    core_sections = ["S3.1.md", "S3.2.1.md", "S3.2.2.md", "S3.2.3.md",
                     "S3.3.1.md", "S3.4.1.md", "S3.4.2.md", "S3.4.3.md"]

    # If a focus area is specified, prioritize relevant sections
    if focus:
        focus_lower = focus.lower()
        focus_map = {
            "maintainability": ["S3.2.1.md", "S3.4.1.md"],
            "analyzability": ["S3.2.1.md", "S3.4.1.md"],
            "modifiability": ["S3.2.1.md", "S3.4.1.md"],
            "testability": ["S3.2.1.md", "S3.4.1.md"],
            "trustworthiness": ["S3.2.2.md", "S3.4.2.md"],
            "confidentiality": ["S3.2.2.md", "S3.4.2.md"],
            "accountability": ["S3.2.2.md", "S3.4.2.md"],
            "authenticity": ["S3.2.2.md", "S3.4.2.md"],
            "reliability": ["S3.2.3.md", "S3.4.3.md"],
            "availability": ["S3.2.3.md", "S3.4.3.md"],
            "integrity": ["S3.2.3.md", "S3.4.3.md", "S6.4.md"],
            "resilience": ["S3.2.3.md", "S3.4.3.md", "S6.3.md", "S6.4.md"],
            "transparency": ["S2.6.md", "S3.3.1.md"],
            "trust boundary": ["S6.3.md", "S6.4.md"],
            "dependency": ["S4.1.md", "S6.5.md"],
        }
        for key, files in focus_map.items():
            if key in focus_lower:
                for f in files:
                    if f not in core_sections:
                        core_sections.append(f)

    fiasse_content = []
    for fname in core_sections:
        content = _read_file(DATA_DIR / "fiasse" / fname)
        if content:
            fiasse_content.append(content)

    if fiasse_content:
        sections.append(
            "# FIASSE REFERENCE DATA\n\n" + "\n\n---\n\n".join(fiasse_content)
        )

    # Build context header
    header = "# SECURABILITY ENGINEERING REVIEW CONTEXT\n\n"
    if target:
        header += f"**Target**: {target}\n"
    if focus:
        header += f"**Focus**: {focus}\n"
    header += "\nUse the workflow below to perform a structured SSEM assessment.\n"

    return header + "\n\n---\n\n".join(sections)


def secure_generate(feature: str = "", language: str = "", context: str = "") -> str:
    """
    Load FIASSE/SSEM code generation constraints for securable code output.
    Returns the complete set of engineering constraints, SSEM attribute
    enforcement rules, trust boundary handling, and generation checklist.

    Args:
        feature: Description of the feature/code to generate
        language: Target programming language/framework
        context: Additional context (data sensitivity, exposure, etc.)
    """
    sections = []

    # 1. Build context header
    header = "# SECURABILITY ENGINEERING — CODE GENERATION CONSTRAINTS\n\n"
    if feature:
        header += f"**Feature**: {feature}\n"
    if language:
        header += f"**Language/Framework**: {language}\n"
    if context:
        header += f"**Context**: {context}\n"
    header += ("\nApply all FIASSE/SSEM constraints below when generating code. "
               "The output must embody securable qualities from the start.\n")
    sections.append(header)

    # 2. Foundational Principles
    principles = []
    for sid in ["S2.1.md", "S2.2.md", "S2.3.md", "S2.4.md", "S2.6.md"]:
        content = _read_file(DATA_DIR / "fiasse" / sid)
        if content:
            principles.append(content)
    if principles:
        sections.append(
            "# FOUNDATIONAL PRINCIPLES\n\n" + "\n\n---\n\n".join(principles)
        )

    # 3. SSEM Attribute Enforcement Rules
    ssem_constraints = """# SSEM ATTRIBUTE ENFORCEMENT RULES

Every code generation output must satisfy these nine attributes.

## Maintainability (S3.2.1)

| Attribute | Enforcement Rule |
|-----------|-----------------|
| **Analyzability** | Methods ≤ 30 LoC. Cyclomatic complexity < 10. Clear, descriptive naming. No dead code. Comments at trust boundaries and complex logic explaining *why*. |
| **Modifiability** | Loose coupling via interfaces/dependency injection. No static mutable state. Security-sensitive logic (auth, crypto, validation) centralized in dedicated modules, not scattered. Configuration externalized. |
| **Testability** | All public interfaces testable without modifying the code under test. Dependencies injectable/mockable. Security controls (auth, validation, crypto) isolated for dedicated test suites. |

## Trustworthiness (S3.2.2)

| Attribute | Enforcement Rule |
|-----------|-----------------|
| **Confidentiality** | Sensitive data classified and handled at the type level. Least-privilege data access. No secrets in code, logs, or error messages. Encryption at rest and in transit where applicable. Data minimization — collect and retain only what is needed. |
| **Accountability** | Security-sensitive actions logged with structured data (who, what, where, when). Audit trails append-only. Auth events (login, logout, failure) and authz decisions (grant, deny) recorded. No sensitive data in logs. |
| **Authenticity** | Use established authentication mechanisms. Verify token/session integrity (signed JWTs, secure cookies). Mutually authenticate service-to-service calls. Support non-repudiation — link actions irrefutably to entities. |

## Reliability (S3.2.3)

| Attribute | Enforcement Rule |
|-----------|-----------------|
| **Availability** | Enforce resource limits (memory, connections, file handles). Configure timeouts for all external calls. Rate-limit where appropriate. Thread-safe design for concurrent code. Graceful degradation for non-critical failures. |
| **Integrity** | Validate input at every trust boundary: canonicalize → sanitize → validate (S6.4.1). Output-encode when crossing trust boundaries. Use parameterized queries exclusively. Apply the **Derived Integrity Principle** (S6.4.1.1): never accept client-supplied values for server-owned state. Apply **Request Surface Minimization** (S6.4.1.1): extract only specific expected values from requests. |
| **Resilience** | Defensive coding: anticipate out-of-bounds input and handle gracefully. Specific exception handling (no bare catch-all). Sandbox nulls to input checks and DB communication. Use immutable data structures in concurrent code. Ensure no resource leaks — proper disposal patterns. Graceful degradation under load. |

## Trust Boundary Handling (S6.3)

Apply the **Turtle Analogy**: hard shell at trust boundaries, flexible interior.

- Identify trust boundaries in the generated code (user input, API calls, DB queries, file I/O, service-to-service)
- Apply strict input handling (canonicalization → sanitization → validation) at every boundary entry point
- Log trust boundary crossings with validation outcomes
- Keep interior logic flexible — strict control belongs at the boundary, not everywhere
"""
    sections.append(ssem_constraints)

    # 4. Generation Checklist
    checklist = """# GENERATION CHECKLIST

Before returning generated code, verify against this checklist:

**Maintainability:**
- [ ] Functions ≤ 30 LoC, cyclomatic complexity < 10
- [ ] No static mutable state; dependencies injected
- [ ] Security logic centralized, not duplicated
- [ ] Testable without modifying code under test

**Trustworthiness:**
- [ ] No secrets, PII, or tokens in code, logs, or error output
- [ ] Auth/authz events logged with structured data
- [ ] Authentication uses established mechanisms
- [ ] Data access follows least privilege

**ASVS Feature Requirements:**
- [ ] Relevant ASVS chapter(s) in data/asvs/ were identified for the feature
- [ ] Applicable ASVS requirements were translated into implementation constraints
- [ ] Generated code satisfies the relevant ASVS requirement intent

**Reliability:**
- [ ] Input validated at every trust boundary (canonicalize → sanitize → validate)
- [ ] Derived Integrity Principle applied (server-owned state not client-supplied)
- [ ] Request Surface Minimization applied (only expected values extracted)
- [ ] Specific exception handling with meaningful messages; no bare catch-all
- [ ] Resource limits, timeouts, and disposal patterns in place

**Dependency Choice (Supply Chain Hygiene):**
- [ ] External libraries are necessary (no avoidable dependency added)
- [ ] Selected versions are latest stable compatible releases
- [ ] Selected packages have low known CVE/CWE exposure
- [ ] Packages show active maintenance
- [ ] Versions are pinned and lockfile usage is included

**Transparency:**
- [ ] Meaningful naming conventions; self-documenting code
- [ ] Structured logging at trust boundaries and security events
- [ ] Audit trail hooks for security-sensitive actions

## Output

Generated code that embodies FIASSE securable qualities. When the generation is non-trivial, include a brief **Securability Notes** section after the code listing which SSEM attributes were actively enforced, applicable ASVS chapter or requirement references, dependency-selection rationale, and any trade-offs made.
"""
    sections.append(checklist)

    # 5. Load relevant FIASSE data
    fiasse_refs = []
    for sid in ["S3.2.1.md", "S3.2.2.md", "S3.2.3.md", "S3.3.1.md",
                "S6.3.md", "S6.4.md"]:
        content = _read_file(DATA_DIR / "fiasse" / sid)
        if content:
            fiasse_refs.append(content)
    if fiasse_refs:
        sections.append(
            "# FIASSE REFERENCE DATA\n\n" + "\n\n---\n\n".join(fiasse_refs)
        )

    # 6. Load ASVS index for feature mapping
    asvs_readme = _read_file(DATA_DIR / "asvs" / "README.md")
    if asvs_readme:
        sections.append("# ASVS CHAPTER INDEX\n\n" + asvs_readme)

    return "\n\n---\n\n".join(sections)


def fiasse_lookup(query: str, section: str = "") -> str:
    """
    Look up FIASSE/SSEM/ASVS reference material by topic or section identifier.

    Args:
        query: Search topic (e.g., "integrity", "trust boundary", "input validation",
               "dependency management", "transparency")
        section: Optional specific section ID (e.g., "S3.2.1", "V6.2", "S6.4")
    """
    results = []

    # If a specific section is requested, load it directly
    if section:
        section_clean = section.strip().upper()
        # Try FIASSE section
        if section_clean.startswith("S"):
            path = DATA_DIR / "fiasse" / f"{section_clean}.md"
            content = _read_file(path)
            if content:
                results.append(f"## FIASSE {section_clean}\n\n{content}")
        # Try ASVS chapter
        elif section_clean.startswith("V"):
            path = DATA_DIR / "asvs" / f"{section_clean}.md"
            content = _read_file(path)
            if content:
                results.append(f"## ASVS {section_clean}\n\n{content}")
        # Try both
        else:
            for prefix, subdir, label in [("S", "fiasse", "FIASSE"),
                                           ("V", "asvs", "ASVS")]:
                path = DATA_DIR / subdir / f"{prefix}{section_clean}.md"
                content = _read_file(path)
                if content:
                    results.append(f"## {label} {prefix}{section_clean}\n\n{content}")

    # Search by query across both FIASSE and ASVS data
    if query:
        for subdir, label in [("fiasse", "FIASSE"), ("asvs", "ASVS")]:
            matches = _search_data_files(subdir, query)
            for path, fm, content in matches:
                title = fm.get("title", path.stem)
                sid = fm.get("fiasse_section", fm.get("asvs_chapter", path.stem))
                if f"## {label} {sid}" not in "\n".join(results):
                    results.append(f"## {label} — {title}\n\n{content}")

    if not results:
        return (f"No results found for query='{query}' section='{section}'. "
                f"Available FIASSE sections: S2.1–S8.2. "
                f"Available ASVS chapters: V1.1–V17.3.")

    header = f"# FIASSE/SSEM/ASVS REFERENCE LOOKUP\n\n**Query**: {query}\n"
    if section:
        header += f"**Section**: {section}\n"
    header += f"\n**Results**: {len(results)} section(s) found.\n"

    return header + "\n\n---\n\n".join(results)


# ---------------------------------------------------------------------------
# MCP Protocol Implementation (JSON-RPC over stdio)
# ---------------------------------------------------------------------------

TOOLS = [
    {
        "name": "securability_review",
        "description": (
            "Load the full SSEM securability engineering review workflow. "
            "Returns the complete review procedure, scoring framework, "
            "finding template, and report template for analyzing code "
            "securability. Use when asked to review, assess, audit, or "
            "evaluate code securability, code quality for security, or "
            "FIASSE/SSEM compliance."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "target": {
                    "type": "string",
                    "description": "Description of the code/system being reviewed"
                },
                "focus": {
                    "type": "string",
                    "description": (
                        "Optional focus area: maintainability, trustworthiness, "
                        "reliability, or specific attributes like integrity, "
                        "resilience, transparency, dependency"
                    )
                }
            },
            "required": []
        }
    },
    {
        "name": "secure_generate",
        "description": (
            "Load FIASSE/SSEM code generation constraints for producing "
            "inherently securable code. Returns SSEM attribute enforcement "
            "rules, trust boundary handling, generation checklist, and "
            "relevant FIASSE/ASVS reference data. Use when asked to generate, "
            "scaffold, or refactor code with securable qualities."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "feature": {
                    "type": "string",
                    "description": "Description of the feature/code to generate"
                },
                "language": {
                    "type": "string",
                    "description": "Target programming language or framework"
                },
                "context": {
                    "type": "string",
                    "description": (
                        "Additional context: data sensitivity, exposure level, "
                        "system type, trust boundaries"
                    )
                }
            },
            "required": []
        }
    },
    {
        "name": "fiasse_lookup",
        "description": (
            "Look up FIASSE/SSEM/ASVS reference material by topic keyword "
            "or section identifier. Returns matching section content with "
            "YAML frontmatter metadata. Use when you need FIASSE principles, "
            "SSEM attribute definitions, ASVS requirements, or measurement "
            "criteria."
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": (
                        "Search topic: integrity, trust boundary, input validation, "
                        "dependency management, transparency, confidentiality, etc."
                    )
                },
                "section": {
                    "type": "string",
                    "description": (
                        "Specific section ID: S3.2.1, V6.2, S6.4, etc. "
                        "FIASSE sections use S prefix, ASVS chapters use V prefix."
                    )
                }
            },
            "required": []
        }
    }
]

# Map tool names to handler functions
TOOL_HANDLERS = {
    "securability_review": securability_review,
    "secure_generate": secure_generate,
    "fiasse_lookup": fiasse_lookup,
}


def _handle_request(request: dict) -> dict:
    """Handle a single JSON-RPC request and return a response."""
    method = request.get("method", "")
    req_id = request.get("id")
    params = request.get("params", {})

    if method == "initialize":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {}
                },
                "serverInfo": {
                    "name": "securable-engineering",
                    "version": "1.0.0"
                }
            }
        }

    elif method == "notifications/initialized":
        # This is a notification, no response needed
        return None

    elif method == "tools/list":
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS
            }
        }

    elif method == "tools/call":
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        handler = TOOL_HANDLERS.get(tool_name)
        if not handler:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{
                        "type": "text",
                        "text": f"Unknown tool: {tool_name}"
                    }],
                    "isError": True
                }
            }

        try:
            result_text = handler(**arguments)
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{
                        "type": "text",
                        "text": result_text
                    }],
                    "isError": False
                }
            }
        except Exception as e:
            return {
                "jsonrpc": "2.0",
                "id": req_id,
                "result": {
                    "content": [{
                        "type": "text",
                        "text": f"Error executing {tool_name}: {e}"
                    }],
                    "isError": True
                }
            }

    else:
        return {
            "jsonrpc": "2.0",
            "id": req_id,
            "error": {
                "code": -32601,
                "message": f"Method not found: {method}"
            }
        }


def main():
    """Run the MCP server over stdio (JSON-RPC)."""
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue

        try:
            request = json.loads(line)
        except json.JSONDecodeError:
            error_resp = {
                "jsonrpc": "2.0",
                "id": None,
                "error": {
                    "code": -32700,
                    "message": "Parse error"
                }
            }
            sys.stdout.write(json.dumps(error_resp) + "\n")
            sys.stdout.flush()
            continue

        response = _handle_request(request)
        if response is not None:
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()


if __name__ == "__main__":
    main()
