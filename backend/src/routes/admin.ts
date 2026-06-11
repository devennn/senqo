import { Hono } from "hono";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthVariables } from "../middleware/auth.js";
import { instanceAdminMiddleware } from "../middleware/instance-admin.js";
import {
  countInstanceAdmins,
  deleteUser,
  listAllUsers,
  setInstanceAdmin,
  setUserDisabled,
} from "../repositories/auth-users.js";
import {
  getAllowPublicRegistration,
  setAllowPublicRegistration,
} from "../repositories/instance-settings.js";
import { deleteWorkspace, listAllWorkspaces } from "../repositories/workspaces.js";
import { createRegistrationInvite } from "../repositories/registration-invites.js";
import { sendRegistrationInviteEmail } from "../services/email.js";

const settingsSchema = z.object({
  allowPublicRegistration: z.boolean(),
});

const emailSchema = z.object({
  email: z.string().email(),
});

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);
app.use("*", instanceAdminMiddleware);

app.get("/settings", async (c) => {
  const allowPublicRegistration = await getAllowPublicRegistration();
  return c.json({ allowPublicRegistration });
});

app.patch("/settings", async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const result = await setAllowPublicRegistration(parsed.data.allowPublicRegistration);
  if (!result.ok) return c.json({ error: result.message }, 500);

  return c.json({ allowPublicRegistration: parsed.data.allowPublicRegistration });
});

app.get("/workspaces", async (c) => {
  const workspaces = await listAllWorkspaces();
  return c.json({ workspaces });
});

app.delete("/workspaces/:id", async (c) => {
  const workspaceId = c.req.param("id");
  const result = await deleteWorkspace(workspaceId);
  if (!result.ok) {
    const status = result.message === "workspace_not_found" ? 404 : 500;
    return c.json({ error: result.message }, status);
  }
  return c.json({ ok: true });
});

app.get("/users", async (c) => {
  const users = await listAllUsers();
  return c.json({ users });
});

app.post("/users/:id/disable", async (c) => {
  const actorId = c.get("userId");
  const targetId = c.req.param("id");

  if (actorId === targetId) {
    return c.json({ error: "cannot_disable_self" }, 403);
  }

  const users = await listAllUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return c.json({ error: "user_not_found" }, 404);

  if (target.is_instance_admin) {
    const adminCount = await countInstanceAdmins();
    if (adminCount <= 1) {
      return c.json({ error: "cannot_disable_last_superadmin" }, 403);
    }
  }

  const result = await setUserDisabled(targetId, true);
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

app.post("/users/:id/enable", async (c) => {
  const targetId = c.req.param("id");
  const result = await setUserDisabled(targetId, false);
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

app.delete("/users/:id", async (c) => {
  const actorId = c.get("userId");
  const targetId = c.req.param("id");

  if (actorId === targetId) {
    return c.json({ error: "cannot_delete_self" }, 403);
  }

  const users = await listAllUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return c.json({ error: "user_not_found" }, 404);

  if (target.is_instance_admin) {
    const adminCount = await countInstanceAdmins();
    if (adminCount <= 1) {
      return c.json({ error: "cannot_delete_last_superadmin" }, 403);
    }
  }

  const result = await deleteUser(targetId);
  if (!result.ok) {
    const status = result.message === "user_owns_workspaces" ? 409 : 500;
    return c.json({ error: result.message }, status);
  }
  return c.json({ ok: true });
});

app.post("/users/:id/superadmin", async (c) => {
  const targetId = c.req.param("id");
  const users = await listAllUsers();
  if (!users.some((u) => u.id === targetId)) {
    return c.json({ error: "user_not_found" }, 404);
  }

  const result = await setInstanceAdmin(targetId, true);
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

app.delete("/users/:id/superadmin", async (c) => {
  const actorId = c.get("userId");
  const targetId = c.req.param("id");

  if (actorId === targetId) {
    return c.json({ error: "cannot_demote_self" }, 403);
  }

  const users = await listAllUsers();
  const target = users.find((u) => u.id === targetId);
  if (!target) return c.json({ error: "user_not_found" }, 404);

  if (target.is_instance_admin) {
    const adminCount = await countInstanceAdmins();
    if (adminCount <= 1) {
      return c.json({ error: "cannot_demote_last_superadmin" }, 403);
    }
  }

  const result = await setInstanceAdmin(targetId, false);
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

app.post("/registration-invites", async (c) => {
  const parsed = emailSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "invalid_payload" }, 400);

  const allowPublicRegistration = await getAllowPublicRegistration();
  if (allowPublicRegistration) {
    return c.json({ error: "public_registration_enabled" }, 409);
  }

  const actorId = c.get("userId");
  const created = await createRegistrationInvite(parsed.data.email, actorId);
  if (!created.ok) {
    const status = created.message === "invite_already_pending" ? 409 : 400;
    return c.json({ error: created.message }, status);
  }

  const emailed = await sendRegistrationInviteEmail({
    to: parsed.data.email,
    inviteToken: created.inviteToken,
  });

  return c.json({ ok: true, emailSent: emailed.ok });
});

export default app;
