import { useEffect, useState } from "react";
import type { WorkspaceResponseTemplateEntryRecord } from "@/types/repositories";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import {
  RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP,
  RESPONSE_TEMPLATE_UI_PAGE_SIZE,
} from "@/lib/response-template-limits";
import { ResponseTemplateGroupEntryCard } from "@/pages/dashboard/components/response-template-group-entry-card";
import { ResponseTemplateAddEntry } from "@/pages/dashboard/components/response-template-add-entry";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";

type Props = {
  groupId: string;
  entries: WorkspaceResponseTemplateEntryRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

export function ResponseTemplateGroupTemplatesBlock({ groupId, entries, reloadGroup, onWorkspaceStale }: Props) {
  const [page, setPage] = useState(1);
  const pageSize = RESPONSE_TEMPLATE_UI_PAGE_SIZE;

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
          <p className="text-sm font-medium leading-none">Templates</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            ({entries.length}/{RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP})
          </span>
          <InlineHelpHint label="About templates in this group">
            <>
              <p>
                Entries are predefined question-and-reply snippets for consistent WhatsApp replies. Edit one saved row at a
                time.
              </p>
              <p>
                Limit {RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP} entries per group. Intent matching is semantic —
                shopper wording may differ.
              </p>
            </>
          </InlineHelpHint>
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          slicedEntries.map((entry, idx) => (
            <ResponseTemplateGroupEntryCard
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
          <TablePagination
            page={safePage}
            total={entries.length}
            pageSize={pageSize}
            onPage={setPage}
          />
        ) : null}
      </div>
      <ResponseTemplateAddEntry
        groupId={groupId}
        atCapacity={entries.length >= RESPONSE_TEMPLATE_ENTRIES_MAX_PER_GROUP}
        onAdded={reloadGroup}
        onWorkspaceStale={onWorkspaceStale}
      />
    </>
  );
}
