"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { PublicSite } from "@platform/shared-types";

interface SiteContextValue {
  site: PublicSite;
  subdomain: string;
}

const SiteContext = createContext<SiteContextValue | null>(null);

export function SiteProvider({
  site,
  subdomain,
  children,
}: {
  site: PublicSite;
  subdomain: string;
  children: ReactNode;
}): React.ReactElement {
  return <SiteContext.Provider value={{ site, subdomain }}>{children}</SiteContext.Provider>;
}

export function useSite(): SiteContextValue {
  const ctx = useContext(SiteContext);
  if (!ctx) {
    throw new Error("useSite must be used within a SiteProvider");
  }
  return ctx;
}
