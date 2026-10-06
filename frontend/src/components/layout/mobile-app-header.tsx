import { useState } from "react";
import { Menu } from "lucide-react";
import { AppNavigation } from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

export function MobileAppHeader() {
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
