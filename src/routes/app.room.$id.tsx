import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Editor from "@monaco-editor/react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { FileTree, type RFile } from "@/components/FileTree";
import { CrabBrain } from "@/components/CrabBrain";
import { RoomChat } from "@/components/RoomChat";
import { Button } from "@/components/ui/button";
import { detectLanguage } from "@/lib/lang";
import { toast } from "sonner";
import { ArrowLeft, Crown, Shield, Hammer, Baby, GitPullRequest, UserPlus, Mail } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/app/room/$id")({
  component: RoomPage,
});

type Member = { id: string; user_id: string; role: "king" | "senior" | "builder" | "baby" };
type Profile = { id: string; username: string };
type Room = { id: string; name: string; description: string; owner_id: string };
type FileFull = RFile & { content: string };
type Claw = { id: string; file_id: string; proposer_name: string; new_content: string; message: string; status: string; created_at: string };
type JoinReq = { id: string; user_id: string; username: string; message: string; status: string; created_at: string };

const ROLE_ICON = { king: Crown, senior: Shield, builder: Hammer, baby: Baby } as const;
const RANK = { king: 4, senior: 3, builder: 2, baby: 1 } as const;

function RoomPage() {
  const { id: roomId } = useParams({ from: "/app/room/$id" });
  const { user, profile } = useAuth();

  const [room, setRoom] = useState<Room | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [files, setFiles] = useState<FileFull[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string>("");
  const [presence, setPresence] = useState<{ username: string }[]>([]);
  const [claws, setClaws] = useState<Claw[]>([]);
  const [joinReqs, setJoinReqs] = useState<JoinReq[]>([]);
  const [membershipChecked, setMembershipChecked] = useState(false);
  const [isMember, setIsMember] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const editorChannel = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastBroadcast = useRef<number>(0);
  const remoteUpdate = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const myRole: Member["role"] | null = useMemo(
    () => members.find((m) => m.user_id === user?.id)?.role ?? null,
    [members, user]
  );
  const canEdit = !!(myRole && RANK[myRole] >= RANK.builder);
  const canDelete = !!(myRole && RANK[myRole] >= RANK.senior);
  const isKing = myRole === "king";
  const isAdmin = myRole === "king" || myRole === "senior";
  const activeFile = files.find((f) => f.id === activeId) ?? null;

  useEffect(() => {
    (async () => {
      const { data: r } = await supabase.from("rooms").select("*").eq("id", roomId).maybeSingle();
      setRoom(r as Room | null);
      if (!user) return;
      const { data: mem } = await supabase.from("room_members").select("*").eq("room_id", roomId).eq("user_id", user.id).maybeSingle();
      if (mem) {
        setIsMember(true);
      } else {
        // Try to auto-claim membership if owner or has approved access (RLS will allow only then)
        const { error } = await supabase.from("room_members").insert({ room_id: roomId, user_id: user.id, role: "baby" });
        setIsMember(!error);
      }
      setMembershipChecked(true);
    })();
  }, [roomId, user]);

  useEffect(() => {
    const loadMembers = async () => {
      const { data } = await supabase.from("room_members").select("*").eq("room_id", roomId);
      setMembers((data ?? []) as Member[]);
      const ids = (data ?? []).map((m) => m.user_id);
      if (ids.length) {
        const { data: ps } = await supabase.from("profiles").select("id,username").in("id", ids);
        setProfiles(Object.fromEntries((ps ?? []).map((p) => [p.id, p as Profile])));
      }
    };
    loadMembers();
    const ch = supabase.channel(`mem-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_members", filter: `room_id=eq.${roomId}` }, loadMembers)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId]);

  const loadFiles = useCallback(async () => {
    const { data } = await supabase.from("room_files").select("*").eq("room_id", roomId).order("path");
    const list = (data ?? []) as FileFull[];
    setFiles(list);
    setActiveId((cur) => cur ?? list[0]?.id ?? null);
  }, [roomId]);

  useEffect(() => {
    loadFiles();
    const ch = supabase.channel(`files-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "room_files", filter: `room_id=eq.${roomId}` }, (p) => {
        if (p.eventType === "DELETE") {
          const oldId = (p.old as any).id;
          setFiles((fs) => fs.filter((f) => f.id !== oldId));
          setActiveId((cur) => cur === oldId ? null : cur);
        } else {
          const nf = p.new as FileFull;
          setFiles((fs) => {
            const ix = fs.findIndex((f) => f.id === nf.id);
            if (ix === -1) return [...fs, nf].sort((a, b) => a.path.localeCompare(b.path));
            const copy = [...fs]; copy[ix] = { ...copy[ix], ...nf }; return copy;
          });
        }
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, loadFiles]);

  useEffect(() => {
    const f = files.find((x) => x.id === activeId);
    if (f) { remoteUpdate.current = true; setDraft(f.content); }
  }, [activeId, files.length]); // eslint-disable-line

  useEffect(() => {
    if (!profile || !user) return;
    const ch = supabase.channel(`editor-${roomId}`, { config: { presence: { key: user.id } } });
    editorChannel.current = ch;
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState();
      const list: { username: string }[] = [];
      Object.values(state).forEach((arr) => (arr as any[]).forEach((p) => list.push({ username: p.username })));
      setPresence(list);
    });
    ch.on("broadcast", { event: "edit" }, (msg) => {
      const { fileId, content, by } = msg.payload as { fileId: string; content: string; by: string };
      if (by === user.id) return;
      setFiles((fs) => fs.map((f) => f.id === fileId ? { ...f, content } : f));
      setActiveId((cur) => {
        if (cur === fileId) { remoteUpdate.current = true; setDraft(content); }
        return cur;
      });
    });
    ch.subscribe(async (status) => {
      if (status === "SUBSCRIBED") await ch.track({ username: profile.username });
    });
    return () => { supabase.removeChannel(ch); editorChannel.current = null; };
  }, [roomId, profile, user]);

  useEffect(() => {
    if (!isMember) return;
    const load = () => supabase.from("claw_requests").select("*").eq("room_id", roomId).order("created_at", { ascending: false })
      .then(({ data }) => setClaws((data ?? []) as Claw[]));
    load();
    const ch = supabase.channel(`claw-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "claw_requests", filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, isMember]);

  // Load join requests (admin only)
  useEffect(() => {
    if (!isAdmin) { setJoinReqs([]); return; }
    const load = () => supabase.from("join_requests").select("*").eq("room_id", roomId).eq("status", "pending").order("created_at", { ascending: false })
      .then(({ data }) => setJoinReqs((data ?? []) as JoinReq[]));
    load();
    const ch = supabase.channel(`jr-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "join_requests", filter: `room_id=eq.${roomId}` }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [roomId, isAdmin]);

  const onChange = (val?: string) => {
    const v = val ?? "";
    setDraft(v);
    if (remoteUpdate.current) { remoteUpdate.current = false; return; }
    if (!activeFile || !canEdit || !user) return;
    const now = Date.now();
    if (now - lastBroadcast.current > 80 && editorChannel.current) {
      lastBroadcast.current = now;
      editorChannel.current.send({
        type: "broadcast", event: "edit",
        payload: { fileId: activeFile.id, content: v, by: user.id },
      });
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      await supabase.from("room_files").update({ content: v, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", activeFile.id);
    }, 600);
  };

  const createFile = async (path: string) => {
    if (!user) return;
    const { error } = await supabase.from("room_files").insert({
      room_id: roomId, path, content: "", language: detectLanguage(path), updated_by: user.id,
    });
    if (error) toast.error(error.message);
  };

  const deleteFile = async (id: string) => {
    const { error } = await supabase.from("room_files").delete().eq("id", id);
    if (error) toast.error(error.message);
  };

  const applyAI = async (changes: { path: string; content: string; language?: string }[]) => {
    if (!user || !profile) return;
    if (isKing || myRole === "senior") {
      for (const c of changes) {
        const existing = files.find((f) => f.path === c.path);
        if (existing) {
          await supabase.from("room_files").update({
            content: c.content, language: c.language ?? existing.language, updated_by: user.id, updated_at: new Date().toISOString(),
          }).eq("id", existing.id);
        } else {
          await supabase.from("room_files").insert({
            room_id: roomId, path: c.path, content: c.content,
            language: c.language ?? detectLanguage(c.path), updated_by: user.id,
          });
        }
      }
    } else if (myRole === "builder") {
      for (const c of changes) {
        const existing = files.find((f) => f.path === c.path);
        if (!existing) {
          await supabase.from("room_files").insert({
            room_id: roomId, path: c.path, content: c.content,
            language: c.language ?? detectLanguage(c.path), updated_by: user.id,
          });
        } else {
          await supabase.from("claw_requests").insert({
            room_id: roomId, file_id: existing.id, proposer_id: user.id,
            proposer_name: profile.username, new_content: c.content, message: "AI-proposed change",
          });
        }
      }
      toast.message("Submitted as Claw Requests for King review");
    } else {
      toast.error("Baby crabs can only watch.");
    }
  };

  const setRole = async (memberId: string, role: Member["role"]) => {
    const { error } = await supabase.from("room_members").update({ role }).eq("id", memberId);
    if (error) toast.error(error.message);
  };

  const decideClaw = async (c: Claw, approve: boolean) => {
    if (!user) return;
    if (approve) {
      await supabase.from("room_files").update({
        content: c.new_content, updated_by: user.id, updated_at: new Date().toISOString(),
      }).eq("id", c.file_id);
    }
    await supabase.from("claw_requests").update({ status: approve ? "approved" : "rejected" }).eq("id", c.id);
  };

  const decideJoin = async (jr: JoinReq, approve: boolean) => {
    if (approve) {
      await supabase.from("join_requests").update({ status: "approved" }).eq("id", jr.id);
      // Add as member directly (RLS allows admin to manage via function? No — admin can't insert members.
      // Use server-bypass via RPC-ish: set status=approved unlocks has_approved_access; user must self-join.
      // To make it instant, also try direct insert (will succeed for owner-managed update policy if room owner).
    } else {
      await supabase.from("join_requests").update({ status: "rejected" }).eq("id", jr.id);
    }
  };

  const sendInvite = async () => {
    if (!user || !profile || !inviteName.trim()) return;
    const uname = inviteName.trim();
    const { data: target } = await supabase.from("profiles").select("id,username").eq("username", uname).maybeSingle();
    if (!target) { toast.error("No crab with that name."); return; }
    const { error } = await supabase.from("room_invites").insert({
      room_id: roomId, invited_user_id: target.id, invited_username: target.username,
      by_user_id: user.id, by_username: profile.username,
    });
    if (error) return toast.error(error.message);
    toast.success(`Invite sent to ${uname}`);
    setInviteName("");
  };

  const pendingClaws = claws.filter((c) => c.status === "pending");

  if (membershipChecked && !isMember) {
    return (
      <div className="h-[calc(100vh-3.5rem)] grid place-items-center p-6">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-2xl font-bold">{room?.name ?? "Reef"}</h1>
          <p className="text-muted-foreground">{room?.description || "A private crab reef."}</p>
          <p className="text-sm text-yellow-400">You're not a member of this reef.</p>
          <Link to="/app"><Button variant="secondary"><ArrowLeft className="h-4 w-4 mr-1" />Back</Button></Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-3.5rem)] grid grid-cols-1 lg:grid-cols-[240px_1fr_360px]">
      <aside className="border-r border-border/60 bg-sidebar/60 min-h-0 flex flex-col">
        <div className="p-3 border-b border-border/60 flex items-center gap-2">
          <Link to="/app"><Button size="icon" variant="ghost" className="h-7 w-7"><ArrowLeft className="h-4 w-4" /></Button></Link>
          <div className="min-w-0">
            <div className="font-bold truncate">{room?.name ?? "..."}</div>
            <div className="text-[10px] text-muted-foreground">{presence.length} crab{presence.length === 1 ? "" : "s"} live</div>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <FileTree files={files.map(({ id, path, language }) => ({ id, path, language }))}
            activeId={activeId} onPick={setActiveId} onCreate={createFile} onDelete={deleteFile}
            canEdit={canEdit} canDelete={canDelete} />
        </div>
        <div className="border-t border-border/60 max-h-56 overflow-y-auto p-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1 px-1">Crew</div>
          {members.map((m) => {
            const Icon = ROLE_ICON[m.role];
            const live = presence.some((p) => p.username === profiles[m.user_id]?.username);
            return (
              <div key={m.id} className="flex items-center gap-2 px-1 py-1 text-xs">
                <Icon className="h-3.5 w-3.5 text-secondary" />
                <span className={`flex-1 truncate ${live ? "text-foreground" : "text-muted-foreground"}`}>
                  {profiles[m.user_id]?.username ?? "..."} {live && "🟢"}
                </span>
                {isKing && m.user_id !== user?.id && (
                  <Select value={m.role} onValueChange={(v) => setRole(m.id, v as Member["role"])}>
                    <SelectTrigger className="h-6 w-20 text-[10px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="senior">senior</SelectItem>
                      <SelectItem value="builder">builder</SelectItem>
                      <SelectItem value="baby">baby</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <main className="min-h-0 flex flex-col">
        <div className="h-9 border-b border-border/60 bg-card/40 flex items-center px-3 text-xs justify-between">
          <div className="flex items-center gap-3">
            <span className="text-muted-foreground">{activeFile ? activeFile.path : "no file"}</span>
            {!canEdit && activeFile && <span className="text-yellow-400">read-only</span>}
          </div>
          <div className="flex items-center gap-2">
          {isAdmin && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7">
                  <Mail className="h-3 w-3 mr-1" />Requests {joinReqs.length > 0 && `(${joinReqs.length})`}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Join requests & invites</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div className="flex gap-2">
                    <Input value={inviteName} onChange={(e) => setInviteName(e.target.value)} placeholder="invite by username" />
                    <Button onClick={sendInvite}><UserPlus className="h-3 w-3 mr-1" />Invite</Button>
                  </div>
                  <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                    {joinReqs.length === 0 && <p className="text-xs text-muted-foreground">No pending requests.</p>}
                    {joinReqs.map((j) => (
                      <div key={j.id} className="flex items-center justify-between rounded border border-border/60 p-2 bg-card/40">
                        <div className="text-sm">🦀 <b>{j.username}</b> wants in</div>
                        <div className="flex gap-1">
                          <Button size="sm" onClick={() => decideJoin(j, true)}>Approve</Button>
                          <Button size="sm" variant="ghost" onClick={() => decideJoin(j, false)}>Reject</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
          {pendingClaws.length > 0 && (
            <Dialog>
              <DialogTrigger asChild>
                <Button size="sm" variant="secondary" className="h-7">
                  <GitPullRequest className="h-3 w-3 mr-1" />{pendingClaws.length}
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Claw Requests</DialogTitle></DialogHeader>
                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {pendingClaws.map((c) => {
                    const f = files.find((x) => x.id === c.file_id);
                    return (
                      <div key={c.id} className="rounded-lg border border-border/60 p-3 bg-card/40">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-semibold">🦀 {c.proposer_name} → {f?.path ?? "(deleted)"}</div>
                          {isAdmin ? (
                            <div className="flex gap-1">
                              <Button size="sm" onClick={() => decideClaw(c, true)}>Approve</Button>
                              <Button size="sm" variant="ghost" onClick={() => decideClaw(c, false)}>Reject</Button>
                            </div>
                          ) : <span className="text-xs text-muted-foreground">awaiting King/Senior</span>}
                        </div>
                        <pre className="mt-2 text-xs bg-muted/30 p-2 rounded max-h-40 overflow-auto">{c.new_content.slice(0, 1200)}{c.new_content.length > 1200 ? "..." : ""}</pre>
                      </div>
                    );
                  })}
                </div>
              </DialogContent>
            </Dialog>
          )}
          </div>
        </div>
        <div className="flex-1 min-h-0">
          {activeFile ? (
            <Editor
              height="100%"
              theme="vs-dark"
              path={activeFile.path}
              language={activeFile.language || detectLanguage(activeFile.path)}
              value={draft}
              onChange={onChange}
              options={{ readOnly: !canEdit, minimap: { enabled: false }, fontSize: 13, scrollBeyondLastLine: false, tabSize: 2 }}
            />
          ) : (
            <div className="h-full grid place-items-center text-muted-foreground text-sm">
              {canEdit ? "Create a file in the Shell Storage to begin." : "No files yet."}
            </div>
          )}
        </div>
      </main>

      <aside className="border-l border-border/60 bg-sidebar/60 min-h-0 hidden lg:flex flex-col">
        <Tabs defaultValue="ai" className="flex-1 flex flex-col min-h-0">
          <TabsList className="rounded-none border-b border-border/60 bg-transparent">
            <TabsTrigger value="ai" className="flex-1">CrabBrain</TabsTrigger>
            <TabsTrigger value="chat" className="flex-1">Chat</TabsTrigger>
          </TabsList>
          <TabsContent value="ai" className="flex-1 min-h-0 m-0 overflow-hidden">
            <CrabBrain
              files={files.map((f) => ({ path: f.path, content: f.content, language: f.language }))}
              currentPath={activeFile?.path ?? null}
              onApply={applyAI}
            />
          </TabsContent>
          <TabsContent value="chat" className="flex-1 min-h-0 m-0 overflow-hidden">
            <RoomChat roomId={roomId} />
          </TabsContent>
        </Tabs>
      </aside>
    </div>
  );
}