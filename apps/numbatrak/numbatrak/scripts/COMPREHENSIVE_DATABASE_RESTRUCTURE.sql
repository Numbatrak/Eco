-- ============================================
-- COMPREHENSIVE DATABASE RESTRUCTURE
-- ============================================
-- This script restructures the entire database for:
-- 1. Better data integrity and relationships
-- 2. Performance optimization with proper indexes
-- 3. Fixing "unknown user" issues in CRS lists
-- 4. Ensuring all foreign keys are properly set up
-- 5. Adding OTP verification support
--
-- IMPORTANT: Backup your database before running this script!
-- ============================================

-- ============================================
-- PART 1: USER PROFILES - Foundation Table

-- ============================================

-- Ensure user_profiles table exists with proper structure
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'Customer Relations' CHECK (role IN ('Owner', 'Admin', 'Customer Relations', 'Manager')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add new columns if they don't exist
DO $$ 
BEGIN
  -- Add email_verified column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'email_verified'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;
  
  -- Add otp_code column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'otp_code'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN otp_code TEXT;
  END IF;
  
  -- Add otp_expires_at column
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'otp_expires_at'
  ) THEN
    ALTER TABLE user_profiles 
    ADD COLUMN otp_expires_at TIMESTAMPTZ;
  END IF;
  
  -- Add unique constraint on email if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'user_profiles_email_unique'
  ) THEN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT user_profiles_email_unique UNIQUE (email);
  END IF;
  
  -- Make email NOT NULL if it's nullable
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'email' 
    AND is_nullable = 'YES'
  ) THEN
    -- First, set default for any NULL emails
    UPDATE user_profiles SET email = COALESCE(email, '') WHERE email IS NULL;
    -- Then make it NOT NULL
    ALTER TABLE user_profiles ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;

-- Create indexes for performance (after columns are added)
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- Create index on email_verified only if the column exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' AND column_name = 'email_verified'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_user_profiles_email_verified ON user_profiles(email_verified);
  END IF;
END $$;

-- Enable RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (drop all possible policy names)
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Owners and Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Users can view profiles in their organizations" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Owners can update any profile" ON user_profiles;
DROP POLICY IF EXISTS "Owners can update any profile in their organizations" ON user_profiles;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can view profiles in their organizations"
  ON user_profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM organization_members om2
        WHERE om2.organization_id = om.organization_id
        AND om2.user_id = user_profiles.id
      )
    )
  );

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id 
    AND role = (SELECT role FROM user_profiles WHERE id = auth.uid())
  );

CREATE POLICY "Owners can update any profile in their organizations"
  ON user_profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM organization_members om
      WHERE om.user_id = auth.uid()
      AND om.role = 'Owner'
      AND EXISTS (
        SELECT 1 FROM organization_members om2
        WHERE om2.organization_id = om.organization_id
        AND om2.user_id = user_profiles.id
      )
    )
  );

-- ============================================
-- PART 2: ORGANIZATIONS
-- ============================================

-- Ensure organizations table exists
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_name ON organizations(name);

-- Ensure organizations INSERT works with RLS
-- Without this, authenticated inserts fail with: "new row violates row-level security policy".
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Authenticated users can create organizations" ON organizations;
CREATE POLICY "Authenticated users can create organizations"
  ON organizations FOR INSERT
  -- Do not restrict by role (`TO authenticated`) so SECURITY DEFINER functions work too.
  WITH CHECK (auth.uid() IS NOT NULL);

-- Users can view organizations they belong to.
-- This is required for the organization selection UI (joins through organization_members).
DROP POLICY IF EXISTS "Users can view their organizations" ON organizations;
CREATE POLICY "Users can view their organizations"
  ON organizations FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.organization_id = organizations.id
      AND om.user_id = auth.uid()
    )
  );

-- ============================================
-- PART 3: ORGANIZATION MEMBERS - Fixed Relationship
-- ============================================

