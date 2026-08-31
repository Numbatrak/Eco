import { notFound } from "next/navigation";
import { fetchFunnel } from "../../../../../lib/funnelApi";
import { FunnelPageClient } from "./FunnelPageClient";

export default async function FunnelPage({
  params,
}: {
  params: Promise<{ subdomain: string; productId: string }>;
}): Promise<React.ReactElement> {
  const { subdomain, productId } = await params;
  const funnel = await fetchFunnel(subdomain, productId);

  if (!funnel) {
    notFound();
  }

  return <FunnelPageClient funnel={funnel} subdomain={subdomain} />;
}
