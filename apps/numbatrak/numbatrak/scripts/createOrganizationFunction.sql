-- Function to create an organization and add the creator as Owner
-- This uses SECURITY DEFINER to bypass RLS issues during creation
-- This ensures the organization is created and the user is added as Owner atomically

CREATE OR REPLACE FUNCTION create_organization_with_owner(
  p_name TEXT
)
RETURNS TABLE(
  id UUID,
  name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Ensure the function can insert even when RLS policies are strict/complex.
  -- The function itself is SECURITY DEFINER and is intended for organization creation.
  SET row_security = off;

  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;
  
  -- Create the organization
  INSERT INTO organizations (name)
  VALUES (p_name)
  RETURNING organizations.id INTO v_org_id;
  
  -- Add creator as Owner
  INSERT INTO organization_members (organization_id, user_id, role)
  VALUES (v_org_id, v_user_id, 'Owner');
  
  -- Return the created organization
  RETURN QUERY
  SELECT 
    o.id,
    o.name,
    o.created_at,
    o.updated_at
  FROM organizations o
  WHERE o.id = v_org_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_organization_with_owner(TEXT) TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_organization_with_owner(TEXT) IS 
  'Creates a new organization and adds the creator as Owner. Bypasses RLS to ensure atomic creation.';




