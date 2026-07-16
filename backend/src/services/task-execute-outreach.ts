import { listLeadsForColdOutreach, updateLeadStatus } from "../repositories/leads.js";
import { sendScheduledTaskAsManualWhatsapp } from "../services/task-execute-manual.js";

const scope = "TaskExecuteOutreach";
const MAX_AGGREGATED_ERROR_LENGTH = 3800;

export type TaskOutreachBatchResult =
  | { ok: true; candidateCount: number; sentCount: number }
  | { ok: false; candidateCount: number; sentCount: number; error: string };

export async function runTaskOutreachBatch(input: {
  workspaceId: string;
  agentConfigId: string;
  messageBody: string;
  fileUrl?: string | null;
  whatsappConnectionId?: string | null;
  limit: number;
  dryRun: boolean;
}): Promise<TaskOutreachBatchResult> {
  const body = input.messageBody.trim();
  if (!body) {
    return { ok: false, candidateCount: 0, sentCount: 0, error: "Message body is empty." };
  }

  const leadIds = await listLeadsForColdOutreach(input.workspaceId, input.limit);
  const candidateCount = leadIds.length;

  if (input.dryRun) {
    return { ok: true, candidateCount, sentCount: 0 };
  }

  if (candidateCount === 0) {
    return { ok: true, candidateCount: 0, sentCount: 0 };
  }

  const errors: string[] = [];
  let sentCount = 0;

  for (const leadId of leadIds) {
    const sent = await sendScheduledTaskAsManualWhatsapp({
      workspaceId: input.workspaceId,
      agentConfigId: input.agentConfigId,
      leadId,
      instruction: body,
      fileUrl: input.fileUrl ?? null,
      whatsappConnectionId: input.whatsappConnectionId,
    });

    if (!sent.ok) {
      errors.push(`${leadId}: ${sent.error}`);
      continue;
    }

    const updated = await updateLeadStatus(input.workspaceId, leadId, "contacted");
    if (!updated) {
      errors.push(`${leadId}: message sent but failed to update lead status`);
    }
    sentCount += 1;
  }

  if (errors.length > 0) {
    const error =
      errors.join("; ").length > MAX_AGGREGATED_ERROR_LENGTH
        ? `${errors.join("; ").slice(0, MAX_AGGREGATED_ERROR_LENGTH)}…`
        : errors.join("; ");
    console.error(`[${scope}/runTaskOutreachBatch] Partial or full failure: sentCount=${sentCount}`, {
      workspaceId: input.workspaceId,
      candidateCount,
    });
    return { ok: false, candidateCount, sentCount, error };
  }

  console.info(
    `[${scope}/runTaskOutreachBatch] Success: userId=${input.workspaceId} sentCount=${sentCount} candidateCount=${candidateCount}`,
  );
  return { ok: true, candidateCount, sentCount };
}
