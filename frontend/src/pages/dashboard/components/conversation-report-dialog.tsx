import { useState } from "react";
import { format } from "date-fns";
import { Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { api } from "@/lib/api";
import type { ConversationReportEntry } from "@/types/reports";

const REASON_MAX_LENGTH = 1000;

type Props = {
  conversationId: string;
  conversationTitle: string;
};

type ReportResponse = {
  report: ConversationReportEntry;
};

function formatEntryDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

export function ConversationReportDialog({
  conversationId,
  conversationTitle,
}: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<ConversationReportEntry[]>([]);

  const trimmedReason = reason.trim();
  const canSubmit = trimmedReason.length > 0 && !saving;

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (nextOpen) {
      setError(null);
      setSaving(false);
      setHistory([]);
      setLoading(true);
      void loadHistory();
    }
  }

  async function loadHistory() {
    try {
      const res = await api.get<{ reports: ConversationReportEntry[] }>(
        `/api/user/conversations/${conversationId}/reports`,
      );
      setHistory(Array.isArray(res.reports) ? res.reports : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (!trimmedReason || saving) return;
    setSaving(true);
    setError(null);
    try {
      const res = await api.post<ReportResponse>(
        `/api/user/conversations/${conversationId}/reports`,
        { reason: trimmedReason },
      );
      if (res.report) {
        setHistory((previous) => [res.report, ...previous]);
      }
      setReason("");
      setOpen(false);
    } catch {
      setError("Could not submit the report. Try again.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            title="Report as wrong"
            className="h-7 shrink-0 gap-1.5 px-2 text-xs"
          />
        }
      >
        <Flag className="size-3.5" />
        Report
      </DialogTrigger>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report this conversation as wrong</DialogTitle>
          <DialogDescription>
            Flag “{conversationTitle}” so your team can review it under Reports → Reported
            conversations.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <label htmlFor="conversation-report-reason" className="text-sm font-medium">
            Reason <span className="font-normal text-muted-foreground">(required)</span>
          </label>
          <Textarea
            id="conversation-report-reason"
            value={reason}
            maxLength={REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong in this conversation?"
            rows={4}
            className="resize-none"
          />
          <p className="text-right text-xs text-muted-foreground">
            {reason.length}/{REASON_MAX_LENGTH}
          </p>
        </div>
        <div className="grid gap-2">
          <h3 className="text-sm font-semibold">Previous reports</h3>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading reports...</p>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground">No reports yet.</p>
          ) : (
            <ul className="max-h-40 space-y-2 overflow-y-auto pr-1">
              {history.map((entry) => (
                <li
                  key={entry.id}
                  className="rounded-lg border border-border/70 bg-muted/40 px-3 py-2 text-sm"
                >
                  <p className="text-foreground">{entry.reason}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {entry.reportedByName} · {formatEntryDate(entry.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
          >
            {saving ? "Reporting..." : "Report"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}