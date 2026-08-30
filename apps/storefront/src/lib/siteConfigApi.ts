"use client";

import type { SiteConfig } from "@platform/shared-types";
import { apiRequest } from "./apiClient";

export const siteConfigApi = {
  get: () => apiRequest<SiteConfig>("/org/site-config", { method: "GET" }),
  save: (config: SiteConfig) =>
    apiRequest<void>("/org/site-config", { method: "PUT", body: config }),
  publish: async () => {
    console.log("[siteConfigApi.publish] POST /org/site-config/publish");
    try {
      const result = await apiRequest<void>("/org/site-config/publish", { method: "POST" });
      console.log("[siteConfigApi.publish] succeeded (204)");
      return result;
    } catch (err) {
      console.error("[siteConfigApi.publish] failed", err);
      throw err;
    }
  },
};
