import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { ASSET_GROUPS_UI_PAGE_SIZE } from "@/lib/asset-groups-limits";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceAssetGroupSummary } from "@/types/repositories";

type Props = {
  groups: WorkspaceAssetGroupSummary[];
  selectedGroupId: string | undefined;
  onAddGroup: () => void;
  groupHref: (id: string) => string;
};

export function AssetGroupsSidebar({ groups, selectedGroupId, onAddGroup, groupHref }: Props) {
  const pageSize = ASSET_GROUPS_UI_PAGE_SIZE;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selectedGroupId || groups.length === 0) return;
    const idx = groups.findIndex((g) => g.id === selectedGroupId);
    if (idx < 0) return;
    setPage(Math.floor(idx / pageSize) + 1);
  }, [selectedGroupId, pageSize, groups]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [groups.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(groups.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const listGroups = groups.slice(startOffset, startOffset + pageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">Asset groups</span>
            <InlineHelpHint className="size-7" label="About asset groups">
              <>
                <p>Browse workspace file sets (images, videos, documents) with a short note on what each file is about.</p>
                <p>Attach whichever groups fit an agent on the Profile tab.</p>
              </>
            </InlineHelpHint>
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="icon-sm"
            className="shrink-0"
            aria-label="Add group"
            onClick={onAddGroup}
          >
            <Plus className="size-4" aria-hidden />
          </Button>
        </div>
        <CardDescription>Select a group to view or edit files.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.length > 0 ? (
          <>
            {listGroups.map((group) => (
              <Link
                key={group.id}
                to={groupHref(group.id)}
                className={`flex items-baseline justify-between gap-2 rounded-md border px-3 py-2 text-sm ${
                  selectedGroupId === group.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                <p className="min-w-0 truncate font-medium">{group.name}</p>
                <p className="shrink-0 text-xs">
                  {group.asset_count} {group.asset_count === 1 ? "file" : "files"}
                </p>
              </Link>
            ))}
            {groups.length > pageSize ? (
              <TablePagination
                page={safePage}
                total={groups.length}
                pageSize={pageSize}
                onPage={setPage}
                compact
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No groups yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
