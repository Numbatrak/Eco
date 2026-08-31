"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";

// Products are now managed in Numbatrak and synced here automatically -
// this route no longer has an editable form, just bounces back to the list.
export default function EditProductPage(): React.ReactElement {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dashboard/products");
  }, [router]);

  return (
    <RequireAuth>
      <DashboardLayout>
        <p className="field-hint">Redirecting…</p>
      </DashboardLayout>
    </RequireAuth>
  );
}
