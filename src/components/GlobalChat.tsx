import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Hash, Send } from "lucide-react";
import { toast } from "sonner";

type Channel = { id: string; name: string };
type Msg = { id: string; channel_id: string; user_id: string; username: string; content: string; created_at: string };

export function GlobalChat() {
  const { user, profile } = useAuth();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("channels").select("*").order("name").then(({ data }) => {
      if (data) {
        setChannels(data);
        setActive((cur) => cur ?? data[0]?.id ?? null);
      }
    });
  }, []);

  useEffect(() => {
    if (!active) return;
    supabase.from("chat_messages").select("*").eq("channel_id", active).order("created_at", { ascending: true }).limit(200)
      .then(({ data }) => setMsgs((data ?? []) as Msg[]));
    const ch = supabase.channel(`chat-${active}`).on("postgres_changes",
      { event: "INSERT", schema: "public", table: "chat_messages", filter: `channel_id=eq.${active}` },
      (p) => setMsgs((m) => [...m, p.new as Msg])).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [active]);

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9 }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !active || !user || !profile) return;
    const content = text.trim();
    setText("");
    const { error } = await supabase.from("chat_messages").insert({
      channel_id: active, user_id: user.id, username: profile.username, content,
    });
    if (error) toast.error(error.message);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 p-2 border-b border-border/60 overflow-x-auto">
        {channels.map((c) => (
          <button key={c.id} onClick={() => setActive(c.id)}
            className={`px-2 py-1 rounded text-sm flex items-center gap-1 transition ${
              active === c.id ? "bg-primary text-primary-foreground" : "hover:bg-muted text-muted-foreground"
            }`}>
            <Hash className="h-3 w-3" />{c.name}
          </button>
        ))}
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {msgs.length === 0 && <p className="text-center text-xs text-muted-foreground mt-4">No bubbles yet. Be the first crab!</p>}
        {msgs.map((m) => (
          <div key={m.id} className="text-sm">
            <span className="font-semibold text-secondary">🦀 {m.username}</span>
            <span className="text-foreground/90 ml-2">{m.content}</span>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-2 border-t border-border/60 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Pinch a message..." />
        <Button type="submit" size="icon" disabled={!text.trim()}><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}