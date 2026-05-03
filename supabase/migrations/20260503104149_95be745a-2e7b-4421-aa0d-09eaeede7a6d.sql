
-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles readable" on public.profiles for select using (true);
create policy "profiles self insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles self update" on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1)))
  on conflict (id) do nothing;
  return new;
end; $$;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Channels (global chat) seed
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  created_at timestamptz not null default now()
);
insert into public.channels (name) values ('general'),('ai'),('random');
alter table public.channels enable row level security;
create policy "channels readable" on public.channels for select using (true);

-- Global chat messages
create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.chat_messages enable row level security;
create policy "chat readable" on public.chat_messages for select using (true);
create policy "chat insert auth" on public.chat_messages for insert with check (auth.uid() = user_id);
create index on public.chat_messages (channel_id, created_at);

-- Rooms
create type public.crab_role as enum ('king','senior','builder','baby');

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  owner_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.rooms enable row level security;

create table public.room_members (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.crab_role not null default 'builder',
  created_at timestamptz not null default now(),
  unique(room_id, user_id)
);
alter table public.room_members enable row level security;

-- Membership helper (security definer to avoid recursion)
create or replace function public.is_room_member(_room uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.room_members where room_id=_room and user_id=_user);
$$;

create or replace function public.room_role(_room uuid, _user uuid)
returns public.crab_role language sql stable security definer set search_path = public as $$
  select role from public.room_members where room_id=_room and user_id=_user limit 1;
$$;

create policy "rooms readable to all" on public.rooms for select using (true);
create policy "rooms create auth" on public.rooms for insert with check (auth.uid() = owner_id);
create policy "rooms owner update" on public.rooms for update using (auth.uid() = owner_id);
create policy "rooms owner delete" on public.rooms for delete using (auth.uid() = owner_id);

create policy "members readable to all" on public.room_members for select using (true);
create policy "members self join" on public.room_members for insert with check (auth.uid() = user_id);
create policy "members owner manage" on public.room_members for update using (
  exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = auth.uid())
);
create policy "members owner remove" on public.room_members for delete using (
  auth.uid() = user_id or exists (select 1 from public.rooms r where r.id = room_id and r.owner_id = auth.uid())
);

-- When a room is created, auto-add owner as king
create or replace function public.handle_new_room()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.room_members (room_id, user_id, role) values (new.id, new.owner_id, 'king');
  return new;
end; $$;
create trigger on_room_created after insert on public.rooms
  for each row execute function public.handle_new_room();

-- Files per room
create table public.room_files (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  path text not null,
  content text not null default '',
  language text not null default 'javascript',
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(room_id, path)
);
alter table public.room_files enable row level security;
create policy "files read members" on public.room_files for select using (public.is_room_member(room_id, auth.uid()));
create policy "files insert builders+" on public.room_files for insert with check (
  public.room_role(room_id, auth.uid()) in ('king','senior','builder')
);
create policy "files update builders+" on public.room_files for update using (
  public.room_role(room_id, auth.uid()) in ('king','senior','builder')
);
create policy "files delete seniors+" on public.room_files for delete using (
  public.room_role(room_id, auth.uid()) in ('king','senior')
);

-- Room chat
create table public.room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  username text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.room_messages enable row level security;
create policy "room msg read members" on public.room_messages for select using (public.is_room_member(room_id, auth.uid()));
create policy "room msg insert members" on public.room_messages for insert with check (
  auth.uid() = user_id and public.is_room_member(room_id, auth.uid())
);
create index on public.room_messages (room_id, created_at);

-- Claw requests (proposed file changes pending owner approval)
create type public.claw_status as enum ('pending','approved','rejected');
create table public.claw_requests (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  file_id uuid not null references public.room_files(id) on delete cascade,
  proposer_id uuid not null references public.profiles(id) on delete cascade,
  proposer_name text not null,
  new_content text not null,
  message text default '',
  status public.claw_status not null default 'pending',
  created_at timestamptz not null default now()
);
alter table public.claw_requests enable row level security;
create policy "claw read members" on public.claw_requests for select using (public.is_room_member(room_id, auth.uid()));
create policy "claw insert members" on public.claw_requests for insert with check (
  auth.uid() = proposer_id and public.is_room_member(room_id, auth.uid())
);
create policy "claw update king" on public.claw_requests for update using (
  public.room_role(room_id, auth.uid()) = 'king'
);

-- Realtime
alter publication supabase_realtime add table public.chat_messages;
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.room_files;
alter publication supabase_realtime add table public.room_members;
alter publication supabase_realtime add table public.claw_requests;
alter publication supabase_realtime add table public.rooms;
