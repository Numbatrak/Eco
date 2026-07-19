"use client";

import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { CollectionForm } from "../CollectionForm";

export default function NewCollectionPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <CollectionForm />
      </DashboardLayout>
    </RequireAuth>
  );
}
