import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function CrabBrain({
  files, currentPath, onApply,
}: {
  files: { path: string; content: string; language?: string }[];
  currentPath: string | null;
  onApply: (changes: { path: string; content: string; language?: string }[]) => Promise<void>;
}) {
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<string>("");

  const run = async () => {
    if (!prompt.trim()) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("crabbrain", {
        body: { prompt, files, currentPath },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLast(data.explanation || "Done.");
      await onApply(data.files || []);
      toast.success(`CrabBrain updated ${data.files?.length ?? 0} file(s)`);
      setPrompt("");
    } catch (e: any) {
      toast.error(e?.message ?? "CrabBrain stumbled");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-secondary" />
        <h3 className="font-bold">CrabBrain</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">AI agent</span>
      </div>
      <div className="flex-1 overflow-y-auto p-3 text-sm">
        {last ? (
          <div className="p-3 rounded-lg bg-muted/40 border border-border/60 whitespace-pre-wrap">{last}</div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Ask CrabBrain to scaffold, refactor, or fix. It reads every file in this reef and writes changes back.
          </p>
        )}
      </div>
      <div className="p-3 border-t border-border/60 space-y-2">
        <Textarea rows={3} placeholder="e.g. add a fibonacci function to math.js"
          value={prompt} onChange={(e) => setPrompt(e.target.value)} />
        <Button onClick={run} disabled={busy || !prompt.trim()} className="w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pinch it!"}
        </Button>
      </div>
    </div>
  );
}