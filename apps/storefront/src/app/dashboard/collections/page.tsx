"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Collection } from "@platform/shared-types";
import { RequireAuth } from "../../../components/dashboard/RouteGuards";
import { DashboardLayout } from "../../../components/dashboard/DashboardLayout";
import { ConfirmDialog } from "../../../components/dashboard/ConfirmDialog";
import { commerceApi } from "../../../lib/commerceApi";

function CollectionsInner(): React.ReactElement {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Collection | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { collections: list } = await commerceApi.listCollections();
      setCollections(list);
    } catch {
      setError("Could not load collections.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(): Promise<void> {
    if (!deleteTarget) return;
    await commerceApi.deleteCollection(deleteTarget.id);
    setDeleteTarget(null);
    await load();
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h1>Collections</h1>
        <Link href="/dashboard/collections/new" className="btn btn-primary">
          Add collection
        </Link>
      </div>

      {error ? (
        <div className="banner banner-danger" role="alert">
          {error}
        </div>
      ) : null}

      {collections === null ? (
        <p className="field-hint">Loading collections…</p>
      ) : collections.length === 0 ? (
        <p className="field-hint">No collections yet.</p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {collections.map((collection) => (
                <tr key={collection.id}>
                  <td>{collection.name}</td>
                  <td>{collection.slug}</td>
                  <td>
                    <span className={`badge badge-${collection.isActive ? "published" : "draft"}`}>
                      {collection.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                      <Link href={`/dashboard/collections/${collection.id}`} className="btn-link">
                        Edit
                      </Link>
                      <button
                        type="button"
                        className="btn-link"
                        onClick={() => setDeleteTarget(collection)}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this collection?"
        description={
          deleteTarget
            ? `"${deleteTarget.name}" will be permanently removed. Products in it will become uncategorized.`
            : undefined
        }
        confirmLabel="Delete"
        danger
        onCancel={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
      />
    </div>
  );
}

export default function CollectionsListPage(): React.ReactElement {
  return (
    <RequireAuth>
      <DashboardLayout>
        <CollectionsInner />
      </DashboardLayout>
    </RequireAuth>
  );
}
