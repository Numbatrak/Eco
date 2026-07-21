# Database Restructure Summary

This document summarizes the comprehensive database restructuring performed to improve efficiency, speed, reliability, and fix the "unknown user" issue in CRS lists.

## Key Changes

### 1. Fixed User Profiles and Organization Members Relationship

**Problem**: Users in `organization_members` sometimes didn't have corresponding entries in `user_profiles`, causing "Unknown User" to appear in CRS lists.

**Solution**:
- Changed `organization_members.user_id` to reference `user_profiles(id)` instead of `auth.users(id)` directly
- Added automatic creation of `user_profiles` when users sign up via trigger
- Added function to create missing user profiles for existing data
- Added proper foreign key constraints to ensure data integrity

### 2. OTP-Based Email Verification

**Problem**: Email verification was using Supabase's default system.

**Solution**:
- Created `email_verification_otps` table to store OTP codes
- Added `email_verified` and OTP fields to `user_profiles`
- Created database functions: `create_verification_otp()` and `verify_otp()`
- Created email service (`src/services/emailVerification.ts`)
- Created email verification page (`src/components/EmailVerificationPage.tsx`)
- Created Supabase Edge Function for sending OTP emails
- Created email templates (HTML and text versions)

### 3. Database Schema Improvements

**Indexes Added**:
- `idx_user_profiles_email` - Fast email lookups
- `idx_user_profiles_role` - Fast role filtering
- `idx_user_profiles_email_verified` - Fast verification status checks
- `idx_organization_members_user_id` - Fast user lookups
- `idx_organization_members_org_id` - Fast organization lookups
- `idx_organization_members_role` - Fast role filtering
- `idx_email_verification_otps_user_id` - Fast OTP lookups
- `idx_email_verification_otps_code` - Fast OTP code verification

**Constraints Added**:
- Unique constraint on `user_profiles.email`
- Foreign key from `organization_members.user_id` to `user_profiles.id`
- Proper CASCADE deletes to maintain referential integrity

### 4. Data Integrity Improvements

**Triggers**:
- `on_auth_user_created` - Automatically creates `user_profiles` when user signs up
- `on_auth_user_email_updated` - Syncs email changes to `user_profiles`
- `update_updated_at_column` - Automatically updates `updated_at` timestamps

**Functions**:
- `create_missing_user_profiles()` - Creates missing profiles for existing data
- `create_verification_otp()` - Generates and stores OTP codes
- `verify_otp()` - Verifies OTP codes and marks email as verified
- `generate_otp()` - Generates 6-digit OTP codes

### 5. Query Improvements

**Updated Services**:
- `fetchCustomerRelationsUsers()` - Now filters out users without emails and provides fallback names
- `fetchCustomerRelationsLeaderboard()` - Handles missing user data gracefully
- `fetchOrganizationMembers()` - Always returns user object with fallback values
- `autoAssignFollowUp()` - Only considers users with valid profiles

**Key Changes**:
- All queries now filter out users without emails: `.not("email", "is", null)`
- All user displays now have fallbacks: `full_name || email || "Unknown User"`
- Organization member queries use proper joins to ensure user_profiles exist

### 6. Authentication Flow Updates

**Signup Process**:
1. User signs up with email and password
2. `user_profiles` is automatically created via trigger
3. OTP is generated and sent via email
4. User is redirected to verification page
5. User enters OTP to verify email
6. Email is marked as verified in `user_profiles`

**New Components**:
- `EmailVerificationPage.tsx` - OTP verification interface
- `emailVerification.ts` - OTP service functions
- `send-verification-email` Edge Function - Sends OTP emails

## Files Created/Modified

### Database Scripts
- `scripts/COMPREHENSIVE_DATABASE_RESTRUCTURE.sql` - Main restructuring script

### Email Templates
- `templates/email-verification-otp.html` - HTML email template
- `templates/email-verification-otp.txt` - Plain text email template

### Services
- `src/services/emailVerification.ts` - OTP verification service

### Components
- `src/components/EmailVerificationPage.tsx` - Email verification UI
- `src/components/SignupPage.tsx` - Updated to use OTP verification

### Edge Functions
- `supabase/functions/send-verification-email/index.ts` - Email sending function

### Updated Services
- `src/services/customerRelations.ts`
- `src/services/customerRelationsLeaderboard.ts`
- `src/services/organizations.ts`
- `src/services/followUps.ts`

### Updated Routes
- `src/App.tsx` - Added `/verify-email` route

## Migration Steps

1. **Run the Database Restructure Script**:
   ```sql
   -- Run scripts/COMPREHENSIVE_DATABASE_RESTRUCTURE.sql in Supabase SQL Editor
   ```

2. **Deploy Edge Function**:
   ```bash
   # Deploy the email sending function
   supabase functions deploy send-verification-email
   ```

3. **Configure Email Service**:
   - Set `RESEND_API_KEY` environment variable in Supabase Edge Functions
   - Or configure your preferred email service (SendGrid, AWS SES, etc.)

4. **Update Environment Variables** (if needed):
   - Ensure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set

## Benefits

1. **No More Unknown Users**: All users in organization_members now have valid user_profiles
2. **Better Data Integrity**: Foreign keys ensure referential integrity
3. **Improved Performance**: Indexes speed up common queries
4. **OTP Verification**: More secure and user-friendly email verification
5. **Better Error Handling**: Graceful fallbacks for missing data
6. **Automatic Data Sync**: Triggers keep user_profiles in sync with auth.users

## Testing Checklist

- [ ] Run database restructure script
- [ ] Verify user_profiles are created for all users
- [ ] Test signup flow with OTP verification
- [ ] Verify CRS user lists show proper names
- [ ] Test organization member displays
- [ ] Verify email sending works
- [ ] Test OTP expiration (15 minutes)
- [ ] Verify resend OTP functionality
- [ ] Check that missing user_profiles are created automatically

## Notes

- The OTP expires after 15 minutes
- Email service needs to be configured (Resend, SendGrid, etc.)
- The system automatically creates missing user_profiles
- All foreign keys use CASCADE deletes for data cleanup
- Indexes are optimized for common query patterns
