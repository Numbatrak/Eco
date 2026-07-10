"use client";

import { use } from "react";
import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { ProductForm } from "../ProductForm";

export default function EditProductPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}): React.ReactElement {
  const { productId } = use(params);
  return (
    <RequireAuth>
      <DashboardLayout>
        <ProductForm productId={productId} />
      </DashboardLayout>
    </RequireAuth>
  );
}
