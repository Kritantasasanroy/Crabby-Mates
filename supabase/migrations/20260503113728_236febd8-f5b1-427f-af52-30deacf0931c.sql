
-- ============= JOIN REQUESTS =============
CREATE TABLE public.join_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  username text NOT NULL,
  message text DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, user_id)
);
ALTER TABLE public.join_requests ENABLE ROW LEVEL SECURITY;

-- ============= ROOM INVITES =============
CREATE TABLE public.room_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  invited_user_id uuid NOT NULL,
  invited_username text NOT NULL,
  by_user_id uuid NOT NULL,
  by_username text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (room_id, invited_user_id)
);
ALTER TABLE public.room_invites ENABLE ROW LEVEL SECURITY;

-- Helpers (after tables exist)
CREATE OR REPLACE FUNCTION public.is_room_admin(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room AND user_id = _user AND role IN ('king','senior')
      AND (auth.uid() IS NULL OR _user = auth.uid() OR auth.role() = 'service_role')
  );
$$;

CREATE OR REPLACE FUNCTION public.has_approved_access(_room uuid, _user uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_invites
    WHERE room_id = _room AND invited_user_id = _user AND status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM public.join_requests
    WHERE room_id = _room AND user_id = _user AND status = 'approved'
  );
$$;

-- Policies for join_requests
CREATE POLICY "jr self read" ON public.join_requests FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "jr admin read" ON public.join_requests FOR SELECT TO authenticated
  USING (public.is_room_admin(room_id, auth.uid()));
CREATE POLICY "jr self create" ON public.join_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND status = 'pending'
    AND username = (SELECT p.username FROM public.profiles p WHERE p.id = auth.uid())
  );
CREATE POLICY "jr admin update" ON public.join_requests FOR UPDATE TO authenticated
  USING (public.is_room_admin(room_id, auth.uid()));
CREATE POLICY "jr self delete" ON public.join_requests FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));

-- Policies for room_invites
CREATE POLICY "inv invitee read" ON public.room_invites FOR SELECT TO authenticated
  USING (invited_user_id = auth.uid());
CREATE POLICY "inv admin read" ON public.room_invites FOR SELECT TO authenticated
  USING (public.is_room_admin(room_id, auth.uid()));
CREATE POLICY "inv admin create" ON public.room_invites FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = by_user_id
    AND public.is_room_admin(room_id, auth.uid())
    AND status = 'pending'
  );
CREATE POLICY "inv invitee update" ON public.room_invites FOR UPDATE TO authenticated
  USING (invited_user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));
CREATE POLICY "inv invitee delete" ON public.room_invites FOR DELETE TO authenticated
  USING (invited_user_id = auth.uid() OR public.is_room_admin(room_id, auth.uid()));

-- Tighten room_members self-join
DROP POLICY IF EXISTS "members self join" ON public.room_members;
CREATE POLICY "members self join" ON public.room_members FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'baby'
    AND (
      public.has_approved_access(room_id, auth.uid())
      OR EXISTS (SELECT 1 FROM public.rooms r WHERE r.id = room_id AND r.owner_id = auth.uid())
    )
  );

-- Claw approvals: King + Senior
DROP POLICY IF EXISTS "claw update king" ON public.claw_requests;
CREATE POLICY "claw update admins" ON public.claw_requests FOR UPDATE TO authenticated
  USING (public.is_room_admin(room_id, auth.uid()));

ALTER PUBLICATION supabase_realtime ADD TABLE public.join_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.room_invites;
