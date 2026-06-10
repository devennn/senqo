export const CUSTOM_TOOL_SOURCE_TEMPLATE = `export async function execute(
  input: { example: string },
  ctx: {
    env: Record<string, string | undefined>;
    workspaceId: string;
    sessionId: string;
    agentConfigId?: string;
  },
) {
  // Use ctx.env.MY_SECRET for workspace secrets configured outside this editor.
  return { ok: true, echo: input.example, workspaceId: ctx.workspaceId };
}
`;
