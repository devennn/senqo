/**
 * Demo seed for local development.
 *
 *   npm run demo:seed
 *   npm run demo:seed -- --force   # allow a non-local DATABASE_URL
 *
 * Recreates an "Acme Workspace" owned by a demo user, filled with realistic
 * but non-live data (WhatsApp lines, agents, knowledge, inbox threads, tasks,
 * evals, reports). Local only: refuses non-local database hosts unless forced.
 * Docs: README -> Demo data.
 */

import { loadRepoEnv } from "../../lib/load-repo-env.js";

loadRepoEnv();

import os from "node:os";

import {
  createRng,
  DEMO_SEED,
  DEMO_USER_EMAIL,
  DEMO_USER_NAME,
  DEMO_USER_PASSWORD,
  DEMO_WORKSPACE_NAME,
  DEMO_WORKSPACE_TIMEZONE,
} from "./dataset.js";

const LOCAL_DB_HOSTS = new Set([
  "postgres",
  "db",
  "localhost",
  "host.docker.internal",
]);

function isLoopbackIp(host: string): boolean {
  return host === "::1" || host.startsWith("127.");
}

/** True when the database host is an address of one of this machine's interfaces. */
function isLocalInterfaceAddress(host: string): boolean {
  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.address === host) return true;
    }
  }
  return false;
}

function assertLocalDatabase(force: boolean): void {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) {
    throw new Error("DATABASE_URL is not set. Run with the stack's .env (see README).");
  }
  let host = "";
  try {
    host = new URL(raw).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  const local =
    LOCAL_DB_HOSTS.has(host) || isLoopbackIp(host) || isLocalInterfaceAddress(host);
  if (!local && !force) {
    throw new Error(
      `Refusing to seed demo data into a non-local database host "${host}". ` +
        "This script is for local development only. Pass --force to override.",
    );
  }
}

function printSummary(lines: string[]): void {
  process.stdout.write(`\n${lines.join("\n")}\n\n`);
}

async function main(): Promise<void> {
  const force = process.argv.slice(2).includes("--force");
  assertLocalDatabase(force);

  const { db } = await import("../../db/index.js");
  const { tasks, taskRuns } = await import("../../db/schema/index.js");
  const { eq } = await import("drizzle-orm");
  const { createUser, findUserByEmail, listAllUsers, updateUserPassword } = await import(
    "../../repositories/auth-users.js"
  );
  const { provisionPlatformUser } = await import("../../repositories/profiles.js");
  const {
    addWorkspaceMember,
    createWorkspaceForUser,
    deleteWorkspace,
    listWorkspacesForUser,
    updateWorkspaceSettingsAsOwner,
  } = await import("../../repositories/workspaces.js");
  const { hashPassword } = await import("../../lib/auth-users.js");
  const { seedConnectionsAndKnowledge } = await import("./knowledge.js");
  const { seedChatter } = await import("./chatter.js");
  const { seedActivity } = await import("./activity.js");

  // --- Demo user ------------------------------------------------------------
  let demoUser = await findUserByEmail(DEMO_USER_EMAIL);
  if (!demoUser) {
    const passwordHash = await hashPassword(DEMO_USER_PASSWORD);
    demoUser = await createUser(DEMO_USER_EMAIL, passwordHash);
    await provisionPlatformUser(demoUser.id, DEMO_USER_NAME);
    process.stdout.write(`created demo user: ${DEMO_USER_EMAIL}\n`);
  } else {
    await updateUserPassword(demoUser.id, await hashPassword(DEMO_USER_PASSWORD));
    process.stdout.write(`reusing demo user: ${DEMO_USER_EMAIL}\n`);
  }
  const demoUserId = demoUser.id;

  // --- Recreate the demo workspace -----------------------------------------
  const existing = (await listWorkspacesForUser(demoUserId)).find(
    (workspace) => workspace.name === DEMO_WORKSPACE_NAME,
  );
  if (existing) {
    // Tasks restrict connection/agent deletes, so clear them before the cascade.
    await db.delete(taskRuns).where(eq(taskRuns.workspaceId, existing.id));
    await db.delete(tasks).where(eq(tasks.workspaceId, existing.id));
    const deleted = await deleteWorkspace(existing.id);
    if (!deleted.ok) {
      throw new Error(`Could not reset existing demo workspace: ${deleted.message}`);
    }
    process.stdout.write(`reset existing workspace: ${existing.id}\n`);
  }

  const created = await createWorkspaceForUser(demoUserId, DEMO_WORKSPACE_NAME);
  if (!created.ok) {
    throw new Error(`Could not create demo workspace: ${created.message}`);
  }
  const workspaceId = created.workspaceId;
  await updateWorkspaceSettingsAsOwner(workspaceId, demoUserId, {
    timezone: DEMO_WORKSPACE_TIMEZONE,
  });

  // Let existing local accounts see the demo workspace in their chooser
  // (instance admins already see every workspace).
  const users = await listAllUsers();
  let membersAdded = 0;
  for (const user of users) {
    if (user.id === demoUserId || user.is_instance_admin || user.disabled_at) continue;
    const added = await addWorkspaceMember(workspaceId, user.email);
    if (added.ok) membersAdded += 1;
  }

  // --- Fill it up -----------------------------------------------------------
  const rng = createRng(DEMO_SEED);
  const nowMs = Date.now();

  const ctx = await seedConnectionsAndKnowledge({ workspaceId, demoUserId });
  const chats = await seedChatter({ ctx, rng, nowMs });
  const activity = await seedActivity({ ctx, chats, nowMs });

  const warnings = ctx.warnings;
  const summary = [
    "Demo seed complete.",
    `  workspace:      ${DEMO_WORKSPACE_NAME} (${workspaceId})`,
    `  sign in:        ${DEMO_USER_EMAIL} / ${DEMO_USER_PASSWORD}`,
    `  members added:  ${membersAdded} existing user(s)`,
    `  contacts:       ${chats.contacts.length}`,
    `  conversations:  ${chats.conversations.length} (${chats.messages} messages)`,
    `  leads:          ${activity.leads}`,
    `  tasks:          ${activity.tasks}`,
    `  eval cases:     ${activity.evalCases} (${activity.evalRuns} runs)`,
    `  secrets:        ${activity.secrets}`,
    `  api keys:       ${activity.apiKeys}`,
    "Note: WhatsApp lines are demo rows - nothing sends or receives. Live docs,",
    "asset links, and agent runs need real integrations.",
  ];
  if (warnings.length > 0) {
    summary.push("", `Skipped ${warnings.length} item(s):`, ...warnings.map((w) => `  - ${w}`));
  }
  printSummary(summary);
}

main().catch((error: unknown) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
