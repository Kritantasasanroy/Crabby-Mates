DROP POLICY IF EXISTS "profiles readable" ON public.profiles;
CREATE POLICY "profiles readable" ON public.profiles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "channels readable" ON public.channels;
CREATE POLICY "channels readable" ON public.channels FOR SELECT TO authenticated USING (true);