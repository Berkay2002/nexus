# Plan 6: Frontend — Landing Page

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip the Agent Chat UI scaffold, update stale dependencies to LangChain 1.0+, and build a minimal landing page where users can type and submit a prompt that connects to the LangGraph server. Keep the existing dark theme CSS and fonts unchanged.

**Architecture:** Next.js 15 App Router, React 19, Tailwind CSS v4, shadcn/ui (radix-mira style, hugeicons), AI Elements as editable source files. `useStream` from `@langchain/langgraph-sdk/react` streams to the LangGraph server at `:2024`. Uses the existing dark theme from the scaffold's globals.css.

**Tech Stack:** Next.js 15, React 19, TypeScript 5.7, Tailwind CSS v4, shadcn/ui, @langchain/langgraph-sdk 1.x, motion (framer-motion), hugeicons

---

## File Structure

```
apps/web/
├── package.json                         # MODIFY: update deps
├── src/
│   ├── app/
│   │   ├── layout.tsx                   # MODIFY: dark class on html, metadata only
│   │   └── page.tsx                     # MODIFY: landing ↔ execution routing
│   ├── components/
│   │   ├── landing/                     # CREATE
│   │   │   ├── nexus-logo.tsx           # CREATE: animated logo/wordmark
│   │   │   ├── nexus-prompt.tsx         # CREATE: prompt textarea + submit
│   │   │   └── index.tsx                # CREATE: landing page layout
│   │   └── thread/
│   │       └── index.tsx                # MODIFY: strip scaffold branding
│   ├── hooks/
│   │   └── use-nexus-stream.ts          # CREATE: typed useStream wrapper for Nexus
│   └── providers/
│       └── Stream.tsx                   # MODIFY: remove config form, Nexus defaults
├── .env.example                         # CREATE: document required env vars
package.json (root)                      # MODIFY: update @langchain/core override
```

**NOT modified (per user request):** `globals.css`, `tailwind.config.js` — keep existing theme, fonts, and CSS variables as-is.

---

### Task 1: Update Dependencies

Update all outdated packages to their latest versions. Upgrade the LangChain ecosystem from 0.x to 1.x (LTS). Do NOT upgrade eslint-related packages or Next.js.

**Files:**
- Modify: `apps/web/package.json`
- Modify: `package.json` (root — `overrides` section)

- [ ] **Step 1: Update root package.json override**

The root `package.json` has an override pinning `@langchain/core` to `^0.3.42`. Update it to `^1.0.0` for LangChain 1.0 LTS.

```json
{
  "overrides": {
    "@langchain/core": "^1.0.0"
  }
}
```

Find the `overrides` section in the root `package.json` and change the `@langchain/core` version from `"^0.3.42"` to `"^1.0.0"`.

- [ ] **Step 2: Update apps/web/package.json dependencies**

Replace version ranges for these dependencies:

```json
{
  "dependencies": {
    "@langchain/core": "^1.0.0",
    "@langchain/langgraph": "^1.0.0",
    "@langchain/langgraph-api": "^1.0.0",
    "@langchain/langgraph-cli": "^1.0.0",
    "@langchain/langgraph-sdk": "^1.0.0",
    "@langchain/react": "^0.1.0",
    "esbuild": "^0.28.0",
    "lucide-react": "^1.0.0",
    "nanoid": "^5.0.0",
    "prettier": "^3.8.0",
    "react-syntax-highlighter": "^16.0.0",
    "recharts": "^3.0.0",
    "uuid": "^13.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.13.5",
    "dotenv": "^16.4.7",
    "typescript": "~5.7.2"
  }
}
```

Also update React and Next.js to their latest stable versions within the current major:

```json
{
  "dependencies": {
    "react": "^19.1.0",
    "react-dom": "^19.1.0"
  },
  "devDependencies": {
    "next": "^15.5.0",
    "@types/react": "^19.1.0",
    "@types/react-dom": "^19.1.0"
  }
}
```

Check if the `react-is` override is still needed with React 19.1 stable. If `react-is` 19.x is now published, remove the override.

Keep these UNCHANGED (user specified):
- All `eslint*`, `@eslint/*`, `globals` packages — do not touch
- `typescript` — keep at `~5.7.2`

