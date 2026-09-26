import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ProductWithDetails } from "../../types/product";
import { Agent } from "../../types/agent";
import { intakeWaybillBatch } from "../../services/waybillIntake";
import { fetchStockGrid, buildOnHandMap, onHandKey } from "../../services/agentStock";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { ErrorAlert } from "../agents/ErrorAlert";
import { sanitizeDecimalInput, sanitizeIntegerInput } from "../../utils/numericInput";
import { Package, Plus } from "lucide-react";

type Line = {
  to_agent_id: string;
  product_id: string;
  variant_id: string;
  quantity: string;
  cost: string;
  fee: string;
};

const emptyLine = (): Line => ({
  to_agent_id: "",
  product_id: "",
  variant_id: "",
  quantity: "",
  cost: "",
  fee: "",
});

interface WaybillBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  agents: Agent[];
  products: ProductWithDetails[];
  onSuccess?: () => void;
}

export function WaybillBatchDialog({
  open,
  onOpenChange,
  organizationId,
  agents,
  products,
  onSuccess,
}: WaybillBatchDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hqOnHand, setHqOnHand] = useState<Map<number, Map<string, number>>>(new Map());

  const warehouseAgent = useMemo(() => agents.find((a) => a.is_warehouse) ?? null, [agents]);

  useEffect(() => {
    if (open) {
      setOccurredAt(new Date().toISOString().slice(0, 10));
      setLines([emptyLine(), emptyLine()]);
      setError(null);
      setSaving(false);
      fetchStockGrid(organizationId)
        .then(({ rows }) => setHqOnHand(buildOnHandMap(rows)))
        .catch(() => setHqOnHand(new Map()));
    }
  }, [open, organizationId]);

  const addLine = () => setLines((x) => [...x, emptyLine()]);

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const variantsForLine = (line: Line) => {
    const product = productById.get(line.product_id);
    if (!product?.allows_variants) return [];
    return (product.variants ?? []).filter((v) => v.active !== false);
  };

  const hqOnHandForLine = (line: Line): number | null => {
    if (!warehouseAgent || !line.product_id) return null;
    return hqOnHand.get(warehouseAgent.id)?.get(onHandKey(line.product_id, line.variant_id || null)) ?? 0;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed: {
      to_agent_id: number;
      product_id: string;
      variant_id: string | null;
      quantity: number;
      cost: number;
      fee: number;
    }[] = [];
    for (const l of lines) {
      if (!l.to_agent_id || !l.product_id) continue;
      const q = parseInt(l.quantity, 10);
      if (!q || q < 1) {
        setError("Each line needs a valid quantity.");
        return;
      }
      if (variantsForLine(l).length > 0 && !l.variant_id) {
        setError(`Select a variant for ${productById.get(l.product_id)?.name ?? "a product"}.`);
        return;
      }
      const onHand = hqOnHandForLine(l);
      if (onHand != null && q > onHand) {
        setError(
          `Insufficient HQ warehouse stock for ${productById.get(l.product_id)?.name ?? "product"}: on hand ${onHand}, requested ${q}.`
        );
        return;
      }
      parsed.push({
        to_agent_id: parseInt(l.to_agent_id, 10),
        product_id: l.product_id,
        variant_id: l.variant_id || null,
        quantity: q,
        cost: parseFloat(l.cost) || 0,
        fee: parseFloat(l.fee) || 0,
      });
    }
    if (!parsed.length) {
      setError("Add at least one line with agent and product.");
      return;
    }
    try {
      setSaving(true);
      await intakeWaybillBatch({
        organization_id: organizationId,
        occurred_at: new Date(occurredAt + "T12:00:00").toISOString(),
        lines: parsed.map((l) => ({
          agent_id: l.to_agent_id,
          product_id: l.product_id,
          variant_id: l.variant_id,
          quantity: l.quantity,
          cost: l.cost,
          waybilling_fee: l.fee,
        })),
      });
      onSuccess?.();
      onOpenChange(false);
    } catch (err: unknown) {
      console.error(err);
      const msg =
        err && typeof err === "object" && "message" in err
          ? String((err as { message?: string }).message)
          : "";
      setError(msg || "Failed to post waybill batch");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmitClick = () => {
    formRef.current?.requestSubmit();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={<Package className="h-7 w-7" aria-hidden />}
          title="Bulk Waybill Out"
          description="Record Lagos → agent stock, delivery rows, and waybill fees in one batch"
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6 w-full">
            {error && <ErrorAlert message={error} />}

            <div className="dialog-form-field space-y-2">
              <Label htmlFor="occurred-at" className="dialog-field-label">
                Occurred Date *
              </Label>
              <Input
                id="occurred-at"
                type="date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                className="w-full max-w-none"
                required
              />
            </div>

            <p className="dialog-field-hint">
              All lines share one{" "}
              <code className="text-xs rounded bg-muted px-1 py-0.5">
                waybill_batch_id
              </code>{" "}
              (generated on save).
            </p>

            <div className="space-y-4">
              {lines.map((line, i) => (
                <div
                  key={i}
                  className="dialog-readonly-panel space-y-4"
                >
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Line {i + 1}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="dialog-form-field space-y-2">
                      <Label className="dialog-field-label">Agent *</Label>
                      <Select
                        value={line.to_agent_id || undefined}
                        onValueChange={(value) =>
                          updateLine(i, { to_agent_id: value })
                        }
                      >
                        <SelectTrigger className="w-full max-w-none">
                          <SelectValue placeholder="Select agent" />
                        </SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.id} value={a.id.toString()}>
                              {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="dialog-form-field space-y-2">
                      <Label className="dialog-field-label">Product *</Label>
                      <Select
                        value={line.product_id || undefined}
                        onValueChange={(value) =>
                          updateLine(i, { product_id: value, variant_id: "" })
                        }
                      >
                        <SelectTrigger className="w-full max-w-none">
                          <SelectValue placeholder="Select product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {(() => {
                        const onHand = hqOnHandForLine(line);
                        return onHand != null && (variantsForLine(line).length === 0 || line.variant_id) ? (
                          <p className="text-xs text-muted-foreground">
                            On hand at HQ:{" "}
                            <span className="font-semibold text-foreground">{onHand}</span>
                          </p>
                        ) : null;
                      })()}
                    </div>

                    {variantsForLine(line).length > 0 && (
                      <div className="dialog-form-field space-y-2">
                        <Label className="dialog-field-label">Variant *</Label>
                        <Select
                          value={line.variant_id || undefined}
                          onValueChange={(value) =>
                            updateLine(i, { variant_id: value })
                          }
                        >
                          <SelectTrigger className="w-full max-w-none">
                            <SelectValue placeholder="Select variant" />
                          </SelectTrigger>
                          <SelectContent>
                            {variantsForLine(line).map((v) => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    <div className="dialog-form-field space-y-2">
                      <Label className="dialog-field-label">Quantity *</Label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(i, { quantity: sanitizeIntegerInput(e.target.value) })
                        }
                        className="w-full max-w-none"
                      />
                    </div>

                    <div className="dialog-form-field space-y-2">
                      <Label className="dialog-field-label">Cost (₦)</Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={line.cost}
                        onChange={(e) =>
                          updateLine(i, { cost: sanitizeDecimalInput(e.target.value) })
                        }
                        className="w-full max-w-none"
                      />
                    </div>

                    <div className="dialog-form-field space-y-2 sm:col-span-2">
                      <Label className="dialog-field-label">
                        Waybill Fee (₦)
                      </Label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={line.fee}
                        onChange={(e) =>
                          updateLine(i, { fee: sanitizeDecimalInput(e.target.value) })
                        }
                        className="w-full max-w-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80 transition-colors cursor-pointer"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add Line
            </button>
          </form>
        </div>

        <div className="dialog-footer-bar">
          <button
            type="button"
            className="dialog-cancel-button cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmitClick}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-md transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Saving…" : "Post Waybill Batch"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
