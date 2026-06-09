import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  groupId: string;
  value: string;
  onChange: (next: string) => void;
  nameDirty: boolean;
  saving: boolean;
  disabled: boolean;
  error: string | null;
  onSave: () => void;
  className?: string;
};

export function ContextGroupNameFields({
  groupId,
  value,
  onChange,
  nameDirty,
  saving,
  disabled,
  error,
  onSave,
  className,
}: Props) {
  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={`ctx-group-name-${groupId}`}>Group name</Label>
      <div className="flex flex-wrap items-end gap-2">
        <Input
          id={`ctx-group-name-${groupId}`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Brand facts"
          className="min-w-0 flex-1 sm:max-w-md"
          disabled={saving || disabled}
        />
        <Button type="button" size="sm" disabled={saving || disabled || !nameDirty || value.trim().length === 0} onClick={onSave}>
          {saving ? "Saving…" : "Save name"}
        </Button>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
