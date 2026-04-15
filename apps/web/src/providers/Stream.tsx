"use client";

import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { useStream } from "@langchain/react";
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StreamContextType = ReturnType<typeof useStream<any>>;
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

  // filterSubagentMessages is typed on AnyStreamOptions but not on the
  // UseStreamOptions overload. Runtime handles it — use type assertion.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const streamValue = useStream<StateType>({
    apiUrl: API_URL,
    apiKey: API_KEY,
    assistantId: ASSISTANT_ID,
    threadId: threadId ?? null,
    filterSubagentMessages: true,
    // Persist the per-thread runId (`lg:stream:{threadId}`) to localStorage so
    // reloading, closing the tab, or opening a new tab on the same machine
    // rejoins the live run instead of cancelling it. `reconnectOnMount: true`
    // would use sessionStorage (per-tab, dies with the tab) and doesn't
    // satisfy the cross-tab story. Returning `localStorage` — which satisfies
    // `RunMetadataStorage` structurally (getItem/setItem/removeItem) — keeps
    // the key alive across tabs. Also flips the server-side `onDisconnect`
    // default from "cancel" to "continue", so closing the SSE connection no
    // longer aborts the run (stream.lgp.js:332-343, types.d.ts:896-900).
    reconnectOnMount: () => window.localStorage,
    onCustomEvent: (event: unknown, options: { mutate: (fn: (prev: StateType) => Partial<StateType>) => void }) => {
      options.mutate((prev: StateType) => {
        const ui = uiMessageReducer(
          prev.ui ?? [],
          event as UIMessage | RemoveUIMessage,
        );
        return { ...prev, ui };
      });
    },
    onThreadId: (id: string) => {
      setThreadId(id);
      setTimeout(() => {
        getThreads().then(setThreads).catch(console.error);
      }, 4000);
    },
    // Purge stale rejoin keys so a deleted-thread runId doesn't zombie in
    // localStorage. The library auto-removes the key on success / stop /
    // join-success, but not on joinStream failure.
    onError: (error: unknown, run: { thread_id: string } | undefined) => {
      if (run && typeof window !== "undefined") {
        window.localStorage.removeItem(`lg:stream:${run.thread_id}`);
      }
      console.error("[useStream] error", error);
    },
  } as any);

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
