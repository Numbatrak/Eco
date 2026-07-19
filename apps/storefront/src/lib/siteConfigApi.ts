"use client";

import type { SiteConfig } from "@platform/shared-types";
import { apiRequest } from "./apiClient";

export const siteConfigApi = {
  get: () => apiRequest<SiteConfig>("/org/site-config", { method: "GET" }),
  save: (config: SiteConfig) =>
    apiRequest<void>("/org/site-config", { method: "PUT", body: config }),
  publish: () => apiRequest<void>("/org/site-config/publish", { method: "POST" }),
};
