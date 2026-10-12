import { useState } from "react";
import { AddLinkedDocDialog } from "@/pages/dashboard/components/add-linked-doc-dialog";
import { LinkedDocRow } from "@/pages/dashboard/components/linked-doc-row";
import { useLinkedDocs } from "@/hooks/useWorkspaceApps";
import { PageLoader } from "@/components/ui/spinner";

export function LinkedDocsPanel() {
  const {
    docs,
    loading,
    updateDescription,
    removeDoc,
    reload,
    summarizeExistingDoc,
  } = useLinkedDocs();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [summarizingId, setSummarizingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (loading) {
    return <PageLoader label="Loading docs" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Live linked files the agent re-reads via code mode (inventory sheets, PDFs, CSV).
        </p>
        <AddLinkedDocDialog onCreated={() => void reload({ silent: true })} />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {docs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/60 py-12 text-center text-sm text-muted-foreground">
          No linked docs yet. Add one file — AI drafts what the agent can use it for.
        </div>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {docs.map((doc) => (
            <LinkedDocRow
              key={doc.id}
              doc={doc}
              editing={editingId === doc.id}
              draft={editingId === doc.id ? draft : doc.description}
              busy={busyId === doc.id}
              summarizing={summarizingId === doc.id}
              onDraftChange={setDraft}
              onStartEdit={() => {
                setEditingId(doc.id);
                setDraft(doc.description);
              }}
              onCancelEdit={() => setEditingId(null)}
              onSave={() => {
                setBusyId(doc.id);
                setError(null);
                void updateDescription(doc.id, draft.trim())
                  .then(() => setEditingId(null))
                  .catch((err) =>
                    setError(err instanceof Error ? err.message : "Save failed"),
                  )
                  .finally(() => setBusyId(null));
              }}
              onDelete={() => {
                setBusyId(doc.id);
                setError(null);
                void removeDoc(doc.id)
                  .catch((err) =>
                    setError(
                      err instanceof Error ? err.message : "Delete failed",
                    ),
                  )
                  .finally(() => setBusyId(null));
              }}
              onRegenerate={() => {
                setSummarizingId(doc.id);
                setError(null);
                void summarizeExistingDoc(doc.id)
                  .then((text) => {
                    setDraft(text);
                    setEditingId(doc.id);
                  })
                  .catch((err) =>
                    setError(
                      err instanceof Error
                        ? err.message
                        : "Could not summarize file",
                    ),
                  )
                  .finally(() => setSummarizingId(null));
              }}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
