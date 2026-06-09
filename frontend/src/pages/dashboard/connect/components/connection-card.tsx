import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Phone, Plug, Wifi, WifiOff } from "lucide-react";
import type {
  WhatsappConnection,
  WhatsappConnectionMode,
} from "@/types/repositories";
import { ConnectionAiModeSegmented } from "@/pages/dashboard/connect/components/connection-ai-mode-segmented";
import { ConnectionCardMenu } from "@/pages/dashboard/connect/components/connection-card-menu";
import { ConnectionRenameDialog } from "@/pages/dashboard/connect/components/connection-rename-dialog";
import { ConnectionDeleteDialog } from "@/pages/dashboard/connect/components/connection-delete-dialog";

type StateInfo = { label: string; note: string; isHealthy: boolean };

function getStateInfo(state: string): StateInfo {
  const map: Record<string, StateInfo> = {
    authorized: { label: "Authorized", note: "", isHealthy: true },
    notAuthorized: {
      label: "Not Authorized",
      note: "Scan QR code to connect this instance.",
      isHealthy: false,
    },
    blocked: {
      label: "Blocked",
      note: "Instance is blocked by WhatsApp.",
      isHealthy: false,
    },
    sleepMode: {
      label: "Sleep Mode",
      note: "Status may be outdated. Can take up to 5 minutes to recover.",
      isHealthy: false,
    },
    starting: {
      label: "Starting",
      note: "Instance booting. May take up to 5 minutes to become authorized.",
      isHealthy: false,
    },
    yellowCard: {
      label: "Yellow Card",
      note: "Messaging suspended due to spam signals. Reboot required.",
      isHealthy: false,
    },
  };
  return (
    map[state] ?? {
      label: state || "Unknown",
      note: "Connection status is currently unavailable.",
      isHealthy: false,
    }
  );
}

function connectionInitials(displayName: string): string {
  const [a = "", b = ""] = displayName.trim().split(/\s+/);
  return (
    `${a.charAt(0)}${b.charAt(0)}`.toUpperCase() ||
    displayName.slice(0, 2).toUpperCase() ||
    "?"
  );
}

function normalizeMode(
  raw: WhatsappConnection["mode"] | undefined,
): WhatsappConnectionMode {
  if (raw === "testing" || raw === "live" || raw === "inactive") return raw;
  return "inactive";
}

type Props = {
  connection: WhatsappConnection;
  onRefreshQr: (id: string) => Promise<void>;
  onReconnect: (id: string) => Promise<void>;
  onUpdateMode: (id: string, mode: WhatsappConnectionMode) => Promise<void>;
  onUpdateDisplayName: (id: string, displayName: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
};

export function ConnectionCard({
  connection: conn,
  onRefreshQr,
  onReconnect,
  onUpdateMode,
  onUpdateDisplayName,
  onDelete,
}: Props) {
  const [updatingMode, setUpdatingMode] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentState = conn.last_state_instance ?? conn.status;
  const isAuthorized = currentState === "authorized";
  const isPreviouslyLinkedOffline =
    !isAuthorized &&
    typeof conn.phone_number === "string" &&
    conn.phone_number.trim().length > 0;
  const info = isAuthorized
    ? getStateInfo("authorized")
    : isPreviouslyLinkedOffline
      ? {
          label: "Not Authorized",
          note: "This WhatsApp connection is offline. Use Reconnect QR to sign in again — your saved number and settings stay on this card.",
          isHealthy: false,
        }
      : getStateInfo(currentState);
  const isLinked = conn.status === "authorized";
  const mode = normalizeMode(conn.mode);

  async function handleModeChange(next: WhatsappConnectionMode) {
    if (next === mode) return;
    setUpdatingMode(true);
    try {
      await onUpdateMode(conn.id, next);
    } finally {
      setUpdatingMode(false);
    }
  }

  return (
    <>
      <Card>
        <CardHeader className="space-y-1 pb-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle className="flex min-w-0 items-center gap-2 text-lg">
              <Plug className="size-5 shrink-0 text-primary" />
              <span className="truncate">{conn.display_name}</span>
            </CardTitle>
            <ConnectionCardMenu
              onRename={() => setRenameOpen(true)}
              onDelete={() => setDeleteOpen(true)}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-0">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-base">
              {info.isHealthy ? (
                <Wifi className="size-4 text-primary" />
              ) : (
                <WifiOff className="size-4 text-muted-foreground" />
              )}
              <span
                className={
                  info.isHealthy
                    ? "font-semibold text-primary"
                    : "font-semibold text-muted-foreground"
                }
              >
                {info.label}
              </span>
            </div>
            <ConnectionAiModeSegmented
              mode={mode}
              disabled={updatingMode}
              onChange={handleModeChange}
            />
          </div>
          {info.note ? (
            <p className="text-sm leading-relaxed text-muted-foreground">
              {info.note}
            </p>
          ) : null}
          <div className="flex items-center gap-3 rounded-lg border border-border bg-secondary/60 px-3 py-3">
            <Avatar size="lg" className="size-12">
              {conn.wa_avatar_url ? (
                <AvatarImage src={conn.wa_avatar_url} alt="" />
              ) : null}
              <AvatarFallback className="text-sm font-semibold">
                {connectionInitials(conn.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm text-muted-foreground">
                <Phone className="size-3.5 shrink-0 gap-6" />
                <span>{conn.phone_number ?? "No number yet"}</span>
              </p>
            </div>
          </div>
          {!isAuthorized && conn.qr_code_payload && (
            <div className="rounded-lg border border-border bg-card p-3 shadow-soft">
              <img
                src={conn.qr_code_payload}
                alt={`QR for ${conn.display_name}`}
                className="mx-auto size-40 object-contain"
              />
            </div>
          )}
          {!isAuthorized && (
            <div className="flex flex-col gap-2 border-t border-border/60 pt-3 sm:flex-row sm:flex-wrap">
              {isLinked && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => {
                    void onRefreshQr(conn.id);
                  }}
                >
                  Refresh QR
                </Button>
              )}
              <Button
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => {
                  void onReconnect(conn.id);
                }}
              >
                Reconnect QR
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <ConnectionRenameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        connectionId={conn.id}
        displayName={conn.display_name}
        onSave={(name) => onUpdateDisplayName(conn.id, name)}
      />
      <ConnectionDeleteDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        displayName={conn.display_name}
        isDeleting={deleting}
        onConfirm={async () => {
          setDeleting(true);
          try {
            await onDelete(conn.id);
          } finally {
            setDeleting(false);
          }
        }}
      />
    </>
  );
}
