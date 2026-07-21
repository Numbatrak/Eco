import { FormEvent, useEffect, useRef, useState } from "react";
import { Product } from "../../types/product";
import { Agent } from "../../types/agent";
import { intakeWaybillBatch } from "../../services/waybillIntake";
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
import { Package, Plus } from "lucide-react";

type Line = {
  to_agent_id: string;
  product_id: string;
  quantity: string;
  cost: string;
  fee: string;
};

const emptyLine = (): Line => ({
  to_agent_id: "",
  product_id: "",
  quantity: "1",
  cost: "0",
  fee: "0",
});

interface WaybillBatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
  agents: Agent[];
  products: Product[];
  recordedByUserId?: string | null;
  onSuccess?: () => void;
}

export function WaybillBatchDialog({
  open,
  onOpenChange,
  organizationId,
  agents,
  products,
  recordedByUserId,
  onSuccess,
}: WaybillBatchDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [occurredAt, setOccurredAt] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [lines, setLines] = useState<Line[]>([emptyLine(), emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setOccurredAt(new Date().toISOString().slice(0, 10));
      setLines([emptyLine(), emptyLine()]);
      setError(null);
      setSaving(false);
    }
  }, [open]);

  const addLine = () => setLines((x) => [...x, emptyLine()]);

  const updateLine = (i: number, patch: Partial<Line>) => {
    setLines((rows) => rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed: {
      to_agent_id: number;
      product_id: string;
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
      parsed.push({
        to_agent_id: parseInt(l.to_agent_id, 10),
        product_id: l.product_id,
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
        recorded_by_user_id: recordedByUserId ?? null,
        lines: parsed.map((l) => ({
          agent_id: l.to_agent_id,
          product_id: l.product_id,
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
                          updateLine(i, { product_id: value })
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
                    </div>

                    <div className="dialog-form-field space-y-2">
                      <Label className="dialog-field-label">Quantity *</Label>
                      <Input
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(i, { quantity: e.target.value })
                        }
                        className="w-full max-w-none"
                      />
                    </div>

                    <div className="dialog-form-field space-y-2">
                      <Label className="dialog-field-label">Cost (₦)</Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.cost}
                        onChange={(e) =>
                          updateLine(i, { cost: e.target.value })
                        }
                        className="w-full max-w-none"
                      />
                    </div>

                    <div className="dialog-form-field space-y-2 sm:col-span-2">
                      <Label className="dialog-field-label">
                        Waybill Fee (₦)
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.fee}
                        onChange={(e) =>
                          updateLine(i, { fee: e.target.value })
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
