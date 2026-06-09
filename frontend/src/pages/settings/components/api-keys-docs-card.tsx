import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  buildCreateTaskCurlExample,
  buildCreateTaskRequestBody,
  getPublicTasksApiUrl,
} from "@/lib/public-tasks-api";
import {
  createTaskBodyParams,
  createTaskErrorCodes,
} from "@/pages/settings/components/api-keys-docs-data";

type Props = {
  apiKey?: string | null;
};

export function ApiKeysDocsCard({ apiKey }: Props) {
  const [copying, setCopying] = useState(false);
  const endpointUrl = getPublicTasksApiUrl();
  const requestBody = useMemo(() => buildCreateTaskRequestBody(), []);
  const curlExample = useMemo(
    () => buildCreateTaskCurlExample({ apiKey: apiKey ?? undefined }),
    [apiKey],
  );

  async function handleCopyCurl() {
    setCopying(true);
    try {
      await navigator.clipboard.writeText(curlExample);
      toast.success("curl command copied");
    } catch {
      toast.error("Could not copy curl command");
    } finally {
      setCopying(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>How to use this API</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm text-muted-foreground">
        <div>
          <p className="font-medium text-foreground">Endpoint</p>
          <p>
            <code>POST {endpointUrl}</code>
          </p>
          <p className="mt-1">
            Authenticate with <code>x-api-key</code> or{" "}
            <code>Authorization: Bearer &lt;key&gt;</code>.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-medium text-foreground">Request</p>
            <Button type="button" variant="outline" size="sm" disabled={copying} onClick={() => void handleCopyCurl()}>
              {copying ? "Copying..." : "Copy curl"}
            </Button>
          </div>
          {apiKey ? (
            <p className="text-xs text-foreground">
              Using your newly created API key in the example below.
            </p>
          ) : (
            <p className="text-xs">
              Replace <code>YOUR_WORKSPACE_API_KEY</code> with a key from the API keys tab.
            </p>
          )}
          <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs text-slate-100">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-300">REQUEST</p>
            <pre className="overflow-x-auto whitespace-pre-wrap">{curlExample}</pre>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground">Body params</p>
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">Name</th>
                  <th className="px-3 py-2 font-semibold">Type</th>
                  <th className="px-3 py-2 font-semibold">Required</th>
                  <th className="px-3 py-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody>
                {createTaskBodyParams.map((param) => (
                  <tr key={param.name} className="border-t border-border/60">
                    <td className="px-3 py-2 align-top text-foreground"><code>{param.name}</code></td>
                    <td className="px-3 py-2 align-top">{param.type}</td>
                    <td className="px-3 py-2 align-top">{param.required}</td>
                    <td className="px-3 py-2 align-top">{param.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground">Sample request body</p>
          <pre className="overflow-x-auto rounded-md border border-border/70 bg-muted/40 p-3 text-xs text-foreground">
            {JSON.stringify(requestBody, null, 2)}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground">Response example (200)</p>
          <pre className="overflow-x-auto rounded-md border border-primary/30 bg-secondary p-3 text-xs text-foreground">
{`{
  "ok": true,
  "id": "550e8400-e29b-41d4-a716-446655440000"
}`}
          </pre>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-foreground">Error codes</p>
          <div className="overflow-x-auto rounded-md border border-border/70">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/40 text-foreground">
                <tr>
                  <th className="px-3 py-2 font-semibold">HTTP</th>
                  <th className="px-3 py-2 font-semibold">Error</th>
                  <th className="px-3 py-2 font-semibold">Meaning</th>
                </tr>
              </thead>
              <tbody>
                {createTaskErrorCodes.map((row) => (
                  <tr key={row.error} className="border-t border-border/60">
                    <td className="px-3 py-2">{row.http}</td>
                    <td className="px-3 py-2"><code>{row.error}</code></td>
                    <td className="px-3 py-2">{row.meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
