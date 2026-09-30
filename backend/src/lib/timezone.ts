/** IANA timezone helpers for agent clock and business-hours reasoning. */

export function isValidTimeZone(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: trimmed });
    return true;
  } catch {
    return false;
  }
}

/** Human label, e.g. "Friday, September 25, 2026 at 1:15 PM". */
export function formatZonedDateTime(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    dateStyle: "full",
    timeStyle: "short",
  }).format(date);
}

/** Human label with zone and offset, e.g. "Friday, September 25, 2026 at 1:15 PM (Asia/Kuala_Lumpur, GMT+8)". */
export function formatZonedDateTimeWithZone(date: Date, timeZone: string): string {
  const label = formatZonedDateTime(date, timeZone);
  const offset = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  return offset ? `${label} (${timeZone}, ${offset})` : `${label} (${timeZone})`;
}

/** Renders an ISO timestamp in the business zone; null when the timestamp is unparseable. */
export function formatZonedDateTimeFromIso(iso: string, timeZone: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return formatZonedDateTimeWithZone(date, timeZone);
}
