import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Crown, Shield, Hammer, Baby, Mail, GitPullRequest, Hourglass, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/profile")({
  component: ProfilePage,
});

type Room = { id: string; name: string; description: string | null };
type Membership = { room_id: string; role: "king" | "senior" | "builder" | "baby"; rooms: Room };
type Invite = { id: string; room_id: string; by_username: string; status: string; rooms: Room };
type JoinReq = { id: string; room_id: string; status: string; rooms: Room };
type Claw = { id: string; room_id: string; file_id: string; proposer_name: string; status: string; rooms: Room };

const ROLE_ICON = { king: Crown, senior: Shield, builder: Hammer, baby: Baby } as const;

function ProfilePage() {
  const { user, profile } = useAuth();
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [outgoingReqs, setOutgoingReqs] = useState<JoinReq[]>([]);
  const [adminClaws, setAdminClaws] = useState<Claw[]>([]);

  const load = async () => {
    if (!user) return;
    const [{ data: mems }, { data: invs }, { data: reqs }] = await Promise.all([
      supabase.from("room_members").select("room_id,role,rooms(id,name,description)").eq("user_id", user.id),
      supabase.from("room_invites").select("id,room_id,by_username,status,rooms(id,name,description)").eq("invited_user_id", user.id).eq("status", "pending"),
      supabase.from("join_requests").select("id,room_id,status,rooms(id,name,description)").eq("user_id", user.id),
    ]);
    setMemberships((mems ?? []) as any);
    setInvites((invs ?? []) as any);
    setOutgoingReqs((reqs ?? []) as any);

    // For rooms where I'm admin, load pending claws
    const adminRoomIds = (mems ?? []).filter((m: any) => m.role === "king" || m.role === "senior").map((m: any) => m.room_id);
    if (adminRoomIds.length) {
      const { data: cl } = await supabase.from("claw_requests")
        .select("id,room_id,file_id,proposer_name,status,rooms(id,name,description)")
        .in("room_id", adminRoomIds).eq("status", "pending");
      setAdminClaws((cl ?? []) as any);
    } else {
      setAdminClaws([]);
    }
  };

  useEffect(() => { load(); }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    const ch = supabase.channel(`profile-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_invites" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "claw_requests" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id]);

  const acceptInvite = async (inv: Invite) => {
    const { error } = await supabase.from("room_invites").update({ status: "approved" }).eq("id", inv.id);
    if (error) return toast.error(error.message);
    // self-join
    if (user) await supabase.from("room_members").insert({ room_id: inv.room_id, user_id: user.id, role: "baby" });
    toast.success("Welcome to the reef!");
    load();
  };

  const declineInvite = async (inv: Invite) => {
    await supabase.from("room_invites").update({ status: "rejected" }).eq("id", inv.id);
    load();
  };

  const cancelRequest = async (jr: JoinReq) => {
    await supabase.from("join_requests").delete().eq("id", jr.id);
    load();
  };

  if (!user) return null;

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-y-auto p-6 lg:p-10">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/20 grid place-items-center text-3xl">🦀</div>
          <div>
            <h1 className="text-3xl font-black">{profile?.username ?? "..."}</h1>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </header>

        <section>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Mail className="h-4 w-4" />Pending invites ({invites.length})</h2>
          <div className="space-y-2">
            {invites.length === 0 && <p className="text-xs text-muted-foreground">No invites right now.</p>}
            {invites.map((i) => (
              <div key={i.id} className="rounded-lg border border-border/60 p-3 bg-card/40 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{i.rooms?.name}</div>
                  <div className="text-xs text-muted-foreground">invited by {i.by_username}</div>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" onClick={() => acceptInvite(i)}><Check className="h-3 w-3 mr-1" />Accept</Button>
                  <Button size="sm" variant="ghost" onClick={() => declineInvite(i)}><X className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><GitPullRequest className="h-4 w-4" />Claw Requests to review ({adminClaws.length})</h2>
          <div className="space-y-2">
            {adminClaws.length === 0 && <p className="text-xs text-muted-foreground">Nothing waiting on you.</p>}
            {adminClaws.map((c) => (
              <Link key={c.id} to="/app/room/$id" params={{ id: c.room_id }}
                className="block rounded-lg border border-border/60 p-3 bg-card/40 hover:bg-card/70">
                <div className="font-semibold">{c.rooms?.name}</div>
                <div className="text-xs text-muted-foreground">{c.proposer_name} proposed a merge</div>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3 flex items-center gap-2"><Hourglass className="h-4 w-4" />Outgoing join requests</h2>
          <div className="space-y-2">
            {outgoingReqs.length === 0 && <p className="text-xs text-muted-foreground">None.</p>}
            {outgoingReqs.map((r) => (
              <div key={r.id} className="rounded-lg border border-border/60 p-3 bg-card/40 flex items-center justify-between">
                <div>
                  <div className="font-semibold">{r.rooms?.name}</div>
                  <div className="text-xs text-muted-foreground capitalize">{r.status}</div>
                </div>
                {r.status === "pending" && <Button size="sm" variant="ghost" onClick={() => cancelRequest(r)}>Cancel</Button>}
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="font-bold text-lg mb-3">My reefs ({memberships.length})</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            {memberships.length === 0 && <p className="text-xs text-muted-foreground">Join or create a reef to get started.</p>}
            {memberships.map((m) => {
              const Icon = ROLE_ICON[m.role];
              return (
                <Link key={m.room_id} to="/app/room/$id" params={{ id: m.room_id }}
                  className="rounded-lg border border-border/60 p-4 bg-card/40 hover:bg-card/70">
                  <div className="flex items-center gap-2 font-semibold"><Icon className="h-4 w-4 text-secondary" />{m.rooms?.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{m.rooms?.description || "no description"}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-2">{m.role} crab</div>
                </Link>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
