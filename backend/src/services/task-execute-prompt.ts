import { formatZonedDateTime } from "../lib/timezone.js";

function resolveScheduledLabel(scheduledAtIso: string, timeZone: string): string {
  const date = new Date(scheduledAtIso);
  const effective = Number.isNaN(date.getTime()) ? new Date() : date;
  try {
    return `${formatZonedDateTime(effective, timeZone)} (${timeZone})`;
  } catch {
    return `${formatZonedDateTime(effective, "UTC")} (UTC)`;
  }
}

/** User prompt for /api/agent when a task runs in an existing conversation (CLI -s equivalent). */
export function buildTaskExecuteAgentMessage(
  instruction: string,
  scheduledAtIso: string,
  timeZone = "UTC",
): string {
  const when = resolveScheduledLabel(scheduledAtIso, timeZone);
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
  timeZone = "UTC",
): string {
  const when = resolveScheduledLabel(scheduledAtIso, timeZone);
  const body = instruction.trim();
  return `Scheduled workspace task:\n${when}\n\nInstruction:\n${body}`;
}
