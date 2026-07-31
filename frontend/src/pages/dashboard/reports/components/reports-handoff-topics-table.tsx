import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatTopicShare } from "@/pages/dashboard/reports/reports-format";
import type { HandoffTopicPerformanceRow } from "@/types/reports";

type Props = {
  topics: HandoffTopicPerformanceRow[];
  totalHandoffs: number;
};

export function ReportsHandoffTopicsTable({ topics, totalHandoffs }: Props) {
  return (
    <>
      <div className="space-y-3 md:hidden">
        {topics.map((topic) => (
          <article
            key={topic.id}
            className="rounded-2xl border border-border bg-card p-4 shadow-soft"
          >
            <h3 className="text-base font-semibold text-foreground">{topic.topicName}</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">{topic.groupName}</p>
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
              <TableHead>Group</TableHead>
              <TableHead className="text-right">Handoffs</TableHead>
              <TableHead className="text-right">Share</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {topics.map((topic) => (
              <TableRow key={topic.id}>
                <TableCell className="font-medium">{topic.topicName}</TableCell>
                <TableCell className="text-muted-foreground">{topic.groupName}</TableCell>
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
