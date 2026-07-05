import type { PublicSite } from "@platform/shared-types";
import { apiRequest, ApiError } from "./apiClient";

/** Returns null (not a thrown error) for "no such site" - a clean, distinguishable case from a real failure. */
export async function fetchSite(subdomain: string): Promise<PublicSite | null> {
  try {
    return await apiRequest<PublicSite>(`/public/sites/${encodeURIComponent(subdomain)}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
