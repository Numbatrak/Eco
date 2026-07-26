-- Existing org members predate OTP verification — do not lock them out.
UPDATE public.user_profiles up
SET
  email_verified = true,
  updated_at = NOW()
WHERE up.email_verified = false
  AND EXISTS (
    SELECT 1
    FROM public.organization_members om
    WHERE om.user_id = up.id
  );
