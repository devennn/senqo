import { loadRepoEnv } from "../lib/load-repo-env.js";

loadRepoEnv();

async function main(): Promise<void> {
  const { db } = await import("../db/index.js");
  const { workspaces } = await import("../db/schema/index.js");
  const { ensureDefaultCustomTools } = await import("../lib/seed-default-custom-tools.js");

  const rows = await db.select({ id: workspaces.id }).from(workspaces);
  for (const row of rows) {
    await ensureDefaultCustomTools(row.id);
    process.stdout.write(`seeded_workspace=${row.id}\n`);
  }
  process.stdout.write(`seeded_workspaces_count=${rows.length}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
