const GB = 1024 * 1024 * 1024;
const MB = 1024 * 1024;
const KB = 1024;

export function formatStorageBytes(bytes: number): string {
  if (bytes <= 0) return "0 B";
  if (bytes >= GB) {
    const gb = bytes / GB;
    return `${gb < 10 ? gb.toFixed(2) : gb.toFixed(1)} GB`;
  }
  if (bytes >= MB) {
    const mb = bytes / MB;
    return mb >= 10 ? `${Math.round(mb)} MB` : `${mb.toFixed(1)} MB`;
  }
  if (bytes >= KB) {
    return `${Math.round(bytes / KB)} KB`;
  }
  return `${bytes} B`;
}

export function breakdownPercent(partBytes: number, totalUsedBytes: number): number {
  if (totalUsedBytes <= 0 || partBytes <= 0) return 0;
  return Math.round((partBytes / totalUsedBytes) * 100);
}