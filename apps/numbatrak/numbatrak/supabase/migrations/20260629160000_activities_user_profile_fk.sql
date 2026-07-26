-- PostgREST needs a direct FK to user_profiles for:
--   .select('*, user:user_profiles(id, email, full_name)')
ALTER TABLE public.activities
  DROP CONSTRAINT IF EXISTS activities_user_id_fkey;

ALTER TABLE public.activities
  ADD CONSTRAINT activities_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;
