import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Label } from "@/components/ui/label";
import { CUSTOM_TOOL_SOURCE_TEMPLATE } from "@/lib/custom-tool-template";
import type { CustomToolGenerateDraft } from "@/types/custom-tool-generate";
import { ToolAiGenerateDialog } from "@/pages/dashboard/tools/components/tool-ai-generate-dialog";
import { ToolCodeEditor } from "@/pages/dashboard/tools/components/tool-code-editor";
import { ToolRequiredEnvField } from "@/pages/dashboard/tools/components/tool-required-env-field";

type Props = {
  onCreate: (
    displayName: string,
    description: string,
    sourceCode: string,
    requiredEnv: string[],
  ) => Promise<void>;
  onGenerate: (prompt: string) => Promise<CustomToolGenerateDraft>;
  cancelTo: string;
  secretsSettingsPath: string;
};

export function ToolCreateForm({ onCreate, onGenerate, cancelTo, secretsSettingsPath }: Props) {
  const [displayName, setDisplayName] = useState("My Custom Tool");
  const [description, setDescription] = useState("");
  const [requiredEnvInput, setRequiredEnvInput] = useState("");
  const [sourceCode, setSourceCode] = useState(CUSTOM_TOOL_SOURCE_TEMPLATE);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleGenerate(prompt: string) {
    setGenerating(true);
    setGenerateError(null);
    try {
      const draft = await onGenerate(prompt);
      setDisplayName(draft.displayName);
      setDescription(draft.description);
      setRequiredEnvInput(draft.requiredEnv.join(", "));
      setSourceCode(draft.sourceCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not generate tool code.";
      setGenerateError(message);
      throw error instanceof Error ? error : new Error(message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    try {
      const requiredEnv = requiredEnvInput
        .split(",")
        .map((part) => part.trim())
        .filter(Boolean);
      await onCreate(displayName, description, sourceCode, requiredEnv);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create tool</CardTitle>
        <CardDescription>
          Describe the tool for the AI, list env names, and write only the execute function (input types are inferred).
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(e) => {
            void handleSubmit(e);
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="tool-create-name">
              Name <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="tool-create-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tool-create-description">
              Description <span className="text-destructive" aria-hidden>*</span>
            </Label>
            <Input
              id="tool-create-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What the AI should know about when to use this tool"
              required
            />
          </div>
          <ToolRequiredEnvField
            value={requiredEnvInput}
            onChange={setRequiredEnvInput}
            secretsSettingsPath={secretsSettingsPath}
          />
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>
                Execute code <span className="text-destructive" aria-hidden>*</span>
              </Label>
              <InlineHelpHint label="Execute code help">
                <p>
                  Export <code>async function execute(input, ctx)</code>. Use an inline input type
                  (for example <code>input: {"{ city: string }"}</code>). See How to write tools in
                  the sidebar for the full guide.
                </p>
              </InlineHelpHint>
              <div className="ml-auto">
                <ToolAiGenerateDialog
                  generating={generating}
                  error={generateError}
                  onGenerate={handleGenerate}
                />
              </div>
            </div>
            <ToolCodeEditor value={sourceCode} onChange={setSourceCode} />
          </div>
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" disabled={saving || generating}>
              {saving ? "Saving…" : "Create tool"}
            </Button>
            <Link to={cancelTo}>
              <Button type="button" size="sm" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
