import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchForms } from "../../services/forms";
import { Form } from "../../types/form";
import { trackingLinksApi, TrackingLink } from "../../services/trackingLinks";
import { adPlatforms } from "../../constants/platforms";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Copy, Link2, Plus } from "lucide-react";

export function TrackingLinksPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("trackingLinks", "canCreate");

  const [forms, setForms] = useState<Form[]>([]);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formId, setFormId] = useState("");
  const [offerId, setOfferId] = useState("");
  const [platform, setPlatform] = useState("");
  const [mediaBuyerName, setMediaBuyerName] = useState("");
  const [label, setLabel] = useState("");

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [formsResult, linksResult] = await Promise.all([
        fetchForms(currentOrganization.id),
        trackingLinksApi.list(),
      ]);
      setForms(formsResult);
      setLinks(linksResult.trackingLinks);
    } catch (err) {
      console.error("Failed to load tracking links", err);
      setError("Failed to load tracking links.");
    } finally {
      setLoading(false);
    }
  }, [currentOrganization]);

  useEffect(() => {
    void load();
  }, [load]);

  const knownMediaBuyerNames = useMemo(
    () => [...new Set(links.map((l) => l.mediaBuyerName.trim()).filter(Boolean))].sort(),
    [links]
  );

  const selectedForm = useMemo(() => forms.find((f) => f.id === formId) ?? null, [forms, formId]);
  const offerOptions = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.schema.fields
      .filter((f) => f.type === "radio-group" && f.radioOptions)
      .flatMap((f) => f.radioOptions ?? []);
  }, [selectedForm]);

  const handleCreate = async () => {
    if (!formId || !platform || !mediaBuyerName.trim()) {
      setError("Form, platform, and media buyer are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const offer = offerOptions.find((o) => o.id === offerId) ?? null;
      const created = await trackingLinksApi.create({
        formId,
        offerId: offer?.id ?? null,
        offerLabel: offer?.title ?? null,
        mediaBuyerName: mediaBuyerName.trim(),
        platform,
        label: label.trim() || null,
      });
      setLinks((prev) => [created, ...prev]);
      setFormId("");
      setOfferId("");
      setPlatform("");
      setMediaBuyerName("");
      setLabel("");
    } catch (err: any) {
      setError(err.message || "Failed to create tracking link.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (link: TrackingLink) => {
    try {
      const updated = await trackingLinksApi.update(link.id, { active: !link.active });
      setLinks((prev) => prev.map((l) => (l.id === link.id ? updated : l)));
    } catch (err) {
      console.error("Failed to update tracking link", err);
    }
  };

  const handleCopy = async (link: TrackingLink) => {
    if (!link.url) return;
    await navigator.clipboard.writeText(link.url);
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (loading) {
    return (
      <PageLayout>
        <p className="text-sm text-muted-foreground">Loading tracking links…</p>
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <div className="flex items-center gap-2">
        <Link2 className="w-5 h-5 text-muted-foreground" />
        <h1 className="text-lg font-semibold text-foreground">Tracking Links</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-4">
        Generate a link per media buyer + platform + funnel/offer to see which ads actually drive orders.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canManage && (
        <div className="rounded-[10px] border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">New tracking link</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl-form">Form / funnel</Label>
              <Select
                value={formId}
                onValueChange={(v) => {
                  setFormId(v);
                  setOfferId("");
                }}
              >
                <SelectTrigger id="tl-form" className="w-full">
                  <SelectValue placeholder="Select form" />
                </SelectTrigger>
                <SelectContent>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tl-offer">Offer/package (optional)</Label>
              <Select value={offerId} onValueChange={setOfferId} disabled={offerOptions.length === 0}>
                <SelectTrigger id="tl-offer" className="w-full">
                  <SelectValue placeholder="Whole form" />
                </SelectTrigger>
                <SelectContent>
                  {offerOptions.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tl-platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="tl-platform" className="w-full">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {adPlatforms.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tl-buyer">Media buyer</Label>
              <Input
                id="tl-buyer"
                value={mediaBuyerName}
                onChange={(e) => setMediaBuyerName(e.target.value)}
                placeholder="e.g. John"
                list="tl-buyer-suggestions"
                autoComplete="off"
              />
              {/* Suggests previously used names so "John"/"john"/"Jon" don't
                  silently fragment funnel-comparison data - still free text,
                  so a genuinely new buyer can still be typed. */}
              <datalist id="tl-buyer-suggestions">
                {knownMediaBuyerNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="tl-label">Label (optional)</Label>
              <Input
                id="tl-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g. Nov Black Friday test"
              />
            </div>
          </div>
          <Button type="button" onClick={handleCreate} disabled={saving}>
            <Plus className="w-4 h-4 mr-1" />
            {saving ? "Creating…" : "Create tracking link"}
          </Button>
        </div>
      )}

      <div className="rounded-[10px] border border-border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="p-3 font-medium">Form</th>
              <th className="p-3 font-medium">Offer</th>
              <th className="p-3 font-medium">Platform</th>
              <th className="p-3 font-medium">Media buyer</th>
              <th className="p-3 font-medium">Label</th>
              <th className="p-3 font-medium">Orders</th>
              <th className="p-3 font-medium">Link</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {links.length === 0 && (
              <tr>
                <td colSpan={8} className="p-6 text-center text-muted-foreground">
                  No tracking links yet.
                </td>
              </tr>
            )}
            {links.map((link) => (
              <tr key={link.id} className="border-b border-border last:border-0">
                <td className="p-3">{link.formName ?? "—"}</td>
                <td className="p-3">{link.offerLabel ?? "Whole form"}</td>
                <td className="p-3">{link.platform}</td>
                <td className="p-3">{link.mediaBuyerName}</td>
                <td className="p-3">{link.label ?? "—"}</td>
                <td className="p-3">{link.orderCount}</td>
                <td className="p-3">
                  {link.url ? (
                    <button
                      type="button"
                      onClick={() => handleCopy(link)}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      {copiedId === link.id ? "Copied!" : "Copy link"}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">Form has no site URL</span>
                  )}
                </td>
                <td className="p-3">
                  {canManage ? (
                    <button
                      type="button"
                      onClick={() => handleToggleActive(link)}
                      className={link.active ? "text-foreground hover:underline" : "text-muted-foreground hover:underline"}
                    >
                      {link.active ? "Active" : "Inactive"}
                    </button>
                  ) : (
                    <span>{link.active ? "Active" : "Inactive"}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </PageLayout>
  );
}
