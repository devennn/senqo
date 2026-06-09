import { AppFrame } from "@/components/layout/app-frame";
import { ConversationLabelsManager } from "@/pages/dashboard/components/conversation-labels-manager";

export default function LabelsPage() {
  return (
    <AppFrame
      conversations={[]}
      messages={[]}
      hideConversationRail
      mainPanel={
        <section className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Conversation labels</h1>
            <p className="mt-1.5 text-base text-muted-foreground">
              Define labels for your workspace. Filter chats on the dashboard and let agents assign them when enabled.
            </p>
          </div>
          <div className="mt-8 w-full">
            <ConversationLabelsManager />
          </div>
        </section>
      }
    />
  );
}
