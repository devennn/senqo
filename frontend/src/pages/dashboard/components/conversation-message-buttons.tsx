/** Read-only chips showing which interactive buttons an outbound message carried. */
export function ConversationMessageButtons({ buttons }: { buttons: unknown }) {
  const labels = parseButtonLabels(buttons);
  if (labels.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="message-buttons">
      {labels.map((label, index) => (
        <span
          key={`${label}-${index}`}
          className="rounded-md border border-current/25 px-2 py-0.5 text-[0.72rem] font-medium opacity-80"
        >
          {label}
        </span>
      ))}
    </div>
  );
}

function parseButtonLabels(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const labels: string[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const label = (raw as { label?: unknown }).label;
    if (typeof label !== "string") continue;
    const trimmed = label.trim();
    if (trimmed.length > 0) labels.push(trimmed);
  }
  return labels;
}
