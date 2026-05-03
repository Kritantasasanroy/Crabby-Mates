import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { CrabLogo } from "./CrabLogo";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import type { ReactNode } from "react";

export function AppShell({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Surfacing...</div>;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-14 border-b border-border/60 flex items-center justify-between px-4 bg-card/30 backdrop-blur sticky top-0 z-30">
        <Link to="/app" className="flex items-center gap-2">
          <CrabLogo size={32} />
          <span className="font-bold text-gradient-coral">Crabby Mates</span>
        </Link>
        <div className="flex items-center gap-3">
          <Link to="/app/profile" className="text-sm text-muted-foreground hover:text-foreground transition">
            🦀 {profile?.username ?? "..."}
          </Link>
          <Button size="sm" variant="ghost" onClick={() => { signOut(); navigate({ to: "/" }); }}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}