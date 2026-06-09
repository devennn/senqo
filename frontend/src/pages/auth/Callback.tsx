import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getSession } from "@/lib/auth-client";

export default function AuthCallbackPage() {
  const navigate = useNavigate();

  useEffect(() => {
    getSession().then(() => {
      navigate("/", { replace: true });
    });
  }, [navigate]);

  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Signing you in…
    </div>
  );
}