import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TablePagination } from "@/pages/dashboard/components/table-pagination";
import type { WorkspaceSecretListItem } from "@/types/repositories";

const TOOL_SECRETS_PAGE_SIZE = 5;

type Props = {
  secrets: WorkspaceSecretListItem[];
  loading: boolean;
  secretsSettingsPath: string;
};

export function ToolAvailableSecretsList({ secrets, loading, secretsSettingsPath }: Props) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [secrets.length]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * TOOL_SECRETS_PAGE_SIZE;
    return secrets.slice(start, start + TOOL_SECRETS_PAGE_SIZE);
  }, [page, secrets]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="text-base">Available secrets</CardTitle>
          <Link
            to={secretsSettingsPath}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            Manage in Settings
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading secrets…</p>
        ) : secrets.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            No secrets yet. Create them in{" "}
            <Link to={secretsSettingsPath} className="text-primary underline-offset-2 hover:underline">
              Settings → Secrets
            </Link>
            .
          </p>
        ) : (
          <>
            <ul className="space-y-2">
              {pageItems.map((secret) => (
                <li
                  key={secret.id}
                  className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                >
                  <span className="font-mono text-sm font-semibold">{secret.name}</span>
                  {secret.description ? (
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {secret.description}
                    </p>
                  ) : null}
                  {secret.value_hint ? (
                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">…{secret.value_hint}</p>
                  ) : null}
                </li>
              ))}
            </ul>
            {secrets.length > TOOL_SECRETS_PAGE_SIZE ? (
              <div className="[&_p]:text-xs">
                <TablePagination
                  page={page}
                  total={secrets.length}
                  pageSize={TOOL_SECRETS_PAGE_SIZE}
                  onPage={setPage}
                />
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