Add `@langchain/react` as a new dependency — it provides the AI Elements bridge and additional React hooks for LangChain.

Also update the `overrides` section inside `apps/web/package.json` if it exists:

```json
{
  "overrides": {
    "react-is": "^19.0.0-rc-69d4b800-20241021"
  }
}
```

Keep the `react-is` override as-is — it's needed for React 19 compatibility.

- [ ] **Step 3: Install updated dependencies**

Run:
```bash
cd apps/web && npm install
```

Expected: installs without errors. Resolve any peer dependency warnings.

- [ ] **Step 4: Check for breaking import changes**

After upgrading, some imports may have changed. Run:
```bash
cd apps/web && npx tsc --noEmit 2>&1 | head -50
```

Common breaking changes to watch for:
- `@langchain/langgraph-sdk` 1.x: `useStream` import path may change. Current: `@langchain/langgraph-sdk/react`. Check if it's still valid.
- `lucide-react` 1.x: icon names may use PascalCase consistently now. Check imports.
- `nanoid` 5.x: ESM-only, default export changed to named. `import { nanoid } from 'nanoid'`.
- `uuid` 13.x: `v4` may still be available as `import { v4 as uuidv4 } from 'uuid'`.
- `recharts` 3.x: component API may have changed.
- `zod` 4.x: `z.object()`, `z.string()` etc. still work. Key change: `z.infer<>` → same. `safeParse` → same. Main migration: some utility types renamed. Check `apps/agents/` tool schemas too — zod is used across both workspaces.

Fix any import errors found. If a package has too many breaking changes in existing scaffold code we won't use (e.g., recharts charts we'll replace), just fix the compile errors minimally — we'll rewrite those components later.

- [ ] **Step 5: Verify build passes**

Run:
```bash
npm run build --filter=web
```

Expected: build completes. Fix any remaining type errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json package.json apps/web/package-lock.json package-lock.json
git add -u  # any import fixes
git commit -m "chore(web): upgrade LangChain to 1.x and update stale dependencies"
```

---

### Task 2: Create .env.example and Refactor StreamProvider

Remove the Agent Chat UI configuration form from `Stream.tsx`. Nexus always connects to `localhost:2024` with assistant ID `nexus`. The form should never appear — if env vars aren't set, use sensible defaults. Add `filterSubagentMessages: true` for sub-agent streaming support (Plan 7 needs this).

**Files:**
- Create: `apps/web/.env.example`
- Modify: `apps/web/src/providers/Stream.tsx`

- [ ] **Step 1: Create .env.example**

```bash
# apps/web/.env.example
# Nexus Frontend Environment Variables

# LangGraph server URL (default: http://localhost:2024)
NEXT_PUBLIC_API_URL=http://localhost:2024

# Graph/assistant ID registered in langgraph.json (default: nexus)
NEXT_PUBLIC_ASSISTANT_ID=nexus

# LangSmith API key (optional, only needed for deployed graphs)
# NEXT_PUBLIC_LANGSMITH_API_KEY=lsv2_pt_...
```

- [ ] **Step 2: Rewrite Stream.tsx — remove config form, hardcode Nexus defaults**

Replace the entire `apps/web/src/providers/Stream.tsx` with:

```typescript
"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import { type Message } from "@langchain/langgraph-sdk";
import {
  uiMessageReducer,
  type UIMessage,
  type RemoveUIMessage,
} from "@langchain/langgraph-sdk/react-ui";
import { useQueryState } from "nuqs";
import { useThreads } from "./Thread";
import { toast } from "sonner";

export type StateType = { messages: Message[]; ui?: UIMessage[] };

const useTypedStream = useStream<
  StateType,
  {
    UpdateType: {
      messages?: Message[] | Message | string;
      ui?: (UIMessage | RemoveUIMessage)[] | UIMessage | RemoveUIMessage;
    };
    CustomEventType: UIMessage | RemoveUIMessage;
  }
>;

type StreamContextType = ReturnType<typeof useTypedStream>;
const StreamContext = createContext<StreamContextType | undefined>(undefined);

// Nexus defaults — no config form needed
const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
const ASSISTANT_ID =
  process.env.NEXT_PUBLIC_ASSISTANT_ID || "nexus";
