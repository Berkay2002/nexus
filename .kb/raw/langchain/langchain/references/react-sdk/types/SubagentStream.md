Represents a single subagent stream.

Supports two usage patterns:

Agent type inference (recommended): Pass a DeepAgent type directly and let TypeScript infer the correct state and tool call types.

import type { agent } from "./agent";

// Automatically infers state and tool call types from the agent
const subagent: SubagentStream<typeof agent> = ...;

Explicit generics: Pass state and tool call types manually.

type ResearcherState = { research_notes: string };
const researcher: SubagentStream<ResearcherState, MyToolCall> = ...;

SubagentStream: IsDeepAgentLike<
  T
> extends true ? SubagentStreamInterface<SubagentStateMap<T, InferAgentToolCalls<T>>[InferSubagentNames<T>], InferAgentToolCalls<T>, InferSubagentNames<T>> : IsAgentLike<T> extends true ? SubagentStreamInterface<InferAgentState<T>, InferAgentToolCalls<T>> : SubagentStreamInterface<T, ToolCall>