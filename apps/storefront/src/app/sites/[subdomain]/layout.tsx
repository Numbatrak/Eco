import { notFound } from "next/navigation";
import { fetchSite } from "../../../lib/siteApi";
import { SiteProvider } from "../../../components/SiteProvider";
import { CartProvider } from "../../../components/CartContext";
import { SiteHeader } from "../../../components/SiteHeader";

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
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </CartProvider>
    </SiteProvider>
  );
}
