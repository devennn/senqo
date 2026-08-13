import { getAgentConfigById } from "../repositories/agent.js";
import { listWorkspaceContextForInstructions } from "../repositories/workspace-context-groups.js";

const scope = "EvalSpecBusinessContext";

/** Keep Spec prompts bounded when a workspace has large context groups. */
const BUSINESS_CONTEXT_MAX_CHARS = 8_000;

function formatContextGroups(
  groups: { name: string; entries: { title: string; body_text: string }[] }[],
): string {
  if (groups.length === 0) return "";
  const chunks: string[] = [];
  for (const grp of groups) {
    chunks.push(`#### ${grp.name}`);
    grp.entries.forEach((entry, i) => {
      chunks.push(`[${i + 1}] ${entry.title}`, entry.body_text, "---");
    });
  }
  return chunks.filter((s) => s.trim().length > 0).join("\n\n");
}

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars - 1).trimEnd()}…`;
}

/**
 * Business briefing for Spec/Judge: agent profile + attached workspace context facts.
 * Empty string when the agent has no usable context.
 */
export async function loadEvalSpecBusinessContext(
  workspaceId: string,
  agentConfigId: string,
): Promise<string> {
  try {
    const agent = await getAgentConfigById(workspaceId, agentConfigId);
    if (!agent) {
      console.error(
        `[${scope}/loadEvalSpecBusinessContext] Failed query: agent not found agentId=${agentConfigId}`,
      );
      return "";
    }

    const parts: string[] = [];
    const profile = agent.profile_name.trim();
    const behavior = agent.behavior.trim();
    if (profile) parts.push(`Agent profile: ${profile}`);
    if (behavior) parts.push(`Agent behavior:\n${behavior}`);

    const groups = await listWorkspaceContextForInstructions(
      workspaceId,
      agent.context_groups ?? [],
    );
    const facts = formatContextGroups(groups);
    if (facts) {
      parts.push("Workspace context (stable business facts):");
      parts.push(facts);
    }

    const text = truncate(parts.join("\n\n").trim(), BUSINESS_CONTEXT_MAX_CHARS);
    console.info(
      `[${scope}/loadEvalSpecBusinessContext] Success: workspaceId=${workspaceId} agentId=${agentConfigId} chars=${text.length}`,
    );
    return text;
  } catch (error) {
    console.error(
      `[${scope}/loadEvalSpecBusinessContext] Unexpected error: ${String(error)}`,
    );
    return "";
  }
}

export { formatContextGroups, truncate as truncateBusinessContext };
