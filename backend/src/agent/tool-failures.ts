export type ToolResultLike = {
  toolName: string;
  output: unknown;
};

const FALLBACK_FAILURE_DETAIL = "Tool returned ok: false";
const EXECUTE_CODE_TOOL = "execute_code";

/**
 * Tracks custom tool failures across agent steps. A later successful call to the
 * same tool clears its failure, so a recovered retry does not force a handoff.
 * Nested `callTool` results from `execute_code` are tracked under each tool key;
 * an outer `execute_code` ok:false is tracked as `execute_code`.
 */
export function createCustomToolFailureTracker(customToolKeys: Iterable<string>) {
  const allowed = new Set(customToolKeys);
  const failures = new Map<string, string>();

  function recordFailure(toolName: string, record: Record<string, unknown>): void {
    const detail =
      typeof record.error === "string" && record.error.trim()
        ? record.error.trim()
        : FALLBACK_FAILURE_DETAIL;
    failures.set(toolName, detail);
  }

  function observeOne(toolName: string, output: unknown): void {
    if (!output || typeof output !== "object") return;
    const record = output as Record<string, unknown>;

    if (toolName === EXECUTE_CODE_TOOL) {
      const nested = Array.isArray(record.toolResults) ? record.toolResults : [];
      for (const item of nested) {
        if (!item || typeof item !== "object") continue;
        const nestedRecord = item as Record<string, unknown>;
        const nestedKey =
          typeof nestedRecord.toolKey === "string" ? nestedRecord.toolKey.trim() : "";
        if (!nestedKey || !allowed.has(nestedKey)) continue;
        const nestedOutput = nestedRecord.output;
        if (!nestedOutput || typeof nestedOutput !== "object") continue;
        const nestedOut = nestedOutput as Record<string, unknown>;
        if (nestedOut.ok === true) {
          failures.delete(nestedKey);
          continue;
        }
        if (nestedOut.ok === false) {
          recordFailure(nestedKey, nestedOut);
        }
      }

      if (record.ok === true) {
        failures.delete(EXECUTE_CODE_TOOL);
        return;
      }
      if (record.ok === false) {
        recordFailure(EXECUTE_CODE_TOOL, record);
      }
      return;
    }

    if (!allowed.has(toolName)) return;
    if (record.ok === true) {
      failures.delete(toolName);
      return;
    }
    if (record.ok !== false) return;
    recordFailure(toolName, record);
  }

  function observeToolResults(results: readonly ToolResultLike[]): void {
    for (const result of results) {
      observeOne(result.toolName, result.output);
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
