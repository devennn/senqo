import { createHash } from "node:crypto";
import * as esbuild from "esbuild";
import { stripLegacyToolExports, normalizeRequiredEnvNames } from "../lib/custom-tool-source.js";
import { inferCustomToolInputSchema } from "../lib/infer-custom-tool-input-schema.js";
import { CUSTOM_TOOL_SOURCE_MAX_BYTES } from "../lib/custom-tool-limits.js";

export type CompiledCustomToolMetadata = {
  normalizedSource: string;
  requiredEnv: string[];
  inputSchema: Record<string, unknown>;
  sourceHash: string;
};

export function hashCustomToolSource(source: string): string {
  return createHash("sha256").update(source).digest("hex");
}

export async function compileCustomToolSource(
  source: string,
  options?: { requiredEnv?: string[] },
): Promise<{ ok: true; metadata: CompiledCustomToolMetadata } | { ok: false; error: string }> {
  const normalizedSource = stripLegacyToolExports(source);
  const bytes = Buffer.byteLength(normalizedSource, "utf8");
  if (bytes > CUSTOM_TOOL_SOURCE_MAX_BYTES) {
    return { ok: false, error: `Source exceeds ${CUSTOM_TOOL_SOURCE_MAX_BYTES} bytes.` };
  }

  const inferred = inferCustomToolInputSchema(normalizedSource);
  if (!inferred.ok) {
    return { ok: false, error: inferred.error };
  }

  let requiredEnv: string[];
  try {
    requiredEnv = normalizeRequiredEnvNames(options?.requiredEnv ?? []);
  } catch (error) {
    return { ok: false, error: String(error) };
  }

  let bundle: string;
  try {
    const result = await esbuild.build({
      stdin: {
        contents: normalizedSource,
        loader: "ts",
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "esm",
      platform: "neutral",
      target: "es2022",
      write: false,
      logLevel: "silent",
    });
    const output = result.outputFiles[0]?.text;
    if (!output) {
      return { ok: false, error: "Bundle produced no output." };
    }
    bundle = output;
  } catch (error) {
    return { ok: false, error: `Compile failed: ${String(error)}` };
  }

  try {
    const mod = await import(
      `data:text/javascript,${encodeURIComponent(bundle)}`
    );
    if (typeof mod.execute !== "function") {
      return { ok: false, error: "Module must export async function execute." };
    }
    return {
      ok: true,
      metadata: {
        normalizedSource,
        requiredEnv,
        inputSchema: inferred.inputSchema,
        sourceHash: hashCustomToolSource(normalizedSource),
      },
    };
  } catch (error) {
    return { ok: false, error: `Metadata extract failed: ${String(error)}` };
  }
}
