import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  value: string;
  onChange: (value: string) => void;
  onTest: (input: unknown) => Promise<Record<string, unknown>>;
};

export function ToolTestPanel({ value, onChange, onTest }: Props) {
  const [testResult, setTestResult] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const parsed = JSON.parse(value) as unknown;
      const result = await onTest(parsed);
      setTestResult(JSON.stringify(result, null, 2));
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : String(error));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Test input (JSON)</p>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={5}
        className="font-mono text-xs"
      />
      <Button type="button" size="sm" disabled={testing} onClick={() => { void handleTest(); }}>
        {testing ? "Running…" : "Run test"}
      </Button>
      {testResult ? (
        <pre className="max-h-64 overflow-auto rounded-md border border-border/70 bg-muted/30 p-3 text-xs">
          {testResult}
        </pre>
      ) : null}
    </div>
  );
}
