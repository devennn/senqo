/** Platform tools always enabled at runtime; not user-editable in Tool Catalog. */
export const BUILTIN_AGENT_TOOL_KEYS = [
  "create_task",
  "load_skills",
  "handoff_to_human",
  "apply_conversation_labels",
] as const;

export type BuiltinAgentToolKey = (typeof BUILTIN_AGENT_TOOL_KEYS)[number];

export function isBuiltinAgentToolKey(key: string): boolean {
  return (BUILTIN_AGENT_TOOL_KEYS as readonly string[]).includes(key);
}
