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
import { formatTopicShare } from "@/pages/dashboard/reports/reports-format";
import type { HandoffTopicPerformanceRow } from "@/types/reports";

type Props = {
  topics: HandoffTopicPerformanceRow[];
  totalHandoffs: number;
};

function formatGroupName(name: string): string {
  const trimmed = name.trim();
  return trimmed && trimmed !== "—" ? trimmed : "-";
}

function topicHref(
  wsPath: (path: string) => string,
  topic: HandoffTopicPerformanceRow,
): string | null {
  if (!topic.groupId) return null;
  const params = new URLSearchParams();
  params.set("tab", "handoff");
  params.set("handoffGroupId", topic.groupId);
  params.set("handoffEntryId", topic.id);
  return `${wsPath("/knowledge")}?${params.toString()}`;
}

function TopicName({ topic }: { topic: HandoffTopicPerformanceRow }) {
  const { wsPath } = useWorkspace();
  const href = topicHref(wsPath, topic);
  if (!href) {
    return <span className="text-muted-foreground">{topic.topicName}</span>;
  }
  return (
    <Link
      to={href}
      className="font-medium text-primary underline-offset-4 hover:underline"
    >
      {topic.topicName}
    </Link>
  );
}

export function ReportsHandoffTopicsTable({ topics, totalHandoffs }: Props) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {topics.map((topic) => (
          <article
            key={topic.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <h3 className="text-base font-semibold text-foreground">
              <TopicName topic={topic} />
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatGroupName(topic.groupName)}
            </p>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Handoffs
                </dt>
                <dd className="mt-1 font-medium">{topic.handoffs.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Share
                </dt>
                <dd className="mt-1 font-medium">
                  {formatTopicShare(topic.handoffs, totalHandoffs)}
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Topic</TableHead>
              <TableHead className="w-28 max-w-[7rem]">Group</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <span>Handoffs</span>
                  <InlineHelpHint label={hintLabel("Handoffs")} className="size-6">
                    <p>{REPORTS_DEFINITIONS.handoffs}</p>
                  </InlineHelpHint>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <span>Share</span>
                  <InlineHelpHint label={hintLabel("Share")} className="size-6">
                    <p>{REPORTS_DEFINITIONS.topicShare}</p>
                  </InlineHelpHint>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow key={topic.id}>
                <TableCell className="font-medium">
                  <TopicName topic={topic} />
                </TableCell>
                <TableCell className="w-28 max-w-[7rem] truncate text-muted-foreground">
                  {formatGroupName(topic.groupName)}
                </TableCell>
                <TableCell className="text-right">{topic.handoffs.toLocaleString()}</TableCell>
                <TableCell className="text-right">
                  {formatTopicShare(topic.handoffs, totalHandoffs)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