const API_KEY =
  process.env.NEXT_PUBLIC_LANGSMITH_API_KEY || undefined;

async function checkGraphStatus(apiUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${apiUrl}/info`);
    return res.ok;
  } catch {
    return false;
  }
}

export const StreamProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [threadId, setThreadId] = useQueryState("threadId");
  const { getThreads, setThreads } = useThreads();

  const streamValue = useTypedStream({
    apiUrl: API_URL,
    apiKey: API_KEY,
    assistantId: ASSISTANT_ID,
    threadId: threadId ?? null,
    filterSubagentMessages: true,
    onCustomEvent: (event, options) => {
      options.mutate((prev) => {
        const ui = uiMessageReducer(prev.ui ?? [], event);
        return { ...prev, ui };
      });
    },
    onThreadId: (id) => {
      setThreadId(id);
      setTimeout(() => {
        getThreads().then(setThreads).catch(console.error);
      }, 4000);
    },
  });

  useEffect(() => {
    checkGraphStatus(API_URL).then((ok) => {
      if (!ok) {
        toast.error("Cannot reach LangGraph server", {
          description: `Ensure the server is running at ${API_URL}`,
          duration: 10000,
          richColors: true,
          closeButton: true,
        });
      }
    });
  }, []);

  return (
    <StreamContext.Provider value={streamValue}>
      {children}
    </StreamContext.Provider>
  );
};

export const useStreamContext = (): StreamContextType => {
  const context = useContext(StreamContext);
  if (context === undefined) {
    throw new Error("useStreamContext must be used within a StreamProvider");
  }
  return context;
};

export default StreamContext;
```

Key changes from scaffold:
1. Removed the entire config form UI (the `if (!finalApiUrl || !finalAssistantId)` block)
2. Removed `StreamSession` wrapper — single component now
3. Hardcoded defaults: `API_URL`, `ASSISTANT_ID`, `API_KEY` from env vars with fallbacks
4. Added `filterSubagentMessages: true` — keeps coordinator messages clean for Plan 7
5. Removed LangGraph logo, Input, Button, Label, PasswordInput imports
6. Removed `getApiKey()` localStorage logic — env var only now

- [ ] **Step 3: Verify TypeScript compiles**

Run:
```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "Stream\|stream" | head -20
```

Expected: no errors in Stream.tsx. If `filterSubagentMessages` is not yet available in the SDK version installed, remove it temporarily and add a `// TODO: enable after SDK upgrade` comment.

- [ ] **Step 4: Commit**

```bash
git add apps/web/.env.example apps/web/src/providers/Stream.tsx
git commit -m "refactor(web): remove config form from StreamProvider, hardcode Nexus defaults"
```

---

### Task 3: Update layout.tsx — Dark Mode & Metadata

Set the `dark` class on `<html>` so the existing dark theme variables activate, and update metadata from "Agent Inbox" to "Nexus". Keep existing fonts (Inter + JetBrains Mono) and globals.css unchanged.

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 1: Update layout.tsx — add dark class, update metadata**

Edit `apps/web/src/app/layout.tsx`:

1. Add `"dark"` to the `<html>` className so the `.dark` CSS variables in globals.css activate:

```typescript
import type { Metadata } from "next";
import "./globals.css";
import { Inter, JetBrains_Mono } from "next/font/google";
import React from "react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { cn } from "@/lib/utils";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

const inter = Inter({
  subsets: ["latin"],
  preload: true,
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nexus",
  description: "Everything AI can do, Nexus does for you.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={cn("dark font-mono", jetbrainsMono.variable)}>
      <body className={cn(inter.className, "antialiased bg-background text-foreground min-h-screen")}>
        <NuqsAdapter>{children}</NuqsAdapter>
      </body>
    </html>
  );
}
```

Key changes:
- Added `"dark"` to `<html>` className — forces dark mode always, activates `.dark` CSS variables
- Metadata: "Agent Inbox" → "Nexus", updated description
- Body: added `antialiased bg-background text-foreground min-h-screen` for consistent dark base
- Kept Inter and JetBrains Mono fonts unchanged

- [ ] **Step 2: Verify dark theme activates**

Run:
```bash
cd apps/web && npm run dev
```

Open `http://localhost:3000`. Expected: dark background from the existing `.dark` CSS variables, no white flash.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(web): enable dark mode and update metadata to Nexus"
```

---

### Task 4: Create Nexus Landing Page Components

Build the landing page: centered logo, tagline, and prompt input. This is the idle state before the user submits a prompt.

Design spec layout:
```
┌──────────────────────────────────────────────┐
│                                              │
│            [Nexus wordmark]                  │
│                                              │
│           Nexus works.                       │
│   Everything AI can do, Nexus does for you.  │
│                                              │
│  ┌────────────────────────────────────────┐  │
│  │ [Prompt textarea]              →      │  │
│  └────────────────────────────────────────┘  │
│                                              │
└──────────────────────────────────────────────┘
```

**Files:**
- Create: `apps/web/src/components/landing/nexus-logo.tsx`
- Create: `apps/web/src/components/landing/nexus-prompt.tsx`
- Create: `apps/web/src/components/landing/index.tsx`

- [ ] **Step 1: Create nexus-logo.tsx**

```typescript
// apps/web/src/components/landing/nexus-logo.tsx
"use client";

import { motion } from "framer-motion";

export function NexusLogo() {
  return (
    <motion.div
      className="flex flex-col items-center gap-4"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
    >
      {/* Geometric logomark */}
      <div className="relative size-14">
        <svg
          viewBox="0 0 56 56"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="size-14"
        >
          {/* Hexagonal shape with teal gradient */}
          <path
            d="M28 4L50 16V40L28 52L6 40V16L28 4Z"
            className="stroke-primary"
            strokeWidth="2"
            fill="none"
          />
          {/* Inner N letterform */}
          <path
            d="M20 38V18L36 38V18"
            className="stroke-primary"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
        {/* Subtle glow behind logo */}
        <div className="absolute inset-0 blur-2xl opacity-30 bg-primary rounded-full" />
      </div>
    </motion.div>
  );
}
```

- [ ] **Step 2: Create nexus-prompt.tsx**

```typescript
// apps/web/src/components/landing/nexus-prompt.tsx
"use client";

import { useState, FormEvent, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { ArrowUpIcon } from "@hugeicons/core-free-icons";
import { HugeIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface NexusPromptProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export function NexusPrompt({ onSubmit, isLoading }: NexusPromptProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSubmit(input.trim());
    setInput("");
  };

  return (
    <motion.div
      className="w-full max-w-2xl"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
    >
      <form onSubmit={handleSubmit}>
        <div className="rounded-2xl border bg-card/50 shadow-sm ring-1 ring-ring/10 focus-within:ring-ring/30 transition-shadow duration-300">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.metaKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault();
                const form = (e.target as HTMLElement).closest("form");
                form?.requestSubmit();
              }
            }}
            placeholder="What would you like Nexus to do?"
            rows={1}
            className="w-full resize-none bg-transparent px-5 pt-4 pb-2 text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none field-sizing-content min-h-[44px] max-h-[200px]"
          />
          <div className="flex items-center justify-end px-3 pb-3">
            <Button
              type="submit"
              size="sm"
              disabled={isLoading || !input.trim()}
              className="rounded-xl px-3 h-9 gap-1.5 transition-all"
            >
              {isLoading ? (
                <Spinner className="size-4" />
              ) : (
                <HugeIcon icon={ArrowUpIcon} className="size-4" data-icon="inline-start" />
              )}
              {isLoading ? "Working..." : "Send"}
            </Button>
          </div>
        </div>
      </form>
    </motion.div>
  );
}
```

Notes:
- Uses existing theme variables: `bg-card/50`, `border`, `ring-ring/10` for styling
- `field-sizing-content` for auto-growing textarea
- hugeicons for the arrow icon (per shadcn config: `iconLibrary: "hugeicons"`)
- Keyboard shortcut: Enter to submit, Shift+Enter for newline

- [ ] **Step 3: Create landing/index.tsx — the full landing layout**

```typescript
// apps/web/src/components/landing/index.tsx
"use client";

