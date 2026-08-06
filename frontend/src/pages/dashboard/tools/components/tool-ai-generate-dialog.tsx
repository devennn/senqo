import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type Props = {
  generating: boolean;
  error: string | null;
  onGenerate: (prompt: string) => Promise<void>;
};

export function ToolAiGenerateDialog({ generating, error, onGenerate }: Props) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const canGenerate = prompt.trim().length > 0 && !generating;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (generating) return;
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={<Button type="button" size="sm" variant="outline" disabled={generating} />}
      >
        <Sparkles className="size-4" aria-hidden />
        {generating ? "Generating…" : "Generate with AI"}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>Generate with AI</DialogTitle>
          <DialogDescription>
            Paste API docs, curl examples, or instructions. Review the draft before creating the tool.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="tool-ai-prompt">Reference or instructions</Label>
            <InlineHelpHint label="AI tool generate help">
              <p>
                Fills name, description, env names, and execute code from your reference. Secrets stay
                in Settings → Secrets; only env names are listed.
              </p>
            </InlineHelpHint>
          </div>
          <Textarea
            id="tool-ai-prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. OpenWeather: GET /data/2.5/weather?q={city}&appid={KEY} — return temp and conditions"
            rows={6}
            className="resize-y"
            disabled={generating}
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!canGenerate}
            onClick={() => {
              void (async () => {
                try {
                  await onGenerate(prompt);
                  setOpen(false);
                } catch {
                  // Keep dialog open; parent surfaces error.
                }
              })();
            }}
          >
            <Sparkles className="size-4" aria-hidden />
            {generating ? "Generating…" : "Generate"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
