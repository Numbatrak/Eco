import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { InventoryWithRelations } from "../../types/inventory";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { Boxes } from "lucide-react";

interface InventoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  inventory: InventoryWithRelations | null;
  agents: Agent[];
  products: Product[];
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function InventoryDialog({
  open,
  onOpenChange,
  mode,
  inventory,
  agents,
  products,
  error,
  saving,
  onSubmit,
}: InventoryDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [agentId, setAgentId] = useState<string>("__none__");
  const [productId, setProductId] = useState<string>("__none__");
  const [totalQuantity, setTotalQuantity] = useState("0");

  useEffect(() => {
    if (open) {
      if (inventory && mode === "edit") {
        setAgentId(inventory.agent_id?.toString() || "__none__");
        setProductId(
          inventory.product_id?.toString() ||
            (products && products.length > 0 ? products[0].id.toString() : "__none__")
        );
        setTotalQuantity(inventory.total_quantity?.toString() || "0");
      } else {
        setAgentId("__none__");
        setProductId(
          products && products.length > 0 ? products[0].id.toString() : "__none__"
        );
        setTotalQuantity("0");
      }
    }
  }, [open, inventory, mode, products]);

  const handleSubmitClick = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Boxes className="h-7 w-7" aria-hidden />}
          title={mode === "edit" ? "Edit Inventory" : "Add Inventory"}
          description={
            mode === "edit"
              ? "Update inventory allocation"
              : "Allocate products to agents"
          }
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6 w-full">
            {error && <ErrorAlert message={error} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="agent" className="dialog-field-label">
                  Agent
                </Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger id="agent" className="w-full max-w-none">
                    <SelectValue placeholder="Select an agent (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
                    {(agents || []).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="agent_id"
                  value={agentId === "__none__" ? "" : agentId}
                />
              </div>

              <div className="dialog-form-field space-y-2">
                <Label htmlFor="product" className="dialog-field-label">
                  Product *
                </Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="product" className="w-full max-w-none">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
                    {productId === "__none__" && (
                      <SelectItem value="__none__" disabled className="hidden">
                        Loading...
                      </SelectItem>
                    )}
                    {(products || []).map((product) => (
                      <SelectItem
                        key={product.id}
                        value={product.id.toString()}
                      >
                        {product.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input
                  type="hidden"
                  name="product_id"
                  value={productId === "__none__" ? "" : productId}
                />
              </div>
            </div>

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="quantity" className="dialog-field-label">
                Total Quantity *
              </Label>
              <Input
                id="quantity"
                name="total_quantity"
                type="number"
                min="0"
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(e.target.value)}
                className="w-full max-w-none"
                required
              />
            </div>
          </form>
        </div>

        <div className="dialog-footer-bar">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="dialog-cancel-button cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={
              saving ||
              !productId ||
              productId === "__none__" ||
              !totalQuantity ||
              totalQuantity === "0"
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            {saving
              ? "Processing..."
              : mode === "edit"
                ? "Update Inventory"
                : "Add Inventory"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
