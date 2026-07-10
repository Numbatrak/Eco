import type {
  PlatformAdminTenantsQuery,
  PlatformAdminTenantsResponse,
  PlatformAdminTenantDetail,
  UpdateTenantPlanRequest,
  AdjustTenantCreditsRequest,
  MetricsOverviewQuery,
  MetricsOverviewResponse,
  ReservedSubdomain,
  AddReservedSubdomainRequest,
  FeatureFlag,
  UpdateFeatureFlagRequest,
  PlatformSetting,
  UpdatePlatformSettingRequest,
} from "@platform/shared-types";
import { apiRequest } from "../../lib/apiClient";

function toQueryString(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") {
      search.set(key, String(value));
    }
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export const platformAdminApi = {
  listTenants: (query: PlatformAdminTenantsQuery) =>
    apiRequest<PlatformAdminTenantsResponse>(`/platform-admin/tenants${toQueryString(query)}`, {
      method: "GET",
    }),

  getTenant: (tenantId: string) =>
    apiRequest<PlatformAdminTenantDetail>(`/platform-admin/tenants/${tenantId}`, { method: "GET" }),

  suspendTenant: (tenantId: string) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/suspend`, { method: "POST" }),

  reactivateTenant: (tenantId: string) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/reactivate`, { method: "POST" }),

  updateTenantPlan: (tenantId: string, body: UpdateTenantPlanRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/plan`, { method: "PATCH", body }),

  adjustTenantCredits: (tenantId: string, body: AdjustTenantCreditsRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/credits/adjust`, { method: "POST", body }),

  getMetricsOverview: (query: MetricsOverviewQuery) =>
    apiRequest<MetricsOverviewResponse>(`/platform-admin/metrics/overview${toQueryString(query)}`, {
      method: "GET",
    }),

  listReservedSubdomains: () =>
    apiRequest<{ reservedSubdomains: ReservedSubdomain[] }>("/platform-admin/reserved-subdomains", {
      method: "GET",
    }),

  addReservedSubdomain: (body: AddReservedSubdomainRequest) =>
    apiRequest<ReservedSubdomain>("/platform-admin/reserved-subdomains", { method: "POST", body }),

  removeReservedSubdomain: (word: string) =>
    apiRequest<void>(`/platform-admin/reserved-subdomains/${encodeURIComponent(word)}`, {
      method: "DELETE",
    }),

  listFeatureFlags: () =>
    apiRequest<{ featureFlags: FeatureFlag[] }>("/platform-admin/feature-flags", { method: "GET" }),

  updateFeatureFlag: (key: string, body: UpdateFeatureFlagRequest) =>
    apiRequest<FeatureFlag>(`/platform-admin/feature-flags/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body,
    }),

  listSettings: () =>
    apiRequest<{ settings: PlatformSetting[] }>("/platform-admin/settings", { method: "GET" }),

  updateSetting: (key: string, body: UpdatePlatformSettingRequest) =>
    apiRequest<PlatformSetting>(`/platform-admin/settings/${encodeURIComponent(key)}`, {
      method: "PATCH",
      body,
    }),
};
