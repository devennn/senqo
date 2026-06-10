import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { InlineHelpHint } from "@/components/ui/inline-help-hint";

type Props = {
  secretsSettingsPath: string;
};

export function ToolCatalogHowTo({ secretsSettingsPath }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex flex-wrap items-center gap-x-2 gap-y-1 text-base">
          <span>How to write tools</span>
          <InlineHelpHint label="Custom tools guide">
            <div className="space-y-3 text-sm leading-relaxed">
              <p>
                Custom tools run in an isolated sandbox when the agent calls them. Platform tools
                (send WhatsApp, schedule tasks, handoff, labels, load skills) are always enabled and
                are not configured here.
              </p>
              <p>
                <strong>Description</strong> is shown to the AI when it chooses tools — write when to
                use the tool and what it returns. It is not part of the code editor.
              </p>
              <p>
                <strong>Required env names</strong> are labels only (for example{" "}
                <code className="rounded bg-muted px-1">MY_API_KEY</code>). Add the real values in{" "}
                <Link to={secretsSettingsPath} className="text-primary underline-offset-2 hover:underline">
                  Settings → Secrets
                </Link>
                . In code, read them with <code className="rounded bg-muted px-1">ctx.env.MY_API_KEY</code>.
              </p>
              <p>
                The editor is for <strong>execute code only</strong>. Export{" "}
                <code className="rounded bg-muted px-1">async function execute(input, ctx)</code>. Type
                the first argument inline, for example{" "}
                <code className="rounded bg-muted px-1">input: {"{ location: string }"}</code> — that
                becomes the tool&apos;s JSON input schema automatically. Optional fields use{" "}
                <code className="rounded bg-muted px-1">?</code> on the property.
              </p>
              <p>
                <code className="rounded bg-muted px-1">fetch</code> is available inside execute for
                outbound HTTP. Use the test panel on a saved tool to try JSON input before enabling it
                on an agent.
              </p>
              <p>
                After saving, turn the tool on per agent under <strong>Profile → Capability</strong>.
              </p>
            </div>
          </InlineHelpHint>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="list-decimal space-y-1.5 pl-4 text-sm text-muted-foreground">
          <li>Name the tool and write a Description for the AI.</li>
          <li>List env names; store values in Settings → Secrets.</li>
          <li>Write execute code — input types are inferred from TypeScript.</li>
          <li>Test, then enable on Profile → Capability.</li>
        </ol>
      </CardContent>
    </Card>
  );
}
