import { FormEvent, useState, useEffect, useMemo, useRef } from "react";
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
import { FormResponseWithItems } from "../../types/formResponse";
import { Agent } from "../../types/agent";
import { agentsForAssignment } from "../../utils/agentFilters";
import { FormFieldRenderer } from "./FormFieldRenderer";
import {
  orderProfit,
  potentialOrderProfit,
  balanceDue,
} from "../../utils/formResponseHelpers";
import {
  MONEY_RECEIVED_BY_OPTIONS,
  inferMoneyReceivedBy,
} from "../../constants/orderAttribution";
import type { MoneyReceivedBy } from "../../constants/orderAttribution";
import {
  ORDER_STATUS_SELECT_OPTIONS,
  canAdvanceStatus,
  getNextStatus,
  isDeliveredStatus,
  orderStatusLabel,
} from "../../constants/orderStatus";
import { Product } from "../../types/product";
import { Package, FileText, DollarSign, Truck, ArrowRight, XCircle } from "lucide-react";

interface FormResponseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "view" | "edit";
  response: FormResponseWithItems | null;
  agents: Agent[];
  error: string | null;
  saving: boolean;
  onSave?: (updates: {
    status?: string;
    notes?: string;
    delivery_fee?: number | null;
    amount_paid?: number | null;
    agent_id?: number | null;
    money_received_by?: MoneyReceivedBy;
  }) => Promise<void>;
  onMarkDelivered?: () => Promise<void>;
  onAdvanceStatus?: () => Promise<void>;
  onMarkFailed?: () => Promise<void>;
  onAddUpsell?: (line: {
    product_id: string;
    quantity: number;
    unit_price_at_submission: number;
    unit_cost_at_submission: number;
  }) => Promise<void>;
  products?: Product[];
  quickActions?: boolean;
}

