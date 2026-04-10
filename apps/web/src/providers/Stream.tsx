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
