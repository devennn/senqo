import { createHash } from "node:crypto";
import ivm from "isolated-vm";
import {
  CUSTOM_TOOL_RUN_MEMORY_MB,
  CUSTOM_TOOL_RUN_TIMEOUT_MS,
  EXECUTE_CODE_RUN_TIMEOUT_MS,
  EXECUTE_CODE_SOURCE_MAX_BYTES,
} from "../../lib/custom-tool-limits.js";
import { sandboxFetch } from "./bridges.js";
import { bundleCustomToolSource } from "./compile.js";
import {
  runCustomTool,
  type CustomToolRunContext,
} from "./run.js";
import {
  COMPOSIO_GOOGLEDRIVE_READ_SLUGS,
  executeGoogleDriveTool,
} from "../composio.js";
import { readLinkedDocContent } from "../linked-docs-read.js";

export type ExecuteCodeToolDefinition = {
  toolKey: string;
  source: string;
  sourceHash: string;
  env: Record<string, string | undefined>;
};

export type ExecuteCodeNestedResult = {
  toolKey: string;
  output: Record<string, unknown>;
};

export type ExecuteCodeRunResult =
  | {
      ok: true;
      result: Record<string, unknown>;
      toolResults: ExecuteCodeNestedResult[];
    }
  | {
      ok: false;
      error: string;
      toolResults: ExecuteCodeNestedResult[];
    };

export type ExecuteCodeComposioContext = {
  connectedAccountId: string;
  allowedDocIds: string[];
};

export type ExecuteCodeRunInput = {
  code: string;
  tools: ExecuteCodeToolDefinition[];
  context: CustomToolRunContext;
  timeoutMs?: number;
  /** When set, enables readLinkedDoc + composioExecute bridges. */
  composio?: ExecuteCodeComposioContext | null;
};

