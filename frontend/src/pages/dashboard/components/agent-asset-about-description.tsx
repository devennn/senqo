import { Label } from "@/components/ui/label";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";
import { workspaceAssetLimitsSummaryForUi } from "@/lib/workspace-asset-limits";

export const ASSET_ABOUT_DESCRIPTION_PLACEHOLDER =
  "e.g. PDF brochure: 2024 pricing (Starter/Pro/Enterprise), feature list, and onboarding steps—not just \"brochure\".";

export function AssetAboutDescriptionHintBody() {
  return (
    <>
      <p>
        This description is saved with the item and embedded in the agent&apos;s system instructions. For
        sendable files the AI uses it to decide whether to send the file on WhatsApp; for live docs it
        uses it to decide when to re-read the file.
      </p>
      <p>
        Be specific: type of item, what is inside (topics, facts, numbers, steps), and who it helps. Vague labels
        like &quot;price list&quot; or &quot;video&quot; give the AI little to match against customer messages.
      </p>
      <p>
        Do not write send rules here (for example &quot;send when they ask for pricing&quot;). Describe the file;
        the agent chooses timing from the conversation.
      </p>
      <p>Upload limit: {workspaceAssetLimitsSummaryForUi()}. Sendable files count toward workspace storage (see Settings → Workspace).</p>
    </>
  );
}

type LabelProps = {
  htmlFor: string;
  labelClassName?: string;
};

export function AssetAboutDescriptionLabel({ htmlFor, labelClassName }: LabelProps) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <Label htmlFor={htmlFor} className={labelClassName}>
        What is this about?
      </Label>
      <InlineHelpHint label="What is this about?">
        <AssetAboutDescriptionHintBody />
      </InlineHelpHint>
    </div>
  );
}
