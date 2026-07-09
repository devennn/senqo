/** Matches backend `recordWebhookEvent` dedupe keys. */
export function webhookDedupeKey(fromMe: boolean, messageId: string): string {
  return `${fromMe ? "message.outbound_mirror" : "message.inbound"}:${messageId}`;
}

const DEDUPE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DEDUPE_MAX_ENTRIES = 100_000;

/**
 * Prevents duplicate webhook delivery when Baileys replays the same message via
 * `notify` and `append`. Backend dedupes too; this avoids redundant work and
 * oversized payloads on reconnect.
 */
export class MessageDedupeTracker {
  private readonly delivered = new Map<string, number>();
  private readonly inflight = new Set<string>();

  tryAcquire(key: string): boolean {
    this.sweepExpired();
    if (this.inflight.has(key) || this.delivered.has(key)) return false;
    this.inflight.add(key);
    return true;
  }

  markDelivered(key: string): void {
    this.inflight.delete(key);
    this.delivered.set(key, Date.now());
    this.sweepExpired();
  }

  release(key: string): void {
    this.inflight.delete(key);
  }

  private sweepExpired(): void {
    const cutoff = Date.now() - DEDUPE_TTL_MS;
    for (const [key, at] of this.delivered) {
      if (at < cutoff) this.delivered.delete(key);
    }
    if (this.delivered.size <= DEDUPE_MAX_ENTRIES) return;
    const sorted = [...this.delivered.entries()].sort((a, b) => a[1] - b[1]);
    const removeCount = this.delivered.size - DEDUPE_MAX_ENTRIES;
    for (let i = 0; i < removeCount; i++) {
      this.delivered.delete(sorted[i][0]);
    }
  }
}
