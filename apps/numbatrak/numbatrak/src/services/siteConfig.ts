import { apiRequest } from "../lib/apiClient";
import type { SiteConfig } from "../types/siteConfig";

export const siteConfigApi = {
  get: () => apiRequest<SiteConfig>("/org/site-config", { method: "GET" }),
  save: (config: SiteConfig) =>
    apiRequest<void>("/org/site-config", { method: "PUT", body: config }),
  publish: () => apiRequest<void>("/org/site-config/publish", { method: "POST" }),
};
