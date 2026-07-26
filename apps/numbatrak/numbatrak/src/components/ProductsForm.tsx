import { FormEvent, useState, useEffect, useCallback } from "react";
import {
  Product,
  ProductOffer,
  ProductVariant,
  ProductWithDetails,
} from "../types/product";
import {
  ProductDialog,
  ProductFormValues,
} from "./products/ProductDialog";
import { OffersDialog } from "./products/OffersDialog";
import { VariantsDialog } from "./products/VariantsDialog";
import { ReceiveStockDialog } from "./products/ReceiveStockDialog";
import { ProductTable } from "./products/ProductTable";
import { PageHeader } from "./products/PageHeader";
import { SuccessNotification } from "./agents/SuccessNotification";
import {
  fetchProductsWithDetails,
  createProduct,
  updateProduct,
  removeProduct,
  setProductActive,
} from "../services/products";
import {
  createProductOffer,
  removeProductOffer,
  setProductOfferActive,
} from "../services/productOffers";
import {
  createProductVariant,
  removeProductVariant,
  updateProductVariant,
} from "../services/productVariants";
import { createInventoryLot } from "../services/inventoryLots";
import { usePermissions } from "../hooks/usePermissions";
import { useOrganization } from "../contexts/OrganizationContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { PageLayout } from "./layout/PageLayout";

const emptyFormValues = (): ProductFormValues => ({
  productName: "",
  basePrice: "",
  costPrice: "",
  sku: "",
  type: "NORMAL",
  category: "",
  subBrand: "",
  lowStockThreshold: "",
  allowsVariants: false,
  allowsBundles: false,
  allowsDiscounts: false,
});

