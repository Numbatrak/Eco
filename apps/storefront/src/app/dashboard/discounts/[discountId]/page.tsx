"use client";

import { use } from "react";
import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { DiscountForm } from "../DiscountForm";

export default function EditDiscountPage({
  params,
}: {
  params: Promise<{ discountId: string }>;
}): React.ReactElement {
  const { discountId } = use(params);
  return (
    <RequireAuth>
      <DashboardLayout>
        <DiscountForm discountId={discountId} />
      </DashboardLayout>
    </RequireAuth>
  );
}
