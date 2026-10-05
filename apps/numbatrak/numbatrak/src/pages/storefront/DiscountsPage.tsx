import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../../components/layout/PageLayout";
import { Button } from "../../components/ui/button";
import { DiscountDialog } from "../../components/storefront/DiscountDialog";
import { useConfirm } from "../../contexts/ConfirmContext";
import { storefrontSettingsApi, type DiscountResponse } from "../../services/storefrontSettings";

export function DiscountsPage() {
  const { confirm } = useConfirm();
  const [discounts, setDiscounts] = useState<DiscountResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState<DiscountResponse | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const { discounts: list } = await storefrontSettingsApi.listDiscounts();
      setDiscounts(list);
    } catch {
      setError("Could not load discounts.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAdd = () => {
    setEditingDiscount(null);
    setDialogOpen(true);
  };

  const handleEdit = (discount: DiscountResponse) => {
    setEditingDiscount(discount);
    setDialogOpen(true);
  };

  const handleDelete = async (discount: DiscountResponse) => {
    if (
      !(await confirm({
        title: "Delete this discount?",
        description: `"${discount.title}" will be permanently removed.`,
        confirmLabel: "Delete",
        destructive: true,
      }))
    ) {
      return;
    }
    await storefrontSettingsApi.deleteDiscount(discount.id);
    await load();
  };

  return (
    <PageLayout>
      <div className="space-y-6">
        <DiscountDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          discount={editingDiscount}
          onSaved={load}
        />

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <h1 className="text-2xl font-semibold text-foreground">Discounts</h1>
            <p className="text-sm text-muted-foreground">
              Codes and automatic discounts applied at storefront checkout
            </p>
          </div>
          <Button onClick={handleAdd}>Add discount</Button>
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {discounts === null ? (
          <p className="text-sm text-muted-foreground">Loading discounts…</p>
        ) : discounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No discounts yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <th className="px-4 py-2">Title</th>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Type</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {discounts.map((discount) => (
                  <tr key={discount.id} className="border-t border-border">
                    <td className="px-4 py-2 font-medium text-foreground">{discount.title}</td>
                    <td className="px-4 py-2">
                      {discount.code ?? <em className="text-muted-foreground">Automatic</em>}
                    </td>
                    <td className="px-4 py-2 capitalize">{discount.config.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-2">
                      <span
                        className={
                          discount.active
                            ? "text-xs font-medium text-green-600"
                            : "text-xs font-medium text-muted-foreground"
                        }
                      >
                        {discount.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right space-x-2">
                      <Button variant="outline" size="sm" onClick={() => handleEdit(discount)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(discount)}>
                        Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
