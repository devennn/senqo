import { createMiddleware } from "hono/factory";
import type { AuthVariables } from "./auth.js";
import { isInstanceAdmin } from "../repositories/auth-users.js";

export const instanceAdminMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const userId = c.get("userId");
    const admin = await isInstanceAdmin(userId);
    if (!admin) {
      return c.json({ error: "forbidden" }, 403);
    }
    await next();
  },
);
