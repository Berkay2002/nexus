---
name: sandbox-openapi-tool-factory
description: Build remaining Nexus sandbox runtime tools from OpenAPI with a repeatable pattern. Use this skill whenever the task is to add or migrate tool wrappers for sandbox endpoints (nodejs, browser, mcp, util, shell session, jupyter, code), especially when the user says "follow the same pattern" or "implement remaining tools".
---

# Sandbox OpenAPI Tool Factory

Use this skill to implement new sandbox-backed tools quickly and consistently in the Nexus agents app.

## Use This Skill When

- The user asks to add one or more tools that map to sandbox endpoints.
- The user references OpenAPI docs or endpoint schemas.
- The task is "implement the remaining tools" and existing tools already establish a pattern.
- You need to extend code agent capabilities with runtime APIs without changing core orchestration architecture.

## Target Pattern

Every new tool should follow this shape:

1. A prompt metadata file:
- tools/<tool-folder>/prompt.ts
- exports TOOL_NAME and TOOL_DESCRIPTION

2. A tool implementation file:
- tools/<tool-folder>/tool.ts
- exports <toolVarName> and <schemaVarName>
- defines zod schema aligned to OpenAPI request model
- calls sandbox endpoint through helper functions
- returns normalized JSON string result

3. Barrel exports and arrays:
- tools/index.ts exports new tool and type
- include in tool group array if required (for example codeTools)

4. Agent wiring:
- agents/<agent>/agent.ts includes tools group where needed
- update agent prompt text only when capabilities changed materially

5. Tests:
- update tools-index tests for exports and array counts
- update agent wiring tests for expected tool names
- add a metadata smoke test for new tools when practical

## Implementation Steps

### 1) Select Endpoint Set

Pick endpoints and define canonical tool names in snake_case.

Example mapping:
- POST /v1/nodejs/execute -> sandbox_nodejs_execute
- GET /v1/nodejs/info -> sandbox_nodejs_info
- POST /v1/browser/actions -> sandbox_browser_action
- GET /v1/browser/screenshot -> sandbox_browser_screenshot
- GET /v1/mcp/servers -> sandbox_mcp_list_servers

### 2) Extract Schema Contract From OpenAPI

For each endpoint, capture:
- method + path
- operationId
- request body fields, required fields, enums, ranges
- response envelope shape (success, message, data)
- nested objects used for normalized output

### 3) Define Zod Input Schema

Model only useful tool inputs, staying faithful to OpenAPI constraints.

Rules:
- enforce enum values from OpenAPI
- enforce numeric min/max constraints
- keep optional fields optional
- avoid over-modeling internal response fields as inputs

### 4) Implement Endpoint Call

Use shared API helper functions from tools/sandbox-runtime-api.ts.

Rules:
- use sandboxPostJson for POST JSON endpoints
- normalize error using normalizeApiError
- parse envelope safely via toRecord
- always return JSON.stringify(...) with stable top-level keys

Preferred output keys:
- kind
- success
- message
- endpoint-specific fields
- error (when failed)

### 5) Normalize Runtime Output

Convert service-specific response objects into model-friendly payloads.

Rules:
- extract major text streams into explicit fields (stdout, stderr, stream_text)
- preserve raw arrays/objects in a dedicated field when useful (outputs, events)
- keep null values explicit when they carry meaning

### 6) Wire Exports and Agent

- add exports/types in tools/index.ts
- add tool to appropriate group (usually codeTools for code-runtime endpoints)
- keep research/creative groups unchanged unless endpoint belongs there

### 7) Update Tests

At minimum:
- tools-index test for new exports and group lengths
- agent factory test for expected tool names
- orchestrator-subagents wiring expectations if code agent tools changed

### 8) Validate

Run focused tests first, then compile.

Suggested commands:
- npm --workspace apps/agents run test -- <updated test files>
- npm --workspace apps/agents exec tsc -- -p tsconfig.json --noEmit

If workspace scripts are not cross-platform, use direct tsc fallback and report unrelated failures separately.

## Naming and File Conventions

- folder names: kebab-case
- tool names: sandbox_<domain>_<action> in snake_case
- schema vars: <toolVarName>Schema
- type exports: PascalCase input type

## Definition Of Done

A tool is done when:

1. OpenAPI contract is represented in zod schema.
2. Endpoint call succeeds and failures produce actionable errors.
3. Normalized JSON output is stable.
4. Tool is exported and discoverable through expected agent/tool arrays.
5. Tests are updated and pass for touched behavior.

## Guardrails

- Do not bypass existing backend architecture (CompositeBackend + Store routes).
- Do not replace shell tools; runtime tools are additive.
- Do not return giant raw payloads if a compact normalized shape is enough.
- Do not silently change existing tool names used by UI/tests.

## Quick Scaffold Checklist

- create prompt.ts
- create tool.ts
- export in tools/index.ts
- append to group array
- wire agent if required
- update tests
- run focused test + compile check
