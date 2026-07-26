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
import { AgentExpenseWithRelations } from "../../types/expense";
import { Agent } from "../../types/agent";

interface ExpenseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  expense: AgentExpenseWithRelations | null;
  agents: Agent[];
  error: string | null;
  saving: boolean;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
}

const EXPENSE_CATEGORIES = [
  "Pickup",
  "Storekeeper",
  "Failed Delivery",
  "Transport",
  "Other",
];

export function ExpenseDialog({
  open,
  onOpenChange,
  mode,
  expense,
  agents,
  error,
  saving,
  onSubmit,
}: ExpenseDialogProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [date, setDate] = useState("");
  const [category, setCategory] = useState("Pickup");
  const [customCategory, setCustomCategory] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [amount, setAmount] = useState("0");
  const [agentId, setAgentId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) {
      if (expense && mode === "edit") {
        setDate(expense.date || "");
        const expenseCategory = expense.category || "Pickup";
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
        setAmount(expense.amount?.toString() || "0");
        setAgentId(expense.agent_id?.toString() || undefined);
      } else {
        // Reset form for create mode
        setDate(new Date().toISOString().split("T")[0]);
        setCategory("Pickup");
        setIsCustomCategory(false);
        setCustomCategory("");
        setAmount("0");
        setAgentId(undefined);
      }
    }
  }, [open, expense, mode]);

  const handleSubmitClick = () => {
    if (formRef.current) {
      formRef.current.requestSubmit();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-hidden bg-card border border-border shadow-2xl p-0">
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
              : "Add a new agent expense entry"
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
            </div>

            <div className="grid grid-cols-2 gap-4">
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

              <div className="space-y-2">
                <Label
                  htmlFor="agent"
                  className="text-sm font-semibold text-foreground"
                >
                  Agent
                </Label>
                <Select value={agentId} onValueChange={setAgentId}>
                  <SelectTrigger id="agent">
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
            disabled={saving || !date || !(isCustomCategory ? customCategory : category) || !amount}
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
