import type {
  PlatformAdminTenantsQuery,
  PlatformAdminTenantsResponse,
  PlatformAdminTenantDetail,
  UpdateTenantPlanRequest,
  GrantTenantCreditsRequest,
  ExtendTrialRequest,
  SuspendTenantRequest,
  DeleteTenantRequest,
  OverviewQuery,
  OverviewResponse,
  OverviewTrendsQuery,
  OverviewTrendsResponse,
  RevenueLedgerQuery,
  RevenueLedgerResponse,
  FailedPaymentsResponse,
  TaxViewQuery,
  TaxViewResponse,
  IssueRefundRequest,
  AffiliatesResponse,
  AffiliateDetail,
  AffiliatePerformance,
  AffiliatePerformanceQuery,
  CreateAffiliateRequest,
  UpdateAffiliateStatusRequest,
  RecordAffiliatePayoutRequest,
  AnnouncementsResponse,
  Announcement,
  CreateAnnouncementRequest,
  FeatureUsageResponse,
  ChurnQuery,
  ChurnAnalyticsResponse,
  IntegrationHealthResponse,
  AuditLogQuery,
  AuditLogResponse,
  ErrorLogQuery,
  ErrorLogResponse,
  ReservedSubdomain,
  AddReservedSubdomainRequest,
  FeatureFlag,
  UpdateFeatureFlagRequest,
  PlatformSetting,
  UpdatePlatformSettingRequest,
  CreditPricingResponse,
  SetCreditPricingRequest,
  CreditBundlesResponse,
  CreditBundle,
  CreateCreditBundleRequest,
  CreditConsumptionResponse,
  CreditMarginResponse,
  ExpensesQuery,
  ExpensesResponse,
  Expense,
  CreateExpenseRequest,
  UpdateExpenseRequest,
  ExpenseSubCategory,
  CreateExpenseSubCategoryRequest,
  PnlResponse,
  AdPerformanceResponse,
} from "@platform/shared-types";
import { apiRequest, downloadCsv } from "../../lib/apiClient";

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

  suspendTenant: (tenantId: string, body: SuspendTenantRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/suspend`, { method: "POST", body }),

  reactivateTenant: (tenantId: string) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/reactivate`, { method: "POST" }),

  updateTenantPlan: (tenantId: string, body: UpdateTenantPlanRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/plan`, { method: "PATCH", body }),

  grantTenantCredits: (tenantId: string, body: GrantTenantCreditsRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/credits/grant`, { method: "POST", body }),

  extendTenantTrial: (tenantId: string, body: ExtendTrialRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}/trial/extend`, { method: "POST", body }),

  resetTenantPassword: (tenantId: string) =>
    apiRequest<{ message: string }>(`/platform-admin/tenants/${tenantId}/reset-password`, {
      method: "POST",
    }),

  deleteTenant: (tenantId: string, body: DeleteTenantRequest) =>
    apiRequest<void>(`/platform-admin/tenants/${tenantId}`, { method: "DELETE", body }),

  getOverview: (query: OverviewQuery) =>
    apiRequest<OverviewResponse>(`/platform-admin/overview${toQueryString(query)}`, {
      method: "GET",
    }),

  getOverviewTrends: (query: OverviewTrendsQuery) =>
    apiRequest<OverviewTrendsResponse>(`/platform-admin/overview/trends${toQueryString(query)}`, {
      method: "GET",
    }),

  getRevenueLedger: (query: RevenueLedgerQuery) =>
    apiRequest<RevenueLedgerResponse>(`/platform-admin/revenue/transactions${toQueryString(query)}`, {
      method: "GET",
    }),

  getFailedPayments: () =>
    apiRequest<FailedPaymentsResponse>("/platform-admin/revenue/failed-payments", { method: "GET" }),

  getTaxView: (query: TaxViewQuery) =>
    apiRequest<TaxViewResponse>(`/platform-admin/revenue/tax${toQueryString(query)}`, { method: "GET" }),

  issueRefund: (reference: string, body: IssueRefundRequest) =>
    apiRequest<{ ok: boolean; reference: string; status: string }>(
      `/platform-admin/revenue/transactions/${encodeURIComponent(reference)}/refund`,
      { method: "POST", body },
    ),

  downloadLedgerCsv: (query: RevenueLedgerQuery) =>
    downloadCsv(`/platform-admin/revenue/transactions/export.csv${toQueryString(query)}`, "transactions.csv"),

  downloadTaxCsv: (query: TaxViewQuery) =>
    downloadCsv(`/platform-admin/revenue/tax/export.csv${toQueryString(query)}`, "tax-report.csv"),

  getAffiliates: () => apiRequest<AffiliatesResponse>("/platform-admin/affiliates", { method: "GET" }),

  createAffiliate: (body: CreateAffiliateRequest) =>
    apiRequest<AffiliateDetail>("/platform-admin/affiliates", { method: "POST", body }),

  getAffiliate: (id: string) =>
    apiRequest<AffiliateDetail>(`/platform-admin/affiliates/${id}`, { method: "GET" }),

  getAffiliatePerformance: (id: string, query: AffiliatePerformanceQuery) =>
    apiRequest<AffiliatePerformance>(`/platform-admin/affiliates/${id}/performance${toQueryString(query)}`, {
      method: "GET",
    }),

  setAffiliateStatus: (id: string, body: UpdateAffiliateStatusRequest) =>
    apiRequest<void>(`/platform-admin/affiliates/${id}/status`, { method: "PATCH", body }),

  recordAffiliatePayout: (id: string, body: RecordAffiliatePayoutRequest) =>
    apiRequest<void>(`/platform-admin/affiliates/${id}/payouts`, { method: "POST", body }),

  getAnnouncements: () =>
    apiRequest<AnnouncementsResponse>("/platform-admin/operations/announcements", { method: "GET" }),

  createAnnouncement: (body: CreateAnnouncementRequest) =>
    apiRequest<Announcement>("/platform-admin/operations/announcements", { method: "POST", body }),

  getFeatureUsage: () =>
    apiRequest<FeatureUsageResponse>("/platform-admin/operations/feature-usage", { method: "GET" }),

  getChurnAnalytics: (query: ChurnQuery) =>
    apiRequest<ChurnAnalyticsResponse>(`/platform-admin/operations/churn${toQueryString(query)}`, { method: "GET" }),

  getIntegrationHealth: () =>
    apiRequest<IntegrationHealthResponse>("/platform-admin/operations/integration-health", { method: "GET" }),

  getAuditLog: (query: AuditLogQuery) =>
    apiRequest<AuditLogResponse>(`/platform-admin/operations/audit-log${toQueryString(query)}`, { method: "GET" }),

  downloadAuditCsv: (query: AuditLogQuery) =>
    downloadCsv(`/platform-admin/operations/audit-log/export.csv${toQueryString(query)}`, "audit-log.csv"),

  getErrorLog: (query: ErrorLogQuery) =>
    apiRequest<ErrorLogResponse>(`/platform-admin/operations/error-log${toQueryString(query)}`, { method: "GET" }),

  downloadErrorCsv: (query: ErrorLogQuery) =>
    downloadCsv(`/platform-admin/operations/error-log/export.csv${toQueryString(query)}`, "error-log.csv"),

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

  // --- Credits (Tab 4) ---

  getCreditPricing: () =>
    apiRequest<CreditPricingResponse>("/platform-admin/credits/pricing", { method: "GET" }),

  setCreditPricing: (body: SetCreditPricingRequest) =>
    apiRequest<CreditPricingResponse>("/platform-admin/credits/pricing", { method: "PUT", body }),

  getCreditBundles: () =>
    apiRequest<CreditBundlesResponse>("/platform-admin/credits/bundles", { method: "GET" }),

  createCreditBundle: (body: CreateCreditBundleRequest) =>
    apiRequest<CreditBundle>("/platform-admin/credits/bundles", { method: "POST", body }),

  deleteCreditBundle: (id: string) =>
    apiRequest<void>(`/platform-admin/credits/bundles/${encodeURIComponent(id)}`, { method: "DELETE" }),

  getCreditConsumption: () =>
    apiRequest<CreditConsumptionResponse>("/platform-admin/credits/consumption", { method: "GET" }),

  getCreditMargin: () =>
    apiRequest<CreditMarginResponse>("/platform-admin/credits/margin", { method: "GET" }),

  // --- Business Metrics (Tab 7) ---

  getExpenses: (query: ExpensesQuery) =>
    apiRequest<ExpensesResponse>(`/platform-admin/business-metrics/expenses${toQueryString(query)}`, { method: "GET" }),

  createExpense: (body: CreateExpenseRequest) =>
    apiRequest<Expense>("/platform-admin/business-metrics/expenses", { method: "POST", body }),

  updateExpense: (id: string, body: UpdateExpenseRequest) =>
    apiRequest<{ ok: boolean }>(`/platform-admin/business-metrics/expenses/${encodeURIComponent(id)}`, { method: "PATCH", body }),

  deleteExpense: (id: string) =>
    apiRequest<void>(`/platform-admin/business-metrics/expenses/${encodeURIComponent(id)}`, { method: "DELETE" }),

  restoreExpense: (id: string) =>
    apiRequest<{ ok: boolean }>(`/platform-admin/business-metrics/expenses/${encodeURIComponent(id)}/restore`, { method: "POST" }),

  createExpenseSubCategory: (body: CreateExpenseSubCategoryRequest) =>
    apiRequest<ExpenseSubCategory>("/platform-admin/business-metrics/sub-categories", { method: "POST", body }),

  getPnl: (query: ExpensesQuery) =>
    apiRequest<PnlResponse>(`/platform-admin/business-metrics/pnl${toQueryString(query)}`, { method: "GET" }),

  getAdPerformance: (query: ExpensesQuery) =>
    apiRequest<AdPerformanceResponse>(`/platform-admin/business-metrics/ad-performance${toQueryString(query)}`, { method: "GET" }),
};