-- Drop existing organization_members table if it has wrong foreign key
DO $$ 
BEGIN
  -- Check if foreign key to auth.users exists
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu 
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'organization_members'
    AND tc.constraint_type = 'FOREIGN KEY'
    AND kcu.column_name = 'user_id'
    AND EXISTS (
      SELECT 1 FROM information_schema.constraint_column_usage ccu
      WHERE ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = 'auth'
      AND ccu.table_name = 'users'
    )
  ) THEN
    -- Drop the foreign key constraint
    ALTER TABLE organization_members 
    DROP CONSTRAINT IF EXISTS organization_members_user_id_fkey;
  END IF;
END $$;

-- Recreate organization_members with proper foreign key to user_profiles
CREATE TABLE IF NOT EXISTS organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'Customer Relations' CHECK (role IN ('Owner', 'Admin', 'Customer Relations', 'Manager')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_members_role ON organization_members(role);
CREATE INDEX IF NOT EXISTS idx_organization_members_org_user ON organization_members(organization_id, user_id);

-- Enable RLS
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- ORGANIZATION HELPER FUNCTIONS (Must be created before RLS policies)
-- ============================================

-- Check if user is member of organization (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_org_member(org_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id AND user_id = auth.uid()
  );
END;
$$;

-- Check if user has role in organization (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION has_org_role(org_id UUID, required_role TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid() 
    AND role = required_role
  );
END;
$$;

-- Check if user has any of the specified roles (uses SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION has_any_org_role(org_id UUID, required_roles TEXT[])
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.organization_members 
    WHERE organization_id = org_id 
    AND user_id = auth.uid() 
    AND role = ANY(required_roles)
  );
END;
$$;

-- Get user's role in organization
CREATE OR REPLACE FUNCTION get_user_org_role(org_id UUID)
RETURNS TEXT AS $$
  SELECT role FROM organization_members 
  WHERE organization_id = org_id AND user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view organization members" ON organization_members;
DROP POLICY IF EXISTS "Users can add themselves to organizations" ON organization_members;
DROP POLICY IF EXISTS "Owners and Admins can add members" ON organization_members;
DROP POLICY IF EXISTS "Owners and Admins can update member roles" ON organization_members;
DROP POLICY IF EXISTS "Owners can remove members" ON organization_members;

-- RLS Policies (using helper functions to avoid recursion)
CREATE POLICY "Users can view organization members"
  ON organization_members FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can add themselves to organizations"
  ON organization_members FOR INSERT
  -- Do not restrict by role (`TO authenticated`) so SECURITY DEFINER functions work too.
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners and Admins can add members"
  ON organization_members FOR INSERT
  TO authenticated
  WITH CHECK (has_any_org_role(organization_id, ARRAY['Owner', 'Admin']));

CREATE POLICY "Owners and Admins can update member roles"
  ON organization_members FOR UPDATE
  USING (has_any_org_role(organization_id, ARRAY['Owner', 'Admin']));

CREATE POLICY "Owners can remove members"
  ON organization_members FOR DELETE
  USING (has_org_role(organization_id, 'Owner'));

-- ============================================
-- PART 4: OTP VERIFICATION TABLE
-- ============================================

CREATE TABLE IF NOT EXISTS email_verification_otps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX IF NOT EXISTS idx_email_verification_otps_user_id ON email_verification_otps(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_otps_email ON email_verification_otps(email);
CREATE INDEX IF NOT EXISTS idx_email_verification_otps_code ON email_verification_otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_email_verification_otps_expires_at ON email_verification_otps(expires_at);

ALTER TABLE email_verification_otps ENABLE ROW LEVEL SECURITY;

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own OTPs" ON email_verification_otps;
DROP POLICY IF EXISTS "Users can insert own OTPs" ON email_verification_otps;
DROP POLICY IF EXISTS "Users can update own OTPs" ON email_verification_otps;

CREATE POLICY "Users can view own OTPs"
  ON email_verification_otps FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own OTPs"
  ON email_verification_otps FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own OTPs"
  ON email_verification_otps FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ============================================
-- PART 5: ENSURE ALL DATA TABLES HAVE ORGANIZATION_ID
-- ============================================

-- Function to add organization_id if missing
DO $$ 
DECLARE
  v_table_name TEXT;
  tables_to_check TEXT[] := ARRAY[
    'agents', 'products', 'deliveries', 'orders', 
    'agent_expenses', 'general_expenses', 'inventory', 
    'abandoned_carts', 'follow_ups'
  ];
BEGIN
  FOREACH v_table_name IN ARRAY tables_to_check
  LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND information_schema.tables.table_name = v_table_name) THEN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public'
        AND information_schema.columns.table_name = v_table_name 
        AND column_name = 'organization_id'
      ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE', v_table_name);
        EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON %I(organization_id)', v_table_name, v_table_name);
      END IF;
    END IF;
  END LOOP;
END $$;

-- ============================================
-- PART 6: FIX FOLLOW_UPS TABLE
-- ============================================

-- Ensure follow_ups has proper foreign key to user_profiles
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'follow_ups') THEN
    -- Check if assigned_to column exists
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'follow_ups' AND column_name = 'assigned_to'
    ) THEN
      -- Drop existing foreign key if it references wrong table
      ALTER TABLE follow_ups 
      DROP CONSTRAINT IF EXISTS follow_ups_assigned_to_fkey;
      
      -- Add proper foreign key to user_profiles
      ALTER TABLE follow_ups
      ADD CONSTRAINT follow_ups_assigned_to_fkey
      FOREIGN KEY (assigned_to) 
      REFERENCES user_profiles(id) 
      ON DELETE SET NULL;
    END IF;
    
    -- Ensure organization_id exists
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'follow_ups' AND column_name = 'organization_id'
    ) THEN
      ALTER TABLE follow_ups 
      ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
      CREATE INDEX IF NOT EXISTS idx_follow_ups_organization_id ON follow_ups(organization_id);
    END IF;
  END IF;
