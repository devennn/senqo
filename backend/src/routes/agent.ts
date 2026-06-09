import { Hono } from "hono";
import { z } from "zod";
import { runAgentSession } from "../agent/agent.js";

const app = new Hono();

const runAgentSchema = z.object({
  workspaceId: z.string().uuid(),
  message: z.string().min(1),
  messageTimestamp: z.string().optional(),
  sessionId: z.string().uuid().optional(),
  agentConfigId: z.string().uuid().optional(),
  dryRun: z.boolean().optional(),
  skipInference: z.boolean().optional(),
});

const logScope = "ApiAgent/POST";

app.post("/", async (c) => {
  try {
    const json = (await c.req.json()) as unknown;
    const parsed = runAgentSchema.safeParse(json);

    if (!parsed.success) {
      console.error(`[${logScope}] Invalid payload`, {
        issues: parsed.error.flatten(),
      });
      return c.json({ error: "Invalid payload" }, 400);
    }

    const result = await runAgentSession({
      workspaceId: parsed.data.workspaceId,
      message: parsed.data.message,
      messageTimestamp: parsed.data.messageTimestamp,
      sessionId: parsed.data.sessionId,
      agentConfigId: parsed.data.agentConfigId,
      dryRun: parsed.data.dryRun ?? false,
      skipInference: parsed.data.skipInference ?? false,
    });

    if (!result) {
      console.error(`[${logScope}] runAgentSession returned null`);
      return c.json({ error: "Failed to run agent session" }, 500);
    }

    return c.json({
      sessionId: result.sessionId,
      reply: result.reply,
      reasoning_for_operators: result.reasoningForOperators,
      num_whatsapp_send: result.num_whatsapp_send,
      modelMessages: result.modelMessages,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[${logScope}] Unexpected error: ${message}`);
    return c.json({ error: "Unexpected error", detail: String(error) }, 500);
  }
});

export default app;
