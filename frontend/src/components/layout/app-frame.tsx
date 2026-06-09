import { Suspense, useState } from "react";
import { Menu } from "lucide-react";
import { AppNavigation, Sidebar } from "@/components/layout/sidebar";
import { ConversationList } from "@/components/layout/conversation-list";
import { ConversationChat } from "@/pages/dashboard/components/conversation-chat";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import type {
  ConversationHeaderData,
  ConversationLabelRecord,
  ConversationMessage,
  ConversationSummary,
} from "@/types/repositories";

export function AppFrame({
  conversations,
  messages,
  children,
  selectedConversation,
  headerFallbackTitle,
  sidePanel,
  hideConversationRail,
  mainPanel,
  conversationLabelCatalog,
  loadingConversations,
  newConversationIds,
  mobilePanel: mobilePanelProp,
}: {
  conversations: ConversationSummary[];
  messages: ConversationMessage[];
  children?: React.ReactNode;
  selectedConversation?: ConversationHeaderData | null;
  headerFallbackTitle?: string;
  /** Custom rail instead of the inbox list (omit when hiding the rail). */
  sidePanel?: React.ReactNode;
  /** Hide the conversation list rail so `mainPanel` spans the content area (settings, CRM, etc.). */
  hideConversationRail?: boolean;
  mainPanel?: React.ReactNode;
  conversationLabelCatalog?: ConversationLabelRecord[];
  loadingConversations?: boolean;
  newConversationIds?: Set<string>;
  mobilePanel?: "side" | "main" | "both";
}) {
  const omitConversationRail = hideConversationRail === true;
  const mobilePanel =
    mobilePanelProp ??
    (omitConversationRail ? "both" : sidePanel !== undefined ? "main" : "both");

  const sidePanelContent = omitConversationRail ? null : sidePanel !==
    undefined ? (
    sidePanel
  ) : (
    <Suspense
      fallback={
        <section
          className="flex w-full shrink-0 flex-col border-r border-border/60 bg-card shadow-soft md:w-[26rem]"
          aria-hidden
        />
      }
    >
      <ConversationList
        conversations={conversations}
        labelCatalog={conversationLabelCatalog ?? []}
        loading={loadingConversations}
        newConversationIds={newConversationIds}
      />
    </Suspense>
  );

  return (
    <main className="bg-app-shell flex h-[100dvh] min-h-0 flex-col gap-2 overflow-hidden p-2 md:h-screen md:flex-row">
      <MobileAppHeader />
      <Sidebar className="hidden md:flex" />
      <div className="flex min-h-0 flex-1 gap-2 overflow-hidden">
        {!omitConversationRail ? (
          <div
            className={cn(
              "min-h-0 w-full shrink-0 md:w-auto",
              mobilePanel === "main" && "hidden md:block",
              mobilePanel === "side" && "block",
              mobilePanel === "both" && "block",
            )}
          >
            {sidePanelContent}
          </div>
        ) : null}
        <section
          className={cn(
            "flex min-h-0 min-w-0 w-full flex-1 flex-col overflow-hidden rounded-2xl border border-border/70 bg-card/95 shadow-soft backdrop-blur",
            mobilePanel === "side" ? "hidden md:flex" : "flex",
          )}
        >
          {mainPanel ? (
            mainPanel
          ) : (
            <>
              {children ? (
                <div className="shrink-0 border-b border-border/60 bg-card/80 px-4 py-4 sm:px-6 sm:py-5">
                  {children}
                </div>
              ) : null}
              <ConversationChat
                className="min-h-0 flex-1"
                messages={messages}
                conversation={selectedConversation ?? null}
                fallbackTitle={headerFallbackTitle}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

function MobileAppHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="flex h-14 shrink-0 items-center justify-between rounded-2xl border border-border/60 bg-card/95 px-4 shadow-soft md:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <img
          src="/icon_transparent_bg.png"
          alt="Senqo logo"
          className="size-8 shrink-0 object-contain"
        />
        <span className="truncate text-sm font-bold tracking-tight">Senqo</span>
      </div>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger
          render={
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label="Open navigation menu"
            />
          }
        >
          <Menu className="size-4" />
        </SheetTrigger>
        <SheetContent
          side="left"
          className="w-[18rem] max-w-[calc(100vw-2rem)] gap-0 border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetHeader className="border-b border-sidebar-border p-4 pr-12">
            <div className="flex items-center gap-2.5">
              <img
                src="/icon_transparent_bg.png"
                alt="Senqo logo"
                className="size-8 shrink-0 object-contain"
              />
              <div className="min-w-0">
                <SheetTitle className="truncate text-sidebar-foreground">
                  Senqo
                </SheetTitle>
                <SheetDescription className="sr-only">
                  Main application navigation
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <AppNavigation expanded onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </header>
  );
}
