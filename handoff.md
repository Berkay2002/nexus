# Handoff — Async/Resumable Runs (Step 1 pivoted to explicit join/rejoin)

## What we're doing

Executing the plan at `docs/plans/2026-04-15-async-resumable-runs.md` (8 steps) using `superpowers:executing-plans`. **Step 1 has been pivoted** from `reconnectOnMount` to the explicit join/rejoin pattern documented at `.kb/raw/langchain/langchain/join-rejoin-streams.md`. The pivot is recorded in the plan's "2026-04-15 pivot" note (under Context) and Step 1 is fully rewritten.

CLAUDE.md and `.claude/rules/*.md` are loaded automatically. Read them first.

## Plan / scope reminder

- Same-browser rejoin via `localStorage` only. NO cross-device rejoin, NO toasts, NO service workers.
- Keep `?threadId=X` query param. NO `/chat/[id]` route.
- Stay on `useStream` (NOT `useSuspenseStream`).
- Do NOT add a checkpointer in `apps/agents/src/nexus/graph.ts` — server injects its own.
- Server-restart durability is out of scope (comes for free with `langgraph up`/docker compose).

## Pivot — why the approach changed

**First attempt (`f9d58c7 fix(stream): rejoin live runs after reload via reconnectOnMount`):**

Wired `reconnectOnMount: () => window.localStorage` on `useStream`. That flips `streamResumable` and `onDisconnect` defaults implicitly (`stream.lgp.js:332, 343`), writes `lg:stream:{threadId}` via `onRunCreated` (`stream.lgp.js:350-360`), and auto-calls `joinStream` from a mount-time effect (`stream.lgp.js:505-538`).

**What verified works:**
1. Run is created with `streamResumable: true` → `run.kwargs.resumable: true` (confirmed via `curl http://localhost:2024/threads/{id}/runs`).
2. After F5/disconnect, the run **stays alive** server-side (`status: "running"`). `onDisconnect: continue` works.
3. Server replays the entire event log when joined fresh with `Last-Event-ID: -1`:
   ```bash
   curl -N -H "Last-Event-ID: -1" -H "Accept: text/event-stream" \
     "http://localhost:2024/threads/{thread_id}/runs/{run_id}/stream?cancel_on_disconnect=0"
   ```
   Output begins with `event: metadata` (id: 0), then `event: values` (id: 1), then `event: messages/metadata`, etc. The full run plays back to a fresh consumer in under a second.
4. The `lg:stream:{threadId}` key IS written to localStorage on submit.
5. After F5, the React adapter **does** issue the rejoin request — `reqid=99 GET /threads/{id}/runs/{runId}/stream?cancel_on_disconnect=0 [200]` (Chrome DevTools MCP).

**What fails:**
1. After F5, the `lg:stream:{threadId}` key is **silently removed** from localStorage with **no `[useStream] error` console log**. That means the React adapter's `joinStream` reached `onSuccess` (`stream.lgp.js:474`), not `onError`. The `for await` loop in `StreamManager.enqueue` (`manager.js:354`) completed **without yielding a single event**.
2. The UI shows the historical state (router card from `fetchStateHistory`) and "Waiting for agent activity..." — no subagents, no streaming.

**The paradox:** `curl` on the exact same endpoint with the same `Last-Event-ID: -1` header returns a fully populated event stream. Some difference between the React-adapter-mediated SDK fetch and `curl` is either (a) causing the server to respond differently, (b) being silently dropped somewhere in the `pipeThrough(BytesLineDecoder()).pipeThrough(SSEDecoder())` chain, or (c) a React-19 strict-mode double-mount racing with the fetch lifecycle. We cannot instrument the mount-time reconnect effect without patching `node_modules`, and `reconnectOnMount` flips two submit defaults implicitly so there is no partial rollback.

**Pivot:** swap to the explicit join/rejoin pattern per `.kb/raw/langchain/langchain/join-rejoin-streams.md`. Pass `{ onDisconnect: "continue", streamResumable: true }` on submit; capture runId in `onCreated`; call `stream.joinStream(runId, "-1")` from our own mount-time `useEffect`; handle cleanup in `onFinish`/`onStop`/`onError` + the rejoin's try/catch. Every step is in user space where we can log, guard, and error-handle it. This also moots Steps 6 and 7's "as any" concerns — the public `UseStream` interface already types `joinStream`, `queue`, `subagents`, `getSubagentsByMessage`.

## Step 1 — chosen approach (pivoted)

Reference: `docs/plans/2026-04-15-async-resumable-runs.md` → "Step 1 — Resumable streams via the documented join/rejoin pattern".

