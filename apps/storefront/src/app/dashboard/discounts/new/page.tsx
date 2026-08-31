"use client";

import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { DiscountForm } from "../DiscountForm";

export default function NewDiscountPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <DiscountForm />
      </DashboardLayout>
    </RequireAuth>
  );
}
