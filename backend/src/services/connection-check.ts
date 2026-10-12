import {
  getConnectionLiveState,
  restartConnection,
  type ConnectionLiveState,
} from "./whatsapp-client.js";
import {
  getConnectionById,
  markConnectionDisconnected,
  recordConnectionEvent,
} from "../repositories/whatsapp.js";

const scope = "ConnectionCheck";

const RECOVERY_POLL_ATTEMPTS = 8;
const RECOVERY_POLL_INTERVAL_MS = 1000;

export type ConnectionCheckStatus =
  | "connected"
  | "disconnected"
  | "pending_qr"
  | "unavailable";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** A session counts as live only when the service reports it authorized with an open socket. */
function isLive(state: ConnectionLiveState): boolean {
  return state.reachable && state.status === "authorized" && state.socketOpen;
}

async function concludeDisconnected(
  workspaceId: string,
  connectionId: string,
): Promise<ConnectionCheckStatus> {
  await markConnectionDisconnected(workspaceId, connectionId);

  const connection = await getConnectionById(workspaceId, connectionId);
  if (connection) {
    const nameLabel = connection.display_name?.trim() || "Unnamed connection";
    const phoneLabel = connection.phone_number?.trim() || "unknown";
    await recordConnectionEvent({
      workspaceId,
      connectionIdSnapshot: connectionId,
      displayName: connection.display_name,
      phoneNumber: connection.phone_number,
      eventType: "connection_disconnected",
      source: "status_refresh",
      stateInstance: "notAuthorized",
      statusInstance: null,
      message: `Connection check confirmed this line is offline. Display name: ${nameLabel}. Phone: ${phoneLabel}. Reconnect from Connect when ready.`,
    });
  }

  return "disconnected";
}

/**
 * Verifies whether a connection is actually still signed in by asking the WhatsApp
 * service. When the service claims authorized but the socket is gone, reopens the
 * socket and watches the result. Confirmed-offline rows are marked not authorized so
 * the Connect card stops showing a stale "Authorized" state.
 */
export async function checkConnection(
  workspaceId: string,
  connectionId: string,
): Promise<ConnectionCheckStatus> {
  const first = await getConnectionLiveState(connectionId);
  if (!first.reachable) {
    console.warn(`[${scope}/checkConnection] WhatsApp service unreachable: connectionId=${connectionId}`);
    return "unavailable";
  }
  if (isLive(first)) return "connected";
  if (first.status === "pending_qr") return "pending_qr";
  if (first.status === "not_authorized") {
    return concludeDisconnected(workspaceId, connectionId);
  }

  // Status claims authorized but the socket is not open — try to reopen with stored credentials.
  await restartConnection(connectionId);
  for (let attempt = 1; attempt <= RECOVERY_POLL_ATTEMPTS; attempt++) {
    await sleep(RECOVERY_POLL_INTERVAL_MS);
    const state = await getConnectionLiveState(connectionId);
    if (!state.reachable) {
      console.warn(`[${scope}/checkConnection] WhatsApp service unreachable mid-check: connectionId=${connectionId}`);
      return "unavailable";
    }
    if (isLive(state)) return "connected";
    if (state.status === "pending_qr") return "pending_qr";
    if (state.status === "not_authorized") {
      return concludeDisconnected(workspaceId, connectionId);
    }
  }

  console.info(`[${scope}/checkConnection] Socket never reopened: connectionId=${connectionId}`);
  return concludeDisconnected(workspaceId, connectionId);
}
