# Async / Resumable Runs — Nexus

## Context

**User story (verbatim):** "I can close the UI, reload the UI, send a prompt and close the tab, open a new tab with the same URL and see the results as it kept going in the background. Thats what I want. But right now, when I reload the nextjs UI etc, it just stops the run."

The user is literally correct — reloading kills the run, and I know exactly why. In `apps/web/src/providers/Stream.tsx:52-73`, `useStream` is called without `reconnectOnMount`. That single omission cascades:

1. `node_modules/@langchain/react/dist/stream.lgp.js:131-137` — `runMetadataStorage` becomes `null` (no storage provided).
2. `stream.lgp.js:332` — `streamResumable = !!runMetadataStorage` → `false`.
3. `stream.lgp.js:343` — `onDisconnect` defaults to `"cancel"` when not resumable.
4. `node_modules/@langchain/langgraph-sdk/dist/types.d.ts:8` — `DisconnectMode = "cancel" | "continue"`; `"cancel"` tells the LangGraph server to actively abort the run when the SSE connection closes.

So closing the tab literally sends a server-side cancel. Everything downstream (thread history, sidebar, old-thread continuation) is blocked on fixing this one wiring mistake. The rest of the feature — history, per-thread badges, command palette, continue-old-thread — is built on APIs that already exist in `@langchain/react` but Nexus isn't using yet (`joinStream`, `switchThread`, `queue`, `subagents`, `fetchStateHistory`).

**Intended outcome:** user submits → closes tab → reopens in any tab on the same machine → stream reattaches live and the run keeps executing untouched. Plus a cmdk-style thread list modal to jump between threads, status badges, and continue-conversation on old threads. Pull-only notifications (no service worker).

**Explicitly out of scope:** server-restart durability. `langgraph dev` is in-memory by design — durability arrives for free with the already-planned "docker compose up" roadmap item (Postgres-backed `langgraph up`), not with this spec.

---

## Grounding references

**Officially documented API (KB — `.kb/raw/langchain/langchain/references/react-sdk/`):**

*Options (input surface):*
- `interface/useStreamOptions.md:37` — `reconnectOnMount` listed as official `UseStreamOptions` property
- `interface/UseDeepAgentStreamOptions.md:48` — same option on the DeepAgent options interface (what Nexus actually uses)

*Return interfaces (output surface):*
- `interface/BaseStream.md` — confirms `joinStream`, `queue`, `switchThread`, `history`, `isLoading`, `isThreadLoading` are on the shared base for every stream flavor (not DeepAgent-specific)
- `interface/UseStream.md` — extends `BaseStream`; adds `subagents`, `activeSubagents`, `getSubagent`, `getSubagentsByType`, `getSubagentsByMessage`, `toolCalls`, `getToolCalls`, `toolProgress`
- `interface/UseDeepAgentStream.md` — identical property set to `UseStream` for Nexus's purposes; subagent methods are fully typed from `createDeepAgent` config
- `interface/SubagentStreamInterface.md` — per-subagent lifecycle: `id`, `status`, `startedAt`, `completedAt`, `result`, `toolCall`, `depth`, `parentId`, `namespace`. These are what `fetchSubagentHistory` rehydrates on rejoin — important for subagent card restoration

*Providers & hooks:*
- `function/StreamProvider.md` — `StreamProviderProps = ResolveStreamOptions & { children }`; accepts every option `useStream` does (including `reconnectOnMount`)
- `function/useStreamContext.md` — identical return typing; context reader for `StreamProvider`
- `function/useStream.md` — the hook itself; Example 4 shows DeepAgent typing with `filterSubagentMessages: true`
- `function/useSuspenseStream.md` — Suspense variant; `isStreaming` replaces `isLoading`; works with `<ErrorBoundary><Suspense>`
- `function/invalidateSuspenseCache.md` — only relevant if the deferred `useSuspenseStream` migration is picked up later (call from `ErrorBoundary.onReset` to retry)

*Queue + subagent support types:*
- `interface/QueueInterface.md` / `interface/QueueEntry.md` — server-side pending runs from `multitaskStrategy: "enqueue"`
- `interface/SubagentToolCall.md` — `{ args, id, name }`; `args.subagent_type` is what the static model-badge mapping in `use-nexus-stream.ts` reads

