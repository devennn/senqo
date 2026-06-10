import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { CONTEXT_GROUPS_UI_PAGE_SIZE } from "@/lib/context-groups-limits";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceContextGroupSummary } from "@/types/repositories";

type Props = {
  groups: WorkspaceContextGroupSummary[];
  selectedGroupId: string | undefined;
  onAddGroup: () => void;
  groupHref: (id: string) => string;
};

export function ContextGroupsSidebar({ groups, selectedGroupId, onAddGroup, groupHref }: Props) {
  const pageSize = CONTEXT_GROUPS_UI_PAGE_SIZE;
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
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1">
          Context groups
          <InlineHelpHint label="About context groups">
            <>
              <p>Browse workspace-wide named groups of facts (title + body).</p>
              <p>Attach whichever groups fit an agent on the Profile tab.</p>
            </>
          </InlineHelpHint>
        </CardTitle>
        <CardDescription>Select a group to view or edit.</CardDescription>
        <CardAction className="-mt-0.5 shrink-0">
          <Button type="button" size="sm" onClick={onAddGroup}>
            Add group
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {groups.length > 0 ? (
          <>
            {listGroups.map((group) => (
              <Link
                key={group.id}
                to={groupHref(group.id)}
                className={`block rounded-md border px-3 py-2 text-sm ${
                  selectedGroupId === group.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                <p className="truncate font-medium">{group.name}</p>
                <p className="truncate text-xs">
                  {group.entry_count} {group.entry_count === 1 ? "entry" : "entries"}
                </p>
              </Link>
            ))}
            {groups.length > pageSize ? (
              <TablePagination page={safePage} total={groups.length} pageSize={pageSize} onPage={setPage} />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No groups yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
