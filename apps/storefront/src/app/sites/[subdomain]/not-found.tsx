export default function SiteNotFound(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
      <h1 className="font-heading text-2xl text-ink">This site isn&apos;t available</h1>
      <p className="max-w-sm text-sm text-muted">
        We couldn&apos;t find a published storefront at this address. If you&apos;re the owner,
        check that your subdomain is set and your site is published in your dashboard.
      </p>
    </div>
  );
}
