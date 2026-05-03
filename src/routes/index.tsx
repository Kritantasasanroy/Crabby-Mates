import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CrabLogo } from "@/components/CrabLogo";
import { toast } from "sonner";
import { MessageCircle, Users, Code2, Sparkles } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const { signIn, signUp } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate({ to: "/app" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const res = mode === "signin"
      ? await signIn(email, password)
      : await signUp(email, password, username || email.split("@")[0]);
    setBusy(false);
    if (res.error) toast.error(res.error);
    else if (mode === "signup") toast.success("Welcome to the reef, crab!");
  };

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <CrabLogo size={44} />
          <span className="text-2xl font-bold text-gradient-coral tracking-tight">Crabby Mates</span>
        </div>
        <a href="#join" className="text-sm text-muted-foreground hover:text-foreground">Join the reef</a>
      </header>

      <main className="max-w-7xl mx-auto px-6 grid lg:grid-cols-2 gap-10 items-center pt-8 pb-24">
        <section>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight leading-[1.05]">
            Code together.<br />
            <span className="text-gradient-coral">Pinch together.</span>
          </h1>
          <p className="mt-6 text-lg text-muted-foreground max-w-lg">
            A real-time playground for developer crustaceans. Chat in <b className="text-foreground">Crabby-Con</b>,
            spin up <b className="text-foreground">Crabby Roomies</b>, write code in the
            <b className="text-foreground"> ClawCode IDE</b>, and let <b className="text-secondary">CrabBrain</b> refactor for you.
          </p>

          <div className="mt-10 grid sm:grid-cols-2 gap-4 max-w-lg">
            {[
              { icon: MessageCircle, label: "Global chat", sub: "#general #ai #random" },
              { icon: Users, label: "Project rooms", sub: "King · Senior · Builder · Baby" },
              { icon: Code2, label: "Live IDE", sub: "Monaco · multi-file · realtime" },
              { icon: Sparkles, label: "CrabBrain AI", sub: "Reads & edits your project" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex gap-3 p-3 rounded-xl border border-border/60 bg-card/40 backdrop-blur">
                <Icon className="h-5 w-5 text-secondary mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-semibold">{label}</div>
                  <div className="text-xs text-muted-foreground">{sub}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Card id="join" className="p-8 bubble-bg border-border/60 shadow-[var(--shadow-deep)]">
          <div className="flex gap-2 mb-6">
            <Button variant={mode === "signin" ? "default" : "ghost"} onClick={() => setMode("signin")} className="flex-1">Sign in</Button>
            <Button variant={mode === "signup" ? "default" : "ghost"} onClick={() => setMode("signup")} className="flex-1">Sign up</Button>
          </div>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="u">Crab name</Label>
                <Input id="u" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="snippy_claws" />
              </div>
            )}
            <div>
              <Label htmlFor="e">Email</Label>
              <Input id="e" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="p">Password</Label>
              <Input id="p" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={busy} className="w-full" size="lg">
              {busy ? "..." : mode === "signin" ? "Dive in" : "Hatch crab"}
            </Button>
          </form>
          <p className="mt-4 text-xs text-muted-foreground text-center">
            By joining you agree to be a respectful reef-mate.
          </p>
        </Card>
      </main>
    </div>
  );
}
