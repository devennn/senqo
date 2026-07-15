import { loadRepoEnv } from "../lib/load-repo-env.js";
import type { ParsedArgs } from "../types/scripts.js";

loadRepoEnv();

function parseArgs(argv: string[]): ParsedArgs {
  let message = "";
  let sessionId: string | undefined;
  let workspaceId = "";
  let agentConfigId: string | undefined;
  let dryRun = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];

    if ((arg === "-m" || arg === "--message") && next) {
      message = next;
      index += 1;
      continue;
    }

    if ((arg === "-s" || arg === "--session") && next) {
      sessionId = next;
      index += 1;
      continue;
    }

    if ((arg === "-w" || arg === "--workspace") && next) {
      workspaceId = next;
      index += 1;
      continue;
    }

    if ((arg === "-a" || arg === "--agent-config-id") && next) {
      agentConfigId = next;
      index += 1;
      continue;
    }

    if (arg === "-y" || arg === "--dry-run") {
      dryRun = true;
      continue;
    }
  }

  if (!workspaceId) {
    throw new Error("Missing required workspace id. Use -w or --workspace.");
  }

  if (!message) {
    throw new Error("Missing required message. Use -m or --message.");
  }

  if (!agentConfigId) {
    throw new Error("Missing required agent config id. Use -a or --agent-config-id.");
  }

  return {
    workspaceId,
    message,
    sessionId,
    agentConfigId: agentConfigId,
    dryRun,
  };
}

async function main(): Promise<void> {
  const { runAgentSession } = await import("../agent/agent.js");
  const args = parseArgs(process.argv.slice(2));
  const result = await runAgentSession(args);

  if (!result) {
    throw new Error("Failed to run agent session.");
  }

  process.stdout.write(
    `${result.messages.map((m) => m.text).join("\n\n")}\n`,
  );
  process.stdout.write(`sessionId=${result.sessionId}\n`);
  process.stdout.write(`handoff_enabled=${result.handoff_enabled}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
