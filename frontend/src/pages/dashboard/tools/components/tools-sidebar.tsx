import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CUSTOM_TOOLS_UI_PAGE_SIZE } from "@/lib/custom-tools-limits";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceCustomToolListItem } from "@/types/repositories";

type Props = {
  tools: WorkspaceCustomToolListItem[];
  selectedId?: string;
  isNew: boolean;
  toToolsUrl: (target: { toolId?: string | null; mode?: string | null }) => string;
};

export function ToolsSidebar({ tools, selectedId, isNew, toToolsUrl }: Props) {
  const pageSize = CUSTOM_TOOLS_UI_PAGE_SIZE;
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!selectedId || tools.length === 0) return;
    const idx = tools.findIndex((t) => t.id === selectedId);
    if (idx < 0) return;
    setPage(Math.floor(idx / pageSize) + 1);
  }, [selectedId, pageSize, tools]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(tools.length / pageSize));
    setPage((p) => Math.min(Math.max(p, 1), totalPages));
  }, [tools.length, pageSize]);

  const totalPages = Math.max(1, Math.ceil(tools.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const startOffset = (safePage - 1) * pageSize;
  const listTools = tools.slice(startOffset, startOffset + pageSize);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Workspace tools</CardTitle>
        <CardDescription>Select a tool to view or edit.</CardDescription>
        <CardAction className="-mt-0.5 shrink-0">
          <Link to={toToolsUrl({ mode: "new" })}>
            <Button type="button" size="sm">
              Add tool
            </Button>
          </Link>
        </CardAction>
      </CardHeader>
      <CardContent className="space-y-2">
        {isNew ? (
          <div className="rounded-md border border-primary bg-primary/5 px-3 py-2 text-sm">
            <p className="font-medium">New tool</p>
          </div>
        ) : null}
        {tools.length > 0 ? (
          <>
            {listTools.map((tool) => (
              <Link
                key={tool.id}
                to={toToolsUrl({ toolId: tool.id })}
                className={`block rounded-md border px-3 py-2 text-sm ${
                  !isNew && selectedId === tool.id
                    ? "border-primary bg-primary/5 text-foreground"
                    : "border-border/70 text-muted-foreground"
                }`}
              >
                <p className="truncate font-medium">{tool.display_name}</p>
                <p className="truncate font-mono text-xs">{tool.tool_key}</p>
              </Link>
            ))}
            {tools.length > pageSize ? (
              <TablePagination
                page={safePage}
                total={tools.length}
                pageSize={pageSize}
                onPage={setPage}
                compact
              />
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No custom tools yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
