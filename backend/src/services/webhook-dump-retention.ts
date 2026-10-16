import { env } from "../lib/env.js";
import { deleteWebhookPayloadDumpsBefore } from "../repositories/whatsapp.js";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Deletes webhook payload dumps older than the configured retention window
 * (S-09). Runs on a daily schedule; a window of `0` disables cleanup.
 */
export async function runWebhookDumpRetention(): Promise<void> {
  const retentionDays = env.whatsappPayloadDumpRetentionDays;
  if (retentionDays <= 0) {
    console.info(
      "[WebhookDumpRetention] Skipped: retention disabled (WHATSAPP_PAYLOAD_DUMP_RETENTION_DAYS=0)",
    );
    return;
  }

  const cutoff = new Date(Date.now() - retentionDays * MS_PER_DAY);
  const result = await deleteWebhookPayloadDumpsBefore(cutoff);
  if (!result.ok) {
    console.error(
      `[WebhookDumpRetention] Unexpected error: cleanup failed cutoff=${cutoff.toISOString()}`,
    );
  }
}
