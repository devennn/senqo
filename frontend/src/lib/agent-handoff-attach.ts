import { ApiError } from "@/lib/api";
import type { AgentConfigRecord } from "@/types/repositories";
import type {
  HandoffNotifyMemberLookup,
  HandoffNotifyRecipientOption,
  HandoffNotifyUnavailableOption,
} from "@/types/ui";

export function agentHasHandoffGroup(agent: AgentConfigRecord, groupId: string): boolean {
  return (Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : []).includes(
    groupId,
  );
}

export function sortedHandoffIds(ids: Iterable<string>): string[] {
  return [...ids].sort();
}

export function agentHandoffNotifyUserIds(agent: AgentConfigRecord): string[] {
  return sortedHandoffIds(
    Array.isArray(agent.handoff_notify_user_ids) ? agent.handoff_notify_user_ids : [],
  );
}

/** Shared notify list when every attached agent has the same recipients; otherwise empty. */
export function commonHandoffNotifyUserIds(
  agents: AgentConfigRecord[],
  groupId: string,
): string[] {
  const attached = agents.filter((a) => agentHasHandoffGroup(a, groupId));
  if (attached.length === 0) return [];
  const first = agentHandoffNotifyUserIds(attached[0]).join(",");
  return attached.every((a) => agentHandoffNotifyUserIds(a).join(",") === first)
    ? agentHandoffNotifyUserIds(attached[0])
    : [];
}

export function nextHandoffGroups(
  agent: AgentConfigRecord,
  groupId: string,
  attach: boolean,
): string[] {
  const current = Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : [];
  const without = current.filter((id) => id !== groupId);
  return attach ? sortedHandoffIds([...without, groupId]) : sortedHandoffIds(without);
}

export type HandoffAttachAgentPut = {
  profileName: string;
  behavior: string;
  tools: string[];
  skills: string[];
  handoffTopicGroups: string[];
  handoffNotifyUserIds?: string[];
};

/**
 * Builds agent update payloads for attaching/detaching this group and notify list.
 * Notify ids are sent only when the selection actually changed, so attach-only saves
 * never overwrite stored notify lists (including stale ones the dialog flags).
 */
export function buildHandoffAttachPuts(
  agents: AgentConfigRecord[],
  groupId: string,
  selectedAgentIds: ReadonlySet<string>,
  notifyUserIds: string[],
  notifySelectionChanged: boolean,
): Array<{ agentId: string; body: HandoffAttachAgentPut }> {
  const puts: Array<{ agentId: string; body: HandoffAttachAgentPut }> = [];
  for (const agent of agents) {
    const attach = selectedAgentIds.has(agent.id);
    const groups = nextHandoffGroups(agent, groupId, attach);
    const prevGroups = sortedHandoffIds(
      Array.isArray(agent.handoff_topic_groups) ? agent.handoff_topic_groups : [],
    );
    const groupsChanged = prevGroups.join(",") !== groups.join(",");
    const notifyChanged =
      attach &&
      notifySelectionChanged &&
      agentHandoffNotifyUserIds(agent).join(",") !== notifyUserIds.join(",");
    if (!groupsChanged && !notifyChanged) continue;

    puts.push({
      agentId: agent.id,
      body: {
        profileName: agent.profile_name,
        behavior: agent.behavior ?? "",
        tools: Array.isArray(agent.tools) ? agent.tools : [],
        skills: Array.isArray(agent.skills) ? agent.skills : [],
        handoffTopicGroups: groups,
        ...(notifyChanged ? { handoffNotifyUserIds: notifyUserIds } : {}),
      },
    });
  }
  return puts;
}

/** Selected notify users that cannot receive alerts: no verified phone, or no longer a teammate. */
export function unavailableNotifySelections(input: {
  notifyUserIds: string[];
  recipients: HandoffNotifyRecipientOption[];
  membersById: ReadonlyMap<string, HandoffNotifyMemberLookup>;
}): HandoffNotifyUnavailableOption[] {
  const verifiedIds = new Set(input.recipients.map((r) => r.userId));
  return input.notifyUserIds
    .filter((userId) => !verifiedIds.has(userId))
    .map((userId) => {
      const member = input.membersById.get(userId);
      return {
        userId,
        email: member?.email ?? null,
        reason: member ? ("not_verified" as const) : ("not_member" as const),
      };
    });
}

/**
 * Names the offending teammate when the API rejects a notify user, so the dialog shows
 * something actionable instead of the raw `handoff_notify_user_unverified` code.
 */
export function handoffAttachSaveErrorMessage(
  error: unknown,
  membersById: ReadonlyMap<string, HandoffNotifyMemberLookup>,
): string {
  const fallback = error instanceof Error ? error.message : "Could not save handoff settings.";
  if (!(error instanceof ApiError)) return fallback;

  const userId = typeof error.body.userId === "string" ? error.body.userId : null;
  const label = userId ? membersById.get(userId)?.email ?? userId : null;
  if (error.code === "handoff_notify_user_unverified") {
    return label
      ? `${label} has no verified phone in this workspace. Uncheck them and save again.`
      : "A selected notify person has no verified phone in this workspace. Uncheck them and save again.";
  }
  if (error.code === "invalid_handoff_notify_user") {
    return label
      ? `${label} is no longer in this workspace. Uncheck them and save again.`
      : "A selected notify person is no longer in this workspace. Uncheck them and save again.";
  }
  return fallback;
}
