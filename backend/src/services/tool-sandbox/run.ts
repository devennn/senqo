import ivm from "isolated-vm";
import {
  CUSTOM_TOOL_RUN_MEMORY_MB,
  CUSTOM_TOOL_RUN_TIMEOUT_MS,
} from "../../lib/custom-tool-limits.js";
import { sandboxFetch } from "./bridges.js";
import { bundleCustomToolSource } from "./compile.js";

export type CustomToolRunContext = {
  workspaceId: string;
  sessionId: string;
  agentConfigId?: string;
};

export type CustomToolRunInput = {
  source: string;
  sourceHash: string;
  input: unknown;
  context: CustomToolRunContext;
  env: Record<string, string | undefined>;
  timeoutMs?: number;
};

export async function runCustomTool(
  params: CustomToolRunInput,
): Promise<Record<string, unknown>> {
  const bundled = await bundleCustomToolSource(params.source, params.sourceHash);
  if (!bundled.ok) {
    return { ok: false, error: bundled.error };
  }

  const timeoutMs = params.timeoutMs ?? CUSTOM_TOOL_RUN_TIMEOUT_MS;
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
      const result = await sandboxFetch(url, init, timeoutMs);
      return JSON.stringify(result);
    });

    await jail.set("__fetch", fetchBridge);
    await jail.set("__input", new ivm.ExternalCopy(params.input).copyInto());
    await jail.set("__ctx", new ivm.ExternalCopy({
      env: params.env,
      workspaceId: params.context.workspaceId,
      sessionId: params.context.sessionId,
      agentConfigId: params.context.agentConfigId ?? null,
    }).copyInto());

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
        const mod = __customTool;
        const execute = mod.execute || (mod.default && mod.default.execute);
        if (typeof execute !== 'function') {
          throw new Error('Module must export execute function.');
        }
        const result = await execute(__input, __ctx);
        return JSON.stringify(result);
      })()
    `;

    const script = await isolate.compileScript(scriptSource);
    const raw = await script.run(context, { timeout: timeoutMs, promise: true });
    if (typeof raw !== "string") {
      return { ok: false, error: "Tool returned non-serializable result." };
    }
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
    return { ok: false, error: "Tool returned non-object result." };
  } catch (error) {
    return { ok: false, error: String(error) };
  } finally {
    isolate.dispose();
  }
}
