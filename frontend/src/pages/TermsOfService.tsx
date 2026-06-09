import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function TermsOfServicePage() {
  const { user, loading } = useAuth();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Terms of Service</h1>
          <p className="text-sm text-muted-foreground">Last updated: June 8, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Service Usage</h2>
          <p className="text-muted-foreground">
            The service is provided as open-source software. Use of the platform is subject to the
            terms of the applicable open-source license.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Marketing Enrollment</h2>
          <p className="text-muted-foreground">
            By creating an account, users are enrolled to receive marketing materials from us.
          </p>
        </section>

        <div>
          {loading ? (
            <span className="inline-block h-5 w-36 animate-pulse rounded bg-muted" aria-hidden />
          ) : user ? (
            <Link to="/" className="text-sm font-medium text-primary hover:underline">
              Go to dashboard
            </Link>
          ) : (
            <Link to="/sign-up" className="text-sm font-medium text-primary hover:underline">
              Back to sign up
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}
