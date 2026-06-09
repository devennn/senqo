import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function TaskScheduleFields() {
  return (
    <div className="grid gap-2">
      <Label>Run at (your local time, stored as UTC)</Label>
      <Input id="oneTimeAtLocal" type="datetime-local" required />
      <input type="hidden" name="scheduleType" value="one_time" />
      <input type="hidden" name="oneTimeAt" value="" />
    </div>
  );
}
