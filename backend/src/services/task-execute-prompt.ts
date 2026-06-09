function resolveScheduledLabel(scheduledAtIso: string): string {
  const date = new Date(scheduledAtIso);
  const effective = Number.isNaN(date.getTime()) ? new Date() : date;
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(effective);
}

/** User prompt for /api/agent when a task runs in an existing conversation (CLI -s equivalent). */
export function buildTaskExecuteAgentMessage(instruction: string, scheduledAtIso: string): string {
  const when = resolveScheduledLabel(scheduledAtIso);
  const body = instruction.trim();
  return `Task is scheduled on: ${when}
You need to send whatsapp.

Instruction:
${body}`;
}

/** Contactless scheduled task: no implied WhatsApp action (workspace / fresh session). */
export function buildWorkspaceScheduledAgentMessage(
  instruction: string,
  scheduledAtIso: string,
): string {
  const when = resolveScheduledLabel(scheduledAtIso);
  const body = instruction.trim();
  return `Scheduled workspace task:\n${when}\n\nInstruction:\n${body}`;
}
