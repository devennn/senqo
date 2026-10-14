import { useState } from "react";
import { AGENT_ATTACH_UI_PAGE_SIZE } from "@/lib/agent-attach-limits";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";

export type AgentAttachCheckboxItem = {
  id: string;
  name: string;
  hint?: string;
};

type Props = {
  /** FormData field name; hidden inputs keep selections on other pages in the payload. */
  fieldName: string;
  items: AgentAttachCheckboxItem[];
  /** Baseline selection from the loaded agent config. */
  selectedIds: Set<string>;
};

/**
 * Paginated checkbox grid for agent setup attach sections. Items outside the visible page stay in
 * the form as hidden inputs, so dirty checks and the save payload keep selections from every page.
 */
export function AgentAttachCheckboxList({ fieldName, items, selectedIds }: Props) {
  const pageSize = AGENT_ATTACH_UI_PAGE_SIZE;
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(selectedIds));

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const pageItems = items.slice(startOffset, startOffset + pageSize);
  const itemIds = new Set(items.map((item) => item.id));
  const pageIds = new Set(pageItems.map((item) => item.id));
  const offPageSelectedIds = [...selected].filter(
    (id) => itemIds.has(id) && !pageIds.has(id),
  );

  function toggleItem(id: string, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  return (
    <>
      <div className="grid min-w-0 gap-2 sm:grid-cols-2">
        {pageItems.map((item) => (
          <label
            key={item.id}
            className="flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded-md border border-border/70 px-3 py-2 text-sm"
          >
            <input
              type="checkbox"
              className="shrink-0"
              name={fieldName}
              value={item.id}
              checked={selected.has(item.id)}
              onChange={(event) => toggleItem(item.id, event.target.checked)}
            />
            <span className="flex min-w-0 flex-1 flex-col overflow-hidden">
              <span className="truncate font-medium">{item.name}</span>
              {item.hint ? (
                <span className="truncate text-xs text-muted-foreground">{item.hint}</span>
              ) : null}
            </span>
          </label>
        ))}
      </div>
      {offPageSelectedIds.map((id) => (
        <input key={id} type="hidden" name={fieldName} value={id} />
      ))}
      {items.length > pageSize ? (
        <TablePagination
          page={safePage}
          total={items.length}
          pageSize={pageSize}
          onPage={setPage}
          compact
        />
      ) : null}
    </>
  );
}
