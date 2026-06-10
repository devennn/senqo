import * as esbuild from "esbuild";
import { getCachedBundle, setCachedBundle } from "./cache.js";

export async function bundleCustomToolSource(
  source: string,
  sourceHash: string,
): Promise<{ ok: true; bundle: string } | { ok: false; error: string }> {
  const cached = getCachedBundle(sourceHash);
  if (cached) {
    return { ok: true, bundle: cached };
  }

  try {
    const result = await esbuild.build({
      stdin: {
        contents: source,
        loader: "ts",
        resolveDir: process.cwd(),
      },
      bundle: true,
      format: "iife",
      globalName: "__customTool",
      platform: "neutral",
      target: "es2022",
      write: false,
      logLevel: "silent",
    });
    const output = result.outputFiles[0]?.text;
    if (!output) {
      return { ok: false, error: "Bundle produced no output." };
    }
    setCachedBundle(sourceHash, output);
    return { ok: true, bundle: output };
  } catch (error) {
    return { ok: false, error: `Compile failed: ${String(error)}` };
  }
}
