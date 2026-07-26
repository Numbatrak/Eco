-- Reliable self-service profile read/update (bypasses RLS edge cases on PATCH/SELECT)

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS avatar_url text;

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS public.user_profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.user_profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL
)
RETURNS public.user_profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.user_profiles;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  UPDATE public.user_profiles
  SET
    full_name = CASE
      WHEN p_full_name IS NOT NULL THEN NULLIF(TRIM(p_full_name), '')
      ELSE full_name
    END,
    avatar_url = COALESCE(p_avatar_url, avatar_url),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user' USING ERRCODE = 'P0002';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_my_profile(text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text) TO authenticated;

-- Simpler self-update policy (role cannot change via this path)
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;

CREATE POLICY "Users can update own profile"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND role IS NOT DISTINCT FROM (
      SELECT up.role
      FROM public.user_profiles up
      WHERE up.id = auth.uid()
    )
  );

NOTIFY pgrst, 'reload schema';
