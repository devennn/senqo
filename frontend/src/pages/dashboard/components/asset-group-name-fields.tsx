import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  groupId: string;
  value: string;
  onChange: (value: string) => void;
  nameDirty: boolean;
  saving: boolean;
  disabled: boolean;
  error: string | null;
  onSave: () => void;
  className?: string;
};

export function AssetGroupNameFields({
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
    <div className={className}>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled || saving}
        aria-label="Asset group name"
        className="h-9 font-semibold"
      />
      {nameDirty ? (
        <Button type="button" size="sm" className="mt-2" disabled={saving} onClick={onSave}>
          {saving ? "Saving…" : "Save name"}
        </Button>
      ) : null}
      {error ? <p className="mt-2 text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
