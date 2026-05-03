
-- 1) Restrict self-join role to 'baby' (default role for new joiners)
DROP POLICY IF EXISTS "members self join" ON public.room_members;
CREATE POLICY "members self join"
ON public.room_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id AND role = 'baby'::public.crab_role);

-- 2) Restrict rooms SELECT to authenticated users
DROP POLICY IF EXISTS "rooms readable to all" ON public.rooms;
CREATE POLICY "rooms readable auth"
ON public.rooms
FOR SELECT
TO authenticated
USING (true);

-- 3) Restrict room_members SELECT to authenticated users
DROP POLICY IF EXISTS "members readable to all" ON public.room_members;
CREATE POLICY "members readable auth"
ON public.room_members
FOR SELECT
TO authenticated
USING (true);

-- 4) Lock down SECURITY DEFINER helper functions: only service_role / postgres
REVOKE EXECUTE ON FUNCTION public.is_room_member(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.room_role(uuid, uuid) FROM PUBLIC, anon, authenticated;

-- 5) Realtime topic-level RLS: only members of a room can subscribe to its topics
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "realtime room topic access" ON realtime.messages;
CREATE POLICY "realtime room topic access"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow non room-scoped topics (e.g. global chat, rooms-list)
  (realtime.topic() NOT LIKE 'mem-%'
   AND realtime.topic() NOT LIKE 'files-%'
   AND realtime.topic() NOT LIKE 'editor-%'
   AND realtime.topic() NOT LIKE 'claw-%'
   AND realtime.topic() NOT LIKE 'room-msg-%')
  OR
  public.is_room_member(
    NULLIF(split_part(realtime.topic(), '-', 2) || '-' ||
           split_part(realtime.topic(), '-', 3) || '-' ||
           split_part(realtime.topic(), '-', 4) || '-' ||
           split_part(realtime.topic(), '-', 5) || '-' ||
           split_part(realtime.topic(), '-', 6), '----')::uuid,
    auth.uid()
  )
);
