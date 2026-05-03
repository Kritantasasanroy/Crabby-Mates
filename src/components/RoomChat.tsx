import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Send } from "lucide-react";

type Msg = { id: string; username: string; content: string; created_at: string };

export function RoomChat({ roomId }: { roomId: string }) {
  const { user, profile } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("room_messages").select("*").eq("room_id", roomId).order("created_at").limit(200)
      .then(({ data }) => setMsgs((data ?? []) as Msg[]));
    const ch = supabase.channel(`room-msg-${roomId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        (p) => setMsgs((m) => [...m, p.new as Msg]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  useEffect(() => { ref.current?.scrollTo({ top: 9e9 }); }, [msgs]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !user || !profile) return;
    const c = text.trim(); setText("");
    await supabase.from("room_messages").insert({ room_id: roomId, user_id: user.id, username: profile.username, content: c });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/60 font-bold text-sm">Reef Chat</div>
      <div ref={ref} className="flex-1 overflow-y-auto p-3 space-y-1.5 text-sm">
        {msgs.map((m) => (
          <div key={m.id}><span className="font-semibold text-secondary">🦀 {m.username}</span> <span>{m.content}</span></div>
        ))}
      </div>
      <form onSubmit={send} className="p-2 border-t border-border/60 flex gap-2">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="say something..." />
        <Button size="icon" type="submit"><Send className="h-4 w-4" /></Button>
      </form>
    </div>
  );
}