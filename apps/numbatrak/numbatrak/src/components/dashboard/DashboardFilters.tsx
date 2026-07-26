import {
  CalendarDays,
  FileText,
  UserCircle2,
  Filter,
  GitBranch,
  Tag,
  Truck,
  Layers,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Form } from "../../types/form";
import { UserProfile } from "../../types/user";
import { Agent } from "../../services/agents";
import { formatCsrSelectLabel } from "../../utils/userDisplay";
import { CsrUserOption } from "../users/CsrUserOption";
import type { DateFilter, DateFilterType } from "../../utils/dateRange";
import type { DashboardViewMode } from "../../types/dashboardFilters";
import { ORDER_STATUS_SELECT_OPTIONS } from "../../constants/orderStatus";

const FILTER_OPTIONS: { label: string; value: DateFilterType }[] = [
  { label: "All Time", value: "all" },
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
];

export type DashboardFilterValues = {
  dateFilter: DateFilter;
  formId: string | null;
  csrId: string | null;
  funnelName: string | null;
  subBrand: string | null;
  agentId: number | null;
  status: string | null;
  viewMode: DashboardViewMode;
};

interface DashboardFiltersProps {
  values: DashboardFilterValues;
  customStartDate: string;
  customEndDate: string;
  onCustomStartDateChange: (value: string) => void;
  onCustomEndDateChange: (value: string) => void;
  onDateFilterChange: (type: DateFilterType) => void;
  onCustomDateApply: () => void;
  onFormChange: (formId: string | null) => void;
  onCsrChange: (csrId: string | null) => void;
  onFunnelChange: (funnel: string | null) => void;
  onSubBrandChange: (subBrand: string | null) => void;
  onAgentChange: (agentId: number | null) => void;
  onStatusChange: (status: string | null) => void;
  onViewModeChange: (mode: DashboardViewMode) => void;
  forms: Form[];
  csrUsers: UserProfile[];
  agents: Agent[];
  funnelNames: string[];
  subBrands: string[];
  showCsrFilter?: boolean;
  showExtendedFilters?: boolean;
  showViewToggle?: boolean;
}

