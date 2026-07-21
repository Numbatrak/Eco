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
import { DeliveryWithRelations } from "../../types/delivery";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { Truck } from "lucide-react";

interface DeliveryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  delivery: DeliveryWithRelations | null;
  agents: Agent[];
  products: Product[];
  subBrandOptions?: string[];
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

export function DeliveryDialog({
  open,
  onOpenChange,
  mode,
  delivery,
  agents,
  products,
  subBrandOptions = [],
  error,
  saving,
  onSubmit,
}: DeliveryDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState("");
  const [csr, setCsr] = useState("");
  const [agentId, setAgentId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"Waybilled" | "Delivered">("Delivered");
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [quantity, setQuantity] = useState("1");
  const [cost, setCost] = useState("0");
  const [waybillingFee, setWaybillingFee] = useState("0");
  const [subBrand, setSubBrand] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      if (delivery && mode === "edit") {
        setDate(delivery.date);
        setCsr(delivery.csr || "");
        setAgentId(delivery.agent_id?.toString() || undefined);
        setStatus(delivery.status);
        setProductId(delivery.product_id?.toString() || undefined);
        setQuantity(delivery.quantity?.toString() || "0");
        setCost(delivery.cost?.toString() || "0");
        setWaybillingFee(delivery.waybilling_fee?.toString() || "0");
        setSubBrand(delivery.sub_brand || undefined);
      } else {
        setDate(new Date().toISOString().split("T")[0]);
        setCsr("");
        setAgentId(undefined);
        setStatus("Delivered");
        setProductId(undefined);
        setQuantity("1");
        setCost("0");
        setWaybillingFee("0");
        setSubBrand(undefined);
      }
    }
  }, [open, delivery, mode]);

  const handleSubmitClick = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Truck className="h-7 w-7" aria-hidden />}
          title={mode === "edit" ? "Edit Delivery" : "Add Delivery"}
          description={
            mode === "edit"
              ? "Update delivery information"
              : "Add a new delivery or waybill entry"
          }
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6 w-full">
            {error && <ErrorAlert message={error} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="date" className="dialog-field-label">
                  Date *
                </Label>
                <Input
                  id="date"
                  name="date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full max-w-none"
                  required
                />
              </div>

              <div className="dialog-form-field space-y-2">
                <Label htmlFor="csr" className="dialog-field-label">
                  CSR (Customer Sales Rep)
                </Label>
                <Input
                  id="csr"
                  name="csr"
                  type="text"
                  value={csr}
                  onChange={(e) => setCsr(e.target.value)}
                  placeholder="Optional"
                  className="w-full max-w-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="agent" className="dialog-field-label">
                  Agent
                </Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger id="agent" className="w-full max-w-none">
                    <SelectValue placeholder="Select an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {(agents || []).map((agent) => (
                      <SelectItem key={agent.id} value={agent.id.toString()}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="agent_id" value={agentId || ""} />
              </div>

              <div className="dialog-form-field space-y-2">
                <Label htmlFor="status" className="dialog-field-label">
                  Status *
                </Label>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as "Waybilled" | "Delivered")
                  }
                >
                  <SelectTrigger id="status" className="w-full max-w-none">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Delivered">Delivered</SelectItem>
                    <SelectItem value="Waybilled">Waybilled</SelectItem>
                  </SelectContent>
                </Select>
                <input type="hidden" name="status" value={status} />
              </div>
            </div>

            {subBrandOptions.length > 0 && (
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="sub-brand" className="dialog-field-label">
                  Sub-brand
                </Label>
                <Select value={subBrand} onValueChange={setSubBrand}>
                  <SelectTrigger id="sub-brand" className="w-full max-w-none">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {subBrandOptions.map((brand) => (
                      <SelectItem key={brand} value={brand}>
                        {brand}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <input type="hidden" name="sub_brand" value={subBrand || ""} />
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="product" className="dialog-field-label">
                  Product *
                </Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="product" className="w-full max-w-none">
                    <SelectValue placeholder="Select a product" />
                  </SelectTrigger>
                  <SelectContent>
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
                <input type="hidden" name="product_id" value={productId || ""} />
              </div>

              <div className="dialog-form-field space-y-2">
                <Label htmlFor="quantity" className="dialog-field-label">
                  Quantity *
                </Label>
                <Input
                  id="quantity"
                  name="quantity"
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full max-w-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="cost" className="dialog-field-label">
                  Cost (₦) *
                </Label>
                <Input
                  id="cost"
                  name="cost"
                  type="number"
                  min="0"
                  step="0.01"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  className="w-full max-w-none"
                  required
                />
              </div>

              <div className="dialog-form-field space-y-2">
                <Label htmlFor="waybilling-fee" className="dialog-field-label">
                  Waybilling Fee (₦)
                </Label>
                <Input
                  id="waybilling-fee"
                  name="waybilling_fee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={waybillingFee}
                  onChange={(e) => setWaybillingFee(e.target.value)}
                  placeholder="Optional"
                  className="w-full max-w-none"
                />
              </div>
            </div>
          </form>
        </div>

        <div className="dialog-footer-bar">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="dialog-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={
              saving || !date || !status || !productId || !quantity || !cost
            }
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <>
                <svg
                  className="animate-spin h-4 w-4 text-primary-foreground"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  aria-hidden
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Processing...
              </>
            ) : mode === "edit" ? (
              "Update Delivery"
            ) : (
              "Create Delivery"
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
