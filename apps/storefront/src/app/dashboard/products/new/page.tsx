"use client";

import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { ProductForm } from "../ProductForm";

export default function NewProductPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <ProductForm />
      </DashboardLayout>
    </RequireAuth>
  );
}
