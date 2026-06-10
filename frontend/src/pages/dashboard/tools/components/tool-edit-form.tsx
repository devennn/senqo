import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Label } from "@/components/ui/label";
import type { ToolWithSource } from "@/hooks/useCustomTools";
import {
  formatRequiredEnvInput,
  normalizeToolSourceForEditor,
  parseRequiredEnvInput,
} from "@/lib/custom-tool-source";
import { normalizeToolTestInput } from "@/lib/custom-tool-test-input";
import { ToolCodeEditor } from "@/pages/dashboard/tools/components/tool-code-editor";
import { ToolRequiredEnvField } from "@/pages/dashboard/tools/components/tool-required-env-field";
import { ToolTestPanel } from "@/pages/dashboard/tools/components/tool-test-panel";

type Props = {
  tool: ToolWithSource;
  onTest: (
    id: string,
    input: unknown,
    draft?: { sourceCode?: string; requiredEnv?: string[] },
  ) => Promise<Record<string, unknown>>;
  onUpdate: (
    id: string,
    displayName: string,
    description: string,
    sourceCode: string,
    requiredEnv: string[],
    testInput: string,
    isActive: boolean,
  ) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  secretsSettingsPath: string;
};

export function ToolEditForm({ tool, onTest, onUpdate, onDelete, secretsSettingsPath }: Props) {
  const baseline = useMemo(
    () => ({
      displayName: tool.display_name,
      description: tool.description,
      sourceCode: normalizeToolSourceForEditor(tool.source_code),
      requiredEnvInput: formatRequiredEnvInput(tool.required_env),
      testInput: normalizeToolTestInput(tool.test_input),
      isActive: tool.is_active,
    }),
    [tool],
  );
  const [displayName, setDisplayName] = useState(baseline.displayName);
  const [description, setDescription] = useState(baseline.description);
  const [requiredEnvInput, setRequiredEnvInput] = useState(baseline.requiredEnvInput);
  const [sourceCode, setSourceCode] = useState(baseline.sourceCode);
  const [testInput, setTestInput] = useState(baseline.testInput);
  const [isActive, setIsActive] = useState(baseline.isActive);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDisplayName(baseline.displayName);
    setDescription(baseline.description);
    setRequiredEnvInput(baseline.requiredEnvInput);
    setSourceCode(baseline.sourceCode);
    setTestInput(baseline.testInput);
    setIsActive(baseline.isActive);
  }, [baseline]);

  const dirty =
    displayName !== baseline.displayName ||
    description !== baseline.description ||
    requiredEnvInput !== baseline.requiredEnvInput ||
    sourceCode !== baseline.sourceCode ||
    testInput !== baseline.testInput ||
    isActive !== baseline.isActive;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || saving) return;
    setSaving(true);
    try {
      await onUpdate(
        tool.id,
        displayName,
        description,
        sourceCode,
        parseRequiredEnvInput(requiredEnvInput),
        testInput,
        isActive,
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0 truncate">{displayName.trim() || "Untitled tool"}</CardTitle>
        <CardDescription className="font-mono text-xs">{tool.tool_key}</CardDescription>
        <CardAction className="-mt-0.5 shrink-0">
          <Button type="button" size="sm" variant="destructive" onClick={() => { void onDelete(tool.id); }}>
            Delete
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => { void handleSubmit(e); }} className="space-y-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <ToolRequiredEnvField
            value={requiredEnvInput}
            onChange={setRequiredEnvInput}
            secretsSettingsPath={secretsSettingsPath}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>Execute code</Label>
              <InlineHelpHint label="Execute code help">
                <p>
                  Export <code>async function execute(input, ctx)</code>. Use an inline input type
                  (for example <code>input: {"{ city: string }"}</code>). See How to write tools in
                  the sidebar for the full guide.
                </p>
              </InlineHelpHint>
            </div>
            <ToolCodeEditor value={sourceCode} onChange={setSourceCode} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active
          </label>
          <ToolTestPanel
            value={testInput}
            onChange={setTestInput}
            onTest={(input) =>
              onTest(tool.id, input, {
                sourceCode,
                requiredEnv: parseRequiredEnvInput(requiredEnvInput),
              })
            }
          />
          <Button type="submit" size="sm" disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
