import { useEffect, useRef, useState } from "react";
import {
  Camera,
  KeyRound,
  Loader2,
  Phone,
  Save,
  UserCircle,
} from "lucide-react";
import { useSupabaseAuth } from "../../auth/SupabaseAuthProvider";
import {
  updateUserProfile,
  uploadUserAvatar,
  formatProfileError,
} from "../../services/userProfile";
import { updatePassword } from "../../services/authRecovery";
import {
  composeFullName,
  getDisplayName,
  splitFullName,
} from "../../utils/userDisplay";
import {
  DEFAULT_TIMEZONE,
  TIMEZONE_OPTIONS,
} from "../../constants/profileOptions";
import { PageLayout } from "../layout/PageLayout";
import { UserAvatar } from "./UserAvatar";

export function ProfilePage() {
  const { user, userProfile, refreshProfile } = useSupabaseAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [timezone, setTimezone] = useState(DEFAULT_TIMEZONE);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!userProfile) return;
    const { firstName: first, lastName: last } = splitFullName(
      userProfile.full_name
    );
    setFirstName(first);
    setLastName(last);
    setPhone(userProfile.phone ?? "");
    setWhatsapp(userProfile.whatsapp_number ?? "");
    setTimezone(userProfile.timezone ?? DEFAULT_TIMEZONE);
  }, [userProfile]);

  const displayName = getDisplayName(
    userProfile ?? { email: user?.email ?? null },
    "Add your name"
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;

    const fullName = composeFullName(firstName, lastName);
    if (!fullName.trim()) {
      setError("Please enter at least a first name.");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);
      await updateUserProfile(user.id, {
        full_name: fullName,
        phone: phone.trim() || null,
        whatsapp_number: whatsapp.trim() || null,
        timezone,
      });
      await refreshProfile();
      setSuccess("Profile updated successfully.");
    } catch (err: unknown) {
      setError(formatProfileError(err));
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSavingPassword(true);
      setError(null);
      setSuccess(null);
      const result = await updatePassword(newPassword);
      if (!result.success) {
        setError(result.error ?? "Failed to update password.");
        return;
      }
      setNewPassword("");
      setConfirmPassword("");
      setSuccess("Password updated successfully.");
    } catch (err: unknown) {
      setError(formatProfileError(err));
    } finally {
      setSavingPassword(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    try {
      setUploadingAvatar(true);
      setError(null);
      setSuccess(null);
      await uploadUserAvatar(user.id, file);
      await refreshProfile();
      setSuccess("Profile picture updated.");
    } catch (err: unknown) {
      setError(formatProfileError(err));
    } finally {
      setUploadingAvatar(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <PageLayout>
      <div className="max-w-2xl mx-auto w-full space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your name, contact details, timezone, and password. Business
            logo and currency are managed in Organization Settings.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground">
            {success}
          </div>
        )}

        <div className="rounded-xl border border-border bg-card p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className="relative shrink-0">
              <UserAvatar profile={userProfile ?? undefined} size={80} />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute -bottom-1 -right-1 p-2 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors disabled:opacity-60"
                title="Change profile picture"
              >
                {uploadingAvatar ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={handleAvatarChange}
              />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-semibold text-foreground truncate">
                {displayName}
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {userProfile?.email ?? user?.email ?? ""}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label htmlFor="firstName" className="text-sm font-medium">
                  First name
                </label>
                <input
                  id="firstName"
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First name"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="lastName" className="text-sm font-medium">
                  Last name
                </label>
                <input
                  id="lastName"
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last name"
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label
                  htmlFor="phone"
                  className="text-sm font-medium flex items-center gap-1.5"
                >
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  Phone
                </label>
                <input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="whatsapp" className="text-sm font-medium">
                  WhatsApp
                </label>
                <input
                  id="whatsapp"
                  type="tel"
                  value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)}
                  placeholder="+234..."
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="timezone" className="text-sm font-medium">
                Timezone
              </label>
              <select
                id="timezone"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
              >
                {TIMEZONE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="email"
                className="text-sm font-medium flex items-center gap-1.5"
              >
                <UserCircle className="w-4 h-4 text-muted-foreground" />
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={userProfile?.email ?? user?.email ?? ""}
                disabled
                className="w-full px-3 py-2 rounded-md border border-border bg-muted text-muted-foreground text-sm cursor-not-allowed"
              />
              <p className="text-xs text-muted-foreground">
                Contact support if you need to change your email address.
              </p>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save changes
            </button>
          </form>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">
              Change password
            </h2>
          </div>
          <form onSubmit={handlePasswordChange} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="newPassword" className="text-sm font-medium">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                minLength={8}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="confirmPassword" className="text-sm font-medium">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={8}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm"
                autoComplete="new-password"
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword || !newPassword || !confirmPassword}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border bg-background text-sm font-medium hover:bg-muted disabled:opacity-60"
            >
              {savingPassword ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <KeyRound className="w-4 h-4" />
              )}
              Update password
            </button>
          </form>
        </div>
      </div>
    </PageLayout>
  );
}