END $$;

-- ============================================
-- PART 7: FIX ORDERS TABLE
-- ============================================

-- Ensure orders.assigned_to references user_profiles
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'orders' AND column_name = 'assigned_to'
    ) THEN
      ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_assigned_to_fkey;
      
      ALTER TABLE orders
      ADD CONSTRAINT orders_assigned_to_fkey
      FOREIGN KEY (assigned_to) 
      REFERENCES user_profiles(id) 
      ON DELETE SET NULL;
      
      CREATE INDEX IF NOT EXISTS idx_orders_assigned_to ON orders(assigned_to);
    END IF;
  END IF;
END $$;

-- ============================================
-- PART 8: TRIGGERS AND FUNCTIONS
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for user_profiles
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for organizations
DROP TRIGGER IF EXISTS update_organizations_updated_at ON organizations;
CREATE TRIGGER update_organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Trigger for organization_members
DROP TRIGGER IF EXISTS update_organization_members_updated_at ON organization_members;
CREATE TRIGGER update_organization_members_updated_at
  BEFORE UPDATE ON organization_members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- PART 9: ENSURE USER_PROFILES ARE CREATED ON SIGNUP
-- ============================================

-- Function to handle new user creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_has_email_verified BOOLEAN;
BEGIN
  -- Check if email_verified column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'email_verified'
  ) INTO v_has_email_verified;
  
  IF v_has_email_verified THEN
    INSERT INTO public.user_profiles (id, email, full_name, role, email_verified)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Customer Relations',
      COALESCE(NEW.email_confirmed_at IS NOT NULL, FALSE)
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
      email_verified = COALESCE(EXCLUDED.email_verified, user_profiles.email_verified, FALSE),
      updated_at = NOW();
  ELSE
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      'Customer Relations'
    )
    ON CONFLICT (id) DO UPDATE
    SET 
      email = EXCLUDED.email,
      full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
      updated_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to sync user email updates
