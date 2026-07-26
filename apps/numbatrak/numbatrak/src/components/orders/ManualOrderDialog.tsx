import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Plus, ShoppingBag, Trash2, X, Check } from "lucide-react";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { agentsForAssignment } from "../../utils/agentFilters";
import {
  MONEY_RECEIVED_BY_OPTIONS,
  type MoneyReceivedBy,
} from "../../constants/orderAttribution";

export type ManualOrderLine = {
  product_id: string;
  quantity: number;
  unit_price_at_submission: number;
  unit_cost_at_submission: number;
};

export type ManualOrderFormValues = {
  customer_name: string;
  phone_number: string;
  state: string;
  delivery_address: string;
  agent_id: number | null;
  delivery_fee: number | null;
  amount_paid: number | null;
  money_received_by: MoneyReceivedBy;
  funnel_name: string;
  offer_name: string;
  sub_brand: string;
  notes: string;
  items: ManualOrderLine[];
};

interface ManualOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Agent[];
  products: Product[];
  error: string | null;
  saving: boolean;
  onSubmit: (values: ManualOrderFormValues) => Promise<void>;
};

type LineDraft = {
  id: string;
  product_id: string;
  quantity: string;
};

let lineIdCounter = 0;

function createLineDraft(): LineDraft {
  lineIdCounter += 1;
  return {
    id: `manual-order-line-${lineIdCounter}`,
    product_id: "",
    quantity: "1",
  };
}

