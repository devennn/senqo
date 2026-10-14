/** Keep in sync with backend `workspace-asset-limits.ts`. */

const MB = 1024 * 1024;

export const WORKSPACE_ASSET_MAX_BYTES = 20 * MB;

function formatMegabytes(bytes: number): string {
  const mb = bytes / MB;
  return Number.isInteger(mb) ? String(mb) : mb.toFixed(1);
}

export function workspaceAssetLimitsSummaryForUi(): string {
  return `Up to ${formatMegabytes(WORKSPACE_ASSET_MAX_BYTES)} MB per file`;
}
