import { tool } from "ai";
import { z } from "zod";
import type { ToolSet } from "ai";
import {
  getAllowPublicRegistration,
  setAllowPublicRegistration,
} from "../repositories/instance-settings.js";
import { listAllWorkspaces } from "../repositories/workspaces.js";
import { listAllUsers } from "../repositories/auth-users.js";

const scope = "AdminChatTools";

/**
 * Tools for the instance-admin AI chat. These are admin-scoped: every call
 * reads or mutates instance-level platform state (settings, workspaces, users).
 */
export function createAdminChatTools(): ToolSet {
  return {
    get_platform_state: tool({
      description:
        "Get a snapshot of this Senqo instance: public registration setting, workspace count, user count, admin count, and disabled user count.",
      inputSchema: z.object({}),
      execute: async () => {
        const [allowPublicRegistration, workspaces, users] = await Promise.all([
          getAllowPublicRegistration(),
          listAllWorkspaces(),
          listAllUsers(),
        ]);
        const adminCount = users.filter((u) => u.is_instance_admin).length;
        const disabledCount = users.filter((u) => u.disabled_at).length;
        console.info(
          `[${scope}/get_platform_state] Success: workspaces=${workspaces.length} users=${users.length}`,
        );
        return {
          allowPublicRegistration,
          workspaceCount: workspaces.length,
          userCount: users.length,
          adminCount,
          disabledUserCount: disabledCount,
        };
      },
    }),

    list_workspaces: tool({
      description:
        "List every workspace on this instance with its name, owner email, member count, and creation date.",
      inputSchema: z.object({}),
      execute: async () => {
        const workspaces = await listAllWorkspaces();
        console.info(`[${scope}/list_workspaces] Success: count=${workspaces.length}`);
        return workspaces.map((w) => ({
          name: w.name,
          ownerEmail: w.owner_email,
          memberCount: w.member_count,
          createdAt: w.created_at,
        }));
      },
    }),

    list_users: tool({
      description:
        "List every user on this instance with email, instance-admin flag, disabled state, owned workspace count, and creation date.",
      inputSchema: z.object({}),
      execute: async () => {
        const users = await listAllUsers();
        console.info(`[${scope}/list_users] Success: count=${users.length}`);
        return users.map((u) => ({
          email: u.email,
          isInstanceAdmin: u.is_instance_admin,
          disabled: u.disabled_at !== null,
          ownedWorkspaceCount: u.owned_workspace_count,
          createdAt: u.created_at,
        }));
      },
    }),

    set_allow_public_registration: tool({
      description:
        "Change whether anyone can sign up without an invite. Only use this when the admin clearly asks for the change.",
      inputSchema: z.object({
        allow: z.boolean().describe("True to allow public registration, false to require invites."),
      }),
      execute: async ({ allow }) => {
        const result = await setAllowPublicRegistration(allow);
        if (!result.ok) {
          console.error(`[${scope}/set_allow_public_registration] Failed query: value=${allow}`);
          return { ok: false, error: "unexpected_error" };
        }
        console.info(`[${scope}/set_allow_public_registration] Success: value=${allow}`);
        return {
          ok: true,
          message: allow
            ? "Public registration is now enabled — anyone can sign up without an invite."
            : "Public registration is now disabled — sign-up requires an invite.",
        };
      },
    }),
  };
}
