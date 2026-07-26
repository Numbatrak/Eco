-- §14 Auth & Profile stabilization
-- User contact/timezone fields, org branding (logo, timezone, currency), profile RPCs, org-logos bucket.

-- ---------------------------------------------------------------------------
-- User profile extensions
-- ---------------------------------------------------------------------------
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS whatsapp_number text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Lagos';

COMMENT ON COLUMN public.user_profiles.phone IS 'User contact phone (optional).';
COMMENT ON COLUMN public.user_profiles.whatsapp_number IS 'User WhatsApp number (optional).';
COMMENT ON COLUMN public.user_profiles.timezone IS 'IANA timezone for user display preferences.';

-- ---------------------------------------------------------------------------
-- Organization branding / locale
-- ---------------------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url text,
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Africa/Lagos',
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'NGN';

COMMENT ON COLUMN public.organizations.logo_url IS 'Business logo URL (org-logos storage bucket).';
COMMENT ON COLUMN public.organizations.timezone IS 'Business timezone for reports and scheduling.';
COMMENT ON COLUMN public.organizations.currency IS 'ISO 4217 currency code for monetary display.';

-- ---------------------------------------------------------------------------
-- Org logo storage
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'org-logos',
  'org-logos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "org_logos_public_read" ON storage.objects;
CREATE POLICY "org_logos_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'org-logos');

DROP POLICY IF EXISTS "org_logos_insert_admin" ON storage.objects;
CREATE POLICY "org_logos_insert_admin"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'org-logos'
    AND public.has_any_org_role(((storage.foldername(name))[1])::uuid, ARRAY['Owner', 'Admin'])
  );

DROP POLICY IF EXISTS "org_logos_update_admin" ON storage.objects;
CREATE POLICY "org_logos_update_admin"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND public.has_any_org_role(((storage.foldername(name))[1])::uuid, ARRAY['Owner', 'Admin'])
  )
  WITH CHECK (
    bucket_id = 'org-logos'
    AND public.has_any_org_role(((storage.foldername(name))[1])::uuid, ARRAY['Owner', 'Admin'])
  );

DROP POLICY IF EXISTS "org_logos_delete_admin" ON storage.objects;
CREATE POLICY "org_logos_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'org-logos'
    AND public.has_any_org_role(((storage.foldername(name))[1])::uuid, ARRAY['Owner', 'Admin'])
  );

-- ---------------------------------------------------------------------------
-- Profile RPCs (extended)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.update_my_profile(text, text);

CREATE OR REPLACE FUNCTION public.update_my_profile(
  p_full_name text DEFAULT NULL,
  p_avatar_url text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_whatsapp_number text DEFAULT NULL,
  p_timezone text DEFAULT NULL
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
    phone = CASE
      WHEN p_phone IS NOT NULL THEN NULLIF(TRIM(p_phone), '')
      ELSE phone
    END,
    whatsapp_number = CASE
      WHEN p_whatsapp_number IS NOT NULL THEN NULLIF(TRIM(p_whatsapp_number), '')
      ELSE whatsapp_number
    END,
    timezone = COALESCE(NULLIF(TRIM(p_timezone), ''), timezone),
    updated_at = NOW()
  WHERE id = auth.uid()
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found for current user' USING ERRCODE = 'P0002';
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.update_my_profile(text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_my_profile(text, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
