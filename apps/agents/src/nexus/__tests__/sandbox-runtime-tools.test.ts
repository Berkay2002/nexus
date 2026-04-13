import { describe, expect, it } from "vitest";
import {
  sandboxCodeExecute,
  sandboxCodeExecuteSchema,
} from "../tools/code-execute/tool.js";
import {
  sandboxJupyterCreateSession,
  sandboxJupyterCreateSessionSchema,
} from "../tools/jupyter-create-session/tool.js";
import {
  sandboxJupyterExecute,
  sandboxJupyterExecuteSchema,
} from "../tools/jupyter-execute/tool.js";

describe("sandbox runtime tools", () => {
  it("should expose sandbox_code_execute metadata", () => {
    expect(sandboxCodeExecute.name).toBe("sandbox_code_execute");
    expect(sandboxCodeExecute.description).toContain("/v1/code/execute");
    expect(sandboxCodeExecuteSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_create_session metadata", () => {
    expect(sandboxJupyterCreateSession.name).toBe(
      "sandbox_jupyter_create_session",
    );
    expect(sandboxJupyterCreateSession.description).toContain(
      "/v1/jupyter/sessions/create",
    );
    expect(sandboxJupyterCreateSessionSchema).toBeDefined();
  });

  it("should expose sandbox_jupyter_execute metadata", () => {
    expect(sandboxJupyterExecute.name).toBe("sandbox_jupyter_execute");
    expect(sandboxJupyterExecute.description).toContain("/v1/jupyter/execute");
    expect(sandboxJupyterExecuteSchema).toBeDefined();
  });
});