export function DashboardFilters({
  values,
  customStartDate,
  customEndDate,
  onCustomStartDateChange,
  onCustomEndDateChange,
  onDateFilterChange,
  onCustomDateApply,
  onFormChange,
  onCsrChange,
  onFunnelChange,
  onSubBrandChange,
  onAgentChange,
  onStatusChange,
  onViewModeChange,
  forms,
  csrUsers,
  agents,
  funnelNames,
  subBrands,
  showCsrFilter = true,
  showExtendedFilters = false,
  showViewToggle = false,
}: DashboardFiltersProps) {
  const formSelectValue = values.formId ?? "all";
  const csrSelectValue = values.csrId ?? "all";
  const funnelSelectValue = values.funnelName ?? "all";
  const subBrandSelectValue = values.subBrand ?? "all";
  const agentSelectValue =
    values.agentId != null ? String(values.agentId) : "all";
  const statusSelectValue = values.status ?? "all";

  return (
    <div className="bg-card border border-border rounded-xl p-4 flex flex-col gap-4 shadow-sm">
      <div className="flex flex-wrap gap-3 items-center">
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground mr-1">
          <CalendarDays className="w-4 h-4" />
          Filter by:
        </span>

        {FILTER_OPTIONS.map(({ label, value }) => (
          <button
            key={value}
            type="button"
            onClick={() => onDateFilterChange(value)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer
              ${
                values.dateFilter.type === value
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-accent hover:text-accent-foreground"
              }`}
          >
            {label}
          </button>
        ))}

        <div className="flex items-center gap-2 ml-auto flex-wrap">
          <input
            type="date"
            value={customStartDate}
            onChange={(e) => onCustomStartDateChange(e.target.value)}
            aria-label="Start date"
            title="Start date"
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
          />
          <span className="text-muted-foreground text-sm">to</span>
          <input
            type="date"
            value={customEndDate}
            onChange={(e) => onCustomEndDateChange(e.target.value)}
            aria-label="End date"
            title="End date"
            className="px-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors"
          />
          <button
            type="button"
            onClick={onCustomDateApply}
            disabled={!customStartDate || !customEndDate}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer
              ${
                customStartDate && customEndDate
                  ? "bg-primary text-primary-foreground border-primary hover:opacity-90"
                  : "bg-muted text-muted-foreground border-border opacity-50 cursor-not-allowed"
              }`}
          >
            Apply
          </button>
        </div>
      </div>

      {showViewToggle && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground shrink-0">
            <Layers className="w-4 h-4" />
            View
          </span>
          <button
            type="button"
            onClick={() => onViewModeChange("funnel")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer
              ${
                values.viewMode === "funnel"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-accent"
              }`}
          >
            Funnel (ads)
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("business")}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium border transition-colors cursor-pointer
              ${
                values.viewMode === "business"
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-background text-foreground border-border hover:bg-accent"
              }`}
          >
            Business (full ROI)
          </button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-t border-border pt-3">
        <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground shrink-0">
          <FileText className="w-4 h-4" />
          Product
        </span>
        <Select
          value={formSelectValue}
          onValueChange={(v) => onFormChange(v === "all" ? null : v)}
        >
          <SelectTrigger
            className="w-full sm:max-w-md border-border bg-background"
            aria-label="Filter by product"
          >
            <SelectValue placeholder="All products" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {forms.map((f) => (
              <SelectItem key={f.id} value={f.id}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {showCsrFilter && csrUsers.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground shrink-0">
            <UserCircle2 className="w-4 h-4" />
            CSR
          </span>
          <Select
            value={csrSelectValue}
            onValueChange={(v) => onCsrChange(v === "all" ? null : v)}
          >
            <SelectTrigger
              className="w-full sm:max-w-md border-border bg-background"
              aria-label="Filter by CSR"
            >
              <SelectValue placeholder="All CSRs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All CSRs</SelectItem>
              {csrUsers.map((u) => (
                <SelectItem
                  key={u.id}
                  value={u.id}
                  textValue={formatCsrSelectLabel(u)}
                >
                  <CsrUserOption full_name={u.full_name} email={u.email} />
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {showExtendedFilters && (
        <>
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-2 sm:gap-3 border-t border-border pt-3">
            <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground shrink-0">
              <Filter className="w-4 h-4" />
              More filters
            </span>

            {funnelNames.length > 0 && (
              <Select
                value={funnelSelectValue}
                onValueChange={(v) =>
                  onFunnelChange(v === "all" ? null : v)
                }
              >
                <SelectTrigger
                  className="w-full sm:w-48 border-border bg-background"
                  aria-label="Filter by funnel"
                >
                  <GitBranch className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All funnels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All funnels</SelectItem>
                  {funnelNames.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {subBrands.length > 0 && (
              <Select
                value={subBrandSelectValue}
                onValueChange={(v) =>
                  onSubBrandChange(v === "all" ? null : v)
                }
              >
                <SelectTrigger
                  className="w-full sm:w-48 border-border bg-background"
                  aria-label="Filter by sub-brand"
                >
                  <Tag className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All sub-brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sub-brands</SelectItem>
                  {subBrands.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {agents.length > 0 && (
              <Select
                value={agentSelectValue}
                onValueChange={(v) =>
                  onAgentChange(v === "all" ? null : Number(v))
                }
              >
                <SelectTrigger
                  className="w-full sm:w-48 border-border bg-background"
                  aria-label="Filter by agent"
                >
                  <Truck className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder="All agents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All agents</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <Select
              value={statusSelectValue}
              onValueChange={(v) => onStatusChange(v === "all" ? null : v)}
            >
              <SelectTrigger
                className="w-full sm:w-48 border-border bg-background"
                aria-label="Filter by status"
              >
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {ORDER_STATUS_SELECT_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </>
      )}
    </div>
  );
}
