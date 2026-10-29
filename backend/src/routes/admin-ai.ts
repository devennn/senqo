import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth.js";
import type { AuthVariables } from "../middleware/auth.js";
import { instanceAdminMiddleware } from "../middleware/instance-admin.js";
import {
  deleteAdminChatMessages,
  listAdminChatMessages,
} from "../repositories/admin-chat.js";
import {
  ADMIN_CHAT_MAX_MESSAGE_LENGTH,
  persistAdminChatUserMessage,
  runAdminChat,
  validateAdminChatInput,
} from "../agent/admin-chat.js";

const MESSAGES_LIMIT = 200;

const app = new Hono<{ Variables: AuthVariables }>();

app.use("*", authMiddleware);
app.use("*", instanceAdminMiddleware);

app.get("/messages", async (c) => {
  const userId = c.get("userId");
  const messages = await listAdminChatMessages(userId, MESSAGES_LIMIT);
  return c.json({ messages });
});

app.post("/chat", async (c) => {
  const userId = c.get("userId");
  const parsed = validateAdminChatInput(await c.req.json());
  if (!parsed.ok) {
    return c.json(
      { error: "invalid_payload", maxLength: ADMIN_CHAT_MAX_MESSAGE_LENGTH },
      400,
    );
  }

  const persisted = await persistAdminChatUserMessage(userId, parsed.message);
  if (!persisted) return c.json({ error: "unexpected_error" }, 500);

  const result = await runAdminChat(userId, parsed.message);
  if (!result.ok) {
    const status = result.message === "unexpected_error" ? 500 : 502;
    return c.json({ error: result.message }, status);
  }

  return c.json({ reply: result.reply });
});

app.delete("/messages", async (c) => {
  const userId = c.get("userId");
  const result = await deleteAdminChatMessages(userId);
  if (!result.ok) return c.json({ error: result.message }, 500);
  return c.json({ ok: true });
});

export default app;
