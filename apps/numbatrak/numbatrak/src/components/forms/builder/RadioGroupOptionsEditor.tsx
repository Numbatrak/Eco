import { ChevronDown, ChevronRight, Package, Plus, Radio, Trash2 } from "lucide-react";
import { Product, ProductOffer, ProductVariant } from "../../../types/product";
import { FormField, RadioOption, RadioOptionProduct } from "../../../types/form";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "../../../utils/numericInput";
import { offerLabel, offersForProduct, offersForRadioOption } from "../../../utils/formOfferItems";

interface RadioGroupOptionsEditorProps {
  field: FormField;
  fieldIndex: number;
  products: Product[];
  offersByProduct: Record<string, ProductOffer[]>;
  variantsByProduct: Record<string, ProductVariant[]>;
  productsLoading: boolean;
  expandedRadioOptions: Set<string>;
  onToggleExpand: (optionId: string) => void;
  onAddOption: (fieldIndex: number) => void;
  onUpdateOption: (fieldIndex: number, optionIndex: number, updates: Partial<RadioOption>) => void;
  onRemoveOption: (fieldIndex: number, optionIndex: number) => void;
  onAddProduct: (fieldIndex: number, optionIndex: number) => void;
  onUpdateProduct: (
    fieldIndex: number,
    optionIndex: number,
    productIndex: number,
    updates: Partial<RadioOptionProduct>
  ) => void;
  onRemoveProduct: (fieldIndex: number, optionIndex: number, productIndex: number) => void;
  onApplyOffer: (fieldIndex: number, optionIndex: number, offerId: string | null) => void;
}