import { motion } from "framer-motion";
import { NexusLogo } from "./nexus-logo";
import { NexusPrompt } from "./nexus-prompt";

interface LandingPageProps {
  onSubmit: (text: string) => void;
  isLoading: boolean;
}

export function LandingPage({ onSubmit, isLoading }: LandingPageProps) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center px-4">
      <div className="flex flex-col items-center gap-8 w-full">
        <NexusLogo />

        {/* Tagline */}
        <motion.div
          className="flex flex-col items-center gap-2 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
        >
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            Nexus works.
          </h1>
          <p className="text-lg text-muted-foreground max-w-md">
            Everything AI can do, Nexus does for you.
          </p>
        </motion.div>

        {/* Prompt input */}
        <NexusPrompt onSubmit={onSubmit} isLoading={isLoading} />
      </div>
    </div>
  );
}
```

Design details:
- Centered vertically and horizontally (flex, min-h-screen)
- Staggered entrance animations (logo → tagline → prompt)
- Uses existing theme colors from globals.css — no custom CSS added
- Responsive: `text-4xl sm:text-5xl` for the heading

- [ ] **Step 4: Verify components render**

Run:
```bash
cd apps/web && npx tsc --noEmit 2>&1 | grep -i "landing\|nexus-logo\|nexus-prompt" | head -10
```

Expected: no type errors. If `HugeIcon` or `ArrowUpIcon` imports don't resolve, check the hugeicons package exports and adjust:
```typescript
// Alternative import if @hugeicons/core-free-icons doesn't export ArrowUpIcon:
import { ArrowUp01Icon as ArrowUpIcon } from "@hugeicons/core-free-icons";
```

If `Spinner` component doesn't exist yet, check `apps/web/src/components/ui/` for it. If missing, add it:
```bash
npx shadcn@latest add spinner
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/landing/
git commit -m "feat(web): create landing page components — logo, tagline, prompt input"
```

---

### Task 5: Rewrite page.tsx — Landing Page with Prompt Submission

Wire the landing page into the app. Replace the scaffold's `<Thread />` with a state-driven layout: landing page when idle, placeholder for execution view (Plan 7) when active.

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/hooks/use-nexus-stream.ts`

