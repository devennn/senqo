import { useEffect, useState } from "react";
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

export function HandoffTopicGroupTopicsBlock({ groupId, entries, reloadGroup, onWorkspaceStale }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = HANDOFF_TOPIC_UI_PAGE_SIZE;

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
              onAfterMutation={reloadGroup}
              onWorkspaceStale={onWorkspaceStale}
            />
          ))
        )}
        {entries.length > pageSize ? (
          <TablePagination page={safePage} total={entries.length} pageSize={pageSize} onPage={setPage} />
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
