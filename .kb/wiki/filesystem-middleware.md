---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, middleware, filesystem, workspace]
sources: [raw/langchain/deepagents/overview.md]
---

# Filesystem Middleware

The filesystem middleware is the [[harness-capabilities|harness capability]] that injects virtual filesystem tools into a [[deep-agents-overview|DeepAgent]]. It is wired automatically by [[create-deep-agent]] via `FilesystemMiddleware` and requires a [[backends|backend]] to be configured.

## Available Tools

| Tool | Description |
|---|---|
| `ls` | List files in a directory with size and modified-time metadata |
| `read_file` | Read file contents with line numbers. Supports `offset`/`limit` for large files. Returns multimodal content blocks for non-text files. |
| `write_file` | Create new files |
| `edit_file` | Perform exact string replacements (with global replace mode) |
| `glob` | Find files matching patterns, e.g., `**/*.py` |
| `grep` | Search file contents with three output modes: files-only, content-with-context, or match counts |
| `execute` | Run shell commands — only available when a [[deepagents-sandboxes|sandbox backend]] is attached |

## Multimodal File Support

`read_file` can return multimodal content blocks (not just text) for the following file types:

| Type | Extensions |
|---|---|
| Image | `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.heic`, `.heif` |
| Video | `.mp4`, `.mpeg`, `.mov`, `.avi`, `.flv`, `.mpg`, `.webm`, `.wmv`, `.3gpp` |
| Audio | `.wav`, `.mp3`, `.aiff`, `.aac`, `.ogg`, `.flac` |
| Document | `.pdf`, `.ppt`, `.pptx` |

This enables agents to reason over non-text artifacts (screenshots, recordings, slide decks) directly from the filesystem.

## Role in the Harness

The virtual filesystem is used internally by several other harness features:

- **[[skills]]** — skill files are stored at `/skills/` on the filesystem backend and read progressively
- **[[memory]]** — memory files (`AGENTS.md`) are loaded via filesystem reads at startup
- **Context management** — offloaded content is written to disk and read back incrementally
- **Code execution** — `execute` output that exceeds truncation limits is saved to a file for incremental reading

Custom tools and middleware can also call filesystem tools directly when building on top of DeepAgents.

## Backend Dependency

The filesystem tools are only as capable as the underlying [[backends|backend]]:
- [[filesystem-backend]] or [[store-backend]] — full read/write, no shell execution
- [[local-shell-backend]] or [[deepagents-sandboxes|sandbox backend]] — adds `execute` tool
- [[composite-backend]] — routes paths to different backends (Nexus pattern)

## Nexus Workspace Layout

In Nexus, the AIO Sandbox home is `/home/gem/`. The workspace convention is:

```
/home/gem/workspace/{research|code|creative|orchestrator}/task_{id}/
/home/gem/workspace/shared/   ← final deliverables
```

All agents can read any path; each writes to its own task folder.

## Related

- [[harness-capabilities]]
- [[create-deep-agent]]
- [[backends]]
- [[composite-backend]]
- [[deepagents-sandboxes]]

## Sources

- `raw/langchain/deepagents/overview.md` — virtual filesystem section: tool table, multimodal extensions table, backend reference
