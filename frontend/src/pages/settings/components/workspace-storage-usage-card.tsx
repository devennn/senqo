import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { breakdownPercent, formatStorageBytes } from "@/lib/workspace-storage";
import { workspaceAssetLimitsSummaryForUi } from "@/lib/workspace-asset-limits";
import type { WorkspaceStorageUsage } from "@/types/repositories";

type Props = {
  storage: WorkspaceStorageUsage | null;
};

function BreakdownRow(props: { label: string; bytes: number; totalUsed: number }) {
  const { label, bytes, totalUsed } = props;
  const share = breakdownPercent(bytes, totalUsed);
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums text-foreground">
        {formatStorageBytes(bytes)}
        {totalUsed > 0 ? <span className="text-muted-foreground"> ({share}%)</span> : null}
      </span>
    </div>
  );
}

export function WorkspaceStorageUsageCard({ storage }: Props) {
  const assetsBytes = storage?.breakdown.assetsBytes ?? 0;
  const mediaBytes = storage?.breakdown.mediaBytes ?? 0;
  const usedBytes = assetsBytes + mediaBytes;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span>Storage</span>
          <InlineHelpHint label="Workspace storage">
            <>
              <p>
                Tracks agent asset files and media saved from WhatsApp conversations.
              </p>
              <p>Deleting agent assets frees space immediately. Conversation media counts while stored in your workspace.</p>
              <p>Asset upload limits: {workspaceAssetLimitsSummaryForUi()}.</p>
            </>
          </InlineHelpHint>
        </CardTitle>
        <CardDescription>Usage across agent assets and saved conversation media.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatStorageBytes(usedBytes)} used</span>
          </div>
        </div>
        <div className="space-y-2 rounded-md border bg-muted/30 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Breakdown</p>
          <BreakdownRow label="Agent assets" bytes={assetsBytes} totalUsed={usedBytes} />
          <BreakdownRow label="Conversation media" bytes={mediaBytes} totalUsed={usedBytes} />
        </div>
      </CardContent>
    </Card>
  );
}