export function FormResponseDialog({
  open,
  onOpenChange,
  mode,
  response,
  agents,
  error,
  saving,
  onSave,
  onMarkDelivered,
  onAdvanceStatus,
  onMarkFailed,
  onAddUpsell,
  products = [],
  quickActions = false,
}: FormResponseDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [status, setStatus] = useState<string>("new");
  const [notes, setNotes] = useState<string>("");
  const [deliveryFee, setDeliveryFee] = useState<string>("");
  const [amountPaid, setAmountPaid] = useState<string>("");
  const [agentId, setAgentId] = useState<string>("");
  const [moneyReceivedBy, setMoneyReceivedBy] = useState<MoneyReceivedBy>("agent_collected");
  const [upsellProductId, setUpsellProductId] = useState("");
  const [upsellQty, setUpsellQty] = useState("1");
  const [upsellSaving, setUpsellSaving] = useState(false);
  const [actionSaving, setActionSaving] = useState<string | null>(null);

  useEffect(() => {
    if (response) {
      setStatus(response.status);
      setNotes(response.notes || "");
      setDeliveryFee(
        response.delivery_fee != null && response.delivery_fee !== 0
          ? String(response.delivery_fee)
          : ""
      );
      setAmountPaid(
        response.amount_paid != null ? String(response.amount_paid) : ""
      );
      setAgentId(response.agent_id != null ? String(response.agent_id) : "");
      setMoneyReceivedBy(
        inferMoneyReceivedBy(
          response.money_received_by ?? undefined,
          response.payment_method ?? undefined
        )
      );
    }
  }, [response]);

  const assignableAgents = useMemo(
    () => agentsForAssignment(agents, response?.agent_id ?? null),
    [agents, response?.agent_id]
  );

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "₦0.00";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!onSave || !response) return;

    const deliveryFeeNum =
      deliveryFee.trim() === "" ? null : parseFloat(deliveryFee);
    const deliveryFeeChanged =
      deliveryFeeNum !== (response.delivery_fee ?? null);
    const amountPaidNum =
      amountPaid.trim() === "" ? null : parseFloat(amountPaid);
    const amountPaidChanged = amountPaidNum !== (response.amount_paid ?? null);
    const newAgentId = agentId.trim() === "" ? null : Number(agentId);
    const agentIdChanged = newAgentId !== (response.agent_id ?? null);
    const moneyReceivedChanged =
      moneyReceivedBy !==
      inferMoneyReceivedBy(
        response.money_received_by ?? undefined,
        response.payment_method ?? undefined
      );

    try {
      await onSave({
        status: status !== response.status ? status : undefined,
        notes: notes !== (response.notes || "") ? notes : undefined,
        ...(deliveryFeeChanged ? { delivery_fee: deliveryFeeNum } : {}),
        ...(amountPaidChanged ? { amount_paid: amountPaidNum } : {}),
        ...(agentIdChanged ? { agent_id: newAgentId } : {}),
        ...(moneyReceivedChanged ? { money_received_by: moneyReceivedBy } : {}),
      });
      onOpenChange(false);
    } catch (err) {
      console.error("Error saving form response:", err);
    }
  };

  if (!response) {
    return null;
  }

  const fullPrice =
    response.order_revenue ??
    response.items.reduce((sum, i) => sum + (i.total_price || 0), 0);
  const totalCost =
    response.order_cost ??
    response.items.reduce((sum, i) => sum + (i.total_cost || 0), 0);
  const amountPaidNum =
    amountPaid.trim() === ""
      ? response.amount_paid ?? null
      : parseFloat(amountPaid) || null;
  const deliveryFeeNum =
    deliveryFee.trim() === ""
      ? response.delivery_fee ?? 0
      : parseFloat(deliveryFee) || 0;
  const isCompleted = isDeliveredStatus(response.status);
  const nextStatus = getNextStatus(response.status);
  const deliveryFeeUnchanged =
    deliveryFee.trim() === "" ||
    parseFloat(deliveryFee) === (response.delivery_fee ?? 0);
  const displayNetProfit = isCompleted
    ? deliveryFeeUnchanged
      ? (response.profit ?? orderProfit(fullPrice, totalCost, deliveryFeeNum))
      : orderProfit(fullPrice, totalCost, deliveryFeeNum)
    : potentialOrderProfit(response.items, deliveryFeeNum);
  const displayBalanceDue = balanceDue(fullPrice, amountPaidNum);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<FileText className="h-7 w-7" aria-hidden />}
          title={
            mode === "edit" ? "Edit Form Response" : "View Form Response"
          }
          description={`${response.form?.name || "Form Response"} • ${response.response_type.replace("_", " ")}`}
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-6 w-full">
            {error && <ErrorAlert message={error} />}

            {/* Summary Section */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg border border-border">
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Customer Name
                </Label>
                <p className="text-sm font-bold text-foreground mt-1">
                  {response.customer_name || (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </p>
              </div>
              <div>
                <Label className="text-xs font-semibold text-muted-foreground">
                  Phone Number
                </Label>
                <p className="text-sm font-bold text-foreground mt-1">
                  {response.phone_number || (
                    <span className="text-muted-foreground italic">Not provided</span>
                  )}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Offer</Label>
                <p className="text-sm font-semibold text-foreground">
                  {response.offer_name || response.package_name || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Funnel</Label>
                <p className="text-sm font-semibold text-foreground">
                  {response.funnel_name || response.form?.name || "N/A"}
                </p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Created</Label>
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(response.created_at)}
                </p>
              </div>
            </div>

            {/* Status and Notes Section */}
            <div className="space-y-4">
              <div className="dialog-form-field">
                <Label
                  htmlFor="status"
                  className="dialog-field-label"
                >
                  Status
                </Label>
                {mode === "edit" ? (
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="status" className="mt-1 w-full max-w-none">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUS_SELECT_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="mt-1 text-sm text-foreground">
                    {orderStatusLabel(status)}
                  </p>
                )}
              </div>

              {quickActions && mode === "edit" && (
                <div className="flex flex-wrap gap-2">
                  {!isCompleted && onMarkDelivered && (
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      disabled={!!actionSaving || saving}
                      onClick={async () => {
                        setActionSaving("deliver");
                        try {
                          await onMarkDelivered();
                        } finally {
                          setActionSaving(null);
                        }
                      }}
                    >
                      <Truck className="w-4 h-4 mr-1" />
                      {actionSaving === "deliver" ? "Saving…" : "Mark delivered"}
                    </Button>
                  )}
                  {canAdvanceStatus(response.status) && onAdvanceStatus && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={!!actionSaving || saving}
                      onClick={async () => {
                        setActionSaving("advance");
                        try {
                          await onAdvanceStatus();
                        } finally {
                          setActionSaving(null);
                        }
                      }}
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      {actionSaving === "advance"
                        ? "Saving…"
                        : `Advance to ${orderStatusLabel(nextStatus)}`}
                    </Button>
                  )}
                  {!isCompleted && onMarkFailed && (
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      disabled={!!actionSaving || saving}
                      onClick={async () => {
                        setActionSaving("failed");
                        try {
                          await onMarkFailed();
                        } finally {
                          setActionSaving(null);
                        }
                      }}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      {actionSaving === "failed" ? "Saving…" : "Mark failed delivery"}
                    </Button>
                  )}
                </div>
              )}

              <div className="dialog-form-field">
                <Label
                  htmlFor="agent"
                  className="dialog-field-label"
                >
                  Assigned agent
                </Label>
                {mode === "edit" ? (
                  <Select
                    value={agentId || "none"}
                    onValueChange={(v) => setAgentId(v === "none" ? "" : v)}
                  >
                    <SelectTrigger id="agent" className="mt-1 w-full max-w-none">
                      <SelectValue placeholder="Select agent (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        <span className="text-muted-foreground">No agent</span>
                      </SelectItem>
                      {assignableAgents.map((agent) => (
                        <SelectItem key={agent.id} value={String(agent.id)}>
                          {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="mt-1 text-sm text-foreground">
                    {response.agent_id != null && agents.length > 0
                      ? agents.find((a) => a.id === response.agent_id)?.name ??
                        "N/A"
                      : "N/A"}
                  </p>
                )}
                <p className="dialog-field-hint mt-1">
                  Optional: assign this order to an agent
                </p>
              </div>

              <div className="dialog-form-field">
                <Label htmlFor="money-received" className="dialog-field-label">
                  Who received the money
                </Label>
                {mode === "edit" ? (
                  <Select
                    value={moneyReceivedBy}
                    onValueChange={(v) => setMoneyReceivedBy(v as MoneyReceivedBy)}
                  >
                    <SelectTrigger id="money-received" className="mt-1 w-full max-w-none">
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
                ) : (
                  <p className="mt-1 text-sm text-foreground">
                    {MONEY_RECEIVED_BY_OPTIONS.find((o) => o.value === moneyReceivedBy)
                      ?.label ?? moneyReceivedBy}
                  </p>
                )}
                <p className="dialog-field-hint mt-1">
                  Agent collected creates a Wallet remittance line when delivered.
                </p>
              </div>

              <div className="dialog-form-field">
                <Label
                  htmlFor="amount_paid"
                  className="dialog-field-label"
                >
                  Amount paid / agreed price (₦)
                </Label>
                {mode === "edit" ? (
                  <Input
                    id="amount_paid"
                    name="amount_paid"
                    type="number"
                    min="0"
                    step="0.01"
                    value={amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    placeholder={formatCurrency(fullPrice)}
                    className="mt-1 w-full max-w-none"
                  />
                ) : (
                  <p className="mt-1 text-sm text-foreground">
                    {response.amount_paid != null
                      ? formatCurrency(response.amount_paid)
                      : formatCurrency(fullPrice) + " (full price)"}
                  </p>
                )}
                <p className="dialog-field-hint mt-1">
                  Leave empty if full price; set when customer bids or pays less
                </p>
              </div>

              <div className="dialog-form-field">
                <Label
                  htmlFor="delivery_fee"
                  className="dialog-field-label"
                >
                  Delivery Fee (₦)
                </Label>
                {mode === "edit" ? (
                  <Input
                    id="delivery_fee"
                    name="delivery_fee"
                    type="number"
                    min="0"
                    step="0.01"
                    value={deliveryFee}
                    onChange={(e) => setDeliveryFee(e.target.value)}
                    placeholder="0"
                    className="mt-1 w-full max-w-none"
                  />
                ) : (
                  <p className="mt-1 text-sm text-foreground">
                    {response.delivery_fee != null &&
                    response.delivery_fee !== 0
                      ? formatCurrency(response.delivery_fee)
                      : "N/A"}
                  </p>
                )}
                <p className="dialog-field-hint mt-1">
                  Subtracted from profit for net profit
                </p>
              </div>

              <div className="dialog-form-field">
                <Label
                  htmlFor="notes"
                  className="dialog-field-label"
                >
                  Notes
                </Label>
                {mode === "edit" ? (
                  <Textarea
                    id="notes"
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add internal notes, follow-up information, or any additional details..."
                    className="mt-1 min-h-[100px] w-full max-w-none"
                    rows={4}
                  />
                ) : (
                  <p className="mt-1 text-sm text-foreground whitespace-pre-wrap">
                    {notes || (
                      <span className="text-muted-foreground italic">No notes</span>
                    )}
                  </p>
                )}
              </div>
            </div>

            {/* Products Section */}
            {response.items.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-muted-foreground" />
                  <Label className="text-sm font-semibold text-foreground">
                    Products ({response.items.length})
                  </Label>
                </div>
                <div className="space-y-2 border border-border rounded-lg p-4 bg-muted/50">
                  {response.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 bg-background rounded border border-border"
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Product {idx + 1} × {item.quantity}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Price: {formatCurrency(item.unit_price_at_submission)}{" "}
                          | Cost: {formatCurrency(item.unit_cost_at_submission)}{" "}
                          | Profit: {formatCurrency(item.profit)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-foreground">
                          {formatCurrency(item.total_price)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Profit: {formatCurrency(item.profit)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <div className="flex justify-between items-center text-sm text-muted-foreground">
                      <span>Full price</span>
                      <span>{formatCurrency(fullPrice)}</span>
                    </div>
                    {amountPaidNum != null && amountPaidNum < fullPrice && (
                      <div className="flex justify-between items-center text-sm text-amber-600 dark:text-amber-400">
                        <span>Amount paid</span>
                        <span>{formatCurrency(amountPaidNum)}</span>
                      </div>
                    )}
                    {displayBalanceDue != null && displayBalanceDue > 0 && (
                      <div className="flex justify-between items-center text-sm font-medium text-amber-600 dark:text-amber-400">
                        <span>Balance due</span>
                        <span>{formatCurrency(displayBalanceDue)}</span>
                      </div>
                    )}
                    {deliveryFeeNum > 0 && (
                      <div className="flex justify-between items-center text-sm text-muted-foreground">
                        <span>Delivery fee</span>
                        <span>{formatCurrency(deliveryFeeNum)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-muted-foreground" />
                        <span className="text-sm font-semibold text-foreground">
                          {isCompleted ? "Net Profit" : "Potential Net Profit"}:
                        </span>
                      </div>
                      <span
                        className={`text-lg font-bold ${
                          displayNetProfit >= 0
                            ? "text-primary"
                            : "text-destructive"
                        }`}
                      >
                        {formatCurrency(displayNetProfit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {mode === "edit" &&
              onAddUpsell &&
              products.length > 0 &&
              !isCompleted && (
                <div className="space-y-3 p-4 border border-dashed border-border rounded-lg">
                  <Label className="text-sm font-semibold">Add upsell</Label>
                  <div className="flex flex-wrap gap-2 items-end">
                    <div className="flex-1 min-w-[160px]">
                      <Select
                        value={upsellProductId || "none"}
                        onValueChange={(v) =>
                          setUpsellProductId(v === "none" ? "" : v)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Select product</SelectItem>
                          {products
                            .filter((p) => p.active !== false)
                            .map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input
                      className="w-20"
                      type="number"
                      min={1}
                      value={upsellQty}
                      onChange={(e) => setUpsellQty(e.target.value)}
                    />
                    <Button
                      type="button"
                      size="sm"
                      disabled={upsellSaving || !upsellProductId}
                      onClick={async () => {
                        const product = products.find(
                          (p) => p.id === upsellProductId
                        );
                        const qty = parseInt(upsellQty, 10);
                        if (!product || !Number.isFinite(qty) || qty <= 0) return;
                        setUpsellSaving(true);
                        try {
                          await onAddUpsell({
                            product_id: product.id,
                            quantity: qty,
                            unit_price_at_submission: product.base_price ?? 0,
                            unit_cost_at_submission: product.cost_price ?? 0,
                          });
                          setUpsellProductId("");
                          setUpsellQty("1");
                        } finally {
                          setUpsellSaving(false);
                        }
                      }}
                    >
                      {upsellSaving ? "Adding…" : "Add line"}
                    </Button>
                  </div>
                </div>
              )}

            {/* Form Data Section */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-muted-foreground" />
                <Label className="text-sm font-semibold text-foreground">
                  Form Data
                </Label>
              </div>
              <FormFieldRenderer
                fieldValues={response.field_values}
                formSchema={response.form?.schema || null}
              />
            </div>

            {/* Metadata Section */}
            <div className="space-y-3 p-4 bg-muted/50 rounded-lg border border-border">
              <Label className="text-sm font-semibold text-foreground">
                Metadata
              </Label>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Form:</span>{" "}
                  <span className="font-medium">
                    {response.form?.name || "Unknown"}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Source:</span>{" "}
                  <span className="font-medium capitalize">
                    {response.source}
                  </span>
                </div>
                {response.page_url && (
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Page URL:</span>{" "}
                    <a
                      href={response.page_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline break-all"
                    >
                      {response.page_url}
                    </a>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Response Type:</span>{" "}
                  <span className="font-medium capitalize">
                    {response.response_type.replace("_", " ")}
                  </span>
                </div>
                {response.completed_at && (
                  <div>
                    <span className="text-muted-foreground">Completed:</span>{" "}
                    <span className="font-medium">
                      {formatDate(response.completed_at)}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Last Updated:</span>{" "}
                  <span className="font-medium">
                    {formatDate(response.updated_at)}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </div>

        {mode === "edit" && (
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
              onClick={() => formRef.current?.requestSubmit()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
            >
              {saving ? (
                <>
                  <svg
                    className="animate-spin h-4 w-4 text-primary-foreground"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Saving...
                </>
              ) : (
                <>
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Save Changes
                </>
              )}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
