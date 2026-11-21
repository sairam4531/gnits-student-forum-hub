DROP POLICY IF EXISTS "Open event submissions" ON public.student_forum_events;
REVOKE INSERT ON public.student_forum_events FROM anon, authenticated;