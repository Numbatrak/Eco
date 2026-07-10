import { notFound } from "next/navigation";
import { fetchSite } from "../../../lib/siteApi";
import { SiteProvider } from "../../../components/SiteProvider";
import { CartProvider } from "../../../components/CartContext";

export default async function SiteLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ subdomain: string }>;
}): Promise<React.ReactElement> {
  const { subdomain } = await params;
  const site = await fetchSite(subdomain);

  if (!site) {
    notFound();
  }

  return (
    <SiteProvider site={site} subdomain={subdomain}>
      <CartProvider subdomain={subdomain}>
        {children}
      </CartProvider>
    </SiteProvider>
  );
}
