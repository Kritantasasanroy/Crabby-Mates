
CREATE OR REPLACE FUNCTION public.is_room_member(_room uuid, _user uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.room_members
    WHERE room_id = _room AND user_id = _user
      AND (auth.uid() IS NULL OR _user = auth.uid() OR auth.role() = 'service_role')
  );
$$;

CREATE OR REPLACE FUNCTION public.room_role(_room uuid, _user uuid)
RETURNS public.crab_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT role FROM public.room_members
  WHERE room_id = _room AND user_id = _user
    AND (auth.uid() IS NULL OR _user = auth.uid() OR auth.role() = 'service_role')
  LIMIT 1;
$$;
