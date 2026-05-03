import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Waves, LogIn, Check, Hourglass } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Room = { id: string; name: string; description: string; owner_id: string };

export function RoomList() {
  const { user, profile } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [memberRoomIds, setMemberRoomIds] = useState<Set<string>>(new Set());
  const [pendingRoomIds, setPendingRoomIds] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");

  const load = () => supabase.from("rooms").select("*").order("created_at", { ascending: false })
    .then(({ data }) => setRooms((data ?? []) as Room[]));

  const loadMembership = async () => {
    if (!user) return;
    const [{ data: mems }, { data: jrs }] = await Promise.all([
      supabase.from("room_members").select("room_id").eq("user_id", user.id),
      supabase.from("join_requests").select("room_id,status").eq("user_id", user.id).eq("status", "pending"),
    ]);
    setMemberRoomIds(new Set((mems ?? []).map((m: any) => m.room_id)));
    setPendingRoomIds(new Set((jrs ?? []).map((j: any) => j.room_id)));
  };

  useEffect(() => {
    load();
    loadMembership();
    const ch = supabase.channel("rooms-list").on("postgres_changes",
      { event: "*", schema: "public", table: "rooms" }, () => load()).subscribe();
    const ch2 = supabase.channel("my-mem-rooms")
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, loadMembership)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, loadMembership)
      .subscribe();
    return () => { supabase.removeChannel(ch); supabase.removeChannel(ch2); };
  }, [user?.id]);

  const create = async () => {
    if (!user || !name.trim()) return;
    const { error } = await supabase.from("rooms").insert({
      name: name.trim(), description: desc.trim(), owner_id: user.id,
    });
    if (error) return toast.error(error.message);
    setName(""); setDesc(""); setOpen(false);
    toast.success("Reef built!");
  };

  const requestJoin = async (roomId: string) => {
    if (!user || !profile) return;
    const { error } = await supabase.from("join_requests").insert({
      room_id: roomId, user_id: user.id, username: profile.username, message: "",
    });
    if (error) return toast.error(error.message);
    toast.success("Request sent — awaiting King's claw.");
    loadMembership();
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border/60 flex items-center justify-between">
        <h2 className="font-bold flex items-center gap-2"><Waves className="h-4 w-4 text-secondary" />Crabby Roomies</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button size="sm" variant="secondary"><Plus className="h-4 w-4" /></Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Build a new reef</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="reef-of-snippy-claws" /></div>
              <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
              <Button onClick={create} className="w-full">Create</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {rooms.length === 0 && <p className="text-xs text-muted-foreground text-center mt-4">Be first to build a reef.</p>}
        {rooms.map((r) => {
          const isMember = memberRoomIds.has(r.id);
          const isPending = pendingRoomIds.has(r.id);
          return (
            <div key={r.id} className="rounded-lg border border-border/60 p-3 bg-card/40">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold truncate">{r.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.description || "no description"}</div>
                </div>
                {isMember ? (
                  <Link to="/app/room/$id" params={{ id: r.id }}>
                    <Button size="sm" variant="secondary"><Check className="h-3 w-3 mr-1" />Open</Button>
                  </Link>
                ) : isPending ? (
                  <Button size="sm" variant="ghost" disabled><Hourglass className="h-3 w-3 mr-1" />Pending</Button>
                ) : (
                  <Button size="sm" onClick={() => requestJoin(r.id)}><LogIn className="h-3 w-3 mr-1" />Request</Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}