DROP POLICY IF EXISTS "Only service-side admin access" ON public.student_forum_events;
GRANT INSERT ON public.student_forum_events TO anon, authenticated;
CREATE POLICY "Open event submissions" ON public.student_forum_events FOR INSERT TO anon, authenticated WITH CHECK (true);