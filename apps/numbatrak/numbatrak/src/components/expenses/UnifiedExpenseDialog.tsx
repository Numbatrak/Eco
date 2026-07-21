import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { DateInput } from "../ui/date-input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Pencil, Plus } from "lucide-react";
import {
  EXPENSE_CATEGORY_META,
  ORG_EXPENSE_CATEGORY_IDS,
  OrgExpenseCategory,
} from "../../constants/expenseCategories";
import {
  formatExpenseCategoryLabel,
  subcategoriesForCategory,
} from "../../utils/expenseCategoryHelpers";
import {
  UnifiedExpenseScope,
  UnifiedExpenseWithRelations,
} from "../../types/unifiedExpense";
import { Agent } from "../../types/agent";
import { Product } from "../../types/product";
import { ExpenseSubcategoryRow } from "../../services/expenseSubcategories";
import { isAutoFedExpense } from "../../utils/expenseAttribution";

export interface UnifiedExpenseFormValues {
  occurred_at: string;
  category: string;
  subcategory: string;
  amount: number;
  agent_id: number | null;
  product_id: string | null;
  offer_name: string | null;
  note: string | null;
}

interface UnifiedExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  scope: UnifiedExpenseScope;
  expense: UnifiedExpenseWithRelations | null;
  agents: Agent[];
  products: Product[];
  customSubcategories: ExpenseSubcategoryRow[];
  preferredOrgCategory?: OrgExpenseCategory;
  onAddCustomSubcategory?: (
    parentCategory: OrgExpenseCategory,
    label: string
  ) => Promise<void>;
  error: string | null;
  saving: boolean;
  onSubmit: (values: UnifiedExpenseFormValues) => Promise<void>;
}

