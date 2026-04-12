---
created: 2026-04-12
updated: 2026-04-12
tags: [deepagents, sandbox, backends, execution]
sources: [raw/langchain/deepagents/sandbox.md]
---

# BaseSandbox Protocol

`BaseSandbox` is the abstract base class in DeepAgents that custom sandbox backends must extend. It defines the implementation contract for sandbox [[backends]]: a provider implements exactly one method — `execute()` — and `BaseSandbox` derives all filesystem tools from it automatically.

## The contract

The only method a provider must implement is:

```typescript
execute(command: string): Promise<ExecuteResult>
```

`ExecuteResult` contains:
- `stdout` / `stderr` (or combined output depending on provider)
- `exitCode: number`
- A truncation notice if output exceeded the limit

Every filesystem operation — `read_file`, `write_file`, `edit_file`, `ls`, `glob`, `grep` — is implemented by `BaseSandbox` by constructing a shell script and calling `execute()` with it. This means adding a new provider requires implementing only one method.

## SandboxBackendProtocol

`SandboxBackendProtocol` is the interface the DeepAgents harness checks to decide whether to expose the `execute` tool to the LLM. On every model call, the harness inspects whether the configured backend implements this protocol. If it does, `execute` appears in the agent's tool list. If not, it is filtered out.

A class that extends `BaseSandbox` automatically satisfies `SandboxBackendProtocol`.

## Implementing a custom sandbox backend

To integrate a custom execution environment (e.g., Nexus's [[aio-sandbox-deepagents-integration|AIOSandboxBackend]]):

1. Extend `BaseSandbox` from `deepagents`.
2. Implement `execute(command: string): Promise<ExecuteResult>` — call your provider's API to run the command in the isolated environment and return the result.
3. Optionally implement `uploadFiles()` and `downloadFiles()` for host-to-sandbox file transfer via the provider's native API (these are separate from the agent filesystem tools).
4. Pass an instance as `backend` to `createDeepAgent()`.

```typescript
import { BaseSandbox } from "deepagents";

class AIOSandboxBackend extends BaseSandbox {
  async execute(command: string) {
    // call AIO Sandbox HTTP API at :8080
    const result = await this.client.shell.run(command);
    return {
      output: result.stdout + result.stderr,
      exitCode: result.exitCode,
    };
  }
}

const agent = createDeepAgent({
  backend: new AIOSandboxBackend(client),
  systemPrompt: "...",
});
```

## Large output handling

If a command produces very large output, `BaseSandbox` automatically saves it to a file and instructs the agent to use `read_file` to access it incrementally. This prevents context window overflow without requiring any provider-specific logic.

## Relationship to other backends

`BaseSandbox` sits above all filesystem tool construction. Provider SDKs sit below it, supplying only `execute()`. The `SandboxBackendProtocol` check is how the harness distinguishes sandbox backends (which expose `execute`) from pure filesystem backends (State, Store, Filesystem) which do not.

See [[deepagents-sandboxes]] for the full list of built-in providers, lifecycle scoping, and security considerations.

## Related

- [[deepagents-sandboxes]]
- [[backends]]
- [[aio-sandbox-deepagents-integration]]
- [[backend-protocol]]

## Sources

- `raw/langchain/deepagents/sandbox.md` — the `execute` method architecture, `BaseSandbox` design, `SandboxBackendProtocol` check, large output handling
