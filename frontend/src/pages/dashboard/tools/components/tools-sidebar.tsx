import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { WorkspaceCustomToolListItem } from "@/types/repositories";

type Props = {
  tools: WorkspaceCustomToolListItem[];
  selectedId?: string;
  isNew: boolean;
  toToolsUrl: (target: { toolId?: string | null; mode?: string | null }) => string;
};

export function ToolsSidebar({ tools, selectedId, isNew, toToolsUrl }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">Workspace tools</CardTitle>
          <Link to={toToolsUrl({ mode: "new" })}>
            <Button type="button" size="sm">Add tool</Button>
          </Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        {tools.map((tool) => (
          <Link
            key={tool.id}
            to={toToolsUrl({ toolId: tool.id })}
            className={`block rounded-md border px-3 py-2 text-sm transition-colors ${
              !isNew && selectedId === tool.id
                ? "border-primary bg-primary/5 font-semibold"
                : "border-border/70 hover:bg-muted/50"
            }`}
          >
            <span>{tool.display_name}</span>
            <span className="mt-0.5 block font-mono text-xs text-muted-foreground">{tool.tool_key}</span>
          </Link>
        ))}
        {tools.length === 0 ? (
          <p className="text-sm text-muted-foreground">No custom tools yet.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
