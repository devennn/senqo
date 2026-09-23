import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import {
  HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP,
  HANDOFF_TOPIC_UI_PAGE_SIZE,
} from "@/lib/agent-handoff-topic-limits";
import type { WorkspaceHandoffTopicEntryRecord } from "@/types/repositories";
import { HandoffTopicGroupEntryCard } from "@/pages/dashboard/components/handoff-topic-group-entry-card";
import { HandoffTopicAddEntry } from "@/pages/dashboard/components/handoff-topic-add-entry";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";

type Props = {
  groupId: string;
  entries: WorkspaceHandoffTopicEntryRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

function pageForEntryId(
  entries: WorkspaceHandoffTopicEntryRecord[],
  entryId: string | null,
  pageSize: number,
): number {
  if (!entryId) return 1;
  const idx = entries.findIndex((entry) => entry.id === entryId);
  if (idx < 0) return 1;
  return Math.floor(idx / pageSize) + 1;
}

export function HandoffTopicGroupTopicsBlock({ groupId, entries, reloadGroup, onWorkspaceStale }: Props) {
  const [searchParams] = useSearchParams();
  const focusEntryId = searchParams.get("handoffEntryId");
  const pageSize = HANDOFF_TOPIC_UI_PAGE_SIZE;
  const focusPage = useMemo(
    () => pageForEntryId(entries, focusEntryId, pageSize),
    [entries, focusEntryId, pageSize],
  );
  const [page, setPage] = useState(focusPage);

  useEffect(() => {
    setPage(focusPage);
  }, [groupId, focusPage]);

  const totalPages = Math.max(1, Math.ceil(entries.length / pageSize) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const slicedEntries = entries.slice(startOffset, startOffset + pageSize);

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
          <p className="text-sm font-medium leading-none">Topics</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            ({entries.length}/{HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP})
          </span>
          <InlineHelpHint label="Topics in this group">
            <>
              <p>Each topic names when to switch the chat to a teammate; the description helps the model decide.</p>
              <p>Limit {HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP} topics per group.</p>
            </>
          </InlineHelpHint>
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No topics yet.</p>
        ) : (
          slicedEntries.map((entry, idx) => (
            <HandoffTopicGroupEntryCard
              key={entry.id}
              groupId={groupId}
              entry={entry}
              labelIndex={startOffset + idx + 1}
              focusOpen={entry.id === focusEntryId}
              onAfterMutation={reloadGroup}
              onWorkspaceStale={onWorkspaceStale}
            />
          ))
        )}
        {entries.length > pageSize ? (
          <TablePagination
            page={safePage}
            total={entries.length}
            pageSize={pageSize}
            onPage={setPage}
            compact
          />
        ) : null}
      </div>
      <HandoffTopicAddEntry
        groupId={groupId}
        atCapacity={entries.length >= HANDOFF_TOPIC_ENTRIES_MAX_PER_GROUP}
        onAdded={reloadGroup}
        onWorkspaceStale={onWorkspaceStale}
      />
    </>
  );
}
