import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let cachedVersion: string | null = null;

function readPackageVersion(): string | null {
  try {
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), "../../package.json");
    const raw = readFileSync(packagePath, "utf8");
    const parsed = JSON.parse(raw) as { version?: string };
    const version = parsed.version?.trim();
    return version || null;
  } catch {
    return null;
  }
}

export function getAppVersion(): string {
  if (cachedVersion) return cachedVersion;

  const fromEnv = process.env.APP_VERSION?.trim();
  cachedVersion = fromEnv || readPackageVersion() || "0.0.0-dev";
  return cachedVersion;
}
