"use client";

import { use } from "react";
import { RequireAuth } from "../../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../../components/dashboard/DashboardLayout";
import { CollectionForm } from "../CollectionForm";

export default function EditCollectionPage({
  params,
}: {
  params: Promise<{ collectionId: string }>;
}): React.ReactElement {
  const { collectionId } = use(params);
  return (
    <RequireAuth>
      <DashboardLayout>
        <CollectionForm collectionId={collectionId} />
      </DashboardLayout>
    </RequireAuth>
  );
}
