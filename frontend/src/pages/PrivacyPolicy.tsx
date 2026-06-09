import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function PrivacyPolicyPage() {
  const { user, loading } = useAuth();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="space-y-8">
        <header className="space-y-3">
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">Last updated: June 8, 2026</p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Information We Collect</h2>
          <p className="text-muted-foreground">
            We collect account information you provide during sign up, such as your name, email
            address, and login credentials needed to operate and improve the platform.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">How We Use Information</h2>
          <p className="text-muted-foreground">
            We use your information to provide access to your account, protect platform security,
            communicate service updates, and improve product performance.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Marketing Communications</h2>
          <p className="text-muted-foreground">
            All users who create an account are automatically enrolled to receive marketing
            materials from us.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Retention and Protection</h2>
          <p className="text-muted-foreground">
            We retain information for as long as needed to operate the service and meet legal,
            accounting, and security obligations. We apply reasonable safeguards to protect your
            data.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Contact</h2>
          <p className="text-muted-foreground">
            For privacy questions, please contact us through the support channel provided in your
            account workspace.
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
