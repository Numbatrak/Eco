import { useState, useEffect, FormEvent, useCallback, useMemo } from "react";
import { AbandonedCartWithRelations } from "../types/abandonedCart";
import { AbandonedCartTable } from "./abandonedCarts/AbandonedCartTable";
import { AbandonedCartDialog } from "./abandonedCarts/AbandonedCartDialog";
import { PageHeader } from "./abandonedCarts/PageHeader";
import { ErrorAlert } from "./agents/ErrorAlert";
import { SuccessAlert } from "./agents/SuccessAlert";
import {
  fetchAbandonedCarts,
  removeAbandonedCart,
  markAsConverted,
  fetchAbandonedCartsCount,
  updateAbandonedCart,
  fetchAbandonedCartFunnels,
  parseCartSelectedProducts,
  resolveCartLinePrices,
  AbandonedCartFilters,
} from "../services/abandonedCarts";
import { createCustomerOrderFromAbandonedCart } from "../services/customerOrders";
import { resolveFollowUpsForConvertedCart } from "../services/followUps";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm, confirmDelete } from "../contexts/ConfirmContext";
import { fetchForms } from "../services/forms";
import { fetchProducts } from "../services/products";
import { PageLayout } from "./layout/PageLayout";
import { Form } from "../types/form";

export default function AbandonedCartsForm() {
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canEdit = hasPermission("orders", "canUpdate");
  const canDelete = hasPermission("orders", "canDelete");

  const [carts, setCarts] = useState<AbandonedCartWithRelations[]>([]);
  const [open, setOpen] = useState(false);
  const [editingCart, setEditingCart] = useState<AbandonedCartWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [filters, setFilters] = useState<AbandonedCartFilters>({});
  const [forms, setForms] = useState<Form[]>([]);
  const [funnelOptions, setFunnelOptions] = useState<string[]>([]);
  const [productOptions, setProductOptions] = useState<{ id: string; name: string }[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCarts, setTotalCarts] = useState(0);
  const [convertedCount, setConvertedCount] = useState(0);
  const itemsPerPage = 20;

  const formList = useMemo(
    () => forms.map((f) => ({ id: f.id, name: f.name })),
    [forms]
  );

  useEffect(() => {
    if (!currentOrganization) {
      setForms([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const [list, funnels, products] = await Promise.all([
          fetchForms(currentOrganization.id),
          fetchAbandonedCartFunnels(currentOrganization.id),
          fetchProducts(currentOrganization.id, { activeOnly: true }),
        ]);
        if (!cancelled) {
          setForms(list);
          setFunnelOptions(funnels);
          setProductOptions(products.map((p) => ({ id: p.id, name: p.name })));
        }
      } catch (e) {
        console.error("Error loading forms:", e);
        if (!cancelled) {
          setForms([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [currentOrganization]);

  useEffect(() => {
    setFilters((f) => ({ ...f, formId: undefined }));
  }, [currentOrganization?.id]);

  // Memoize loadData to prevent unnecessary re-renders
  const loadData = useCallback(async () => {
    if (!currentOrganization) return;
    
    try {
      setLoading(true);
      setLoadError(null);

      const offset = (currentPage - 1) * itemsPerPage;
      const limit = itemsPerPage;

      const cartsData = await fetchAbandonedCarts(
        currentOrganization.id,
        offset,
        limit,
        sortOrder,
        searchQuery,
        filters
      );
      setCarts(cartsData);

      const count = await fetchAbandonedCartsCount(currentOrganization.id, searchQuery, filters);
      setTotalCarts(count);

      // Get converted count
      const convertedCountData = await fetchAbandonedCartsCount(currentOrganization.id, searchQuery, {
        ...filters,
        converted: true,
      });
      setConvertedCount(convertedCountData);
    } catch (err) {
      console.error("Error loading data:", err);
      setLoadError("Failed to load data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id, currentPage, sortOrder, filters, searchQuery, itemsPerPage]);

  // Load data when dependencies change
  useEffect(() => {
    if (currentOrganization) {
      loadData();
    }
  }, [currentOrganization?.id, loadData]);

  const handleDeleteCart = async (cartId: string) => {
    if (!(await confirmDelete(confirm, "abandoned cart"))) return;

    try {
      setError(null);
      await removeAbandonedCart(cartId);
      setSuccess("Abandoned cart deleted successfully!");
      await loadData();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting cart:", err);
      setError("Failed to delete cart. Please try again.");
    }
  };

  const handleConvertToOrder = async (cart: AbandonedCartWithRelations) => {
    if (
      !(await confirm({
        title: "Convert to order?",
        description:
          "This will create a new order from this abandoned cart. The cart will be marked as converted.",
        confirmLabel: "Convert",
        destructive: false,
      }))
    )
      return;

    try {
      setError(null);
      setLoading(true);

      if (!currentOrganization) {
        setError("No organization selected");
        return;
      }

      // Create order from cart data with catalog line items when available
      const cartLines = parseCartSelectedProducts(cart);
      const pricedLines =
        cartLines.length > 0
          ? await resolveCartLinePrices(currentOrganization.id, cartLines)
          : [];

      const linkedForm = cart.form_id
        ? forms.find((f) => f.id === cart.form_id)
        : undefined;

      const newId = await createCustomerOrderFromAbandonedCart({
        organization_id: currentOrganization.id,
        customer_name: cart.customer_name || "Unknown Customer",
        phone_number: cart.phone_number || null,
        whatsapp_number: cart.whatsapp_number || null,
        state: cart.state ?? null,
        delivery_address: cart.delivery_address ?? null,
        form_id: cart.form_id ?? null,
        order_revenue: cart.sales_price != null ? Number(cart.sales_price) : null,
        order_cost: cart.cost_price != null ? Number(cart.cost_price) : null,
        delivery_fee: cart.delivery_fee != null ? Number(cart.delivery_fee) : null,
        amount_paid: null,
        profit: cart.profit != null ? Number(cart.profit) : null,
        notes: `Converted from abandoned cart #${cart.id}. Page: ${cart.page_url || "N/A"}`,
        abandoned_cart_id: cart.id,
        funnel_name: cart.funnel_name ?? linkedForm?.funnel_name ?? linkedForm?.name ?? null,
        offer_name: cart.offer_name ?? cart.selected_package ?? null,
        sub_brand: cart.sub_brand ?? linkedForm?.sub_brand ?? null,
        items: pricedLines,
      });

      await markAsConverted(cart.id, newId);
      await resolveFollowUpsForConvertedCart(
        currentOrganization.id,
        cart.id,
        newId
      );

      setSuccess(
        `Cart converted to order successfully! Reference: ${newId}`
      );
      await loadData();
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error("Error converting cart:", err);
      setError("Failed to convert cart to order. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (cart: AbandonedCartWithRelations) => {
    setEditingCart(cart);
    setOpen(true);
    setError(null);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingCart) return;

    const formData = new FormData(e.currentTarget);

    try {
      setSaving(true);
      setError(null);

      const updateData = {
        customer_name: (formData.get("customer_name") as string) || null,
        phone_number: (formData.get("phone_number") as string) || null,
        whatsapp_number: (formData.get("whatsapp_number") as string) || null,
        delivery_address: (formData.get("delivery_address") as string) || null,
        state: (formData.get("state") as string) || null,
        location: (formData.get("location") as string) || null,
        selected_package: (formData.get("selected_package") as string) || null,
        selected_items: (formData.get("selected_items") as string) || null,
        product_name: (formData.get("product_name") as string) || null,
        mail_quan: formData.get("mail_quan")
          ? parseInt(formData.get("mail_quan") as string)
          : null,
        agent_quan: formData.get("agent_quan")
          ? parseInt(formData.get("agent_quan") as string)
          : null,
        quantity: formData.get("quantity")
          ? parseInt(formData.get("quantity") as string)
          : null,
        product2: (formData.get("product2") as string) || null,
        mail_quan2: formData.get("mail_quan2")
          ? parseInt(formData.get("mail_quan2") as string)
          : null,
        agent_quan2: formData.get("agent_quan2")
          ? parseInt(formData.get("agent_quan2") as string)
          : null,
        quantity2: formData.get("quantity2")
          ? parseInt(formData.get("quantity2") as string)
          : null,
        sales_price: formData.get("sales_price")
          ? parseFloat(formData.get("sales_price") as string)
          : null,
        page_url: (formData.get("page_url") as string) || null,
        filled_fields_count: formData.get("filled_fields_count")
          ? parseInt(formData.get("filled_fields_count") as string)
          : 0,
        note: (formData.get("note") as string) || null,
      };

      await updateAbandonedCart(editingCart.id, updateData);
      setSuccess("Abandoned cart updated successfully!");
      await loadData();
      setOpen(false);
      setEditingCart(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating cart:", err);
      setError("Failed to update cart. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // Reset to page 1 when filters or search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filters, sortOrder]);

  return (
    <>
      <AbandonedCartDialog
        open={open}
        onOpenChange={(open) => {
          setOpen(open);
          if (!open) {
            setEditingCart(null);
            setError(null);
          }
        }}
        cart={editingCart}
        error={error}
        saving={saving}
        onSubmit={handleSubmit}
      />

      <PageLayout>
        {error && (
          <ErrorAlert message={error} onClose={() => setError(null)} />
        )}
        {success && (
          <SuccessAlert message={success} onClose={() => setSuccess(null)} />
        )}

        <PageHeader totalCarts={totalCarts} convertedCount={convertedCount} />

        <AbandonedCartTable
          carts={carts}
          loading={loading}
          error={loadError}
          onEdit={handleEdit}
          onDelete={handleDeleteCart}
          onConvert={handleConvertToOrder}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          filters={filters}
          onFilterChange={setFilters}
          formList={formList}
          funnelOptions={funnelOptions}
          productOptions={productOptions}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
          itemsPerPage={itemsPerPage}
          totalItems={totalCarts}
          canEdit={canEdit}
          canDelete={canDelete}
          onFollowUpSuccess={(message) => {
            setError(null);
            setSuccess(message);
            setTimeout(() => setSuccess(null), 4000);
          }}
          onFollowUpError={(message) => {
            setSuccess(null);
            setError(message);
          }}
        />
      </PageLayout>
    </>
  );
}

