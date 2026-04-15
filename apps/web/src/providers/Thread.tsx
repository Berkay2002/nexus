import { validate } from "uuid";
import { getApiKey } from "@/lib/api-key";
import { Thread } from "@langchain/langgraph-sdk";
import {
  createContext,
  useContext,
  ReactNode,
  useCallback,
  useEffect,
  useState,
  Dispatch,
  SetStateAction,
} from "react";
import { createClient } from "./client";

export interface ThreadContextType {
  getThreads: () => Promise<Thread[]>;
  refreshThreads: () => Promise<void>;
  threads: Thread[];
  setThreads: Dispatch<SetStateAction<Thread[]>>;
  threadsLoading: boolean;
  setThreadsLoading: Dispatch<SetStateAction<boolean>>;
}

export const ThreadContext = createContext<ThreadContextType | undefined>(
  undefined,
);

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:2024";
const ASSISTANT_ID = process.env.NEXT_PUBLIC_ASSISTANT_ID || "nexus";

function getThreadSearchMetadata(
  assistantId: string,
): { graph_id: string } | { assistant_id: string } {
  if (validate(assistantId)) {
    return { assistant_id: assistantId };
  } else {
    return { graph_id: assistantId };
  }
}

function sortByUpdatedDesc(threads: Thread[]): Thread[] {
  return [...threads].sort((a, b) => {
    const ta = a.updated_at ? Date.parse(a.updated_at) : 0;
    const tb = b.updated_at ? Date.parse(b.updated_at) : 0;
    return tb - ta;
  });
}

export function ThreadProvider({ children }: { children: ReactNode }) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);

  const getThreads = useCallback(async (): Promise<Thread[]> => {
    const client = createClient(API_URL, getApiKey() ?? undefined);
    const result = await client.threads.search({
      metadata: {
        ...getThreadSearchMetadata(ASSISTANT_ID),
      },
      limit: 100,
    });
    return sortByUpdatedDesc(result);
  }, []);

  const refreshThreads = useCallback(async () => {
    setThreadsLoading(true);
    try {
      const next = await getThreads();
      setThreads(next);
    } catch (err) {
      console.error("[threads] refresh failed", err);
    } finally {
      setThreadsLoading(false);
    }
  }, [getThreads]);

  useEffect(() => {
    void refreshThreads();
  }, [refreshThreads]);

  const value = {
    getThreads,
    refreshThreads,
    threads,
    setThreads,
    threadsLoading,
    setThreadsLoading,
  };

  return (
    <ThreadContext.Provider value={value}>{children}</ThreadContext.Provider>
  );
}

export function useThreads() {
  const context = useContext(ThreadContext);
  if (context === undefined) {
    throw new Error("useThreads must be used within a ThreadProvider");
  }
  return context;
}
