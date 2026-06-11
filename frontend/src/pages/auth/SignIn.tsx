import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getAuthConfig, login, saveAuthTokens } from "@/lib/auth-client";
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

export default function SignInPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error"));
  const [allowPublicRegistration, setAllowPublicRegistration] = useState(true);

  useEffect(() => {
    void getAuthConfig().then((config) => {
      setAllowPublicRegistration(config.allowPublicRegistration);
    });
  }, []);

  async function handleEmailSignIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const data = new FormData(e.currentTarget);
    try {
      const result = await login(
        String(data.get("email") ?? ""),
        String(data.get("password") ?? ""),
      );
      saveAuthTokens(result.accessToken, result.refreshToken);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed");
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
            <CardTitle className="text-xl sm:text-2xl">Welcome back</CardTitle>
            <CardDescription>Sign in to your workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error.replace(/_/g, " ")}
              </p>
            )}
            <form onSubmit={handleEmailSignIn} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" name="password" type="password" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
            {allowPublicRegistration ? (
              <p className="text-center text-sm text-muted-foreground sm:text-base">
                New to Senqo?{" "}
                <Link
                  to="/sign-up"
                  className="font-semibold text-primary hover:underline"
                >
                  Create an account
                </Link>
              </p>
            ) : (
              <p className="text-center text-sm text-muted-foreground">
                New accounts require an invitation from your admin.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
