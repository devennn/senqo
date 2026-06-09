import { useConnections } from "@/hooks/useConnections";
import { AppFrame } from "@/components/layout/app-frame";
import { CreateConnectionDialog } from "@/pages/dashboard/connect/components/create-connection-dialog";
import { ConnectionCard } from "@/pages/dashboard/connect/components/connection-card";
import { ConnectionActivityFeed } from "@/pages/dashboard/connect/components/connection-activity-feed";
import { ConnectionUnavailableNotice } from "@/pages/dashboard/connect/components/connection-unavailable-notice";
import { PageLoader } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Clock3, Plug } from "lucide-react";

export default function ConnectPage() {
  const {
    connections,
    events,
    loading,
    canCreateConnection,
    connectionUnavailableReason,
    createConnection,
    refreshQr,
    reconnect,
    updateMode,
    updateDisplayName,
    deleteConnection,
  } = useConnections();

  return (
    <AppFrame conversations={[]} messages={[]} hideConversationRail mainPanel={
      loading ? <PageLoader label="Loading connections" /> :
      <section className="flex min-h-0 w-full flex-1 flex-col overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border/60 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Connect WhatsApp</h1>
            <p className="mt-1.5 text-base text-muted-foreground">Manage your WhatsApp sessions.</p>
          </div>
          <div className="flex flex-col gap-2 sm:shrink-0 sm:flex-row sm:items-center">
            <Sheet>
              <SheetTrigger
                render={
                  <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" />
                }
              >
                <Clock3 className="mr-1.5 size-3.5" />
                Activity
              </SheetTrigger>
              <SheetContent side="right" className="w-full gap-0 overflow-hidden p-0 sm:max-w-md">
                <SheetHeader className="border-b border-border/60 pr-12">
                  <SheetTitle>Recent WhatsApp activity</SheetTitle>
                  <SheetDescription>
                    View recent connection and disconnection history.
                  </SheetDescription>
                </SheetHeader>
                <ConnectionActivityFeed events={events} />
              </SheetContent>
            </Sheet>
            {canCreateConnection ? (
              <CreateConnectionDialog createConnection={createConnection} />
            ) : (
              <ConnectionUnavailableNotice reason={connectionUnavailableReason} />
            )}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                connection={conn}
                onRefreshQr={refreshQr}
                onReconnect={reconnect}
                onUpdateMode={updateMode}
                onUpdateDisplayName={updateDisplayName}
                onDelete={deleteConnection}
              />
            ))}
            {connections.length === 0 && (
              <div className="col-span-full flex flex-col items-center rounded-xl border border-dashed border-border/60 py-14 text-center">
                <Plug className="size-10 text-muted-foreground/30" />
                <p className="mt-4 text-base font-semibold text-muted-foreground">No connections</p>
                <div className="mt-1 text-sm text-muted-foreground/70">
                  {canCreateConnection ? (
                    <>Click &quot;Connect New&quot; to add one.</>
                  ) : (
                    <ConnectionUnavailableNotice reason={connectionUnavailableReason} className="mx-auto" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    } />
  );
}
