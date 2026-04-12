---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, frontend, sandbox, ide, visualization]
sources: [raw/langchain/deepagents/frontend/sandbox.md]
---

# Frontend Sandbox Components

The specific UI components that make up the [[sandbox-ide]] pattern. Three panels, a file-state management layer, and diff-rendering utilities form the complete IDE visualization for a coding agent.

## Three-Panel Layout

The IDE arranges panels side by side in a fixed-flexible-fixed grid:

| Panel | Width | Purpose |
|-------|-------|---------|
| File tree | Fixed 208 px (`w-52`) | Browse sandbox files, show change indicators |
| Code / Diff viewer | Flexible (`flex-1`) | View raw file content or unified diff |
| Chat | Fixed 320 px (`w-80`) | Interact with the agent via [[use-stream-hook]] |

```tsx
<div className="flex h-screen">
  <div className="w-52 shrink-0">
    <FileTree />
    <ChangedFilesSummary />
  </div>
  <CodePanel /* flex-1 */ />
  <div className="w-80 shrink-0">
    <ChatPanel />
  </div>
</div>
```

## FileTree Component

Displays the directory listing returned by `GET /api/sandbox/:threadId/tree`. Key visual details:

- VS Code-style file icons via [`@iconify-json/vscode-icons`](https://www.npmjs.com/package/@iconify-json/vscode-icons)
- Amber dot indicators on files that have been modified since the run started
- Clicking a modified file auto-switches the Code/Diff viewer to the diff tab

## CodePanel Component

Two-tab component: **Code** (raw file content) and **Diff** (unified diff view). When the user selects a file in the file tree, if that file is in the changed-files set the diff tab is selected automatically.

### Diff rendering

Use a framework-appropriate library:

| Framework | Library | Notes |
|-----------|---------|-------|
| React | [`@pierre/diffs`](https://diffs.com) | `<FileDiff fileDiff={diff} options={{ theme: "github-dark" }} />` |
| Vue | [`@git-diff-view/vue`](https://github.com/MrWangJustToDo/git-diff-view) | `<DiffView>` + `generateDiffFile` from `@git-diff-view/file` |
| Svelte | [`@git-diff-view/svelte`](https://github.com/MrWangJustToDo/git-diff-view) | Same as Vue |
| Angular | [`ngx-diff`](https://github.com/rars/ngx-diff) | `<ngx-unified-diff [before]="..." [after]="..."` |

React example:

```tsx
import { FileDiff } from "@pierre/diffs/react";
import { parseDiffFromFile } from "@pierre/diffs";

function DiffPanel({ original, current, fileName }) {
  const diff = parseDiffFromFile(
    { name: fileName, contents: original },
    { name: fileName, contents: current },
  );
  return (
    <FileDiff
      fileDiff={diff}
      options={{ theme: "github-dark", diffStyle: "unified", diffIndicators: "bars" }}
    />
  );
}
```

## ChangedFilesSummary Component

A `git status`-style summary listing every file the agent modified, with per-file addition (green `+N`) and deletion (red `-N`) line counts. Clicking a file in the summary navigates to it in the diff view.

```tsx
function ChangedFilesSummary({ changedFiles, files, originalFiles, onSelect }) {
  const stats = [...changedFiles].map((path) => {
    const oldLines = (originalFiles[path] ?? "").split("\n");
    const newLines = (files[path] ?? "").split("\n");
    return { path, additions, deletions }; // compute by line comparison
  });

  return (
    <div>
      <h3>{stats.length} Files Changed</h3>
      {stats.map((file) => (
        <button key={file.path} onClick={() => onSelect(file.path)}>
          {file.path}
          <span className="text-green-400">+{file.additions}</span>
          <span className="text-red-400">-{file.deletions}</span>
        </button>
      ))}
    </div>
  );
}
```

## `useSandboxFiles` Hook

A custom hook (referenced in the source as `useSandboxFiles(threadId)`) encapsulating all file-state logic:

- **`tree`** — current `FileEntry[]` from the API server (`{name, type, path, size}`).
- **`files`** — map of `path → content` for opened files, updated in real time.
- **`originalFiles`** — snapshot taken before each agent run, used to detect changes.
- **`changedFiles`** — `Set<string>` derived by comparing `files` vs `originalFiles`.

The hook watches `stream.messages` for `ToolMessage` completions on `write_file`, `edit_file`, and `execute`, and calls `refreshSingleFile` or `refreshAllFiles` accordingly (see [[sandbox-ide]] for the full reactive-sync pattern).

### File snapshot and change detection

```ts
function detectChanges(current: FileSnapshot, original: FileSnapshot): Set<string> {
  const changed = new Set<string>();
  for (const [path, content] of Object.entries(current)) {
    if (original[path] !== content) changed.add(path);
  }
  for (const path of Object.keys(original)) {
    if (!(path in current)) changed.add(path); // deleted files
  }
  return changed;
}
```

## Thread Creation and Session Persistence

Thread ID is persisted in `sessionStorage` under a stable key so page reloads reconnect to the same sandbox rather than spinning up a new one:

```tsx
const THREAD_KEY = "sandbox-thread-id";

const [threadId, setThreadId] = useState<string | null>(
  () => sessionStorage.getItem(THREAD_KEY),
);

// On first mount with no stored thread, create one:
useEffect(() => {
  if (threadId) return;
  stream.client.threads.create().then((t) => updateThreadId(t.thread_id));
}, [stream.client, threadId, updateThreadId]);

// "New conversation" button:
function handleNewThread() {
  stream.switchThread(null);
  updateThreadId(null); // clears sessionStorage
}
```

## Related

- [[sandbox-ide]]
- [[use-stream-hook]]
- [[deepagents-sandboxes]]
- [[ai-elements]]
- [[deepagents-frontend-overview]]

## Sources

- `raw/langchain/deepagents/frontend/sandbox.md` — component specifications, layout table, diff library options, `useSandboxFiles` pattern, thread persistence
