import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const { refresh } = useAuth();

  useEffect(() => {
    void refresh().then(() => {
      navigate("/", { replace: true });
    });
  }, [navigate, refresh]);

  return (
    <div className="flex h-screen items-center justify-center text-muted-foreground">
      Signing you in…
    </div>
  );
}