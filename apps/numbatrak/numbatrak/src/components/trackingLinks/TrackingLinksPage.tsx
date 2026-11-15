import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchForms } from "../../services/forms";
import { Form } from "../../types/form";
import { trackingLinksApi, TrackingLink, mediaBuyerListApi, MediaBuyer } from "../../services/trackingLinks";
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
import { Copy, Link2, Pencil, Plus, Users } from "lucide-react";
import { normalizePageUrl, previewCode, previewLink, CODE_PATTERN } from "./linkPreview";
import { EditTrackingLinkDialog } from "./EditTrackingLinkDialog";

// Radix Select can't hold an empty-string value, so "whole form" needs a sentinel.
const WHOLE_FORM = "__whole_form__";

/** What to paste into an ad: the full URL when we know the landing page, else just the param. */
function shareText(link: TrackingLink): string {
  return link.url ?? `?tl=${link.code}`;
}

export function TrackingLinksPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("trackingLinks", "canCreate");

  const [forms, setForms] = useState<Form[]>([]);
  const [links, setLinks] = useState<TrackingLink[]>([]);
  const [buyers, setBuyers] = useState<MediaBuyer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formId, setFormId] = useState("");
  const [offerId, setOfferId] = useState(WHOLE_FORM);
  const [platform, setPlatform] = useState("");
  const [mediaBuyerId, setMediaBuyerId] = useState("");
  const [label, setLabel] = useState("");
  const [code, setCode] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [editingLink, setEditingLink] = useState<TrackingLink | null>(null);

  const [newBuyerName, setNewBuyerName] = useState("");
  const [buyerError, setBuyerError] = useState<string | null>(null);
  const [savingBuyer, setSavingBuyer] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      const [formsResult, linksResult, buyersResult] = await Promise.all([
        fetchForms(currentOrganization.id),
        trackingLinksApi.list(),
        mediaBuyerListApi.list(),
      ]);
      setForms(formsResult);
      setLinks(linksResult.trackingLinks);
      setBuyers(buyersResult.mediaBuyers);
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

  const activeBuyers = useMemo(() => buyers.filter((b) => b.active), [buyers]);
  const selectedBuyer = useMemo(() => buyers.find((b) => b.id === mediaBuyerId) ?? null, [buyers, mediaBuyerId]);

  const selectedForm = useMemo(() => forms.find((f) => f.id === formId) ?? null, [forms, formId]);
  const offerOptions = useMemo(() => {
    if (!selectedForm) return [];
    return selectedForm.schema.fields
      .filter((f) => f.type === "radio-group" && f.radioOptions)
      .flatMap((f) => f.radioOptions ?? []);
  }, [selectedForm]);

  const derivedCode = previewCode([selectedBuyer?.name ?? "", platform, label]);
  const selectedOffer = offerOptions.find((o) => o.id === offerId) ?? null;
  const linkPreview = previewLink(pageUrl, {
    code: code.trim() || derivedCode,
    platform,
    campaign: selectedOffer?.title ?? selectedForm?.name ?? "",
    buyer: selectedBuyer?.name ?? "",
  });
  const pageUrlInvalid = pageUrl.trim() !== "" && normalizePageUrl(pageUrl) === null;

  const handleCreate = async () => {
    if (!formId || !platform || !mediaBuyerId) {
      setError("Form, platform, and media buyer are required.");
      return;
    }
    if (pageUrlInvalid) {
      setError("Page URL doesn't look like a web address (e.g. shop.com/product-page).");
      return;
    }
    const customCode = code.trim().toLowerCase();
    if (customCode && !CODE_PATTERN.test(customCode)) {
      setError("Code may only contain lowercase letters, numbers and single hyphens (e.g. adguys-tiktok).");
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
        mediaBuyerId,
        platform,
        label: label.trim() || null,
        pageUrl: normalizePageUrl(pageUrl),
        ...(customCode ? { code: customCode } : {}),
      });
      setLinks((prev) => [created, ...prev]);
      setFormId("");
      setOfferId(WHOLE_FORM);
      setPlatform("");
      setMediaBuyerId("");
      setLabel("");
      setCode("");
      setPageUrl("");
    } catch (err: any) {
      setError(err.message || "Failed to create tracking link.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddBuyer = async () => {
    const name = newBuyerName.trim();
    if (!name) return;
    setSavingBuyer(true);
    setBuyerError(null);
    try {
      const created = await mediaBuyerListApi.create(name);
      setBuyers((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBuyerName("");
    } catch (err: any) {
      setBuyerError(err.message || "Failed to add media buyer.");
    } finally {
      setSavingBuyer(false);
    }
  };

  const handleToggleBuyer = async (buyer: MediaBuyer) => {
    try {
      const updated = await mediaBuyerListApi.update(buyer.id, { active: !buyer.active });
      setBuyers((prev) => prev.map((b) => (b.id === buyer.id ? updated : b)));
      if (!updated.active && mediaBuyerId === buyer.id) setMediaBuyerId("");
    } catch (err) {
      console.error("Failed to update media buyer", err);
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
    await navigator.clipboard.writeText(shareText(link));
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
        One link per media buyer + platform + funnel (optionally one offer/package), so every order shows which
        platform, offer and media buyer it came from.
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {canManage && (
        <div className="rounded-[10px] border border-border bg-card p-4 space-y-3">
          <h2 className="text-sm font-semibold text-foreground">New tracking link</h2>
          {activeBuyers.length === 0 && (
            <p className="text-sm text-muted-foreground">Add a media buyer below before creating a link.</p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="tl-form">Form / funnel</Label>
              <Select
                value={formId}
                onValueChange={(v) => {
                  setFormId(v);
                  setOfferId(WHOLE_FORM);
                  // Start from the form's own site, unless a page was typed already.
                  const site = forms.find((f) => f.id === v)?.site_url;
                  if (site && !pageUrl.trim()) setPageUrl(site);
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
                  <SelectItem value={WHOLE_FORM}>Whole form</SelectItem>
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
              <Select value={mediaBuyerId} onValueChange={setMediaBuyerId} disabled={activeBuyers.length === 0}>
                <SelectTrigger id="tl-buyer" className="w-full">
                  <SelectValue placeholder="Select media buyer" />
                </SelectTrigger>
                <SelectContent>
                  {activeBuyers.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            <div className="space-y-1.5">
              <Label htmlFor="tl-code">Code (optional)</Label>
              <Input
                id="tl-code"
                value={code}
                onChange={(e) => setCode(e.target.value.toLowerCase())}
                placeholder={derivedCode || "adguys-tiktok"}
                autoComplete="off"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                Goes in the ad URL as <code>?tl={code.trim() || derivedCode || "…"}</code>. Leave blank to use the
                suggested one.
              </p>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="tl-page">Page URL</Label>
            <Input
              id="tl-page"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder="e.g. toheebyusuf.com/sink-flusher"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={pageUrlInvalid}
            />
            {pageUrlInvalid ? (
              <p className="text-xs text-destructive">Enter the page address, e.g. shop.com/product-page.</p>
            ) : linkPreview ? (
              <p className="text-xs text-muted-foreground break-all">
                Ad link: <code>{linkPreview}</code>
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                The page the ad sends people to - the one with this form on it. We add the tracking tags for you.
              </p>
            )}
          </div>

          <Button type="button" onClick={handleCreate} disabled={saving || activeBuyers.length === 0}>
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
              <th className="p-3 font-medium">Code</th>
              <th className="p-3 font-medium">Orders</th>
              <th className="p-3 font-medium">Link</th>
              <th className="p-3 font-medium">Status</th>
              {canManage && <th className="p-3 font-medium sr-only">Edit</th>}
            </tr>
          </thead>
          <tbody>
            {links.length === 0 && (
              <tr>
                <td colSpan={canManage ? 10 : 9} className="p-6 text-center text-muted-foreground">
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
                <td className="p-3">
                  <code className="text-xs">{link.code}</code>
                </td>
                <td className="p-3">{link.orderCount}</td>
                <td className="p-3">
                  <button
                    type="button"
                    onClick={() => handleCopy(link)}
                    className="inline-flex items-center gap-1 text-primary hover:underline whitespace-nowrap"
                    title={link.url ? link.url : "No page URL on this link or its form - append this to the landing page URL"}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copiedId === link.id ? "Copied!" : link.url ? "Copy link" : "Copy ?tl= param"}
                  </button>
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
                {canManage && (
                  <td className="p-3">
                    <button
                      type="button"
                      onClick={() => setEditingLink(link)}
                      className="inline-flex items-center gap-1 text-primary hover:underline"
                      aria-label={`Edit tracking link ${link.code}`}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <EditTrackingLinkDialog
        link={editingLink}
        forms={forms}
        buyers={buyers}
        onClose={() => setEditingLink(null)}
        onSaved={(updated) => {
          setLinks((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
          setEditingLink(null);
        }}
      />

      <div className="rounded-[10px] border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Media buyers</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          The fixed list links pick from, so one buyer's results never split across spellings. Retired buyers keep
          their history but can't get new links.
        </p>
        {buyerError && <p className="text-sm text-destructive">{buyerError}</p>}
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Input
              aria-label="New media buyer name"
              value={newBuyerName}
              onChange={(e) => setNewBuyerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleAddBuyer();
              }}
              placeholder="e.g. AdGuys Agency"
              className="max-w-xs"
            />
            <Button type="button" variant="outline" onClick={handleAddBuyer} disabled={savingBuyer || !newBuyerName.trim()}>
              <Plus className="w-4 h-4 mr-1" />
              {savingBuyer ? "Adding…" : "Add buyer"}
            </Button>
          </div>
        )}
        {buyers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No media buyers yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {buyers.map((buyer) => (
              <li key={buyer.id} className="flex items-center justify-between py-2 text-sm">
                <span className={buyer.active ? "text-foreground" : "text-muted-foreground line-through"}>
                  {buyer.name}
                </span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => handleToggleBuyer(buyer)}
                    className="text-muted-foreground hover:underline"
                  >
                    {buyer.active ? "Retire" : "Reactivate"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageLayout>
  );
}
