import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { adPlatforms } from "../../constants/platforms";
import { Form } from "../../types/form";
import { MediaBuyer, TrackingLink, UpdateTrackingLinkInput, trackingLinksApi } from "../../services/trackingLinks";
import { normalizePageUrl, previewLink } from "./linkPreview";

// Radix Select can't hold an empty-string value, so "whole form" needs a sentinel.
const WHOLE_FORM = "__whole_form__";

interface Props {
  link: TrackingLink | null;
  forms: Form[];
  buyers: MediaBuyer[];
  onClose: () => void;
  onSaved: (link: TrackingLink) => void;
}

/**
 * Edits everything about a link except its form and code: both are already
 * baked into live ads, so changing them would silently break those ads.
 * Only changed fields are sent, so an untouched retired buyer stays put.
 */
export function EditTrackingLinkDialog({ link, forms, buyers, onClose, onSaved }: Props) {
  const [offerId, setOfferId] = useState(WHOLE_FORM);
  const [platform, setPlatform] = useState("");
  const [mediaBuyerId, setMediaBuyerId] = useState("");
  const [label, setLabel] = useState("");
  const [pageUrl, setPageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!link) return;
    setOfferId(link.offerId ?? WHOLE_FORM);
    setPlatform(link.platform);
    setMediaBuyerId(link.mediaBuyerId ?? "");
    setLabel(link.label ?? "");
    setPageUrl(link.pageUrl ?? "");
    setError(null);
  }, [link]);

  const form = useMemo(() => forms.find((f) => f.id === link?.formId) ?? null, [forms, link]);
  const offerOptions = useMemo(
    () =>
      (form?.schema.fields ?? [])
        .filter((f) => f.type === "radio-group" && f.radioOptions)
        .flatMap((f) => f.radioOptions ?? []),
    [form],
  );
  // Keep an offer that was since removed from the form selectable, so opening
  // the dialog doesn't quietly turn the link into a whole-form link.
  const offerChoices = useMemo(() => {
    if (link?.offerId && !offerOptions.some((o) => o.id === link.offerId)) {
      return [...offerOptions, { id: link.offerId, title: link.offerLabel ?? "Removed offer" }];
    }
    return offerOptions;
  }, [offerOptions, link]);
  // Active buyers, plus the link's current one even if retired.
  const buyerChoices = useMemo(
    () => buyers.filter((b) => b.active || b.id === link?.mediaBuyerId),
    [buyers, link],
  );

  if (!link) return null;

  const selectedOffer = offerChoices.find((o) => o.id === offerId) ?? null;
  const selectedBuyer = buyers.find((b) => b.id === mediaBuyerId) ?? null;
  const pageUrlInvalid = pageUrl.trim() !== "" && normalizePageUrl(pageUrl) === null;
  const effectivePage = pageUrl.trim() || form?.site_url || "";
  const preview = previewLink(effectivePage, {
    code: link.code,
    platform,
    campaign: selectedOffer?.title ?? form?.name ?? link.formName ?? "",
    buyer: selectedBuyer?.name ?? link.mediaBuyerName,
  });

  const changes: UpdateTrackingLinkInput = {};
  const nextOfferId = offerId === WHOLE_FORM ? null : offerId;
  if (nextOfferId !== link.offerId) {
    changes.offerId = nextOfferId;
    changes.offerLabel = selectedOffer?.title ?? null;
  }
  if (platform !== link.platform) changes.platform = platform;
  if (mediaBuyerId && mediaBuyerId !== link.mediaBuyerId) changes.mediaBuyerId = mediaBuyerId;
  if ((label.trim() || null) !== link.label) changes.label = label.trim() || null;
  const nextPageUrl = normalizePageUrl(pageUrl);
  if (!pageUrlInvalid && nextPageUrl !== link.pageUrl) changes.pageUrl = nextPageUrl;
  const hasChanges = Object.keys(changes).length > 0;
  const changesAttribution =
    changes.offerId !== undefined || changes.platform !== undefined || changes.mediaBuyerId !== undefined;

  const handleSave = async () => {
    if (pageUrlInvalid) {
      setError("Page URL doesn't look like a web address (e.g. shop.com/product-page).");
      return;
    }
    if (!platform) {
      setError("Pick a platform.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await trackingLinksApi.update(link.id, changes));
    } catch (err: any) {
      setError(err.message || "Failed to save tracking link.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg bg-card border border-border">
        <DialogHeader>
          <DialogTitle>Edit tracking link</DialogTitle>
          <DialogDescription>
            {link.formName ?? "Form"} · <code>{link.code}</code>. The form and code can't change because they're
            already in live ads. Make a new link instead.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="etl-offer">Offer/package</Label>
            <Select value={offerId} onValueChange={setOfferId} disabled={offerChoices.length === 0}>
              <SelectTrigger id="etl-offer" className="w-full">
                <SelectValue placeholder="Whole form" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={WHOLE_FORM}>Whole form</SelectItem>
                {offerChoices.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="etl-platform">Platform</Label>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger id="etl-platform" className="w-full">
                  <SelectValue placeholder="Select platform" />
                </SelectTrigger>
                <SelectContent>
                  {/* Keep a platform no longer in the list selectable. */}
                  {[...new Set([...adPlatforms, link.platform])].map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="etl-buyer">Media buyer</Label>
              <Select value={mediaBuyerId} onValueChange={setMediaBuyerId}>
                <SelectTrigger id="etl-buyer" className="w-full">
                  <SelectValue placeholder={link.mediaBuyerName} />
                </SelectTrigger>
                <SelectContent>
                  {buyerChoices.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                      {b.active ? "" : " (retired)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etl-label">Label (optional)</Label>
            <Input id="etl-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="etl-page">Page URL</Label>
            <Input
              id="etl-page"
              value={pageUrl}
              onChange={(e) => setPageUrl(e.target.value)}
              placeholder={form?.site_url ?? "e.g. toheebyusuf.com/sink-flusher"}
              autoComplete="off"
              spellCheck={false}
              aria-invalid={pageUrlInvalid}
            />
            {pageUrlInvalid ? (
              <p className="text-xs text-destructive">Enter the page address, e.g. shop.com/product-page.</p>
            ) : preview ? (
              <p className="text-xs text-muted-foreground break-all">
                Ad link: <code>{preview}</code>
              </p>
            ) : null}
          </div>

          {changesAttribution && link.orderCount > 0 && (
            <p className="text-xs text-muted-foreground">
              The {link.orderCount} order{link.orderCount === 1 ? "" : "s"} already on this link keep the platform,
              buyer and offer they came in with. Only new orders use the change.
            </p>
          )}
          {changes.pageUrl !== undefined && (
            <p className="text-xs text-muted-foreground">
              Ads already running keep their old address. Paste the new link into them if the page moved.
            </p>
          )}
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