export function ManualOrderDialog({
  open,
  onOpenChange,
  agents,
  products,
  error,
  saving,
  onSubmit,
}: ManualOrderDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [state, setState] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [agentId, setAgentId] = useState("");
  const [deliveryFee, setDeliveryFee] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [moneyReceivedBy, setMoneyReceivedBy] =
    useState<MoneyReceivedBy>("agent_collected");
  const [funnelName, setFunnelName] = useState("");
  const [offerName, setOfferName] = useState("");
  const [subBrand, setSubBrand] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<LineDraft[]>(() => [createLineDraft()]);
  const [localError, setLocalError] = useState<string | null>(null);

  const assignableAgents = useMemo(
    () => agentsForAssignment(agents, null),
    [agents]
  );

  const activeProducts = useMemo(
    () => products.filter((p) => p.active !== false),
    [products]
  );

  useEffect(() => {
    if (!open) return;
    setCustomerName("");
    setPhoneNumber("");
    setState("");
    setDeliveryAddress("");
    setAgentId("");
    setDeliveryFee("");
    setAmountPaid("");
    setMoneyReceivedBy("agent_collected");
    setFunnelName("");
    setOfferName("");
    setSubBrand("");
    setNotes("");
    setLocalError(null);
    setLines([createLineDraft()]);
  }, [open]);

  const resolveLine = (line: LineDraft): ManualOrderLine | null => {
    const product = activeProducts.find((p) => p.id === line.product_id);
    const qty = parseInt(line.quantity, 10);
    if (!product || !Number.isFinite(qty) || qty <= 0) return null;
    return {
      product_id: product.id,
      quantity: qty,
      unit_price_at_submission: product.base_price ?? 0,
      unit_cost_at_submission: product.cost_price ?? 0,
    };
  };

  const previewTotal = lines.reduce((sum, line) => {
    const resolved = resolveLine(line);
    if (!resolved) return sum;
    return sum + resolved.unit_price_at_submission * resolved.quantity;
  }, 0);

  const handleAddProductLine = () => {
    setLines((prev) => [...prev, createLineDraft()]);
  };

  const handleRemoveLine = (lineId: string) => {
    setLines((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((line) => line.id !== lineId);
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLocalError(null);

    const items = lines
      .map(resolveLine)
      .filter((l): l is ManualOrderLine => l != null);

    if (!customerName.trim()) {
      setLocalError("Customer name is required.");
      return;
    }
    if (!items.length) {
      setLocalError("Select at least one product with a valid quantity.");
      return;
    }

    try {
      await onSubmit({
        customer_name: customerName.trim(),
        phone_number: phoneNumber.trim(),
        state: state.trim(),
        delivery_address: deliveryAddress.trim(),
        agent_id: agentId.trim() === "" ? null : Number(agentId),
        delivery_fee: deliveryFee.trim() === "" ? null : parseFloat(deliveryFee),
        amount_paid: amountPaid.trim() === "" ? null : parseFloat(amountPaid),
        money_received_by: moneyReceivedBy,
        funnel_name: funnelName.trim(),
        offer_name: offerName.trim(),
        sub_brand: subBrand.trim(),
        notes: notes.trim(),
        items,
      });
      onOpenChange(false);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to create order.";
      setLocalError(message);
    }
  };

  const displayError = localError || error;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<ShoppingBag className="h-7 w-7" aria-hidden />}
          title="New manual order"
          description="Phone, DM, or walk-in — snapshots prices at creation"
        />

        <div className="dialog-body-scroll max-h-standard p-6">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
            {displayError && <ErrorAlert message={displayError} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-customer" className="dialog-field-label">
                  Customer name *
                </Label>
                <Input
                  id="manual-customer"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  required
                />
              </div>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-phone" className="dialog-field-label">
                  Phone
                </Label>
                <Input
                  id="manual-phone"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                />
              </div>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-state" className="dialog-field-label">
                  State
                </Label>
                <Input
                  id="manual-state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                />
              </div>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-address" className="dialog-field-label">
                  Delivery address
                </Label>
                <Input
                  id="manual-address"
                  value={deliveryAddress}
                  onChange={(e) => setDeliveryAddress(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <Label className="dialog-field-label">Products *</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddProductLine}
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Add Another Product
                </Button>
              </div>
              <div className="space-y-3">
                {lines.map((line) => (
                  <div
                    key={line.id}
                    className="flex flex-wrap gap-3 items-end rounded-lg border border-border bg-muted/30 p-3"
                  >
                    <div className="dialog-form-field space-y-2 flex-1 min-w-[180px]">
                      <Label className="dialog-field-label text-xs">
                        Product
                      </Label>
                      <Select
                        value={line.product_id || "none"}
                        onValueChange={(v) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id
                                ? {
                                    ...l,
                                    product_id: v === "none" ? "" : v,
                                  }
                                : l
                            )
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select product</SelectItem>
                          {activeProducts.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="dialog-form-field space-y-2 w-24 shrink-0">
                      <Label className="dialog-field-label text-xs">Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        placeholder="Qty"
                        value={line.quantity}
                        onChange={(e) =>
                          setLines((prev) =>
                            prev.map((l) =>
                              l.id === line.id
                                ? { ...l, quantity: e.target.value }
                                : l
                            )
                          )
                        }
                      />
                    </div>
                    {lines.length > 1 && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="shrink-0 mb-0.5"
                        aria-label="Remove product line"
                        onClick={() => handleRemoveLine(line.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground">
                Order total (before delivery): ₦
                {previewTotal.toLocaleString("en-NG")}
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-agent" className="dialog-field-label">
                  Assigned agent
                </Label>
                <Select
                  value={agentId || "none"}
                  onValueChange={(v) => setAgentId(v === "none" ? "" : v)}
                >
                  <SelectTrigger id="manual-agent">
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No agent</SelectItem>
                    {assignableAgents.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-money" className="dialog-field-label">
                  Who received the money
                </Label>
                <Select
                  value={moneyReceivedBy}
                  onValueChange={(v) =>
                    setMoneyReceivedBy(v as MoneyReceivedBy)
                  }
                >
                  <SelectTrigger id="manual-money">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MONEY_RECEIVED_BY_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="dialog-form-field space-y-2">
                <Label
                  htmlFor="manual-delivery-fee"
                  className="dialog-field-label"
                >
                  Delivery fee (₦)
                </Label>
                <Input
                  id="manual-delivery-fee"
                  type="number"
                  min={0}
                  step="0.01"
                  value={deliveryFee}
                  onChange={(e) => setDeliveryFee(e.target.value)}
                />
              </div>
              <div className="dialog-form-field space-y-2">
                <Label
                  htmlFor="manual-amount-paid"
                  className="dialog-field-label"
                >
                  Amount paid (₦)
                </Label>
                <Input
                  id="manual-amount-paid"
                  type="number"
                  min={0}
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                />
              </div>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-funnel" className="dialog-field-label">
                  Funnel
                </Label>
                <Input
                  id="manual-funnel"
                  value={funnelName}
                  onChange={(e) => setFunnelName(e.target.value)}
                />
              </div>
              <div className="dialog-form-field space-y-2">
                <Label htmlFor="manual-offer" className="dialog-field-label">
                  Offer
                </Label>
                <Input
                  id="manual-offer"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                />
              </div>
              <div className="dialog-form-field space-y-2 md:col-span-2">
                <Label htmlFor="manual-sub-brand" className="dialog-field-label">
                  Sub-brand
                </Label>
                <Input
                  id="manual-sub-brand"
                  value={subBrand}
                  onChange={(e) => setSubBrand(e.target.value)}
                />
              </div>
            </div>

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="manual-notes" className="dialog-field-label">
                Notes
              </Label>
              <Textarea
                id="manual-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="gap-2"
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
              <Button type="submit" disabled={saving} className="gap-2">
                <Check className="w-4 h-4" />
                {saving ? "Creating…" : "Create order"}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
