
-- 1) chat_messages: restrict SELECT to authenticated
DROP POLICY IF EXISTS "chat readable" ON public.chat_messages;
CREATE POLICY "chat readable" ON public.chat_messages
FOR SELECT TO authenticated USING (true);

-- 2) chat_messages: enforce username matches profile
DROP POLICY IF EXISTS "chat insert auth" ON public.chat_messages;
CREATE POLICY "chat insert auth" ON public.chat_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND username = (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid())
);

-- 3) room_members: only members of the room can read its membership
DROP POLICY IF EXISTS "members readable auth" ON public.room_members;
CREATE POLICY "members readable auth" ON public.room_members
FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_room_member(room_id, auth.uid())
);

-- 4) room_messages: enforce username matches profile
DROP POLICY IF EXISTS "room msg insert members" ON public.room_messages;
CREATE POLICY "room msg insert members" ON public.room_messages
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND public.is_room_member(room_id, auth.uid())
  AND username = (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid())
);

-- 5) claw_requests: enforce proposer_name matches profile
DROP POLICY IF EXISTS "claw insert members" ON public.claw_requests;
CREATE POLICY "claw insert members" ON public.claw_requests
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = proposer_id
  AND public.is_room_member(room_id, auth.uid())
  AND proposer_name = (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid())
);
