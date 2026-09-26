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
  mediaBuyerName: string;
  platform: string;
  label: string | null;
  code: string;
  url: string | null;
  active: boolean;
  orderCount: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface CreateTrackingLinkInput {
  formId: string;
  offerId?: string | null;
  offerLabel?: string | null;
  mediaBuyerName: string;
  platform: string;
  label?: string | null;
}

export interface UpdateTrackingLinkInput {
  mediaBuyerName?: string;
  platform?: string;
  label?: string | null;
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
