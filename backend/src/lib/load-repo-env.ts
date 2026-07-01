import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadEnv } from "dotenv";

/** Loads repo-root `.env` when present (local scripts / npm run dev). Docker injects env directly. */
export function loadRepoEnv(): void {
  const repoEnv = resolve(process.cwd(), "../.env");
  if (existsSync(repoEnv)) {
    loadEnv({ path: repoEnv });
  }
}

/** Loads only DATABASE_URL from repo-root `.env` for tests that import DB modules without a live Postgres. */
export function loadRepoDatabaseUrl(): void {
  if (process.env.DATABASE_URL) return;

  const repoEnv = resolve(process.cwd(), "../.env");
  if (!existsSync(repoEnv)) return;

  const match = readFileSync(repoEnv, "utf8").match(/^DATABASE_URL=(.+)$/m);
  if (match?.[1]) {
    process.env.DATABASE_URL = match[1].trim();
  }
}
