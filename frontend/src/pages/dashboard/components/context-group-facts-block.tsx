import { useEffect, useState } from "react";
import type { WorkspaceContextEntryRecord } from "@/types/repositories";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import {
  CONTEXT_ENTRIES_MAX_PER_GROUP,
  CONTEXT_GROUPS_UI_PAGE_SIZE,
} from "@/lib/context-groups-limits";
import { ContextAddFact } from "@/pages/dashboard/components/context-add-fact";
import { ContextGroupFactEntryCard } from "@/pages/dashboard/components/context-group-fact-entry-card";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";

type Props = {
  groupId: string;
  entries: WorkspaceContextEntryRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

export function ContextGroupFactsBlock({ groupId, entries, reloadGroup, onWorkspaceStale }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = CONTEXT_GROUPS_UI_PAGE_SIZE;

  useEffect(() => {
    setPage(1);
  }, [groupId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [entries.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const slicedEntries = entries.slice(startOffset, startOffset + pageSize);

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-medium leading-none">Facts</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            ({entries.length}/{CONTEXT_ENTRIES_MAX_PER_GROUP})
          </span>
          <InlineHelpHint label="Facts in this group">
            <p>
              Short title plus factual body text. Agents only see groups you attach on Profile. Response templates still override when both apply.
            </p>
          </InlineHelpHint>
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No facts yet.</p>
        ) : (
          slicedEntries.map((entry, idx) => (
            <ContextGroupFactEntryCard
              key={entry.id}
              groupId={groupId}
              entry={entry}
              labelIndex={startOffset + idx + 1}
              onAfterMutation={reloadGroup}
              onWorkspaceStale={onWorkspaceStale}
            />
          ))
        )}
        {entries.length > pageSize ? (
          <TablePagination page={safePage} total={entries.length} pageSize={pageSize} onPage={setPage} />
        ) : null}
      </div>
      <ContextAddFact
        groupId={groupId}
        atCapacity={entries.length >= CONTEXT_ENTRIES_MAX_PER_GROUP}
        onAdded={reloadGroup}
        onWorkspaceStale={onWorkspaceStale}
      />
    </>
  );
}
