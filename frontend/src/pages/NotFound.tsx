import { Link } from "react-router-dom";
import { ArrowLeft, LayoutDashboard, LogIn } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export default function NotFoundPage() {
  const { user, loading } = useAuth();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-6 py-16 text-center">
      <p className="text-[0.7rem] font-semibold tracking-[0.28em] text-muted-foreground uppercase">404</p>
      <h1 className="mt-5 text-4xl font-bold tracking-[-0.04em] text-foreground sm:text-5xl">
        Page not found
      </h1>
      <p className="mt-5 max-w-[34ch] text-base leading-relaxed text-muted-foreground sm:text-[1.05rem]">
        This URL isn&apos;t valid. Double-check the link or continue from home or your workspace.
      </p>

      <div className="mt-12 flex flex-wrap items-center justify-center gap-3">
        <Link
          to="/"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "gap-2 px-5")}
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          Home
        </Link>
        {!loading && user ? (
          <Link to="/" className={cn(buttonVariants({ size: "sm" }), "gap-2 px-5")}>
            <LayoutDashboard className="size-3.5" aria-hidden />
            Dashboard
          </Link>
        ) : null}
        {!loading && !user ? (
          <Link to="/sign-in" className={cn(buttonVariants({ size: "sm" }), "gap-2 px-5")}>
            <LogIn className="size-3.5" aria-hidden />
            Sign in
          </Link>
        ) : null}
      </div>

      <nav className="mt-16 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
        <Link to="/privacy-policy" className="transition-colors hover:text-foreground hover:underline">
          Privacy Policy
        </Link>
        <Link to="/terms-of-service" className="transition-colors hover:text-foreground hover:underline">
          Terms of Service
        </Link>
      </nav>
    </main>
  );
}
