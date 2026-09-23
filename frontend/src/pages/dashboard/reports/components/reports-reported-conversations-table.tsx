import { format } from "date-fns";
import { Link } from "react-router-dom";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { useWorkspace } from "@/context/workspace";
import { REPORTS_DEFINITIONS, hintLabel } from "@/pages/dashboard/reports/reports-definitions";
import type { ConversationReportRow } from "@/types/reports";

type Props = {
  rows: ConversationReportRow[];
};

function formatReportedDate(iso: string): string {
  return format(new Date(iso), "MMM d, yyyy");
}

function conversationHref(
  wsPath: (path: string) => string,
  conversationId: string,
): string {
  const params = new URLSearchParams();
  params.set("conversationId", conversationId);
  return `${wsPath("/dashboard")}?${params.toString()}`;
}

function ConversationName({ row }: { row: ConversationReportRow }) {
  const { wsPath } = useWorkspace();
  return (
    <Link
      to={conversationHref(wsPath, row.conversationId)}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {row.conversationName}
    </Link>
  );
}

function dash(value: string | null): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "-";
}

export function ReportsReportedConversationsTable({ rows }: Props) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <h3 className="text-base font-semibold text-foreground">
              <ConversationName row={row} />
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{dash(row.agentName)}</p>
            <p className="mt-2 text-sm text-foreground">{row.reason}</p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reported
                </dt>
                <dd className="mt-1 font-medium">{formatReportedDate(row.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Reported by
                </dt>
                <dd className="mt-1 font-medium">{row.reportedByName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Contact
                </dt>
                <dd className="mt-1 font-medium">{dash(row.contactName)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Agent
                </dt>
                <dd className="mt-1 font-medium">{dash(row.agentName)}</dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <div className="flex items-center gap-1">
                  <span>Reported</span>
                  <InlineHelpHint label={hintLabel("Reported")} className="size-6">
                    <p>{REPORTS_DEFINITIONS.reportedOn}</p>
                  </InlineHelpHint>
                </div>
              </TableHead>
              <TableHead>Conversation</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Reported by</TableHead>
              <TableHead>Agent</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatReportedDate(row.createdAt)}
                </TableCell>
                <TableCell className="max-w-[12rem]">
                  <span className="block truncate">
                    <ConversationName row={row} />
                  </span>
                </TableCell>
                <TableCell className="max-w-[10rem]">
                  <span className="block truncate text-muted-foreground">
                    {dash(row.contactName)}
                  </span>
                </TableCell>
                <TableCell className="max-w-[20rem]">
                  <span className="block truncate" title={row.reason}>
                    {row.reason}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {row.reportedByName}
                </TableCell>
                <TableCell className="max-w-[12rem]">
                  <span className="block truncate text-muted-foreground">
                    {dash(row.agentName)}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}