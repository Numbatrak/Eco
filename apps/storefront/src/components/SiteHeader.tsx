"use client";

import Link from "next/link";
import { useSite } from "./SiteProvider";
import { MiniCart } from "./MiniCart";

export function SiteHeader(): React.ReactElement {
  const { site } = useSite();

  return (
    <header className="border-line bg-panel sticky top-0 z-10 border-b">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href={`/`} className="font-heading text-lg font-semibold text-ink">
          {site.tenant.name}
        </Link>
        <MiniCart />
      </div>
    </header>
  );
}
