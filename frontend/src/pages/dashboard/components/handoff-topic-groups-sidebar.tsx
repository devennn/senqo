import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import {
  HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP,
  HANDOFF_TOPIC_UI_PAGE_SIZE,
} from "@/lib/agent-handoff-topic-limits";
import { HandoffTopicGroupRowMenu } from "@/pages/dashboard/components/handoff-topic-group-row-menu";
import { KnowledgeGroupListMeta } from "@/pages/dashboard/components/knowledge-group-list-meta";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceHandoffTopicGroupSummary } from "@/types/repositories";

type Props = {
  groups: WorkspaceHandoffTopicGroupSummary[];
  selectedGroupId: string | undefined;
  onAddGroup: () => void;
  groupHref: (id: string) => string;
  onOpenAttachDialog: (groupId: string) => void;
};

export function HandoffTopicGroupsSidebar({
  groups,
  selectedGroupId,
  onAddGroup,
  groupHref,
  onOpenAttachDialog,
}: Props) {
  const pageSize = HANDOFF_TOPIC_UI_PAGE_SIZE;
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
            <span className="truncate">Handoff groups</span>
            <InlineHelpHint className="size-7" label="About handoff groups">
              <>
                <p>
                  Workspace-wide named folders for human takeover topics. Each row lists a trigger phrase plus guidance for the AI.
                </p>
                <p>
                  Use the row menu or Handoff settings to choose which agents use this group and who to notify.
                </p>
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
              <div
                key={group.id}
                className={`flex items-center gap-1 rounded-md border ${
                  selectedGroupId === group.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                <Link
                  to={groupHref(group.id)}
                  className="flex min-w-0 flex-1 items-baseline justify-between gap-2 px-3 py-2 text-sm"
                >
                  <p className="min-w-0 truncate font-medium">{group.name}</p>
                  <KnowledgeGroupListMeta
                    className="shrink-0"
                    entryCount={group.entry_count}
                    entryMax={HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP}
                    entryLabelSingular="topic"
                    entryLabelPlural="topics"
                  />
                </Link>
                <div className="pr-1">
                  <HandoffTopicGroupRowMenu
                    onOpenHandoffSettings={() => onOpenAttachDialog(group.id)}
                  />
                </div>
              </div>
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