export default function ProductsForm() {
  const { hasPermission } = usePermissions();
  const { currentOrganization } = useOrganization();
  const { confirm } = useConfirm();
  const canCreate = hasPermission("products", "canCreate");
  const canUpdate = hasPermission("products", "canUpdate");
  const canDelete = hasPermission("products", "canDelete");
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [formValues, setFormValues] = useState<ProductFormValues>(emptyFormValues());
  const [open, setOpen] = useState(false);
  const [offersDialogOpen, setOffersDialogOpen] = useState(false);
  const [variantsDialogOpen, setVariantsDialogOpen] = useState(false);
  const [receiveStockOpen, setReceiveStockOpen] = useState(false);
  const [receiveStockProduct, setReceiveStockProduct] = useState<Product | null>(null);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const loadProducts = useCallback(async () => {
    if (!currentOrganization) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchProductsWithDetails(currentOrganization.id);
      setProducts(data);
      setSelectedProduct((prev) => {
        if (!prev) return prev;
        return data.find((p) => p.id === prev.id) ?? prev;
      });
    } catch (err) {
      console.error("Error loading products:", err);
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    if (currentOrganization) loadProducts();
  }, [currentOrganization?.id]);

  const patchFormValues = (patch: Partial<ProductFormValues>) => {
    setFormValues((prev) => ({ ...prev, ...patch }));
  };

  const parseProductInput = () => {
    const basePriceNum = parseFloat(formValues.basePrice);
    const costPriceNum = parseFloat(formValues.costPrice);
    const lowStock = formValues.lowStockThreshold.trim()
      ? parseInt(formValues.lowStockThreshold, 10)
      : null;

    if (isNaN(basePriceNum) || basePriceNum < 0) {
      throw new Error("Sales price must be a valid number ≥ 0");
    }
    if (isNaN(costPriceNum) || costPriceNum < 0) {
      throw new Error("Cost price must be a valid number ≥ 0");
    }
    if (lowStock != null && (isNaN(lowStock) || lowStock < 0)) {
      throw new Error("Low stock threshold must be a valid number ≥ 0");
    }

    return {
      name: formValues.productName.trim(),
      base_price: basePriceNum,
      cost_price: costPriceNum,
      type: formValues.type,
      sku: formValues.sku.trim() || null,
      category: formValues.category.trim() || null,
      sub_brand: formValues.subBrand.trim() || null,
      low_stock_threshold: lowStock,
      allows_variants: formValues.allowsVariants,
      allows_bundles: formValues.allowsBundles,
      allows_discounts: formValues.allowsDiscounts,
    };
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formValues.productName.trim()) return;

    try {
      setSaving(true);
      setError(null);
      const input = parseProductInput();

      if (dialogMode === "edit" && editingProductId) {
        await updateProduct(editingProductId, input);
        setSuccess("Product updated successfully!");
      } else {
        if (!currentOrganization) {
          setError("No organization selected");
          return;
        }
        await createProduct({
          ...input,
          organization_id: currentOrganization.id,
        });
        setSuccess("Product created successfully!");
      }

      await loadProducts();
      resetForm();
      setOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving product:", err);
      setError(
        err instanceof Error ? err.message : "Failed to save product. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setFormValues(emptyFormValues());
    setEditingProductId(null);
    setDialogMode("create");
  };

  const handleStartCreate = () => {
    setDialogMode("create");
    resetForm();
    setOpen(true);
  };

  const handleStartEdit = (product: ProductWithDetails) => {
    setDialogMode("edit");
    setEditingProductId(product.id);
    setFormValues({
      productName: product.name,
      basePrice: String(product.base_price ?? 0),
      costPrice: String(product.cost_price ?? 0),
      sku: product.sku ?? "",
      type: product.type ?? "NORMAL",
      category: product.category ?? "",
      subBrand: product.sub_brand ?? "",
      lowStockThreshold:
        product.low_stock_threshold != null
          ? String(product.low_stock_threshold)
          : "",
      allowsVariants: product.allows_variants ?? false,
      allowsBundles: product.allows_bundles ?? false,
      allowsDiscounts: product.allows_discounts ?? false,
    });
    setOpen(true);
  };

  const handleDeleteProduct = async (productId: string | number) => {
    if (
      !(await confirm({
        title: "Delete product?",
        description:
          "This will permanently delete this product, variants, offers, and price history.",
        confirmLabel: "Delete",
        destructive: true,
      }))
    )
      return;

    try {
      setError(null);
      await removeProduct(productId);
      setSuccess("Product deleted successfully!");
      await loadProducts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting product:", err);
      setError("Failed to delete product. Please try again.");
    }
  };

  const handleSetProductActive = async (
    product: ProductWithDetails,
    active: boolean
  ) => {
    const action = active ? "Reactivate" : "Deactivate";
    if (
      !(await confirm({
        title: `${action} product?`,
        description: active
          ? `"${product.name}" will be available for new orders and forms again.`
          : `"${product.name}" will be hidden from new orders and forms.`,
        confirmLabel: action,
        destructive: !active,
      }))
    ) {
      return;
    }

    try {
      setError(null);
      await setProductActive(product.id, active);
      setSuccess(
        active ? "Product reactivated!" : "Product deactivated — hidden from forms."
      );
      await loadProducts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating product status:", err);
      setError(`Failed to ${action.toLowerCase()} product.`);
    }
  };

  const handleReceiveStock = (product: ProductWithDetails) => {
    setReceiveStockProduct(product);
    setReceiveStockOpen(true);
  };

  const handleSaveReceiveStock = async (params: {
    product_id: string;
    variant_id?: string | null;
    quantity_remaining: number;
    unit_cost: number;
  }) => {
    if (!currentOrganization) return;
    try {
      setSaving(true);
      setError(null);
      await createInventoryLot({
        organization_id: currentOrganization.id,
        product_id: params.product_id,
        variant_id: params.variant_id,
        quantity_remaining: params.quantity_remaining,
        unit_cost: params.unit_cost,
      });
      setSuccess("Stock received. Orders consume this lot (FIFO).");
      await loadProducts();
      setReceiveStockOpen(false);
      setReceiveStockProduct(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to receive stock.");
    } finally {
      setSaving(false);
    }
  };

  const handleManageOffers = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setOffersDialogOpen(true);
  };

  const handleManageVariants = (product: ProductWithDetails) => {
    setSelectedProduct(product);
    setVariantsDialogOpen(true);
  };

  const handleSaveOffers = async (
    offers: Omit<
      ProductOffer,
      "id" | "organization_id" | "created_at" | "updated_at" | "active"
    >[]
  ) => {
    if (!selectedProduct || !currentOrganization) return;
    try {
      setSaving(true);
      setError(null);
      for (const offer of offers) {
        await createProductOffer({
          organization_id: currentOrganization.id,
          ...offer,
        });
      }
      setSuccess("Offers saved!");
      await loadProducts();
      setOffersDialogOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving offers:", err);
      setError("Failed to save offers.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      setError(null);
      await removeProductOffer(offerId);
      setSuccess("Offer deleted.");
      await loadProducts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting offer:", err);
      setError("Failed to delete offer.");
    }
  };

  const handleToggleOfferActive = async (
    offer: ProductOffer,
    active: boolean
  ) => {
    try {
      setError(null);
      await setProductOfferActive(offer.id, active);
      await loadProducts();
    } catch (err) {
      console.error("Error toggling offer:", err);
      setError("Failed to update offer status.");
    }
  };

  const handleSaveVariants = async (
    variants: Omit<
      ProductVariant,
      | "id"
      | "organization_id"
      | "product_id"
      | "created_at"
      | "updated_at"
      | "active"
      | "display_order"
    >[]
  ) => {
    if (!selectedProduct || !currentOrganization) return;
    try {
      setSaving(true);
      setError(null);
      for (const variant of variants) {
        await createProductVariant({
          organization_id: currentOrganization.id,
          product_id: selectedProduct.id,
          ...variant,
        });
      }
      setSuccess("Variants saved!");
      await loadProducts();
      setVariantsDialogOpen(false);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error saving variants:", err);
      setError("Failed to save variants.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVariant = async (variantId: string) => {
    try {
      setError(null);
      await removeProductVariant(variantId);
      setSuccess("Variant deleted.");
      await loadProducts();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error deleting variant:", err);
      setError("Failed to delete variant.");
    }
  };

  const handleToggleVariantActive = async (
    variant: ProductVariant,
    active: boolean
  ) => {
    try {
      setError(null);
      await updateProductVariant(variant.id, { active });
      await loadProducts();
    } catch (err) {
      console.error("Error toggling variant:", err);
      setError("Failed to update variant status.");
    }
  };

  const filteredAndSortedProducts = products
    .filter((product) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        product.name.toLowerCase().includes(query) ||
        product.id.toString().includes(query) ||
        (product.category?.toLowerCase().includes(query) ?? false) ||
        (product.sub_brand?.toLowerCase().includes(query) ?? false)
      );
    })
    .sort((a, b) => {
      const comparison = a.name.localeCompare(b.name);
      return sortOrder === "asc" ? comparison : -comparison;
    });

  return (
    <>
      <ProductDialog
        open={open}
        onOpenChange={setOpen}
        mode={dialogMode}
        values={formValues}
        onChange={patchFormValues}
        error={error}
        saving={saving}
        onSubmit={handleSubmit}
      />

      {selectedProduct && (
        <>
          <OffersDialog
            open={offersDialogOpen}
            onOpenChange={setOffersDialogOpen}
            product={selectedProduct}
            variants={selectedProduct.variants ?? []}
            offers={selectedProduct.offers ?? []}
            onSave={handleSaveOffers}
            onDelete={handleDeleteOffer}
            onToggleActive={handleToggleOfferActive}
            error={error}
            saving={saving}
          />
          <VariantsDialog
            open={variantsDialogOpen}
            onOpenChange={setVariantsDialogOpen}
            product={selectedProduct}
            variants={selectedProduct.variants ?? []}
            onSave={handleSaveVariants}
            onDelete={handleDeleteVariant}
            onToggleActive={handleToggleVariantActive}
            error={error}
            saving={saving}
          />
        </>
      )}

      <ReceiveStockDialog
        open={receiveStockOpen}
        onOpenChange={setReceiveStockOpen}
        product={receiveStockProduct}
        variants={
          receiveStockProduct
            ? products.find((p) => p.id === receiveStockProduct.id)?.variants ?? []
            : []
        }
        organizationId={currentOrganization?.id ?? null}
        onSave={handleSaveReceiveStock}
        error={error}
        saving={saving}
      />

      <PageLayout>
        {success && (
          <SuccessNotification
            message={success}
            onClose={() => setSuccess(null)}
          />
        )}

        <PageHeader onAddNew={handleStartCreate} showAddButton={canCreate} />

        <ProductTable
          products={filteredAndSortedProducts}
          loading={loading}
          error={error}
          onEdit={canUpdate ? handleStartEdit : () => {}}
          onDelete={canDelete ? handleDeleteProduct : () => {}}
          onSetActive={canUpdate ? handleSetProductActive : undefined}
          onManageOffers={canUpdate ? handleManageOffers : () => {}}
          onManageVariants={canUpdate ? handleManageVariants : undefined}
          onReceiveStock={canUpdate ? handleReceiveStock : undefined}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
          canEdit={canUpdate}
          canDelete={canDelete}
        />
      </PageLayout>
    </>
  );
}
