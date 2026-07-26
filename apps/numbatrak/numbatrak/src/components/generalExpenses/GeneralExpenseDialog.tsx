import { FormEvent, useRef, useState, useEffect } from "react";
import { Dialog, DialogContent } from "../ui/dialog";
import { BrandedDialogHero } from "../brand/BrandedDialogHero";
import { Pencil, Plus } from "lucide-react";
import { ErrorAlert } from "../agents/ErrorAlert";
import { Input } from "../ui/input";
import { DateInput } from "../ui/date-input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { GeneralExpenseWithRelations } from "../../types/generalExpense";
import { Product } from "../../types/product";

interface GeneralExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  expense: GeneralExpenseWithRelations | null;
  products: Product[];
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const EXPENSE_CATEGORIES = [
  "Ads",
  "Logistics",
  "Marketing Materials",
  "Salary",
  "Technical",
];

const SUBCATEGORY_OPTIONS: Record<string, string[]> = {
  Ads: ["Ads", "ADS charge"],
  Logistics: ["Waybills", "waybills", "Pickup/failed delivery etc"],
  "Marketing Materials": ["CRM"],
  Salary: [
    "Salary",
    "Allowance",
    "allowance",
    "nuella",
    "theodora",
    "opeoluwa",
    "Charge",
  ],
  Technical: ["Automation"],
};

export function GeneralExpenseDialog({
  open,
  onOpenChange,
  mode,
  expense,
  products,
  error,
  saving,
  onSubmit,
}: GeneralExpenseDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState("");
  const [productId, setProductId] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState("Ads");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [subcategory, setSubcategory] = useState("Ads");
  const [amount, setAmount] = useState("0");

  useEffect(() => {
    if (open) {
      if (expense && mode === "edit") {
        setDate(expense.date || "");
        setProductId(expense.product_id?.toString() || undefined);
        const expenseCategory = expense.category || "Ads";
        // Check if the category is in the predefined list
        const isPredefined = EXPENSE_CATEGORIES.includes(expenseCategory);
        if (isPredefined) {
          setCategory(expenseCategory);
          setIsCustomCategory(false);
          setCustomCategory("");
        } else {
          setCategory("Custom");
          setIsCustomCategory(true);
          setCustomCategory(expenseCategory);
        }
        setSubcategory(expense.subcategory || "Ads");
        setAmount(expense.amount?.toString() || "0");
      } else {
        // Reset form for create mode
        setDate(new Date().toISOString().split("T")[0]);
        setProductId(undefined);
        setCategory("Ads");
        setIsCustomCategory(false);
        setCustomCategory("");
        setSubcategory("Ads");
        setAmount("0");
      }
    }
  }, [open, expense, mode]);

  // Update subcategory options when category changes
  useEffect(() => {
    if (category && !isCustomCategory && SUBCATEGORY_OPTIONS[category]) {
      const options = SUBCATEGORY_OPTIONS[category];
      if (!options.includes(subcategory)) {
        setSubcategory(options[0]);
      }
    }
  }, [category, isCustomCategory]);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  const currentSubcategoryOptions = isCustomCategory
    ? []
    : SUBCATEGORY_OPTIONS[category] || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
        <BrandedDialogHero
          icon={
            mode === "edit" ? (
              <Pencil className="h-7 w-7" aria-hidden />
            ) : (
              <Plus className="h-7 w-7" aria-hidden />
            )
          }
          title={mode === "edit" ? "Edit Expense" : "Create New Expense"}
          description={
            mode === "edit"
              ? "Update expense information"
              : "Add a new general expense entry"
          }
        />

        <div className="dialog-body-scroll max-h-standard">
          <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
            {error && <ErrorAlert message={error} />}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="date"
                  className="text-sm font-semibold text-foreground"
                >
                  Date *
                </Label>
                <DateInput
                  id="date"
                  name="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="product"
                  className="text-sm font-semibold text-foreground"
                >
                  Product
                </Label>
                <Select value={productId} onValueChange={setProductId}>
                  <SelectTrigger id="product">
                    <SelectValue placeholder="Select a product (optional)" />
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
                <input
                  type="hidden"
                  name="product_id"
                  value={productId || ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label
                  htmlFor="category"
                  className="text-sm font-semibold text-foreground"
                >
                  Category *
                </Label>
                <Select
                  value={category}
                  onValueChange={(value) => {
                    setCategory(value);
                    setIsCustomCategory(value === "Custom");
                    if (value !== "Custom") {
                      setCustomCategory("");
                    }
                  }}
                >
                  <SelectTrigger id="category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                    <SelectItem value="Custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {isCustomCategory && (
                  <Input
                    id="customCategory"
                    name="customCategory"
                    type="text"
                    placeholder="Enter custom category"
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    required
                    className="mt-2"
                  />
                )}
                <input
                  type="hidden"
                  name="category"
                  value={isCustomCategory ? customCategory : category}
                />
              </div>

              <div className="space-y-2">
                <Label
                  htmlFor="subcategory"
                  className="text-sm font-semibold text-foreground"
                >
                  Subcategory *
                </Label>
                {currentSubcategoryOptions.length > 0 ? (
                  <Select value={subcategory} onValueChange={setSubcategory}>
                    <SelectTrigger id="subcategory">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {currentSubcategoryOptions.map((sub) => (
                        <SelectItem key={sub} value={sub}>
                          {sub}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    id="subcategory"
                    name="subcategory"
                    type="text"
                    value={subcategory}
                    onChange={(e) => setSubcategory(e.target.value)}
                    required
                  />
                )}
                <input type="hidden" name="subcategory" value={subcategory} />
              </div>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="amount"
                className="text-sm font-semibold text-foreground"
              >
                Amount (₦) *
              </Label>
              <Input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
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
              saving ||
              !date ||
              !(isCustomCategory ? customCategory : category) ||
              !subcategory ||
              !amount
            }
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
                Processing...
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
                {mode === "edit" ? "Update Expense" : "Create Expense"}
              </>
            )}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
