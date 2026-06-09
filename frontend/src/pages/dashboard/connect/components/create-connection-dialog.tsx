import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, QrCode } from "lucide-react";
import type { CreateConnectionDialogProps } from "@/types/ui";
import { WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN } from "@/lib/whatsapp-connection-limits";

export function CreateConnectionDialog({ createConnection }: CreateConnectionDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setError(null); }}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" className="w-full sm:w-auto" />}>
        <Plus className="mr-1.5 size-3.5" /> Connect New
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="size-4 text-primary" /> Scan QR Code
          </DialogTitle>
        </DialogHeader>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError(null);
            const fd = new FormData(e.currentTarget);
            try {
              await createConnection(String(fd.get("displayName") ?? ""));
              setOpen(false);
            } catch (caught) {
              const message = caught instanceof Error && caught.message === "whatsapp_unavailable"
                ? "If you’re seeing this, please contact support and we’ll help enable WhatsApp connection setup for you."
                : "Could not create this connection. Please try again or contact support.";
              setError(message);
            } finally {
              setLoading(false);
            }
          }}
          className="space-y-4"
        >
          {error && <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
          <Input
            name="displayName"
            placeholder="Connection name"
            required
            maxLength={WHATSAPP_CONNECTION_DISPLAY_NAME_MAX_LEN}
          />
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border/60 bg-muted/30 py-10">
            <QrCode className="size-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              We will prepare your WhatsApp connection.
            </p>
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating…" : "Create connection"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
