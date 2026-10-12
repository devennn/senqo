import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";

export type AgentLinkedDocOption = {
  id: string;
  file_name: string;
  description: string;
  source: string;
};

type Props = {
  docs: AgentLinkedDocOption[];
  selectedIds: Set<string>;
  docsTabHref: string;
  subsectionDirty: boolean;
  saving: boolean;
};

export function AgentLinkedDocsFields({
  docs,
  selectedIds,
  docsTabHref,
  subsectionDirty,
  saving,
}: Props) {
  return (
    <fieldset className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <Label className="flex shrink-0 items-center gap-2">
            <FileText className="size-3.5 text-muted-foreground" />
            Linked docs
          </Label>
          <InlineHelpHint label="About linked docs">
            <p>
              Live files (Drive or upload) the agent re-reads via execute_code / readLinkedDoc.
              Attach docs authored on Knowledge → Docs.
            </p>
          </InlineHelpHint>
        </div>
        {subsectionDirty ? (
          <Button type="submit" size="sm" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        ) : null}
      </div>
      {docs.length > 0 ? (
        <div className="grid gap-2 sm:grid-cols-2">
          {docs.map((doc) => (
            <label
              key={doc.id}
              className="flex items-center gap-2 rounded-md border border-border/70 px-3 py-2 text-sm"
            >
              <input
                type="checkbox"
                name="linkedDocs"
                value={doc.id}
                defaultChecked={selectedIds.has(doc.id)}
              />
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{doc.file_name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {doc.description}
                </span>
              </span>
            </label>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          None yet. Open{" "}
          <Link
            to={docsTabHref}
            className="font-medium text-primary underline-offset-4 hover:underline"
          >
            Knowledge → Docs
          </Link>{" "}
          to add a file, then return here to attach it.
        </p>
      )}
    </fieldset>
  );
}
