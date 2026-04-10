# Architecture Rules

## Skills Per Domain

- **Frontend UI** → `frontend-design` — produces distinctive, non-generic dark-themed components matching Perplexity aesthetic
- **Before new features** → `brainstorming` — prevents wasted work by exploring intent before implementation
- **Implementation** → `writing-plans` then `executing-plans` — structured execution with review checkpoints
- **Bug investigation** → `systematic-debugging` — diagnoses root cause before proposing fixes
- **Before claiming done** → `verification-before-completion` — evidence before assertions
- **Code review** → `requesting-code-review` after completing a plan

## Design Spec is Authoritative
Always consult `docs/superpowers/specs/2026-04-10-nexus-design.md` before making architectural decisions. The spec defines the meta-router, orchestrator, sub-agents, workspace conventions, and frontend layout.

## Three-Process Boundary
- `apps/agents/` talks to AIO Sandbox via `@agent-infra/sandbox` SDK (HTTP to :8080)
- `apps/web/` talks to LangGraph server via `@langchain/langgraph-sdk` (HTTP to :2024)
- Frontend and agent server share NO code. They communicate solely via the LangGraph protocol.

## DeepAgents Native (Approach A)
Use `createDeepAgent()` for the orchestrator. Do not build custom orchestration logic. Lean into DeepAgents' built-in middleware: `todoListMiddleware`, `FilesystemMiddleware`, `SubAgentMiddleware`, `createSummarizationMiddleware`.

## CompositeBackend Pattern
Default route → AIOSandboxBackend (ephemeral workspace). `/memories/` route → StoreBackend (SQLite persistence). `/skills/` route → StoreBackend (skill file storage). This is the only backend configuration.

## Sub-Agents Are Self-Contained
Custom sub-agents do NOT inherit tools, system prompts, or skills from the orchestrator. Each sub-agent must explicitly define its own tools and system prompt via the `SubAgent` interface.

## Implementation Status
Plans 1-6 are complete. The backend agent system is fully implemented (meta-router, orchestrator, 4 sub-agents, 4 tools, 5 skills, backends, middleware). The frontend has a landing page with prompt submission and initial execution view components (todo panel, agent status panel, subagent cards). Plans 7-8 (execution view completion, integration testing) are next.
