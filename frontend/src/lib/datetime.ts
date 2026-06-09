export function localDateTimeInputValueToIsoUtc(localValue: string): string | null {
  const trimmed = localValue.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;
  const date = new Date(year, monthIndex, day, hour, minute, second);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