**Two files:**

**A. `apps/web/src/hooks/use-nexus-stream.ts`** — add both flags on `stream.submit` (per `join-rejoin-streams.md:1029-1051`):
```ts
stream.submit(values, {
  streamSubgraphs: true,
  onDisconnect: "continue",
  streamResumable: true,
});
```

**B. `apps/web/src/providers/Stream.tsx`** — four changes:
1. **Drop** `reconnectOnMount: () => window.localStorage`.
2. **`onCreated`** writes `lg:stream:${run.thread_id}` to localStorage.
3. **Mount-time rejoin `useEffect`** keyed on `threadId`: reads the key, guards against strict-mode double-mount with a `useRef`, calls `streamValue.joinStream(runId, "-1")` inside a try/catch (logs `[stream] rejoin failed` + removes stale key on error).
4. **`onFinish` + `onStop`** remove the key on clean completion. Existing `onError` from `f9d58c7` stays.

Full code blocks are in the plan doc.

## Implementation checklist

- [ ] **B-1**: Open `apps/web/src/providers/Stream.tsx`, remove `reconnectOnMount` from the options object.
- [ ] **B-2**: Add `onCreated` option writing `lg:stream:${run.thread_id}` → `run.run_id` to localStorage.
- [ ] **B-3**: Add `onFinish` and `onStop` options that remove the key on completion/stop.
- [ ] **B-4**: Inside `StreamProvider`, below `useStream(...)`, add the mount-time rejoin `useEffect` with `triedRejoinRef: useRef<string | null>(null)`. Effect deps: `[threadId]`. Inside effect: early-returns → read key → set ref → async IIFE → `await streamValue.joinStream(runId, "-1")` in try/catch.
- [ ] **A-1**: Open `apps/web/src/hooks/use-nexus-stream.ts`. Locate the `stream.submit(...)` call in `submitPrompt`. Add `onDisconnect: "continue", streamResumable: true` next to the existing `streamSubgraphs: true`.
- [ ] **Lint / typecheck**: `cd apps/web && npx tsc --noEmit -p . && npx eslint src/providers/Stream.tsx src/hooks/use-nexus-stream.ts`.
- [ ] **Manual verification** (hard-reload F5 only, not HMR — the provider's `useMemo` deps cache the options once):
  1. Open `http://localhost:3000`, submit a long research prompt.
  2. Wait until subagents visibly spawn and streaming is flowing.
  3. DevTools → Application → Local Storage → confirm `lg:stream:{threadId}` = `{runId}`.
  4. Hard-reload (Ctrl+Shift+R).
  5. **Expected:** stream reattaches live. Events flow again. Subagent cards restore. `stream.isLoading === true`.
  6. On run completion: `lg:stream:{threadId}` is gone.
- [ ] **Commit** as `fix(stream): switch rejoin to explicit joinStream per langchain docs` and proceed to Step 2.

## Files to know

| Path | What's in it |
|------|--------------|
| `docs/plans/2026-04-15-async-resumable-runs.md` | The spec being executed. Step 1 rewritten; Steps 6/7 have typing notes. |
| `.kb/raw/langchain/langchain/join-rejoin-streams.md` | **Canonical LangChain guide.** Sections: core concepts (L884-898), setup (L899-1027), submit flags (L1029-1051), rejoin (L1067-1080), persist runId (L1173-1195), error handling (L1197-1210), complete example (L1212-1278), best practices (L1280-1287). |
| `.kb/raw/langchain/langchain/references/react-sdk/interface/UseStream.md` | Confirms `joinStream`, `queue`, `subagents`, `getSubagentsByMessage`, `getSubagent`, `toolCalls`, `toolProgress` are all on the public return interface — no `as any` needed. |
| `.kb/raw/langchain/langchain/references/react-sdk/interface/BaseStream.md` | Subset shared across all stream types — `joinStream` and `queue` inherit from here. |
| `.kb/raw/langchain/langchain/references/react-sdk/interface/QueueInterface.md` | `{ size, entries, cancel, clear }` — Step 6's target shape. |
| `apps/web/src/providers/Stream.tsx` | Where most of Step 1 lands. Currently has `reconnectOnMount: () => window.localStorage` from `f9d58c7` — will be removed. |
| `apps/web/src/providers/Thread.tsx` | Step 3 target — has stale `useQueryState("apiUrl")` bug. |
| `apps/web/src/hooks/use-nexus-stream.ts` | Step 1 flags + Step 6 queue + Step 7 typing cleanup. |
| `apps/web/src/components/landing/index.tsx` | Step 5 (running indicator). |
| `apps/web/src/components/execution/execution-shell.tsx` | Step 5 (top-left thread picker button slot). |
| `apps/web/src/components/ui/command.tsx` | Already exists — DO NOT `shadcn add command`. |
| `node_modules/@langchain/react/dist/stream.lgp.js:445-488` | `joinStream` impl — what `streamValue.joinStream(runId, "-1")` calls. |
| `node_modules/@langchain/langgraph-sdk/dist/client.js:1008-1020` | SDK `joinStream` fetch (sends `Last-Event-ID` as header, `cancel_on_disconnect` as query). |
| `node_modules/@langchain/langgraph-api/dist/api/runs.mjs:298-311` | Server stream endpoint. |
| `node_modules/@langchain/langgraph-api/dist/storage/ops.mjs:1188-1255` | Server-side `Stream.join` generator (confirmed replaying correctly via curl). |

## Tasks (TaskList state)

1. Step 1: **Pivoted to explicit joinStream** — in_progress, implementation checklist above
2. Step 2: Extract graph health check — pending
3. Step 3: Thread list data + auto-refresh — pending
4. Step 4: Thread picker cmdk modal — pending
5. Step 5: Running indicator on landing + execution — pending
6. Step 6: Queue surfacing in use-nexus-stream — pending (simplified: `stream.queue` is already typed)
7. Step 7: Strip as-any casts from hook — pending (simplified: subagent methods are already typed on `UseStream`)
8. Step 8: Verify workspace panel on rejoin — pending
9. Final verification: lint + next build + manual tests — pending

## Important gotchas (don't relearn the hard way)

- **HMR doesn't pick up options changes.** `stream.lgp.js:131-137` reads most option fields into a `useMemo(..., [])` with empty deps → only sampled on initial mount. After editing Stream.tsx you MUST hard-reload (Ctrl+Shift+R) or restart `turbo dev --filter=web`.
- **Root `npm run build` fails** due to pre-existing TS errors in `apps/agents` test files and `db/index.ts`. To verify the web app, run `npx next build` inside `apps/web/`.
- **Icons are hugeicons.** `import { HugeiconsIcon } from "@hugeicons/react"` and icons from `@hugeicons/core-free-icons`.
- **Three integration tests are expected to fail locally** (need API keys / sandbox). Listed in CLAUDE.md.
- **`useStream` must come from `@langchain/react`**, not `@langchain/langgraph-sdk/react` — the SDK version lacks `subagents`/`getSubagentsByMessage`.
- **shadcn `command.tsx` already exists** — do not run `npx shadcn@latest add command`.
- **Cross-workspace type import** for `typeof orchestrator` from `apps/agents` into `apps/web` may fight the build — keep `as any` casts if it does, add a TODO. Step 7 is non-blocking.
- **`f9d58c7` stays in history.** The next commit supersedes its changes to `Stream.tsx` (removes `reconnectOnMount`, adds the explicit path) — no revert needed.

## Working state of the dev environment

- `npm run dev` was running (web on :3000, agents on :2024).
- AIO Sandbox container running on :8080.
- The user has `chrome-devtools-mcp` installed and reloaded — MCP tools available under `mcp__plugin_chrome-devtools-mcp_chrome-devtools__*`. The user does NOT want screenshots — text outputs only.
- The user is currently steering debug sessions with "stop using MCP, try to figure out the issue" — prefer static analysis over browser automation unless explicitly re-approved.

## Working style reminders

- Be terse in commit messages and updates. Don't summarize at the end.
- Commit per step. Use conventional messages (`feat:` / `fix:` / `refactor:`).
- Run lint/typecheck before claiming done — `superpowers:verification-before-completion`.
- Don't pad with comments or backwards-compat shims.
- **Verify Test 1 (the F5 rejoin) MANUALLY before moving on to Steps 2–8.** The user's hard requirement. The whole spec falls apart if the primitive doesn't work.

## Next move (recommended)

1. Read this file and `docs/plans/2026-04-15-async-resumable-runs.md` (at least the "2026-04-15 pivot" note and the rewritten Step 1).
2. Read `apps/web/src/providers/Stream.tsx` (current state has `reconnectOnMount` from `f9d58c7` — will be replaced).
3. Read `apps/web/src/hooks/use-nexus-stream.ts` to find the `stream.submit` call in `submitPrompt`.
4. Apply the Implementation checklist above in order (A-1, B-1..B-4, then lint/typecheck).
5. Ask the user to perform the manual F5 test after hard-reloading.
6. Commit and proceed to Step 2.
