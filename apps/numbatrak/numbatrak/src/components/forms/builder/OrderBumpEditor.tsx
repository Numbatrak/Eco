import { CheckSquare, Plus, Trash2 } from "lucide-react";
import { Product } from "../../../types/product";
import { FormField } from "../../../types/form";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "../../../utils/numericInput";

interface OrderBumpEditorProps {
  field: FormField;
  fieldIndex: number;
  products: Product[];
  onUpdateField: (index: number, updates: Partial<FormField>) => void;
}

/** Title/price/attached-products editor for an order-bump field, shown in the field settings panel. */
export function OrderBumpEditor({ field, fieldIndex, products, onUpdateField }: OrderBumpEditorProps) {
  const orderBump = field.orderBump;
  if (!orderBump) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <CheckSquare className="w-4 h-4 text-muted-foreground" />
        <span className="text-sm font-bold text-foreground">Order Bump Offer</span>
      </div>
      <input
        type="text"
        value={orderBump.title}
        onChange={(e) => onUpdateField(fieldIndex, { orderBump: { ...orderBump, title: e.target.value } })}
        placeholder="Bump title (e.g. Add 1 extra mat)"
        className="form-input text-sm"
      />
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Price (₦):</label>
        <input
          type="text"
          inputMode="decimal"
          value={orderBump.price ?? 0}
          onChange={(e) =>
            onUpdateField(fieldIndex, {
              orderBump: { ...orderBump, price: parseFloat(sanitizeDecimalInput(e.target.value)) || 0 },
            })
          }
          className="form-input text-sm flex-1"
        />
      </div>
      <div className="space-y-2">
        <span className="text-xs font-semibold text-muted-foreground">ATTACHED PRODUCTS</span>
        {(orderBump.products ?? []).map((product, prodIndex) => (
          <div key={`${product.product_id}-${prodIndex}`} className="flex items-center gap-2">
            <select
              value={product.product_id}
              onChange={(e) => {
                const nextProducts = [...(orderBump.products ?? [])];
                nextProducts[prodIndex] = { ...nextProducts[prodIndex], product_id: e.target.value };
                onUpdateField(fieldIndex, { orderBump: { ...orderBump, products: nextProducts } });
              }}
              className="form-input text-sm flex-1"
            >
              <option value="">Select product</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              inputMode="numeric"
              value={product.quantity}
              onChange={(e) => {
                const nextProducts = [...(orderBump.products ?? [])];
                nextProducts[prodIndex] = {
                  ...nextProducts[prodIndex],
                  quantity: parseInt(sanitizeIntegerInput(e.target.value), 10) || 1,
                };
                onUpdateField(fieldIndex, { orderBump: { ...orderBump, products: nextProducts } });
              }}
              className="form-input text-sm w-20"
            />
            <button
              type="button"
              onClick={() => {
                const nextProducts = (orderBump.products ?? []).filter((_, i) => i !== prodIndex);
                onUpdateField(fieldIndex, { orderBump: { ...orderBump, products: nextProducts } });
              }}
              className="btn-icon btn-icon-danger"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => {
            const nextProducts = [...(orderBump.products ?? []), { product_id: "", quantity: 1 }];
            onUpdateField(fieldIndex, { orderBump: { ...orderBump, products: nextProducts } });
          }}
          className="btn-secondary text-sm"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>
    </div>
  );
}
