import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { register, saveAuthTokens } from "@/lib/auth-client";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEmailSignUp(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const data = new FormData(e.currentTarget);
    const fullName = String(data.get("fullName") ?? "").trim();
    const email = String(data.get("email") ?? "");
    const password = String(data.get("password") ?? "");

    try {
      const result = await register(email, password, fullName);
      saveAuthTokens(result.accessToken, result.refreshToken);
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
            <CardDescription>Start your Senqo workspace</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {error && (
              <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {error}
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
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creating account…" : "Create account"}
              </Button>
            </form>
            <p className="text-sm text-muted-foreground">
              Continuing means you acknowledge our{" "}
              <Link
                to="/terms-of-service"
                className="font-medium text-primary hover:underline"
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                to="/privacy-policy"
                className="font-medium text-primary hover:underline"
              >
                Privacy Policy
              </Link>
              .
            </p>
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
