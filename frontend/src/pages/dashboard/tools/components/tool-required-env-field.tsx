import { Link } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: string;
  onChange: (value: string) => void;
  secretsSettingsPath: string;
};

export function ToolRequiredEnvField({ value, onChange, secretsSettingsPath }: Props) {
  return (
    <div className="space-y-2">
      <Label htmlFor="tool-required-env">Required env names</Label>
      <Input
        id="tool-required-env"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="MY_API_KEY, OTHER_SECRET"
        className="font-mono text-sm"
      />
      <p className="text-xs text-muted-foreground">
        Comma-separated names referenced in code as{" "}
        <code className="rounded bg-muted px-1">ctx.env.MY_API_KEY</code>. See Available secrets in
        the sidebar; add values in{" "}
        <Link to={secretsSettingsPath} className="text-primary underline-offset-2 hover:underline">
          Settings → Secrets
        </Link>
        .
      </p>
    </div>
  );
}
