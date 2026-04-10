"use client";

import React from "react";
import { StreamProvider } from "@/providers/Stream";
import { ThreadProvider } from "@/providers/Thread";
import { Toaster } from "@/components/ui/sonner";
import { LandingPage } from "@/components/landing";
import { ExecutionView } from "@/components/execution";
import { useNexusStream } from "@/hooks/use-nexus-stream";

function NexusApp() {
  const { submitPrompt, isLoading, hasMessages } = useNexusStream();

  if (hasMessages) {
    return <ExecutionView />;
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
