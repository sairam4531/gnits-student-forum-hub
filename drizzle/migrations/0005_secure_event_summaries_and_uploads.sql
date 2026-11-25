DROP POLICY IF EXISTS "Public event summaries" ON public.student_forum_events;
REVOKE ALL PRIVILEGES ON TABLE public.student_forum_events FROM PUBLIC, anon, authenticated;
REVOKE SELECT (id, club_slug, forum_slug, event_name, event_start, event_end, created_at) ON TABLE public.student_forum_events FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE VIEW public.student_forum_event_summaries WITH (security_barrier = true) AS
  SELECT id, club_slug, forum_slug, event_name, event_start, event_end, created_at
  FROM public.student_forum_events;
REVOKE ALL PRIVILEGES ON TABLE public.student_forum_event_summaries FROM PUBLIC;
GRANT SELECT ON TABLE public.student_forum_event_summaries TO anon, authenticated;
DROP POLICY IF EXISTS "Open event file uploads" ON storage.objects;