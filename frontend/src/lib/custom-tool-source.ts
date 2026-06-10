const LEGACY_EXPORT_NAMES = ["description", "requiredEnv", "inputSchema"] as const;

function scanExpressionEnd(source: string, start: number): number {
  let i = start;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  while (i < source.length) {
    const ch = source[i];
    const next = source[i + 1];

    if (inSingle) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "'") inSingle = false;
      i += 1;
      continue;
    }
    if (inDouble) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === '"') inDouble = false;
      i += 1;
      continue;
    }
    if (inTemplate) {
      if (ch === "\\") {
        i += 2;
        continue;
      }
      if (ch === "`") inTemplate = false;
      i += 1;
      continue;
    }

    if (ch === "'") {
      inSingle = true;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inDouble = true;
      i += 1;
      continue;
    }
    if (ch === "`") {
      inTemplate = true;
      i += 1;
      continue;
    }
    if (ch === "{" || ch === "(" || ch === "[") {
      depth += 1;
      i += 1;
      continue;
    }
    if (ch === "}" || ch === ")" || ch === "]") {
      depth -= 1;
      i += 1;
      continue;
    }
    if (depth === 0 && ch === ";") {
      return i + 1;
    }
    if (depth === 0 && ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    i += 1;
  }

  return source.length;
}

function stripLegacyExport(source: string, constName: string): string {
  const marker = `export const ${constName}`;
  const idx = source.indexOf(marker);
  if (idx === -1) return source;
  const eq = source.indexOf("=", idx + marker.length);
  if (eq === -1) return source;
  const end = scanExpressionEnd(source, eq + 1);
  return (source.slice(0, idx) + source.slice(end)).replace(/^\s+/, "");
}

export function normalizeToolSourceForEditor(source: string): string {
  let next = source;
  for (const name of LEGACY_EXPORT_NAMES) {
    next = stripLegacyExport(next, name);
  }
  return next.trim();
}

export function parseRequiredEnvInput(value: string): string[] {
  return [...new Set(value.split(",").map((part) => part.trim()).filter(Boolean))];
}

export function formatRequiredEnvInput(names: string[]): string {
  return names.join(", ");
}
