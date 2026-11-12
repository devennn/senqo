import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import {
  BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP,
  BUTTON_TEMPLATE_UI_PAGE_SIZE,
} from "@/lib/button-template-limits";
import { ButtonTemplateEntryCard } from "@/pages/dashboard/components/button-template-entry-card";
import { ButtonTemplateAddEntry } from "@/pages/dashboard/components/button-template-add-entry";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceButtonTemplateEntryRecord } from "@/types/repositories";

type Props = {
  groupId: string;
  entries: WorkspaceButtonTemplateEntryRecord[];
  reloadGroup: () => Promise<void>;
  onWorkspaceStale: () => Promise<void>;
};

function pageForEntryId(
  entries: WorkspaceButtonTemplateEntryRecord[],
  entryId: string | null,
  pageSize: number,
): number {
  if (!entryId) return 1;
  const idx = entries.findIndex((entry) => entry.id === entryId);
  if (idx < 0) return 1;
  return Math.floor(idx / pageSize) + 1;
}

export function ButtonTemplateGroupTemplatesBlock({ groupId, entries, reloadGroup, onWorkspaceStale }: Props) {
  const [searchParams] = useSearchParams();
  const focusEntryId = searchParams.get("buttonEntryId");
  const pageSize = BUTTON_TEMPLATE_UI_PAGE_SIZE;
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
          <p className="text-sm font-medium leading-none">Templates</p>
          <span className="text-xs tabular-nums text-muted-foreground">
            ({entries.length}/{BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP})
          </span>
          <InlineHelpHint label="About button templates in this group">
            <>
              <p>
                Each template is one message with up to three interactive buttons (quick reply, link, call, or
                copy code). The agent sends the template exactly as authored.
              </p>
              <p>Limit {BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP} templates per group. Edit one saved row at a time.</p>
            </>
          </InlineHelpHint>
        </div>
        {entries.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No templates yet.</p>
        ) : (
          slicedEntries.map((entry, idx) => (
            <ButtonTemplateEntryCard
              key={entry.id}
              groupId={groupId}
              entry={entry}
              labelIndex={startOffset + idx + 1}
              onAfterMutation={reloadGroup}
              onWorkspaceStale={onWorkspaceStale}
              focusOpen={entry.id === focusEntryId}
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
      <ButtonTemplateAddEntry
        groupId={groupId}
        atCapacity={entries.length >= BUTTON_TEMPLATE_ENTRIES_MAX_PER_GROUP}
        onAdded={reloadGroup}
        onWorkspaceStale={onWorkspaceStale}
      />
    </>
  );
}
