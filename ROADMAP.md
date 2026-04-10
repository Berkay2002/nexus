# Roadmap

MVP is done. This file sketches what comes next, grouped by how soon I plan to get to it. "Now" items are commitments. "Later" items are directions.

## Now

### docker compose up
One file that starts the AIO Sandbox, LangGraph server, Next.js, and SQLite with sensible defaults. Today, running Nexus means three terminals and a `gcloud` login. A single `docker compose up` makes it something other people can actually try.

### Artifact panel
A third column in the execution view that previews whatever the agents drop into `/home/gem/workspace/shared/`: PDFs, code diffs, image galleries, CSV tables, rendered HTML reports. The final deliverable is currently hidden behind file paths inside the sandbox; surfacing it turns invisible work into a visible product.

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

## Later

### MCP support, both ways
Two projects under one banner.

*Agents call MCP tools.* Configure an MCP server URL and its tools become available to the research, code, or creative sub-agent. This plugs Nexus into the existing MCP ecosystem (browse, GitHub, Linear, Slack, filesystem, and custom internal tools) without writing new integrations.

*Nexus exposes itself as an MCP server.* Claude Desktop, Cursor, Zed, or any MCP client can call a `nexus_run` tool that hands a prompt to the orchestrator and streams the result back. Nexus becomes a multi-agent primitive that other agents can delegate to.

### Import skills from a Git URL
`nexus skill add <git-url>` clones a skill folder (a `SKILL.md` plus templates) into the skills store, and the orchestrator picks it up on the next run. Skills are already plain files under a virtual POSIX path, so the plumbing is small. The goal is a set of reusable workflows that anyone can publish instead of a fixed set of five.
