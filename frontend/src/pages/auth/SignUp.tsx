import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getAuthConfig, getInvitePreview, register, saveAuthTokens } from "@/lib/auth-client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get("invite")?.trim() ?? "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState<string | null>(null);
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);
  const [configLoaded, setConfigLoaded] = useState(false);

  useEffect(() => {
    void getAuthConfig().then((config) => {
      setAllowPublicRegistration(config.allowPublicRegistration);
      setConfigLoaded(true);
    });
  }, []);

  useEffect(() => {
    if (!inviteToken) return;
    void getInvitePreview(inviteToken).then((preview) => {
      setInviteEmail(preview?.email ?? null);
    });
  }, [inviteToken]);

  const registrationBlocked =
    configLoaded && !allowPublicRegistration && !inviteToken;

  async function handleEmailSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (registrationBlocked) return;

    setLoading(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const fullName = String(data.get("fullName") ?? "").trim();
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    try {
      const result = await register(
        email,
        password,
        fullName,
        inviteToken || undefined,
      );
      saveAuthTokens(result.accessToken, result.refreshToken);
      setUser(result.user);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign up failed");
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/5 via-background to-background px-4 py-6 sm:px-6 sm:py-10 md:py-12">
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 sm:mb-8 md:mb-10">
          <img
            src="/icon_transparent_bg.png"
            alt="Senqo logo"
            className="size-10 object-contain sm:size-12"
          />
          <h1 className="text-lg font-bold tracking-tight sm:text-xl">Senqo</h1>
        </div>
        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle className="text-xl sm:text-2xl">Create your account</CardTitle>
            <CardDescription>
              {inviteToken
                ? "Complete signup with your invitation"
                : "Start on Senqo"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {registrationBlocked ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                Registration is closed. Ask your admin for an invite link.
              </p>
            ) : null}
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error.replace(/_/g, " ")}
              </p>
            )}
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  placeholder="Your name"
                  required
                  disabled={registrationBlocked}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                  defaultValue={inviteEmail ?? undefined}
                  readOnly={!!inviteEmail}
                  disabled={registrationBlocked}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  minLength={8}
                  required
                  disabled={registrationBlocked}
                />
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || registrationBlocked}
              >
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
            <p className="text-center text-sm text-muted-foreground sm:text-base">
              Already have an account?{" "}
              <Link
                to="/sign-in"
                className="font-semibold text-primary hover:underline"
              >
                Sign in
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
