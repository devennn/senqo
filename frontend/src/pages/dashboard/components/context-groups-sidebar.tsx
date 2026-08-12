import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { CONTEXT_ENTRIES_MAX_PER_GROUP, CONTEXT_GROUPS_UI_PAGE_SIZE } from "@/lib/context-groups-limits";
import { KnowledgeGroupListMeta } from "@/pages/dashboard/components/knowledge-group-list-meta";
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
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="flex min-w-0 items-center gap-1.5">
            <span className="truncate">Context groups</span>
            <InlineHelpHint className="size-7" label="About context groups">
              <>
                <p>Browse workspace-wide named groups of facts (title + body).</p>
                <p>Attach whichever groups fit an agent on Agent → Profile → Attached knowledge.</p>
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
        <CardDescription>Select a group to view or edit.</CardDescription>
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
                <KnowledgeGroupListMeta
                  className="shrink-0"
                  entryCount={group.entry_count}
                  entryMax={CONTEXT_ENTRIES_MAX_PER_GROUP}
                  entryLabelSingular="entry"
                  entryLabelPlural="entries"
                />
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
