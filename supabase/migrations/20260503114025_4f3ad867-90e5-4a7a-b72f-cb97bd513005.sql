
CREATE OR REPLACE FUNCTION public.tg_jr_auto_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (NEW.room_id, NEW.user_id, 'baby')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER jr_auto_member
AFTER UPDATE ON public.join_requests
FOR EACH ROW EXECUTE FUNCTION public.tg_jr_auto_member();

CREATE OR REPLACE FUNCTION public.tg_inv_auto_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND (OLD.status IS DISTINCT FROM 'approved') THEN
    INSERT INTO public.room_members (room_id, user_id, role)
    VALUES (NEW.room_id, NEW.invited_user_id, 'baby')
    ON CONFLICT (room_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER inv_auto_member
AFTER UPDATE ON public.room_invites
FOR EACH ROW EXECUTE FUNCTION public.tg_inv_auto_member();

-- room_members needs unique (room_id,user_id) for ON CONFLICT
ALTER TABLE public.room_members ADD CONSTRAINT room_members_room_user_unique UNIQUE (room_id, user_id);
