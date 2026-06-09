import { createMiddleware } from "hono/factory";
import { verifyToken } from "../lib/auth-jwt.js";

export type AuthVariables = {
  userId: string;
};

export const authMiddleware = createMiddleware<{ Variables: AuthVariables }>(
  async (c, next) => {
    const auth = c.req.header("Authorization");
    const token = auth?.replace("Bearer ", "").trim() ?? "";

    if (!token) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const result = await verifyToken(token);

    if (!result) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    c.set("userId", result.userId);
    await next();
  },
);