function hashExecuteCodeSource(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

function wrapExecuteCodeSource(code: string): string {
  return `
export async function execute(callTool) {
${code}
}
`;
}

export async function runExecuteCode(
  params: ExecuteCodeRunInput,
): Promise<ExecuteCodeRunResult> {
  const toolResults: ExecuteCodeNestedResult[] = [];
  const code = typeof params.code === "string" ? params.code : "";
  if (!code.trim()) {
    return { ok: false, error: "Code is required.", toolResults };
  }
  if (Buffer.byteLength(code, "utf8") > EXECUTE_CODE_SOURCE_MAX_BYTES) {
    return {
      ok: false,
      error: `Code exceeds ${EXECUTE_CODE_SOURCE_MAX_BYTES} bytes.`,
      toolResults,
    };
  }

  const wrapped = wrapExecuteCodeSource(code);
  const sourceHash = hashExecuteCodeSource(wrapped);
  const bundled = await bundleCustomToolSource(wrapped, sourceHash);
  if (!bundled.ok) {
    return { ok: false, error: bundled.error, toolResults };
  }

  const timeoutMs = params.timeoutMs ?? EXECUTE_CODE_RUN_TIMEOUT_MS;
  const deadline = Date.now() + timeoutMs;
  const toolsByKey = new Map(
    params.tools.map((tool) => [tool.toolKey, tool] as const),
  );

  const isolate = new ivm.Isolate({ memoryLimit: CUSTOM_TOOL_RUN_MEMORY_MB });
  try {
    const context = await isolate.createContext();
    const jail = context.global;
    await jail.set("global", jail.derefInto());

    const fetchBridge = new ivm.Reference(async (url: string, initJson: string) => {
      let init: { method?: string; headers?: Record<string, string>; body?: string } | undefined;
      if (initJson) {
        init = JSON.parse(initJson) as typeof init;
      }
      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        return JSON.stringify({ ok: false, status: 0, body: "execute_code deadline exceeded" });
      }
      const result = await sandboxFetch(url, init, Math.min(remaining, timeoutMs));
      return JSON.stringify(result);
    });

    const callToolBridge = new ivm.Reference(
      async (toolKeyRaw: string, inputJson: string) => {
        const remaining = deadline - Date.now();
        if (remaining <= 0) {
          const output = { ok: false, error: "execute_code deadline exceeded" };
          toolResults.push({ toolKey: String(toolKeyRaw), output });
          return JSON.stringify(output);
        }
        const toolKey = String(toolKeyRaw ?? "").trim();
        const definition = toolsByKey.get(toolKey);
        if (!definition) {
          const output = {
            ok: false,
            error: toolKey
              ? `Unknown or unattached tool: ${toolKey}`
              : "Tool key is required.",
          };
          toolResults.push({ toolKey: toolKey || "(missing)", output });
          return JSON.stringify(output);
        }
        let input: unknown = {};
        if (inputJson) {
          input = JSON.parse(inputJson) as unknown;
        }
        const output = await runCustomTool({
          source: definition.source,
          sourceHash: definition.sourceHash,
          input,
          context: params.context,
          env: definition.env,
          timeoutMs: Math.min(remaining, CUSTOM_TOOL_RUN_TIMEOUT_MS),
        });
        toolResults.push({ toolKey, output });
        return JSON.stringify(output);
      },
    );

    // Always enforce the agent attach list (empty set = deny all). Never treat
    // missing composio context as unrestricted workspace doc access.
    const allowedDocIds = new Set(params.composio?.allowedDocIds ?? []);
    const connectedAccountId = params.composio?.connectedAccountId ?? null;

    const readLinkedDocBridge = new ivm.Reference(async (docIdRaw: string) => {
      const docId = String(docIdRaw ?? "").trim();
      const result = await readLinkedDocContent({
        workspaceId: params.context.workspaceId,
        docId,
        allowedDocIds,
      });
      return JSON.stringify(result);
    });

    const composioExecuteBridge = new ivm.Reference(
      async (toolSlugRaw: string, argsJson: string) => {
        const toolSlug = String(toolSlugRaw ?? "").trim();
        if (!connectedAccountId) {
          return JSON.stringify({
            ok: false,
            error: "Google Drive is not connected for this workspace",
          });
        }
        if (!COMPOSIO_GOOGLEDRIVE_READ_SLUGS.has(toolSlug)) {
          return JSON.stringify({
            ok: false,
            error: `Tool not allowed: ${toolSlug}`,
          });
        }
        let args: Record<string, unknown> = {};
        if (argsJson) {
          const parsed = JSON.parse(argsJson) as unknown;
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            args = parsed as Record<string, unknown>;
          }
        }
        const result = await executeGoogleDriveTool({
          workspaceId: params.context.workspaceId,
          connectedAccountId,
          toolSlug,
          arguments: args,
        });
        return JSON.stringify(result);
      },
    );

    await jail.set("__fetch", fetchBridge);
    await jail.set("__callTool", callToolBridge);
    await jail.set("__readLinkedDoc", readLinkedDocBridge);
    await jail.set("__composioExecute", composioExecuteBridge);

    const scriptSource = `
      (async () => {
        ${bundled.bundle}
        const fetch = async (url, init) => {
          const initJson = init ? JSON.stringify({
            method: init.method,
            headers: init.headers ? Object.fromEntries(init.headers.entries ? init.headers.entries() : Object.entries(init.headers)) : undefined,
            body: typeof init.body === 'string' ? init.body : undefined,
          }) : '';
          const raw = await __fetch.apply(undefined, [String(url), initJson], { arguments: { copy: true }, result: { promise: true, copy: true } });
          const parsed = JSON.parse(raw);
          return {
            ok: parsed.ok,
            status: parsed.status,
            async json() { return JSON.parse(parsed.body || '{}'); },
            async text() { return parsed.body || ''; },
          };
        };
        const callTool = async (toolKey, input) => {
          const raw = await __callTool.apply(
            undefined,
            [String(toolKey), JSON.stringify(input ?? {})],
            { arguments: { copy: true }, result: { promise: true, copy: true } },
          );
          return JSON.parse(raw);
        };
        const readLinkedDoc = async (docId) => {
          const raw = await __readLinkedDoc.apply(
            undefined,
            [String(docId)],
            { arguments: { copy: true }, result: { promise: true, copy: true } },
          );
          return JSON.parse(raw);
        };
        const composioExecute = async (toolSlug, args) => {
          const raw = await __composioExecute.apply(
            undefined,
            [String(toolSlug), JSON.stringify(args ?? {})],
            { arguments: { copy: true }, result: { promise: true, copy: true } },
          );
          return JSON.parse(raw);
        };
        const mod = __customTool;
        const execute = mod.execute || (mod.default && mod.default.execute);
        if (typeof execute !== 'function') {
          throw new Error('execute_code must define an async execute(callTool) body.');
        }
        const result = await execute(callTool);
        if (result === undefined || result === null) {
          return JSON.stringify({});
        }
        return JSON.stringify(result);
      })()
    `;

    const script = await isolate.compileScript(scriptSource);
    const remaining = deadline - Date.now();
    if (remaining <= 0) {
      return { ok: false, error: "execute_code deadline exceeded", toolResults };
    }
    const raw = await script.run(context, {
      timeout: remaining,
      promise: true,
    });
    if (typeof raw !== "string") {
      return {
        ok: false,
        error: "execute_code returned non-serializable result.",
        toolResults,
      };
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return {
        ok: true,
        result: parsed as Record<string, unknown>,
        toolResults,
      };
    }
    return {
      ok: false,
      error: "execute_code must return a plain object.",
      toolResults,
    };
  } catch (error) {
    return { ok: false, error: String(error), toolResults };
  } finally {
    isolate.dispose();
  }
}