**Installed type sources (node_modules — authoritative, quote these in comments if needed):**
- `node_modules/@langchain/langgraph-sdk/dist/ui/types.d.ts:710-879` — full `UseStreamOptions` interface
- `node_modules/@langchain/langgraph-sdk/dist/ui/types.d.ts:838` — `reconnectOnMount?: boolean | (() => RunMetadataStorage)`
- `node_modules/@langchain/langgraph-sdk/dist/ui/types.d.ts:896-900` — `RunMetadataStorage` interface (`getItem`/`setItem`/`removeItem` keyed by template literal `lg:stream:${string}`)
- `node_modules/@langchain/langgraph-sdk/dist/ui/types.d.ts:700-703, 757` — `RunCallbackMeta` + `onCreated`
- `node_modules/@langchain/langgraph-sdk/dist/types.d.ts:8` — `DisconnectMode = "cancel" | "continue"`
- `node_modules/@langchain/langgraph-sdk/dist/ui/queue.d.ts:9-32` — `QueueInterface` + `QueueEntry`
- `node_modules/@langchain/react/dist/types.d.ts:6-82` — `UseStream` return interface
- `node_modules/@langchain/react/dist/types.d.ts:64-71` — `joinStream` signature
- `node_modules/@langchain/react/dist/types.d.ts:76` — `switchThread` signature
- `node_modules/@langchain/react/dist/context.d.ts:11, 79` — `StreamProviderProps` + `StreamProvider`
- `node_modules/@langchain/react/dist/stream.lgp.js:131-137` — storage resolution (`true` → `sessionStorage`, function → custom)
- `node_modules/@langchain/react/dist/stream.lgp.js:183-197` — `switchThread` side effects (clears values, cancels prev-thread queue)
- `node_modules/@langchain/react/dist/stream.lgp.js:250-263` — subagent history reconstruction on mount (auto-fetched)
- `node_modules/@langchain/react/dist/stream.lgp.js:332-343` — `streamResumable` + `onDisconnect` defaulting
- `node_modules/@langchain/react/dist/stream.lgp.js:350-360` — `onRunCreated` writes `lg:stream:{threadId}` to storage
- `node_modules/@langchain/react/dist/stream.lgp.js:374, 474, 284` — key removal points (success, join-success, stop)
- `node_modules/@langchain/react/dist/stream.lgp.js:445-488` — `joinStream` implementation (calls `client.runs.joinStream` with `lastEventId: "-1"`)
- `node_modules/@langchain/react/dist/stream.lgp.js:505-538` — mount-time reconnect effect reads stored runId → auto-calls `joinStream`
- `node_modules/@langchain/react/dist/stream.lgp.js:653-663` — `queue.cancel` / `queue.clear` server-side cancellation

**Nexus files involved:**
- `apps/web/src/providers/Stream.tsx` — wraps `useStream`, missing `reconnectOnMount`
- `apps/web/src/providers/Thread.tsx:42-54` — already fetches threads via `client.threads.search`; UI never renders the list
- `apps/web/src/hooks/use-nexus-stream.ts` — consumer hook; uses `as any` casts because it doesn't type through `typeof agent`
- `apps/web/src/app/page.tsx` — landing vs execution view swap by `hasMessages`
- `apps/web/src/components/landing/` — landing page
- `apps/web/src/components/execution/` — execution view
- `apps/agents/src/nexus/graph.ts` — graph export (do NOT pass a checkpointer here; LangGraph server injects its own)

---

## Scope — what this spec ships

**In:**
1. Same-browser rejoin (localStorage) — reload, close tab + reopen, survives both.
2. Thread history command palette (⌘K / Ctrl+K) using shadcn `cmdk`, triggered from a button visible on landing + execution views.
3. Run status badges per thread (`running | done | errored | interrupted`) derived from `Thread.status`.
4. Pull-only "done while away" — no toasts, no service workers; badges update on next visit.
5. Continue conversation on old threads (default behavior once `switchThread` + persisted state work).
6. Replace `as any` casts in `use-nexus-stream.ts` with `typeof orchestrator` typing via `UseDeepAgentStream`.

**Out / deferred:**
- Server-restart durability → comes free with the roadmap `docker compose up` item (Postgres-backed `langgraph up`).
- Cross-device rejoin (different browser, fresh tab with no stored runId) → follow-up; doable later via `onCreated` + metadata persistence without breaking this spec.
- Browser `Notification` API / service workers → out of scope (user picked pull-only).
- `/chat/[id]` route migration → staying on the existing `?threadId=X` query param since `switchThread` + `nuqs` already integrates cleanly.
- Migration to `useSuspenseStream` → evaluated, deferred. The smoother skeleton isn't worth rewriting `use-nexus-stream.ts`'s consumers right now. Revisit when we have more thread-switching UX.

