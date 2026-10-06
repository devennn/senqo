export type ToolResultLike = {
  toolName: string;
  output: unknown;
};

const FALLBACK_FAILURE_DETAIL = "Tool returned ok: false";

/**
 * Tracks custom tool failures across agent steps. A later successful call to the
 * same tool clears its failure, so a recovered retry does not force a handoff.
 */
export function createCustomToolFailureTracker(customToolKeys: Iterable<string>) {
  const allowed = new Set(customToolKeys);
  const failures = new Map<string, string>();

  function observeToolResults(results: readonly ToolResultLike[]): void {
    for (const result of results) {
      if (!allowed.has(result.toolName)) continue;
      const output = result.output;
      if (!output || typeof output !== "object") continue;
      const record = output as Record<string, unknown>;
      if (record.ok === true) {
        failures.delete(result.toolName);
        continue;
      }
      if (record.ok !== false) continue;
      const detail =
        typeof record.error === "string" && record.error.trim()
          ? record.error.trim()
          : FALLBACK_FAILURE_DETAIL;
      failures.set(result.toolName, detail);
    }
  }

  /** `get_weather: TypeError: fetch failed; ...`, or null when nothing is failing. */
  function summarize(): string | null {
    if (failures.size === 0) return null;
    return [...failures.entries()]
      .map(([toolName, detail]) => `${toolName}: ${detail}`)
      .join("; ");
  }

  return { observeToolResults, summarize };
}
