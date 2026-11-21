CREATE TABLE public.admin_profiles (
  username text PRIMARY KEY CHECK (char_length(trim(username)) BETWEEN 1 AND 80),
  display_name text NOT NULL DEFAULT 'GNITS Student Council' CHECK (char_length(trim(display_name)) BETWEEN 1 AND 120),
  avatar_url text CHECK (avatar_url IS NULL OR char_length(avatar_url) <= 2048),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.admin_profiles TO service_role;
ALTER TABLE public.admin_profiles ENABLE ROW LEVEL SECURITY;