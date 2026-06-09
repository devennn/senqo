import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useApiKeys } from "@/hooks/useApiKeys";
import { ApiKeysDocsCard } from "@/pages/settings/components/api-keys-docs-card";
import { ApiKeysManagerCard } from "@/pages/settings/components/api-keys-manager-card";
import { SettingsPageLoader } from "@/pages/settings/components/settings-page-loader";

function decodeMessage(input: string): string {
  return decodeURIComponent(input).replace(/_/g, " ");
}

export default function ApiKeysPage() {
  const [activeTab, setActiveTab] = useState<"usage" | "keys">("usage");
  const {
    items,
    loading,
    loadError,
    creating,
    revokingId,
    createResult,
    reload,
    createKey,
    deleteKey,
    clearCreateResult,
  } = useApiKeys();

  if (loading) {
    return <SettingsPageLoader label="Loading API keys" />;
  }

  return (
    <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
      <h1 className="text-2xl font-extrabold tracking-tight">API</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Manage API keys and integration usage for scheduled task creation.
      </p>

      {loadError ? (
        <div className="mt-4 space-y-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
          <p className="text-sm text-destructive">{decodeMessage(loadError)}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : null}

      <div
        role="tablist"
        aria-label="API settings tabs"
        className="mt-6 flex w-full gap-1 border-b border-border sm:gap-2"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "usage"}
          tabIndex={activeTab === "usage" ? 0 : -1}
          onClick={() => setActiveTab("usage")}
          className={cn(
            "relative -mb-px min-h-10 rounded-none border-b-2 bg-transparent px-3 py-2.5 text-sm outline-none transition-[color,border-color] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4",
            activeTab === "usage"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          How to use API
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "keys"}
          tabIndex={activeTab === "keys" ? 0 : -1}
          onClick={() => setActiveTab("keys")}
          className={cn(
            "relative -mb-px min-h-10 rounded-none border-b-2 bg-transparent px-3 py-2.5 text-sm outline-none transition-[color,border-color] focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-4",
            activeTab === "keys"
              ? "border-primary font-semibold text-foreground"
              : "border-transparent font-medium text-muted-foreground hover:border-border hover:text-foreground",
          )}
        >
          API keys
        </button>
      </div>

      <div className="mt-6">
        {activeTab === "usage" ? (
          <ApiKeysDocsCard apiKey={createResult?.apiKey ?? null} />
        ) : null}
        {activeTab === "keys" ? (
          <ApiKeysManagerCard
            items={items}
            creating={creating}
            revokingId={revokingId}
            onCreate={createKey}
            onDelete={deleteKey}
            createResult={createResult}
            clearCreateResult={clearCreateResult}
          />
        ) : null}
      </div>
    </section>
  );
}
