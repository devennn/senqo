import { scheduleInboundAiDebouncedJob } from "./job-scheduler.js";

const scope = "InboundAiDebounceSchedule";

export async function scheduleInboundAiDebounced(input: {
  workspaceId: string;
  conversationId: string;
  agentConfigId: string;
}): Promise<void> {
  await scheduleInboundAiDebouncedJob(input);
}