/** Options + attached-products editor for a radio-group field, shown in the field settings panel. */
export function RadioGroupOptionsEditor({
  field,
  fieldIndex,
  products,
  offersByProduct,
  variantsByProduct,
  productsLoading,
  expandedRadioOptions,
  onToggleExpand,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onAddProduct,
  onUpdateProduct,
  onRemoveProduct,
  onApplyOffer,
}: RadioGroupOptionsEditorProps) {
  const radioOptions = field.radioOptions ?? [];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground">Options</span>
          <span className="text-xs text-muted-foreground">({radioOptions.length})</span>
        </div>
        <button
          type="button"
          onClick={() => onAddOption(fieldIndex)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold rounded-lg transition-all"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Option
        </button>
      </div>

      {radioOptions.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-border rounded-lg bg-muted">
          <Radio className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No options yet</p>
          <p className="text-xs text-muted-foreground mb-4">Add options for users to choose from</p>
          <button
            type="button"
            onClick={() => onAddOption(fieldIndex)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold rounded-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            Add First Option
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {radioOptions.map((option, optIndex) => {
            const isExpanded = expandedRadioOptions.has(option.id);
            const totalCost = option.products.reduce((sum, { product_id, quantity }) => {
              const product = products.find((p) => p.id === product_id);
              const cost = product?.cost_price ?? 0;
              return sum + cost * (quantity || 1);
            }, 0);
            const packageProfit = (option.price ?? 0) - totalCost;
            const availableOffers = offersForRadioOption(option.products, offersByProduct);

            return (
              <div key={option.id} className="radio-option-card">
                <div className="p-4">
                  <div className="radio-option-header">
                    <div className="radio-indicator">
                      <Radio className="w-3.5 h-3.5" />
                    </div>
                    <div className="radio-option-content">
                      <input
                        type="text"
                        value={option.title}
                        onChange={(e) => onUpdateOption(fieldIndex, optIndex, { title: e.target.value })}
                        placeholder="Option title (e.g., 4 Medium Mats + Free Delivery)"
                        className="radio-option-title-input"
                      />
                      <input
                        type="text"
                        value={option.value}
                        onChange={(e) => onUpdateOption(fieldIndex, optIndex, { value: e.target.value })}
                        placeholder="option_value"
                        className="radio-option-value-input"
                      />
                      <div className="flex items-center gap-2">
                        <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                          Price (₦):
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={option.price ?? 0}
                          onChange={(e) => {
                            const price = parseFloat(sanitizeDecimalInput(e.target.value)) || 0;
                            onUpdateOption(fieldIndex, optIndex, { price });
                          }}
                          placeholder="0.00"
                          className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                          required
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                        <span>
                          Total cost: ₦
                          {totalCost.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className={packageProfit >= 0 ? "text-green-600 font-semibold" : "text-red-600 font-semibold"}>
                          Profit: ₦
                          {packageProfit.toLocaleString("en-NG", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}
                        </span>
                      </div>

                      {availableOffers.length > 0 && (
                        <div className="flex items-center gap-2 mt-2">
                          <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">
                            Package offer:
                          </label>
                          <select
                            value={option.offer_id ?? ""}
                            onChange={(e) => onApplyOffer(fieldIndex, optIndex, e.target.value || null)}
                            className="flex-1 px-3 py-1.5 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                          >
                            <option value="">None (use display price)</option>
                            {availableOffers.map((o) => (
                              <option key={o.id} value={o.id}>
                                {offerLabel(o)}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className="product-attachment-header">
                        <button
                          type="button"
                          onClick={() => onToggleExpand(option.id)}
                          className="btn-secondary text-sm"
                        >
                          {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          <Package className="w-4 h-4" />
                          Products ({option.products.length})
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveOption(fieldIndex, optIndex)}
                          className="btn-icon btn-icon-danger"
                          title="Remove option"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="product-attachment-section bg-card">
                    <div className="product-attachment-header">
                      <span className="text-xs font-semibold text-muted-foreground">ATTACHED PRODUCTS</span>
                      <button
                        type="button"
                        onClick={() => onAddProduct(fieldIndex, optIndex)}
                        disabled={productsLoading || products.length === 0}
                        className="btn-primary text-xs"
                        title={
                          productsLoading
                            ? "Loading products..."
                            : products.length === 0
                              ? "No products available. Create products first."
                              : "Add product"
                        }
                      >
                        <Plus className="w-3 h-3" />
                        Add
                      </button>
                    </div>

                    {option.products.length === 0 ? (
                      <div className="text-center py-6 border-2 border-dashed border-border rounded-lg bg-muted">
                        <Package className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">No products attached</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {option.products.map((product, prodIndex) => (
                          <div key={prodIndex} className="product-item space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <select
                                value={product.product_id}
                                onChange={(e) =>
                                  onUpdateProduct(fieldIndex, optIndex, prodIndex, { product_id: e.target.value })
                                }
                                className="product-select"
                                disabled={productsLoading || products.length === 0}
                              >
                                {productsLoading ? (
                                  <option value="">Loading products...</option>
                                ) : products.length === 0 ? (
                                  <option value="">No products available</option>
                                ) : (
                                  <>
                                    <option value="">Select product</option>
                                    {products.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name}
                                      </option>
                                    ))}
                                  </>
                                )}
                              </select>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={product.quantity}
                                onChange={(e) =>
                                  onUpdateProduct(fieldIndex, optIndex, prodIndex, {
                                    quantity: parseInt(sanitizeIntegerInput(e.target.value)) || 1,
                                  })
                                }
                                className="product-quantity"
                              />
                              <button
                                type="button"
                                onClick={() => onRemoveProduct(fieldIndex, optIndex, prodIndex)}
                                className="btn-icon btn-icon-danger"
                                title="Remove product"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                            {product.product_id &&
                              (variantsByProduct[product.product_id]?.filter((v) => v.active).length ?? 0) > 0 && (
                                <select
                                  value={product.variant_id ?? ""}
                                  onChange={(e) =>
                                    onUpdateProduct(fieldIndex, optIndex, prodIndex, {
                                      variant_id: e.target.value || null,
                                    })
                                  }
                                  className="product-select text-xs"
                                >
                                  <option value="">No variant</option>
                                  {variantsByProduct[product.product_id]
                                    ?.filter((v) => v.active)
                                    .map((v) => (
                                      <option key={v.id} value={v.id}>
                                        {v.name}
                                      </option>
                                    ))}
                                </select>
                              )}
                            {product.product_id && offersForProduct(offersByProduct, product.product_id).length > 0 && (
                              <select
                                value={product.offer_id ?? ""}
                                onChange={(e) =>
                                  onUpdateProduct(fieldIndex, optIndex, prodIndex, {
                                    offer_id: e.target.value || null,
                                  })
                                }
                                className="product-select text-xs"
                              >
                                <option value="">{option.offer_id ? "Use package offer" : "No line offer"}</option>
                                {offersForProduct(offersByProduct, product.product_id).map((o) => (
                                  <option key={o.id} value={o.id}>
                                    {offerLabel(o)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
