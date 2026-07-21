"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../supabaseClient";
import type { User, Session } from "@supabase/supabase-js";
import { UserProfile, UserRole } from "../types/user";
import { fetchUserProfile } from "../services/userProfile";
import { USER_PROFILE_BASE_COLUMNS } from "../services/userProfileColumns";
import { isInvalidRefreshTokenError } from "../utils/authErrors";

type SupabaseAuthContextValue = {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  profileLoaded: boolean;
  userProfile: UserProfile | null;
  userRole: UserRole | null;
  emailVerified: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const SupabaseAuthContext = createContext<SupabaseAuthContextValue | undefined>(
  undefined,
);

type Props = { children?: React.ReactNode };

export function SupabaseAuthProvider({ children }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [profileLoaded, setProfileLoaded] = useState(false);

  const loadUserProfile = async (userId: string | undefined) => {
    if (!userId) {
      setUserProfile(null);
      setProfileLoaded(true);
      return;
    }

    setProfileLoaded(false);
    try {
      const profile = await fetchUserProfile();
      setUserProfile(profile);

      // If profile doesn't exist, try to create it automatically
      if (!profile) {
        try {
          const {
            data: { user },
          } = await supabase.auth.getUser();
          if (user) {
            const { data, error } = await supabase
              .from("user_profiles")
              .insert([
                {
                  id: user.id,
                  email: user.email,
                  full_name: user.user_metadata?.full_name || null,
                  role: "Customer Relations",
                  email_verified: false,
                },
              ])
              .select(USER_PROFILE_BASE_COLUMNS)
              .single();

            if (!error && data) {
              setUserProfile({
                id: data.id,
                email: data.email,
                full_name: data.full_name,
                avatar_url: data.avatar_url ?? null,
                role: data.role as UserRole,
                email_verified: Boolean(data.email_verified),
                created_at: data.created_at,
                updated_at: data.updated_at,
              });
            }
          }
        } catch (createError) {
          console.warn("Could not auto-create user profile:", createError);
          // Don't block login if profile creation fails
        }
      }
    } catch (error) {
      console.error("Error loading user profile:", error);
      // Don't block login if profile fetch fails - user can still use the app
      setUserProfile(null);
    } finally {
      setProfileLoaded(true);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();

        // Handle invalid refresh token error
        if (
          error &&
          isInvalidRefreshTokenError(error)
        ) {
          console.warn("Invalid refresh token, clearing session:", error);
          await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setUserProfile(null);
        setProfileLoaded(true);
        setLoading(false);
        return;
        }

        setSession(data.session);
        setUser(data.session?.user ?? null);
        if (data.session?.user) {
          // Don't await - load profile in background
          loadUserProfile(data.session.user.id).catch(console.error);
        } else {
          setProfileLoaded(true);
        }
      } catch (error: any) {
        console.error("Error initializing auth:", error);
        // If it's a refresh token error, clear the session
        if (isInvalidRefreshTokenError(error)) {
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setUserProfile(null);
        }
      } finally {
        setLoading(false);
      }
    };
    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      // TOKEN_REFRESHED fires silently when switching tabs — do NOT trigger
      // a loading state for it, just quietly update the session reference.
      if (event === "TOKEN_REFRESHED") {
        if (!session) {
          console.warn("Token refresh failed, signing out");
          await supabase.auth.signOut();
          setSession(null);
          setUser(null);
          setUserProfile(null);
          setLoading(false);
        } else {
          // Silently update session without touching loading state.
          // This prevents the app from re-rendering the loading spinner
          // every time the user switches browser tabs.
          setSession(session);
          // Don't update `user` here — Supabase returns a new object
          // reference on every refresh, which would cascade re-renders
          // downstream (e.g. OrganizationContext refetching organisations).
        }
        return;
      }

      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        // Don't await - load profile in background
        loadUserProfile(session.user.id).catch(console.error);
      } else {
        setUserProfile(null);
        setProfileLoaded(true);
      }
      // Only set loading:false on real sign-in/sign-out, not on silent refreshes
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const refreshProfile = async () => {
    if (user?.id) {
      await loadUserProfile(user.id);
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserProfile(null);
    setProfileLoaded(true);
  };

  const emailVerified = userProfile?.email_verified === true;

  return (
    <SupabaseAuthContext.Provider
      value={{
        user,
        session,
        isAuthenticated: !!user,
        loading,
        profileLoaded,
        userProfile,
        userRole: userProfile?.role || null,
        emailVerified,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export function useSupabaseAuth() {
  const ctx = useContext(SupabaseAuthContext);
  if (!ctx)
    throw new Error("useSupabaseAuth must be used within SupabaseAuthProvider");
  return ctx;
}

