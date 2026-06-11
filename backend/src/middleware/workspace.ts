import { createMiddleware } from "hono/factory";
import type { AuthVariables } from "./auth.js";
import { validateWorkspaceMembership } from "../repositories/workspaces.js";

export type WorkspaceVariables = {
  workspaceId: string;
};

export const workspaceMiddleware = createMiddleware<{ Variables: AuthVariables & WorkspaceVariables }>(
  async (c, next) => {
    const userId = c.get("userId");
    const headerWsId = c.req.header("X-Workspace-Id")?.trim();

    if (!headerWsId) {
      return c.json({ error: "workspace_id_required" }, 400);
    }

    const isMember = await validateWorkspaceMembership(headerWsId, userId);
    if (!isMember) return c.json({ error: "Forbidden" }, 403);
    c.set("workspaceId", headerWsId);

    await next();
  },
);