export function UnifiedExpenseDialog({
  open,
  onOpenChange,
  mode,
  scope,
  expense,
  agents,
  products,
  customSubcategories,
  preferredOrgCategory,
  onAddCustomSubcategory,
  error,
  saving,
  onSubmit,
}: UnifiedExpenseDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const defaultOrgCategory: OrgExpenseCategory = "operational";

  const [occurredAt, setOccurredAt] = useState("");
  const [category, setCategory] = useState<string>(defaultOrgCategory);
  const [subcategory, setSubcategory] = useState("");
  const [amount, setAmount] = useState("");
  const [agentId, setAgentId] = useState<string>("");
  const [productId, setProductId] = useState<string>("");
  const [offerName, setOfferName] = useState("");
  const [note, setNote] = useState("");
  const [newSubLabel, setNewSubLabel] = useState("");

  const isAutoFed = expense ? isAutoFedExpense(expense.source_type) : false;

  const subcategoryOptions = useMemo(
    () =>
      subcategoriesForCategory(
        (scope === "org" ? category : "operational") as OrgExpenseCategory,
        scope,
        customSubcategories
      ),
    [category, scope, customSubcategories]
  );

  const showAttribution =
    scope === "org" &&
    (category === "advertising" || category === "marketing");

  const advertisingRequired = scope === "org" && category === "advertising";

  useEffect(() => {
    if (!open) return;
    if (expense && mode === "edit") {
      setOccurredAt(String(expense.occurred_at).slice(0, 10));
      setCategory(expense.category);
      setSubcategory(
        expense.subcategory ||
          subcategoriesForCategory(
            expense.category as OrgExpenseCategory,
            scope,
            customSubcategories
          )[0]?.id ||
          ""
      );
      setAmount(String(expense.amount));
      setAgentId(expense.agent_id ? String(expense.agent_id) : "");
      setProductId(expense.product_id || "");
      setOfferName(expense.offer_name || "");
      setNote(expense.note || "");
    } else {
      const today = new Date().toISOString().slice(0, 10);
      setOccurredAt(today);
      setCategory(
        scope === "org" ? preferredOrgCategory ?? defaultOrgCategory : "operational"
      );
      setSubcategory(
        subcategoriesForCategory(
          preferredOrgCategory ?? defaultOrgCategory,
          scope,
          customSubcategories
        )[0]?.id || "other"
      );
      setAmount("");
      setAgentId("");
      setProductId("");
      setOfferName("");
      setNote("");
    }
    setNewSubLabel("");
  }, [open, expense, mode, scope, preferredOrgCategory, customSubcategories]);

  useEffect(() => {
    if (!subcategoryOptions.some((s) => s.id === subcategory)) {
      setSubcategory(subcategoryOptions[0]?.id || "other");
    }
  }, [category, subcategoryOptions, subcategory]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const parsed = parseFloat(amount);
    if (!occurredAt || !parsed || parsed <= 0) return;
    if (scope === "agent" && !agentId) return;
    if (advertisingRequired && !productId) return;
    if (advertisingRequired && !offerName.trim()) return;

    await onSubmit({
      occurred_at: occurredAt,
      category: scope === "agent" ? "operational" : category,
      subcategory,
      amount: parsed,
      agent_id: scope === "agent" ? parseInt(agentId, 10) : null,
      product_id: productId || null,
      offer_name: offerName.trim() || null,
      note: note.trim() || null,
    });
  };

  const handleAddSubcategory = async () => {
    if (!onAddCustomSubcategory || scope !== "org") return;
    const label = newSubLabel.trim();
    if (!label) return;
    await onAddCustomSubcategory(category as OrgExpenseCategory, label);
    setNewSubLabel("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-0 gap-0 overflow-hidden max-h-[95vh]">
        <BrandedDialogHero
          icon={
            mode === "edit" ? (
              <Pencil className="h-7 w-7" aria-hidden />
            ) : (
              <Plus className="h-7 w-7" aria-hidden />
            )
          }
          title={mode === "edit" ? "Edit expense" : "Add expense"}
          description={
            isAutoFed
              ? "Auto-fed row — amount is locked; you can update notes and attribution"
              : scope === "org"
                ? "Organisation expense: one of four P&L categories"
                : "Per-agent operational cost"
          }
        />
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto max-h-[70vh]"
        >
          {error && <ErrorAlert message={error} />}
          {isAutoFed && (
            <p className="text-xs rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-primary">
              Auto-fed from{" "}
              {expense?.source_type?.replace(/_/g, " ") ?? "system"}
            </p>
          )}

          {scope === "agent" && (
            <div className="space-y-2">
              <Label>Agent</Label>
              <Select value={agentId} onValueChange={setAgentId} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select agent" />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expense-date">Date</Label>
              <DateInput
                id="expense-date"
                value={occurredAt}
                onChange={(e) => setOccurredAt(e.target.value)}
                required
                disabled={isAutoFed}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expense-amount">Amount (NGN)</Label>
              <Input
                id="expense-amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                disabled={isAutoFed}
              />
            </div>
          </div>

          {scope === "org" && (
            <div className="space-y-2">
              <Label>Category</Label>
              <Select
                value={category}
                onValueChange={setCategory}
                disabled={isAutoFed}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_EXPENSE_CATEGORY_IDS.map((id) => (
                    <SelectItem key={id} value={id}>
                      {EXPENSE_CATEGORY_META[id].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {EXPENSE_CATEGORY_META[category as OrgExpenseCategory]
                  ?.description ?? ""}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label>{scope === "org" ? "Subcategory" : "Cost type"}</Label>
            <Select
              value={subcategory}
              onValueChange={setSubcategory}
              disabled={isAutoFed}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {subcategoryOptions.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {scope === "org" && onAddCustomSubcategory && !isAutoFed && (
              <div className="flex gap-2 pt-1">
                <Input
                  value={newSubLabel}
                  onChange={(e) => setNewSubLabel(e.target.value)}
                  placeholder="New custom subcategory"
                  className="text-sm"
                />
                <button
                  type="button"
                  onClick={handleAddSubcategory}
                  className="shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg border border-border hover:bg-accent cursor-pointer"
                >
                  Add
                </button>
              </div>
            )}
          </div>

          {showAttribution && (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
              <p className="text-xs font-semibold text-muted-foreground">
                Attribution
                {advertisingRequired && (
                  <span className="text-destructive"> (required for ads)</span>
                )}
              </p>
              <div className="space-y-2">
                <Label>Product</Label>
                <Select
                  value={productId || "__none__"}
                  onValueChange={(v) =>
                    setProductId(v === "__none__" ? "" : v)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select product" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {products.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="offer-name">Offer name</Label>
                <Input
                  id="offer-name"
                  value={offerName}
                  onChange={(e) => setOfferName(e.target.value)}
                  placeholder="e.g. Buy 2 Get 1, Meta campaign Q1"
                  required={advertisingRequired}
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="expense-note">Note</Label>
            <Textarea
              id="expense-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional details"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="px-4 py-2 text-sm rounded-lg border border-border hover:bg-accent cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Saving…" : mode === "edit" ? "Update" : "Save expense"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function expenseTableCategoryLabel(
  row: UnifiedExpenseWithRelations
): string {
  if (row.scope === "agent") {
    return "Agent · Operational";
  }
  return formatExpenseCategoryLabel(row.category);
}
