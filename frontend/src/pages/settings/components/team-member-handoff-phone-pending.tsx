import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  userId: string;
  phone: string;
  connectionName: string;
  code: string;
  busy: boolean;
  onCodeChange: (value: string) => void;
  onConfirm: () => void;
  onResend: () => void;
  onChangeNumber: () => void;
};

export function TeamMemberHandoffPhonePending({
  userId,
  phone,
  connectionName,
  code,
  busy,
  onCodeChange,
  onConfirm,
  onResend,
  onChangeNumber,
}: Props) {
  return (
    <div className="space-y-3">
      <div className="space-y-0.5">
        <p className="text-sm">
          Enter the code sent to <span className="font-medium tabular-nums">{phone}</span>
        </p>
        <p className="text-xs text-muted-foreground">Sent from {connectionName}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={`handoff-code-${userId}`}>Code</Label>
        <Input
          id={`handoff-code-${userId}`}
          inputMode="numeric"
          autoComplete="one-time-code"
          placeholder="6-digit code"
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          disabled={busy}
          className="w-full"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={busy || code.trim().length === 0} onClick={onConfirm}>
          Confirm
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={busy || phone.replace(/\D/g, "").length === 0}
          onClick={onResend}
        >
          Resend code
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onChangeNumber}>
          Different number
        </Button>
      </div>
    </div>
  );
}