---

## Implementation plan

### Step 1 — Enable resumable streams (the 1-line fix that unblocks everything)

**File:** `apps/web/src/providers/Stream.tsx`

Add to the `useStream` options object:

```ts
reconnectOnMount: () =>
  typeof window === "undefined" ? (null as never) : window.localStorage,
```

Why a function returning `localStorage` instead of `true`:
- `true` → `sessionStorage` (per-tab, dies when tab closes — doesn't satisfy "close tab, open new tab" story).
- Function → any `RunMetadataStorage` we return. `localStorage` survives across tabs and reloads, which is exactly the stated UX.
- `localStorage` satisfies the `RunMetadataStorage` interface structurally (`getItem`/`setItem`/`removeItem`).
- Reference: `stream.lgp.js:131-137` (storage resolution), `types.d.ts:896-900` (interface).

**Also add an `onError` handler that purges stale rejoin keys:**

```ts
onError: (error, run) => {
  if (run && typeof window !== "undefined") {
    window.localStorage.removeItem(`lg:stream:${run.thread_id}`);
  }
  // existing error behavior (toast, etc.)
},
```

Why: if a stored runId points to a thread that was deleted on the server, `joinStream` will throw and the key will otherwise zombie in storage (`stream.lgp.js:445-488` — no auto-cleanup in the error path). This is the one hand-maintenance point in an otherwise automatic flow.

**Strip the `as any` cast on the options.** Type the hook as `useStream<typeof orchestrator>` once we import the orchestrator agent type from `apps/agents`. Cross-workspace type import — check if `apps/web` has a path alias; if not, re-export the type from a shared file or use a structural `UseDeepAgentStreamOptions`-compatible interface. If this fights with the build, keep the cast and add a TODO — it's not load-bearing for the feature.

### Step 2 — Move the graph-status toast out of `StreamProvider`

**File:** `apps/web/src/providers/Stream.tsx`

The current provider runs `checkGraphStatus` inside a `useEffect` after `useStream`. Fine to keep, but extract the toast into a standalone `<GraphHealthCheck />` component mounted as a sibling in `page.tsx`. Reason: when we later consider dropping our custom `StreamProvider` in favor of the library's `StreamProvider` (`context.d.ts:79`, `StreamProvider.md`), we want to avoid coupling unrelated side effects to the provider. Not required for this step, but cheap cleanup.

Only do this if it's a 5-minute extraction. If it tangles, skip.

### Step 3 — Thread list data

**File:** `apps/web/src/providers/Thread.tsx` (already exists)

Current state: `getThreads()` at line 42-54 calls `client.threads.search({ metadata: { graph_id: "nexus" }, limit: 100 })`. No UI consumes it.

Changes:
1. Fetch on mount (existing call is lazy) — add a `useEffect` in `ThreadProvider` that calls `getThreads().then(setThreads)` once on mount and whenever a run completes (`onFinish` in Stream.tsx can bump a version counter or call `getThreads` directly).
2. Auto-refresh on an interval when the modal is open (cheap polling — `setInterval(() => getThreads().then(setThreads), 5000)` while the modal is mounted). `client.threads.search` is local HTTP, negligible cost.
3. Add derived status per thread. `Thread.status` from the SDK exposes `"idle" | "busy" | "interrupted" | "error"`. Surface it directly — no transformation needed.
4. Sort by `updated_at` descending.

Leave the existing `getThreadSearchMetadata` helper alone — it's correct.

### Step 4 — Thread picker modal (cmdk)

**New file:** `apps/web/src/components/thread-picker/thread-picker.tsx`

Stack: shadcn `cmdk` (`<CommandDialog>`, `<CommandInput>`, `<CommandList>`, `<CommandItem>`). Nexus already has `components.json`; add `command` via `npx shadcn@latest add command` if not already present.

Behavior:
- Keyboard shortcut: `⌘K` / `Ctrl+K` toggles the dialog (add a `useHotkeys`-style effect or `@react-hook/keyboard`).
- Plus a persistent button in the top-left on both landing and execution views ("Threads" with hugeicons `Menu01Icon` or `ArrowsLeftRightIcon`). Hugeicons per CLAUDE.md.
- Each row: truncated first human message (fallback to thread id), `updated_at` relative time, status badge.
- Status badge palette:
  - `busy` → "Running" (animated dot) — orange/amber
  - `idle` → "Done" — subdued
  - `interrupted` → "Awaiting input" — blue
  - `error` → "Error" — red
- `<CommandItem onSelect>` calls `stream.switchThread(threadId)`. Per `stream.lgp.js:183-197`, this clears stream values immediately, cancels queued runs on the previous thread, and triggers `onThreadId` (which writes the new id back to the URL via `nuqs`). On the next render, the mount-time reconnect effect (`stream.lgp.js:505-538`) reads `lg:stream:{newThreadId}` from localStorage and auto-joins if the run is still live.
- "New thread" item at the top → `stream.switchThread(null)`. Per `useStream` semantics, next `submit` creates a fresh thread.

**Gotcha:** `switchThread` does NOT clear the stored rejoin key for the *previous* thread. If the user switches away from a running thread and back, that thread's runId is still in storage — this is correct behavior, it's what enables returning to a backgrounded run. But we should verify that two threads simultaneously in `lg:stream:*` don't confuse the hook. The hook reads the key based on the *current* `threadId` (`stream.lgp.js:508-521`), so only one key is active at a time. No conflict.

### Step 5 — Running indicator on landing + execution

**Files:**
- `apps/web/src/components/landing/` (existing landing page)
- `apps/web/src/components/execution/` (existing execution view)

On landing: if `threads` contains any with `status === "busy"`, show a subtle banner/pill at the top: *"2 runs in progress · open command palette"*. Clicking it opens the thread picker. No toast, no auto-redirect — the user chose pull-only.

On execution: the current view is fine, but the thread picker button goes in the same top-left slot so it's present everywhere.

### Step 6 — Queue surfacing

**File:** `apps/web/src/hooks/use-nexus-stream.ts`

The hook currently doesn't expose `stream.queue`. Auto-enqueue (`stream.lgp.js:411-433`) means if the user submits during an active run, a new server-side run is created with `multitaskStrategy: "enqueue"` and tracked in `queue.entries`. Today we silently enqueue and users see nothing.

Add to the return object:
```ts
queue: {
  size: stream.queue.size,
  entries: stream.queue.entries,
  cancel: stream.queue.cancel,
  clear: stream.queue.clear,
}
```

Render a "N queued" chip in the prompt bar when `queue.size > 0`, with a "clear queue" button. No architectural change — just exposing what's already there.

### Step 7 — Verify DeepAgents typing passes through

**File:** `apps/web/src/hooks/use-nexus-stream.ts`

The hook currently casts `(stream as any).subagents` and `(stream as any).getSubagentsByMessage`. Per `interface/UseStream.md` and `interface/UseDeepAgentStream.md`, both are first-class members of the return interface — **even the base `UseStream` already carries them** (`interface/BaseStream.md` confirms the subagent accessors inherit through the hierarchy). So typing the hook as `useStream<typeof orchestrator>` is enough; no DeepAgent-specific import needed.

If importing the orchestrator type across workspaces is clean, replace the casts. If not, add a TODO — not blocking.

### Step 8 — Workspace file visibility on rejoin

**Verify only — no code changes expected.**

When rejoining a thread that had subagent-scoped workspaces at `/home/gem/workspace/threads/{threadId}/`, confirm the workspace file listings in `WorkspaceOutputsPanel` still show the previously-written files. Since `getWorkspaceRootForThread` in `apps/agents/src/nexus/backend/workspace.ts:31-35` is deterministic from `threadId`, they should be there on the sandbox side. But if the panel's data source is the stream-local state (not a direct sandbox query), it may show empty on mount. Test this scenario explicitly in Verification Step 3 below.

---

## Verification

Run the LangGraph dev server (`npm run dev` from repo root) and the AIO Sandbox container. Then:

### Test 1 — Bare-minimum rejoin (F5 reload)
1. Open `http://localhost:3000`, submit a long research prompt ("Research the latest advances in fusion energy and write a 2-page report").
2. Watch subagents spawn and streaming start.
3. Hit F5 mid-run.
4. **Expected:** page reloads, stream reattaches, events continue flowing from where they left off. `stream.isLoading === true` throughout. Subagent cards restore via `reconstructSubagents` + `fetchSubagentHistory` (`stream.lgp.js:250-263`). Each restored subagent has its `status`, `startedAt`, `completedAt`, and `toolCall` populated (per `interface/SubagentStreamInterface.md`) — verify by spot-checking one card's timestamp didn't reset.
5. Run reaches completion. localStorage key `lg:stream:{threadId}` is gone (DevTools → Application → Local Storage).

### Test 2 — Cross-tab rejoin (the stated user story)
1. Start a new run as in Test 1.
2. Before it completes, close the entire tab.
3. Open a new tab, paste the same URL (with `?threadId=...`).
4. **Expected:** stream reattaches live. Same behavior as Test 1.
5. Also verify: opening `http://localhost:3000` *without* the query param on a 3rd tab shows the landing page with a "1 run in progress" pill (from Step 5 of implementation).

### Test 3 — Thread picker navigation
1. Create 3 threads with different prompts, let at least one finish and one still be running.
2. Press ⌘K. Modal opens with 3 items, correct status badges, correct timestamps.
3. Click a completed thread → execution view renders its messages, todos, and subagent cards from thread history. Workspace files panel shows the files from `/home/gem/workspace/threads/{threadId}/` (verifies Step 8).
4. Submit a follow-up message in the old thread. Orchestrator resumes with full conversation history (default `useStream` behavior).
5. Press ⌘K, click the still-running thread → reattaches to live stream (cross-thread rejoin via same localStorage mechanism).
6. Press ⌘K, click "New thread" → landing page, no threadId in URL, next submit creates a fresh thread.

### Test 4 — Queue behavior
1. Start a long run.
2. While it's streaming, submit a second prompt.
3. **Expected:** "1 queued" chip in the prompt bar. Second prompt does not interrupt the first.
4. First run completes → second starts automatically (`drainQueue` in `stream.lgp.js:492-503`).
5. Start another long run, queue two more, then click "clear queue" chip. Both queued runs cancelled server-side via `queue.clear()` (`stream.lgp.js:658-663`).

### Test 5 — Stale key cleanup
1. Manually set `localStorage.setItem('lg:stream:nonexistent-thread', 'fake-run-id')` in DevTools.
2. Navigate to `?threadId=nonexistent-thread`.
3. **Expected:** hook attempts `joinStream('fake-run-id')`, server returns an error, `onError` fires and removes the key (per the handler added in Step 1).
4. Verify key is gone from localStorage.

### Lint / typecheck
- `cd apps/web && npm run lint` — clean.
- `npx next build` inside `apps/web/` — clean (root `npm run build` still fails due to pre-existing `apps/agents` TS errors; that's the documented build gotcha, not a regression).

---

## Risks / gotchas

1. **Dev server restart kills everything.** Documented in CLAUDE.md as the `langgraph dev` limitation. Mention in the spec explicitly so users don't file bugs. Durability ships with the `docker compose up` roadmap item.
2. **Two tabs, same thread, one actively streaming.** The localStorage key is a single slot — whichever tab wrote last "owns" the rejoin for that thread. In practice this is fine: if tab A streams, tab B mounts, both call `joinStream` against the same `runId`, and `client.runs.joinStream` is server-side-idempotent (returns the same SSE stream to both). No dedup needed (`stream.lgp.js:445-488` — server handles it).
3. **`onError` cleanup is the only manual storage hand-off.** Everything else (success, stop, join-success) is already handled in the library. Make sure the `onError` path in Step 1 actually fires for stale-thread errors — test with Test 5.
4. **Cross-workspace type import** (Step 7). If importing `typeof orchestrator` from `apps/agents` into `apps/web` trips the build, don't force it. The casts aren't a regression.
5. **`shadcn add command`** may overwrite an existing file if the team already added cmdk. Check `apps/web/src/components/ui/command.tsx` before running. Per CLAUDE.md: "preserve `src/components/ui/` — shadcn/ui base components".

---

## Deferred follow-ups (explicitly not in this spec)

- **Cross-device rejoin:** persist `{threadId → runId}` via `onCreated` (`types.d.ts:757`) to `thread.metadata` on the server, then on mount query `client.runs.list(threadId)` for any `status: "running"` and call `joinStream(runId)` manually. Clean to add on top of this spec without refactoring.
- **Server-restart durability:** arrives with `langgraph up` (docker compose) — no code changes in Nexus; it's a deployment target switch.
- **OS notifications:** service worker + `Notification.requestPermission()`. Deferred by user choice ("pull-only").
- **`useSuspenseStream` migration:** worth revisiting once thread-switching becomes the dominant interaction. Current `useStream` is fine for this spec.
