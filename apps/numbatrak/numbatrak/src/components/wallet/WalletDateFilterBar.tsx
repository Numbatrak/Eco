import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { DateFilter, DateFilterType } from "../../utils/dateRange";

interface WalletDateFilterBarProps {
  dateFilter: DateFilter;
  onDateFilterChange: (filter: DateFilter) => void;
}

const PERIOD_OPTIONS: { value: DateFilterType; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
  { value: "custom", label: "Custom range" },
];

export function WalletDateFilterBar({
  dateFilter,
  onDateFilterChange,
}: WalletDateFilterBarProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end gap-3 flex-wrap">
      <div className="space-y-1.5 min-w-[10rem]">
        <Label htmlFor="wallet-period" className="text-xs text-muted-foreground">
          Period
        </Label>
        <Select
          value={dateFilter.type}
          onValueChange={(value: DateFilterType) =>
            onDateFilterChange({
              type: value,
              startDate: value === "custom" ? dateFilter.startDate : undefined,
              endDate: value === "custom" ? dateFilter.endDate : undefined,
            })
          }
        >
          <SelectTrigger id="wallet-period" className="w-full sm:w-[11rem]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {dateFilter.type === "custom" && (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-from" className="text-xs text-muted-foreground">
              From
            </Label>
            <Input
              id="wallet-from"
              type="date"
              value={dateFilter.startDate ?? ""}
              onChange={(e) =>
                onDateFilterChange({
                  ...dateFilter,
                  startDate: e.target.value || undefined,
                })
              }
              className="w-full sm:w-[10rem]"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wallet-to" className="text-xs text-muted-foreground">
              To
            </Label>
            <Input
              id="wallet-to"
              type="date"
              value={dateFilter.endDate ?? ""}
              onChange={(e) =>
                onDateFilterChange({
                  ...dateFilter,
                  endDate: e.target.value || undefined,
                })
              }
              className="w-full sm:w-[10rem]"
            />
          </div>
        </>
      )}
    </div>
  );
}
