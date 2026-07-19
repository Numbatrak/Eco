"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../components/dashboard/AuthContext";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { AuthLayout } from "../../../components/dashboard/AuthLayout";
import { authApi } from "../../../lib/authApi";
import { ApiError } from "../../../lib/apiClient";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function CreateOrgForm(): React.ReactElement {
  const router = useRouter();
  const { refreshMe } = useAuth();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const effectiveSlug = slugTouched ? slug : slugify(name);

  async function onSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!name.trim() || !effectiveSlug.trim()) return;
    setError(null);
    setSubmitting(true);
    try {
      const org = await authApi.createOrganization(name.trim(), effectiveSlug.trim());
      await authApi.setActiveOrganization(org.id);
      await refreshMe();
      router.replace("/dashboard");
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout title="Create your store" subtitle="Set up your business to get started.">
      <form onSubmit={(e) => void onSubmit(e)} style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
        {error && <div className="form-error">{error}</div>}
        <div className="field">
          <label htmlFor="org-name" className="field-label">Business name</label>
          <input
            id="org-name"
            className="input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="field">
          <label htmlFor="org-slug" className="field-label">Subdomain</label>
          <input
            id="org-slug"
            className="input"
            type="text"
            value={effectiveSlug}
            onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }}
            required
          />
          <span className="field-hint">
            Your storefront will be at {effectiveSlug || "…"}.yourdomain.com
          </span>
        </div>
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting}>
          {submitting ? "Creating…" : "Create store"}
        </button>
      </form>
    </AuthLayout>
  );
}

export default function CreateOrgPage(): React.ReactElement {
  return (
    <RequireAuth>
      <CreateOrgForm />
    </RequireAuth>
  );
}
