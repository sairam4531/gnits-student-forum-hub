CREATE TABLE public.student_forum_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_slug text NOT NULL CHECK (club_slug IN ('technical-events', 'cultural-events', 'outreach-events', 'innovation-incubation-cell', 'research-development-cell', 'women-protection-abhaya')),
  forum_slug text NOT NULL,
  event_name text NOT NULL CHECK (char_length(trim(event_name)) BETWEEN 1 AND 160),
  event_start date NOT NULL,
  event_end date NOT NULL,
  resource_persons text NOT NULL CHECK (char_length(trim(resource_persons)) BETWEEN 1 AND 2000),
  report_object_path text NOT NULL,
  report_file_name text NOT NULL CHECK (char_length(report_file_name) BETWEEN 1 AND 180),
  report_content_type text NOT NULL,
  photo_object_paths text[] NOT NULL DEFAULT ARRAY[]::text[],
  photo_file_names text[] NOT NULL DEFAULT ARRAY[]::text[],
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT student_forum_event_date_order CHECK (event_start <= event_end),
  CONSTRAINT student_forum_photo_arrays_match CHECK (cardinality(photo_object_paths) = cardinality(photo_file_names)),
  CONSTRAINT student_forum_catalog_match CHECK (
    (club_slug = 'technical-events' AND forum_slug IN ('iste','ieee','csi','iete','acm-w','acm-w-sigai','gdg','atmos-forum','iei')) OR
    (club_slug = 'cultural-events' AND forum_slug IN ('samskruthi','philanto','nrityastra','literaria-clava','artista','talantia','dhriti','suswara')) OR
    (club_slug = 'outreach-events' AND forum_slug IN ('rotaract-club','nss','street-cause','environmental-club','energy-swaraj','nirmaan')) OR
    (club_slug = 'innovation-incubation-cell' AND forum_slug = 'innovation-incubation-cell') OR
    (club_slug = 'research-development-cell' AND forum_slug = 'research-development-cell') OR
    (club_slug = 'women-protection-abhaya' AND forum_slug = 'women-protection-abhaya')
  )
);
GRANT ALL ON public.student_forum_events TO service_role;
ALTER TABLE public.student_forum_events ENABLE ROW LEVEL SECURITY;
CREATE INDEX student_forum_events_browse_idx ON public.student_forum_events (club_slug, forum_slug, created_at DESC);
CREATE POLICY "Only service-side admin access" ON public.student_forum_events FOR ALL TO anon, authenticated USING (false) WITH CHECK (false);
CREATE POLICY "Service role can access event submissions" ON public.student_forum_events FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY "Open event file uploads" ON storage.objects FOR INSERT TO anon, authenticated WITH CHECK (bucket_id = 'student-forum-files' AND name LIKE 'submissions/%');