- [ ] **Step 1: Create use-nexus-stream.ts hook**

A thin wrapper around `useStreamContext` that adds Nexus-specific helpers.

```typescript
// apps/web/src/hooks/use-nexus-stream.ts
"use client";

import { useStreamContext } from "@/providers/Stream";
import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { ensureToolCallsHaveResponses } from "@/lib/ensure-tool-responses";

export function useNexusStream() {
  const stream = useStreamContext();

  const submitPrompt = useCallback(
    (text: string) => {
      const newMessage = {
        id: uuidv4(),
        type: "human" as const,
        content: text,
      };

      const toolMessages = ensureToolCallsHaveResponses(stream.messages);
      stream.submit(
        { messages: [...toolMessages, newMessage] },
        {
          streamMode: ["values"],
          streamSubgraphs: true,
          optimisticValues: (prev) => ({
            ...prev,
            messages: [
              ...(prev.messages ?? []),
              ...toolMessages,
              newMessage,
            ],
          }),
        },
      );
    },
    [stream],
  );

  const hasMessages = stream.messages.length > 0;

  return {
    ...stream,
    submitPrompt,
    hasMessages,
  };
}
```

Key details:
- `submitPrompt(text)` — creates a human message, ensures tool responses, submits with `streamSubgraphs: true`
- `hasMessages` — used to decide whether to show landing or execution view
- `streamSubgraphs: true` — enables sub-agent streaming (critical for Plan 7)

- [ ] **Step 2: Rewrite page.tsx**

```typescript
// apps/web/src/app/page.tsx
"use client";

import React from "react";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/components/landing";
import { useNexusStream } from "@/hooks/use-nexus-stream";

function NexusApp() {
  const { submitPrompt, isLoading, hasMessages } = useNexusStream();

  if (hasMessages) {
    // Execution view — placeholder until Plan 7
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <p className="text-lg">Execution view coming in Plan 7...</p>
          <p className="text-sm">
            {isLoading ? "Agent is working..." : "Agent finished."}
          </p>
        </div>
      </div>
    );
  }

  return <LandingPage onSubmit={submitPrompt} isLoading={isLoading} />;
}

export default function Page(): React.ReactNode {
  return (
    <React.Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      }
    >
      <Toaster theme="dark" />
      <ThreadProvider>
        <StreamProvider>
          <NexusApp />
        </StreamProvider>
      </ThreadProvider>
    </React.Suspense>
  );
}
```

