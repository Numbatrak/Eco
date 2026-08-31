import type { PublicFunnel, Cart } from "@platform/shared-types";
import { apiRequest, ApiError } from "./apiClient";

/** Returns null (not a thrown error) for "no such funnel" - same convention as fetchSite. */
export async function fetchFunnel(subdomain: string, productId: string): Promise<PublicFunnel | null> {
  try {
    return await apiRequest<PublicFunnel>(
      `/public/sites/${encodeURIComponent(subdomain)}/funnel/${encodeURIComponent(productId)}`,
    );
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

export const funnelApi = {
  addPackageToCart: (subdomain: string, productId: string, packageId: string) =>
    apiRequest<Cart>(`/public/sites/${subdomain}/funnel/${productId}/add-to-cart`, {
      method: "POST",
      body: { packageId },
    }),
};
