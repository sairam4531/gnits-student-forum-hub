ALTER TABLE public.student_forum_events
  ADD COLUMN submitter_name text,
  ADD COLUMN submitter_email text;

CREATE OR REPLACE FUNCTION public.validate_student_forum_submitter()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.submitter_name IS NULL OR char_length(trim(NEW.submitter_name)) NOT BETWEEN 1 AND 120 THEN
    RAISE EXCEPTION 'Submitter name must be between 1 and 120 characters';
  END IF;
  NEW.submitter_name := trim(NEW.submitter_name);
  IF NEW.submitter_email IS NULL OR char_length(trim(NEW.submitter_email)) NOT BETWEEN 3 AND 254 OR trim(NEW.submitter_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'A valid submitter email is required';
  END IF;
  NEW.submitter_email := lower(trim(NEW.submitter_email));
  RETURN NEW;
END;
$$;

CREATE TRIGGER student_forum_submitter_validate
BEFORE INSERT ON public.student_forum_events
FOR EACH ROW EXECUTE FUNCTION public.validate_student_forum_submitter();

GRANT SELECT (id, club_slug, forum_slug, event_name, event_start, event_end, created_at) ON public.student_forum_events TO anon, authenticated;
CREATE POLICY "Public event summaries" ON public.student_forum_events
FOR SELECT TO anon, authenticated USING (true);