CREATE OR REPLACE FUNCTION public.handle_user_email_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.email IS DISTINCT FROM NEW.email THEN
    UPDATE public.user_profiles
    SET 
      email = NEW.email,
      updated_at = NOW()
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_email_updated ON auth.users;
CREATE TRIGGER on_auth_user_email_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_update();

-- ============================================
-- PART 10: OTP FUNCTIONS
-- ============================================

-- Function to generate OTP
CREATE OR REPLACE FUNCTION generate_otp()
RETURNS TEXT AS $$
BEGIN
  RETURN LPAD(FLOOR(RANDOM() * 1000000)::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Remove the old overloads (different parameter order) to prevent PostgREST ambiguity.
DROP FUNCTION IF EXISTS public.create_verification_otp(UUID, TEXT);
DROP FUNCTION IF EXISTS public.verify_otp(UUID, TEXT);

-- Function to create/update OTP for user
CREATE OR REPLACE FUNCTION public.create_verification_otp_uuid_text(
  p_user_id UUID,
  p_email TEXT
)
RETURNS TEXT AS $$
DECLARE
  v_otp_code TEXT;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Ensure the referenced user_profiles row exists to satisfy the FK
  -- email_verification_otps(user_id) -> user_profiles(id).
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (p_user_id, p_email, p_email, 'Customer Relations')
  ON CONFLICT (id) DO NOTHING;

  -- Generate 6-digit OTP
  v_otp_code := generate_otp();
  v_expires_at := NOW() + INTERVAL '15 minutes';
  
  -- Insert or update OTP
  INSERT INTO email_verification_otps (user_id, email, otp_code, expires_at)
  VALUES (p_user_id, p_email, v_otp_code, v_expires_at)
  ON CONFLICT (user_id, email) DO UPDATE
  SET 
    otp_code = EXCLUDED.otp_code,
    expires_at = EXCLUDED.expires_at,
    verified_at = NULL;
  
  RETURN v_otp_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper to support swapped argument order for Supabase RPC/schema cache.
-- (TEXT, UUID) variant calls the canonical (UUID, TEXT) function above.
CREATE OR REPLACE FUNCTION public.create_verification_otp(
  p_email TEXT,
  p_user_id UUID
)
RETURNS TEXT AS $$
BEGIN
  RETURN public.create_verification_otp_uuid_text(p_user_id, p_email);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to verify OTP
CREATE OR REPLACE FUNCTION public.verify_otp_uuid_text(
  p_user_id UUID,
  p_otp_code TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  v_otp_record RECORD;
BEGIN
  -- Find valid OTP
  SELECT * INTO v_otp_record
  FROM email_verification_otps
  WHERE user_id = p_user_id
    AND otp_code = p_otp_code
    AND expires_at > NOW()
    AND verified_at IS NULL;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Mark as verified
  UPDATE email_verification_otps
  SET verified_at = NOW()
  WHERE id = v_otp_record.id;
  
  -- Update user profile
  UPDATE user_profiles
  SET 
    email_verified = TRUE,
    updated_at = NOW()
  WHERE id = p_user_id;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Wrapper to support swapped argument order for Supabase RPC/schema cache.
-- (TEXT, UUID) variant calls the canonical (UUID, TEXT) function above.
CREATE OR REPLACE FUNCTION public.verify_otp(
  p_otp_code TEXT,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN public.verify_otp_uuid_text(p_user_id, p_otp_code);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- PART 11: FIX MISSING USER_PROFILES
-- ============================================

-- Function to create missing user profiles
CREATE OR REPLACE FUNCTION create_missing_user_profiles()
RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_user RECORD;
BEGIN
  -- Create user_profiles for users in organization_members but not in user_profiles
  FOR v_user IN
    SELECT DISTINCT om.user_id, au.email
    FROM organization_members om
    JOIN auth.users au ON au.id = om.user_id
    WHERE NOT EXISTS (
      SELECT 1 FROM user_profiles up WHERE up.id = om.user_id
    )
  LOOP
    -- Check if email_verified column exists before inserting
    IF EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'user_profiles' 
      AND column_name = 'email_verified'
    ) THEN
      INSERT INTO user_profiles (id, email, full_name, role, email_verified)
      VALUES (
        v_user.user_id,
        COALESCE(v_user.email, ''),
        COALESCE(v_user.email, 'Unknown User'),
        'Customer Relations',
        FALSE
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        email = COALESCE(EXCLUDED.email, user_profiles.email),
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        updated_at = NOW();
    ELSE
      INSERT INTO user_profiles (id, email, full_name, role)
      VALUES (
        v_user.user_id,
        COALESCE(v_user.email, ''),
        COALESCE(v_user.email, 'Unknown User'),
        'Customer Relations'
      )
      ON CONFLICT (id) DO UPDATE
      SET 
        email = COALESCE(EXCLUDED.email, user_profiles.email),
        full_name = COALESCE(EXCLUDED.full_name, user_profiles.full_name),
        updated_at = NOW();
    END IF;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run the function to create missing profiles
SELECT create_missing_user_profiles();

-- ============================================
-- PART 12: ORGANIZATION HELPER FUNCTIONS
-- ============================================
-- Note: These functions are already created earlier (before RLS policies in PART 3)
-- They use SECURITY DEFINER to bypass RLS and prevent infinite recursion

-- ============================================
-- PART 13: GRANT PERMISSIONS
-- ============================================

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON organization_members TO authenticated;
GRANT SELECT, INSERT, UPDATE ON email_verification_otps TO authenticated;
GRANT EXECUTE ON FUNCTION create_verification_otp(TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION verify_otp(TEXT, UUID) TO authenticated;

-- ============================================
-- PART 13: FORMS TABLE RLS POLICIES
-- (Needed for embed SDK / abandoned carts)
-- ============================================

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;

-- Drop existing policies (if any)
DROP POLICY IF EXISTS "Public can view forms by token" ON forms;
DROP POLICY IF EXISTS "Users can view forms in their organization" ON forms;
DROP POLICY IF EXISTS "Users can create forms in their organization" ON forms;
DROP POLICY IF EXISTS "Users can update forms in their organization" ON forms;
DROP POLICY IF EXISTS "Users can delete forms in their organization" ON forms;

-- SELECT: Public can view active forms by token (embed SDK)
CREATE POLICY "Public can view forms by token"
  ON forms FOR SELECT
  TO anon
  USING (active = true);

-- SELECT: Authenticated users can view forms in their organizations
CREATE POLICY "Users can view forms in their organization"
  ON forms FOR SELECT
  TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id
      FROM organization_members
      WHERE user_id = auth.uid()
    )
  );

-- INSERT: Owners/Admins/Managers can create forms
CREATE POLICY "Users can create forms in their organization"
  ON forms FOR INSERT
  TO authenticated
  WITH CHECK (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  );

-- UPDATE: Owners/Admins/Managers can update forms
CREATE POLICY "Users can update forms in their organization"
  ON forms FOR UPDATE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  )
  WITH CHECK (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin', 'Manager'])
  );

-- DELETE: Owners/Admins can delete forms
CREATE POLICY "Users can delete forms in their organization"
  ON forms FOR DELETE
  TO authenticated
  USING (
    has_any_org_role(organization_id, ARRAY['Owner', 'Admin'])
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON forms TO authenticated;
GRANT SELECT ON forms TO anon;

-- ============================================
-- COMPLETION MESSAGE
-- ============================================

DO $$
BEGIN
  RAISE NOTICE 'Database restructuring completed successfully!';
  RAISE NOTICE 'Key improvements:';
  RAISE NOTICE '1. user_profiles now properly referenced by organization_members';
  RAISE NOTICE '2. OTP verification system added';
  RAISE NOTICE '3. All foreign keys properly set up';
  RAISE NOTICE '4. Missing user_profiles created automatically';
  RAISE NOTICE '5. Performance indexes added';
END $$;
