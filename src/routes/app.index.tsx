import { createFileRoute } from "@tanstack/react-router";
import { GlobalChat } from "@/components/GlobalChat";
import { RoomList } from "@/components/RoomList";

export const Route = createFileRoute("/app/")({
  component: AppHome,
});

function AppHome() {
  return (
    <div className="h-[calc(100vh-3.5rem)] grid grid-cols-1 lg:grid-cols-[320px_1fr_360px]">
      <aside className="border-r border-border/60 bg-sidebar/60 min-h-0"><RoomList /></aside>
      <main className="p-8 overflow-y-auto">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-4xl font-black tracking-tight">Welcome back, crab.</h1>
          <p className="text-muted-foreground mt-2">Pick a reef on the left, or chat with the whole pod on the right.</p>
          <div className="mt-10 grid sm:grid-cols-2 gap-4">
            <div className="p-6 rounded-2xl bg-card/60 border border-border/60 bubble-bg"><h3 className="font-bold text-lg">Crabby-Con</h3><p className="text-sm text-muted-foreground mt-1">Global hangout. Three channels. Real-time bubbles.</p></div>
            <div className="p-6 rounded-2xl bg-card/60 border border-border/60 bubble-bg"><h3 className="font-bold text-lg">Crabby Roomies</h3><p className="text-sm text-muted-foreground mt-1">Project rooms with King / Senior / Builder / Baby roles.</p></div>
            <div className="p-6 rounded-2xl bg-card/60 border border-border/60 bubble-bg"><h3 className="font-bold text-lg">ClawCode IDE</h3><p className="text-sm text-muted-foreground mt-1">Monaco editor + multi-file + live presence.</p></div>
            <div className="p-6 rounded-2xl bg-card/60 border border-border/60 bubble-bg"><h3 className="font-bold text-lg">CrabBrain</h3><p className="text-sm text-muted-foreground mt-1">AI agent that reads your project & rewrites files.</p></div>
          </div>
        </div>
      </main>
      <aside className="border-l border-border/60 bg-sidebar/60 min-h-0 hidden lg:block"><GlobalChat /></aside>
    </div>
  );
}