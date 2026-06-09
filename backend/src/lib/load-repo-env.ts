import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

/** Loads repo-root `.env` when present (local scripts / npm run dev). Docker injects env directly. */
export function loadRepoEnv(): void {
  const repoEnv = resolve(process.cwd(), "../.env");
  if (existsSync(repoEnv)) {
    loadEnv({ path: repoEnv });
  }
}
