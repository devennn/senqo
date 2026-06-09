import { tool } from "ai";
import { z } from "zod";
import { loadSkillByName } from "../skills-catalog.js";
import type { AgentToolRuntimeContext } from "../tools/shared.js";

export function createLoadSkillsTool(context: AgentToolRuntimeContext) {
  return tool({
    description:
      "Load full markdown content for a workspace-owned skill by skill name or key.",
    inputSchema: z.object({
      skill_name: z.string().min(1),
    }),
    execute: async ({ skill_name }) => {
      const loaded = await loadSkillByName(context.workspaceId, skill_name);
      if (!loaded.ok) {
        return { ok: false, error: loaded.error };
      }

      return {
        ok: true,
        skill_name,
        content: loaded.content,
      };
    },
  });
}
