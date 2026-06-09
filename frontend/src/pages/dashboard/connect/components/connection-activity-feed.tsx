import { CheckCircle2, Clock, Trash2, Unplug } from "lucide-react";
import type { WhatsappConnectionEvent } from "@/types/repositories";

type Props = {
  events: WhatsappConnectionEvent[];
};

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getEventIcon(eventType: WhatsappConnectionEvent["event_type"]) {
  if (eventType === "connection_authorized") return CheckCircle2;
  if (eventType === "connection_disconnected") return Unplug;
  if (eventType === "connection_deleted") return Trash2;
  return Clock;
}

function getEventTitle(event: WhatsappConnectionEvent): string {
  if (event.event_type === "connection_authorized") return "Connected";
  if (event.event_type === "connection_disconnected") return "Disconnected";
  if (event.event_type === "connection_deleted") return "Deleted";
  return "Connection started";
}

function getConnectionLabel(event: WhatsappConnectionEvent): string {
  return event.display_name || event.phone_number || event.connection_id_snapshot || "WhatsApp connection";
}

export function ConnectionActivityFeed({ events }: Props) {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto p-4">
      {events.length === 0 ? (
        <p className="text-sm text-muted-foreground">No connection activity recorded yet.</p>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const Icon = getEventIcon(event.event_type);
            return (
              <div key={event.id} className="flex gap-3 border-b border-border/60 pb-4 last:border-0 last:pb-0">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="font-semibold">{getEventTitle(event)}</p>
                    <time className="text-xs text-muted-foreground" dateTime={event.created_at}>
                      {formatEventTime(event.created_at)}
                    </time>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground/80">
                    {getConnectionLabel(event)}
                    {event.state_instance ? ` - ${event.state_instance}` : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
