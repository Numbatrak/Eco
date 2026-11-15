import { apiRequest } from "../lib/apiClient";

/**
 * Hand-mirrored from @platform/shared-types's numbatrak.ts tracking-link
 * schemas (numbatrak can't import that package directly - see
 * services/storefrontSettings.ts for why).
 */

export interface TrackingLink {
  id: string;
  formId: string;
  formName: string | null;
  offerId: string | null;
  offerLabel: string | null;
  /** null only on links made before the buyer list existed. */
  mediaBuyerId: string | null;
  mediaBuyerName: string;
  platform: string;
  label: string | null;
  code: string;
  /** Landing page as entered; null = falls back to the form's site URL. */
  pageUrl: string | null;
  /** Ready-to-paste ad link: page + ?tl=<code> + UTM tags. */
  url: string | null;
  active: boolean;
  orderCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateTrackingLinkInput {
  formId: string;
  /** Narrows the link to one offer/package; omit for the whole form. */
  offerId?: string | null;
  offerLabel?: string | null;
  /** From the managed buyer list (mediaBuyerListApi). */
  mediaBuyerId: string;
  platform: string;
  label?: string | null;
  pageUrl?: string | null;
  /** Optional custom code ([a-z0-9-]); derived from buyer + platform when omitted. */
  code?: string;
}

export interface UpdateTrackingLinkInput {
  /** Another offer on the same form, or null for the whole form. */
  offerId?: string | null;
  offerLabel?: string | null;
  mediaBuyerId?: string;
  platform?: string;
  label?: string | null;
  pageUrl?: string | null;
  active?: boolean;
}

export interface ListTrackingLinksParams {
  formId?: string;
  active?: boolean;
}

function buildQuery(params: ListTrackingLinksParams): string {
  const search = new URLSearchParams();
  if (params.formId) search.set("formId", params.formId);
  if (params.active !== undefined) search.set("active", String(params.active));
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const trackingLinksApi = {
  list: (params: ListTrackingLinksParams = {}) =>
    apiRequest<{ trackingLinks: TrackingLink[] }>(`/org/numbatrak/tracking-links${buildQuery(params)}`, {
      method: "GET",
    }),

  create: (body: CreateTrackingLinkInput) =>
    apiRequest<TrackingLink>("/org/numbatrak/tracking-links", { method: "POST", body }),

  update: (trackingLinkId: string, body: UpdateTrackingLinkInput) =>
    apiRequest<TrackingLink>(`/org/numbatrak/tracking-links/${trackingLinkId}`, { method: "PATCH", body }),
};

/** The business's fixed list of media buyers - links pick from it. */
export interface MediaBuyer {
  id: string;
  name: string;
  active: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export const mediaBuyerListApi = {
  list: () => apiRequest<{ mediaBuyers: MediaBuyer[] }>("/org/numbatrak/media-buyer-list", { method: "GET" }),

  create: (name: string) =>
    apiRequest<MediaBuyer>("/org/numbatrak/media-buyer-list", { method: "POST", body: { name } }),

  update: (mediaBuyerId: string, body: { name?: string; active?: boolean }) =>
    apiRequest<MediaBuyer>(`/org/numbatrak/media-buyer-list/${mediaBuyerId}`, { method: "PATCH", body }),
};
