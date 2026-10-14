import { describe, it, expect, vi, beforeEach } from "vitest";

type BridgeFn = (...args: unknown[]) => unknown;

const isolateState = vi.hoisted(() => ({
  bridges: new Map<string, BridgeFn>(),
  lastScriptSource: "",
}));

vi.mock("isolated-vm", () => {
  class FakeReference {
    fn: BridgeFn;
    constructor(fn: BridgeFn) {
      this.fn = fn;
    }
    async apply(_recv: unknown, args: unknown[]) {
      return this.fn(...args);
    }
  }

  class FakeIsolate {
    async createContext() {
      isolateState.bridges.clear();
      return {
        global: {
          set: async (key: string, value: unknown) => {
            if (value instanceof FakeReference) {
              isolateState.bridges.set(key, value.fn);
            }
          },
          derefInto: () => ({}),
        },
      };
    }
    async compileScript(source: string) {
      isolateState.lastScriptSource = source;
      return {
        run: async () => {
          const callToolBridge = isolateState.bridges.get("__callTool");
          if (!callToolBridge) {
            throw new Error("callTool bridge missing");
          }
          const callTool = async (toolKey: string, input: unknown) => {
            const raw = await callToolBridge(
              toolKey,
              JSON.stringify(input ?? {}),
            );
            return JSON.parse(String(raw));
          };

          // Mirror the wrapped execute body: find statements after the export wrapper
          // by evaluating the user code snippet from the bundled source marker.
          // Tests drive behavior via callTool only (compile is mocked).
          if (isolateState.lastScriptSource.includes("__CALL_GET_WEATHER__")) {
            const weather = await callTool("get_weather", { location: "SG" });
            return JSON.stringify({ weather });
          }
          if (isolateState.lastScriptSource.includes("__CALL_UNKNOWN__")) {
            const out = await callTool("nope", {});
            return JSON.stringify({ out });
          }
          if (isolateState.lastScriptSource.includes("__RETURN_ARRAY__")) {
            return JSON.stringify([1, 2, 3]);
          }
          return JSON.stringify({});
        },
      };
    }
    dispose() {}
  }

  return {
    default: {
      Isolate: FakeIsolate,
      Reference: FakeReference,
      ExternalCopy: class {
        value: unknown;
        constructor(value: unknown) {
          this.value = value;
        }
        copyInto() {
          return this.value;
        }
      },
    },
  };
});

const mockRunCustomTool = vi.fn();
const mockBundleCustomToolSource = vi.fn();

vi.mock("./run.js", () => ({
  runCustomTool: (...args: unknown[]) => mockRunCustomTool(...args),
}));

vi.mock("./compile.js", () => ({
  bundleCustomToolSource: (...args: unknown[]) =>
    mockBundleCustomToolSource(...args),
}));

vi.mock("../composio.js", () => ({
  COMPOSIO_GOOGLEDRIVE_READ_SLUGS: new Set(["GOOGLEDRIVE_FIND_FILE"]),
  executeGoogleDriveTool: vi.fn(),
}));

vi.mock("../linked-docs-read.js", () => ({
  readLinkedDocContent: vi.fn(),
}));

import { runExecuteCode } from "./execute-code.js";

const baseTools = [
  {
    toolKey: "get_weather",
    source: "export async function execute() { return { ok: true }; }",
    sourceHash: "hash-1",
    env: {},
  },
];

const baseContext = {
  workspaceId: "ws-1",
  sessionId: "sess-1",
  agentConfigId: "agent-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  isolateState.bridges.clear();
  isolateState.lastScriptSource = "";
  mockBundleCustomToolSource.mockImplementation(async (source: string) => ({
    ok: true as const,
    bundle: `/* ${source} */`,
  }));
  mockRunCustomTool.mockResolvedValue({ ok: true, temperature: 30 });
});

describe("runExecuteCode", () => {
  // Empty code must fail before compiling or opening an isolate.
  it("rejects empty code", async () => {
    const result = await runExecuteCode({
      code: "   ",
      tools: baseTools,
      context: baseContext,
    });
    expect(result).toEqual({
      ok: false,
      error: "Code is required.",
      toolResults: [],
    });
    expect(mockBundleCustomToolSource).not.toHaveBeenCalled();
    expect(mockRunCustomTool).not.toHaveBeenCalled();
  });

  // Compile failures surface without invoking catalog tools.
  it("returns compile errors from the bundler", async () => {
    mockBundleCustomToolSource.mockResolvedValue({
      ok: false,
      error: "Compile failed: syntax",
    });
    const result = await runExecuteCode({
      code: "return { ok: true };",
      tools: baseTools,
      context: baseContext,
    });
    expect(result).toEqual({
      ok: false,
      error: "Compile failed: syntax",
      toolResults: [],
    });
    expect(mockRunCustomTool).not.toHaveBeenCalled();
  });

  // Allowlisted callTool invokes runCustomTool and records nested results.
  it("invokes allowlisted callTool via runCustomTool", async () => {
    const result = await runExecuteCode({
      code: "__CALL_GET_WEATHER__",
      tools: baseTools,
      context: baseContext,
    });

    expect(result.ok).toBe(true);
    expect(mockRunCustomTool).toHaveBeenCalledWith(
      expect.objectContaining({
        source: baseTools[0].source,
        sourceHash: "hash-1",
        input: { location: "SG" },
        context: baseContext,
      }),
    );
    if (result.ok) {
      expect(result.result).toEqual({
        weather: { ok: true, temperature: 30 },
      });
      expect(result.toolResults).toEqual([
        { toolKey: "get_weather", output: { ok: true, temperature: 30 } },
      ]);
    }
  });

  // Unknown tool keys fail without calling runCustomTool.
  it("rejects unknown tool keys from callTool", async () => {
    const result = await runExecuteCode({
      code: "__CALL_UNKNOWN__",
      tools: baseTools,
      context: baseContext,
    });

    expect(result.ok).toBe(true);
    expect(mockRunCustomTool).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.result).toEqual({
        out: { ok: false, error: "Unknown or unattached tool: nope" },
      });
      expect(result.toolResults).toEqual([
        {
          toolKey: "nope",
          output: { ok: false, error: "Unknown or unattached tool: nope" },
        },
      ]);
    }
  });

  // Nested tool errors are returned to the script and recorded in toolResults.
  it("surfaces nested runCustomTool errors in toolResults", async () => {
    mockRunCustomTool.mockResolvedValue({
      ok: false,
      error: "TypeError: fetch failed",
    });
    const result = await runExecuteCode({
      code: "__CALL_GET_WEATHER__",
      tools: baseTools,
      context: baseContext,
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.toolResults).toEqual([
        {
          toolKey: "get_weather",
          output: { ok: false, error: "TypeError: fetch failed" },
        },
      ]);
      expect(result.result).toEqual({
        weather: { ok: false, error: "TypeError: fetch failed" },
      });
    }
  });

  // Non-object script results fail the outer run.
  it("rejects non-object execute_code results", async () => {
    const result = await runExecuteCode({
      code: "__RETURN_ARRAY__",
      tools: baseTools,
      context: baseContext,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("execute_code must return a plain object.");
    }
  });
});