Key changes from scaffold:
- Replaced `<Thread />` with state-driven routing: `hasMessages` → execution view (placeholder), else → landing page
- `NexusApp` inner component uses `useNexusStream()` hook
- Toaster gets `theme="dark"` prop
- Suspense fallback matches dark theme
- Execution view is a placeholder — Plan 7 builds the real 30/70 split layout

- [ ] **Step 3: Verify the full flow**

Run:
```bash
cd apps/web && npm run dev
```

Open `http://localhost:3000`:
1. Landing page should show: dark background, Nexus logo, "Nexus works." heading, tagline, prompt input with teal glow
2. Prompt input should auto-focus
3. Typing text and pressing Enter (or clicking Send) should transition to the execution placeholder

If the LangGraph server is NOT running, a toast error should appear: "Cannot reach LangGraph server".

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/hooks/use-nexus-stream.ts
git commit -m "feat(web): wire landing page with prompt submission and stream routing"
```

---

### Task 6: Strip Scaffold Branding & Cleanup

Remove Agent Chat UI branding, unused scaffold references, and any white-background hardcoded styles. Ensure no scaffold remnants bleed into the Nexus UI.

**Files:**
- Modify: `apps/web/src/components/thread/index.tsx` — strip scaffold branding
- Possibly modify: other thread components with hardcoded light theme styles

- [ ] **Step 1: Audit thread/index.tsx for scaffold branding**

In `apps/web/src/components/thread/index.tsx`, find and replace:
1. `"Agent Chat"` string → `"Nexus"` (line ~305, ~379)
2. `<LangGraphLogoSVG ...>` → remove or replace with Nexus branding
3. `<OpenGitHubRepo />` → remove entirely (the GitHub link to agent-chat-ui)
4. `bg-white` → `bg-background` (line ~212, ~372)
5. `hover:bg-gray-100` → `hover:bg-accent` (line ~256, ~279)
6. `text-gray-600` → `text-muted-foreground` (line ~419)

Apply these replacements throughout the file. The Thread component is kept for Plan 7 but shouldn't show scaffold branding.

- [ ] **Step 2: Verify no white backgrounds remain**

Search for hardcoded light theme classes across the web app:

```bash
grep -rn "bg-white\|bg-gray-\|text-gray-\|border-gray-" apps/web/src/components/thread/ apps/web/src/components/landing/ apps/web/src/app/ apps/web/src/providers/
```

Replace any found instances with semantic Tailwind classes:
- `bg-white` → `bg-background`
- `bg-gray-100` → `bg-muted`
- `text-gray-600` → `text-muted-foreground`
- `border-gray-200` → `border-border`

- [ ] **Step 3: Remove unused imports from thread/index.tsx**

After removing `OpenGitHubRepo` and `LangGraphLogoSVG` usage, clean up their imports:
- Remove `import { LangGraphLogoSVG } from "../icons/langgraph";`
- Remove `import { GitHubSVG } from "../icons/github";`
- Remove the `OpenGitHubRepo` function definition

- [ ] **Step 4: Verify clean build**

```bash
npm run build --filter=web
```

Expected: builds without errors or warnings about unused imports.

- [ ] **Step 5: Commit**

```bash
git add -u apps/web/src/
git commit -m "refactor(web): strip Agent Chat UI branding and hardcoded light theme styles"
```

---

### Task 7: Final Integration Verification

End-to-end check that all pieces work together.

**Files:**
- No new files — verification only

- [ ] **Step 1: Cold start test**

```bash
# From repo root
npm run build
npm run dev
```

Open `http://localhost:3000`:

- [ ] Dark theme loads immediately (no white flash)
- [ ] Outfit font renders (check in dev tools → Computed → font-family)
- [ ] Nexus logo visible with subtle glow
- [ ] "Nexus works." heading and tagline visible
- [ ] Prompt input has teal border glow
- [ ] Prompt auto-focuses on page load
- [ ] Typing text works, Enter submits

