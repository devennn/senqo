import { format } from "date-fns";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ReportsDateRange } from "@/types/reports";

type Props = {
  range: ReportsDateRange;
  onRangeChange: (range: ReportsDateRange) => void;
};

export function ReportsDateRangeToolbar({ range, onRangeChange }: Props) {
  const today = format(new Date(), "yyyy-MM-dd");
  const fromMax = range.to < today ? range.to : today;

  return (
    <div className="flex flex-wrap items-end justify-end gap-3">
      <div className="mb-2 flex items-center">
        <InlineHelpHint label="About reports date range">
          <p>
            Counts cover conversations touched by each agent between the selected dates. Handoffs
            are AI-initiated transfers to a human. Dates after today cannot be selected.
          </p>
        </InlineHelpHint>
      </div>
      <div className="grid gap-1">
        <Label htmlFor="reports-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="reports-from"
          type="date"
          value={range.from}
          max={fromMax}
          onChange={(e) => onRangeChange({ ...range, from: e.target.value })}
          className="h-9 w-[10.5rem]"
        />
      </div>
      <div className="grid gap-1">
        <Label htmlFor="reports-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="reports-to"
          type="date"
          value={range.to}
          min={range.from}
          max={today}
          onChange={(e) => onRangeChange({ ...range, to: e.target.value })}
          className="h-9 w-[10.5rem]"
        />
      </div>
    </div>
  );
}
