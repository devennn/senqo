import { loadRepoEnv } from "../lib/load-repo-env.js";

loadRepoEnv();

function parseArgs(argv: string[]): { workspaceId: string } {
  let workspaceId = "";
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if ((arg === "-w" || arg === "--workspace") && next) {
      workspaceId = next;
      index += 1;
    }
  }
  if (!workspaceId) {
    throw new Error("Missing required workspace id. Use -w or --workspace.");
  }
  return { workspaceId };
}

async function main(): Promise<void> {
  const { ensureDefaultCustomTools } = await import("../lib/seed-default-custom-tools.js");
  const { workspaceId } = parseArgs(process.argv.slice(2));
  await ensureDefaultCustomTools(workspaceId);
  process.stdout.write("seeded_default_custom_tools=1\n");
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
