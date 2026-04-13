# Roadmap

MVP is done. This file sketches what comes next, grouped by how soon I plan to get to it. "Now" items are commitments. "Later" items are directions.

## Now

### docker compose up
One file that starts the AIO Sandbox, LangGraph server, Next.js, and SQLite with sensible defaults. Today, running Nexus means three terminals and a `gcloud` login. A single `docker compose up` makes it something other people can actually try.

### Cost and token meter
A running total in the header, broken down per sub-agent, with an optional budget that pauses the run when hit.

## Next

### Interruptible agents
A stop button that stops mid-thought and mid-tool-call, plus a "redirect" input that tells the orchestrator to change direction without discarding the state it has already built up. Requires a graph-level interrupt signal and careful handling of partial tool results.

### "Why did you do that" inspector
Click any tool call in the stream and see the orchestrator's reasoning for choosing it, along with the prompt fragment that led there. Pairs with streaming reasoning tokens once the Z.AI middleware is in place. Turns the agent from a black box into something auditable.

### Editable `AGENTS.md`
A project-level instructions file, read on every run and appended to the orchestrator system prompt. Lets users teach Nexus their conventions, tone, output formats, and constraints without forking the repo. Same idea as `CLAUDE.md` in Claude Code. UI is a settings tab with a small code editor.

### Critic sub-agent
A reviewer agent that reads the draft deliverable, writes a critique to `/shared/critique.md`, and hands control back to the orchestrator for a revision pass. A self-improvement loop with no fine-tuning required.

### LangSmith trace integration
Click a run in the UI and see the full LangGraph trace inline, either embedded from LangSmith or linked out to a public trace URL. Depends on a LangSmith API key being configured.

### Context caching
The orchestrator re-sends a large system prompt, a pile of skill files, and full tool schemas on every turn. Enabling provider-side prompt caching cuts both cost and latency dramatically for multi-turn runs. Each provider exposes this differently — Anthropic wants explicit `cache_control` breakpoints in message content, Gemini wants a pre-created cached-content handle, OpenAI does it automatically above a token threshold — so the real work is a small abstraction in the model registry that each provider adapter can implement.

## Later

### Nexus exposes itself as an MCP server
Claude Desktop, Cursor, Zed, or any MCP client can call a `nexus_run` tool that hands a prompt to the orchestrator and streams the result back. Nexus becomes a multi-agent primitive that other agents can delegate to. The other half of MCP support — agents calling external MCP tools — already shipped via the filesystem-of-tools design (`docs/superpowers/specs/2026-04-13-mcp-filesystem-of-tools-design.md`).

### Import skills from a Git URL
`nexus skill add <git-url>` clones a skill folder (a `SKILL.md` plus templates) into the skills store, and the orchestrator picks it up on the next run. Skills are already plain files under a virtual POSIX path, so the plumbing is small. The goal is a set of reusable workflows that anyone can publish instead of a fixed set of five.