- [ ] **Step 2: Prompt submission test (with LangGraph server)**

If the LangGraph server is running (`npm run dev` starts both):

1. Type "Hello" and press Enter
2. Should transition to execution placeholder: "Execution view coming in Plan 7..."
3. If agent responds, "Agent finished." should appear

If the LangGraph server is NOT running:
1. Toast error should appear: "Cannot reach LangGraph server"
2. Submitting a prompt should still attempt (may error gracefully)

- [ ] **Step 3: Build verification**

```bash
npm run build
npm run lint --filter=web
```

Expected: both pass cleanly.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -u
git commit -m "fix(web): address integration issues from Plan 6 verification"
```

---

## Dependency Update Summary

| Package | Before | After | Breaking? |
|---------|--------|-------|-----------|
| @langchain/core | ^0.3.42 | ^1.0.0 | MAJOR — LangChain 1.0 LTS |
| @langchain/langgraph | ^0.2.55 | ^1.0.0 | MAJOR |
| @langchain/langgraph-api | ^0.0.16 | ^1.0.0 | MAJOR |
| @langchain/langgraph-cli | ^0.0.16 | ^1.0.0 | MAJOR |
| @langchain/langgraph-sdk | ^0.0.57 | ^1.0.0 | MAJOR — useStream API may change |
| @langchain/react | (new) | ^0.1.0 | NEW — AI Elements bridge |
| esbuild | ^0.25.0 | ^0.28.0 | Minor |
| lucide-react | ^0.476.0 | ^1.0.0 | MAJOR — icon names |
| nanoid | ^3.3.11 | ^5.0.0 | MAJOR — ESM only |
| prettier | ^3.5.2 | ^3.8.0 | Patch |
| react-syntax-highlighter | ^15.5.0 | ^16.0.0 | MAJOR |
| recharts | ^2.15.1 | ^3.0.0 | MAJOR |
| uuid | ^11.0.5 | ^13.0.0 | MAJOR |
| zod | ^3.24.2 | ^4.0.0 | MAJOR — Zod 4, LangChain supports it |
| react | ^19.0.0 | ^19.1.0 | Stable React 19 |
| react-dom | ^19.0.0 | ^19.1.0 | Stable React 19 |
| next | ^15.2.3 | ^15.5.0 | Latest stable Next.js 15 |
| @types/react | ^19.0.8 | ^19.1.0 | Match React 19 stable |
| @types/react-dom | ^19.0.3 | ^19.1.0 | Match React 19 stable |

**NOT updated (per user request):**
- eslint, @eslint/js, eslint-config-next, eslint-plugin-*, globals
- typescript (stays at ~5.7.2)

## Design Decisions

**Fonts & CSS:** Keep existing globals.css, Inter + JetBrains Mono fonts, and tailwind.config.js unchanged. The scaffold's existing dark theme variables (mist color scheme with teal/cyan accents) align well with the Perplexity-inspired aesthetic.

**Dark mode:** Activated by adding `className="dark"` to the `<html>` element in layout.tsx. This activates the `.dark` CSS variables already defined in globals.css.

**Landing page animation:** Staggered fade-in (logo �� tagline → prompt). Subtle, not flashy — matches the refined minimalist tone.

**Prompt input styling:** Uses existing theme tokens (`bg-card/50`, `border`, `ring-ring`) rather than custom CSS. Focus state uses `ring-ring/30` for a subtle highlight.

## What Plan 7 Will Build On

This plan establishes:
- `useNexusStream()` hook with `submitPrompt()` and `hasMessages`
- `StreamProvider` with `filterSubagentMessages: true` (sub-agent streaming ready)
- Dark theme CSS variables and utility classes
- Landing ↔ execution state routing in `page.tsx`
- The `hasMessages` check that Plan 7 replaces with the 30/70 execution layout

Plan 7 will:
- Replace the execution placeholder with the 30/70 split layout
- Build the left panel (todo list + agent status)
- Build the right panel (agent cards with streaming)
- Add synthesis indicator and completion state
