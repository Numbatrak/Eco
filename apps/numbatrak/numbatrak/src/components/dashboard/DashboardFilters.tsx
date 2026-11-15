import { useMemo, useState } from "react";
import {
  CalendarDays,
  UserCircle2,
  SlidersHorizontal,
  GitBranch,
  Tag,
  Truck,
  Layers,
  Megaphone,
  Users,
  Link2,
  X,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Form } from "../../types/form";
import { UserProfile } from "../../types/user";
import { Agent } from "../../services/agents";
import { formatCsrSelectLabel } from "../../utils/userDisplay";
import { CsrUserOption } from "../users/CsrUserOption";
import type { DateFilter, DateFilterType } from "../../utils/dateRange";
import type { DashboardViewMode } from "../../types/dashboardFilters";
import { ORDER_STATUS_SELECT_OPTIONS, orderStatusLabel } from "../../constants/orderStatus";

const FILTER_OPTIONS: { label: string; value: DateFilterType }[] = [
  { label: "Today", value: "today" },
  { label: "7d", value: "last_7_days" },
  { label: "30d", value: "last_30_days" },
  { label: "MTD", value: "this_month" },
  { label: "All Time", value: "all" },
];

const shortDate = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
/** "2026-11-01" -> "1 Nov", read as a local calendar date (not UTC midnight). */
function formatDay(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return y && m && d ? shortDate.format(new Date(y, m - 1, d)) : ymd;
}

export type DashboardFilterValues = {
  dateFilter: DateFilter;
  formId: string | null;
  csrId: string | null;
  offerName: string | null;
  agentId: number | null;
  status: string | null;
  platform: string | null;
  mediaBuyerName: string | null;
  trackingLinkId: string | null;
  viewMode: DashboardViewMode;
};

export type DashboardTrackingLinkOption = { id: string; label: string };

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
  onOfferChange: (offer: string | null) => void;
  onAgentChange: (agentId: number | null) => void;
  onStatusChange: (status: string | null) => void;
  onPlatformChange: (platform: string | null) => void;
  onMediaBuyerChange: (mediaBuyerName: string | null) => void;
  onTrackingLinkChange: (trackingLinkId: string | null) => void;
  onViewModeChange: (mode: DashboardViewMode) => void;
  forms: Form[];
  csrUsers: UserProfile[];
  agents: Agent[];
  offerNames: string[];
  platforms: string[];
  mediaBuyerNames: string[];
  trackingLinkOptions: DashboardTrackingLinkOption[];
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
  onOfferChange,
  onAgentChange,
  onStatusChange,
  onPlatformChange,
  onMediaBuyerChange,
  onTrackingLinkChange,
  onViewModeChange,
  forms,
  csrUsers,
  agents,
  offerNames,
  platforms,
  mediaBuyerNames,
  trackingLinkOptions,
  showCsrFilter = true,
  showExtendedFilters = false,
  showViewToggle = false,
}: DashboardFiltersProps) {
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  // ISO yyyy-mm-dd strings compare correctly as text.
  const customRangeInvalid = Boolean(customStartDate && customEndDate && customStartDate > customEndDate);
  const isCustom = values.dateFilter.type === "custom" && values.dateFilter.startDate && values.dateFilter.endDate;

  const formSelectValue = values.formId ?? "all";
  const csrSelectValue = values.csrId ?? "all";
  const offerSelectValue = values.offerName ?? "all";
  const agentSelectValue =
    values.agentId != null ? String(values.agentId) : "all";
  const statusSelectValue = values.status ?? "all";
  const platformSelectValue = values.platform ?? "all";
  const mediaBuyerSelectValue = values.mediaBuyerName ?? "all";
  const trackingLinkSelectValue = values.trackingLinkId ?? "all";
  const selectedTrackingLink = trackingLinkOptions.find((t) => t.id === values.trackingLinkId);

  const selectedForm = forms.find((f) => f.id === values.formId);
  const selectedCsr = csrUsers.find((u) => u.id === values.csrId);
  const selectedAgent = agents.find((a) => a.id === values.agentId);

  const chips = useMemo(() => {
    const list: { key: string; label: string; onClear: () => void }[] = [];
    if (values.dateFilter.type === "custom" && values.dateFilter.startDate && values.dateFilter.endDate) {
      list.push({
        key: "date",
        label: `${values.dateFilter.startDate} → ${values.dateFilter.endDate}`,
        onClear: () => onDateFilterChange("all"),
      });
    }
    if (values.formId) {
      list.push({ key: "form", label: selectedForm?.name ?? "Funnel", onClear: () => onFormChange(null) });
    }
    if (values.csrId) {
      list.push({ key: "csr", label: selectedCsr ? formatCsrSelectLabel(selectedCsr) : "CSR", onClear: () => onCsrChange(null) });
    }
    if (values.offerName) {
      list.push({ key: "offer", label: values.offerName, onClear: () => onOfferChange(null) });
    }
    if (values.agentId != null) {
      list.push({ key: "agent", label: selectedAgent?.name ?? "Agent", onClear: () => onAgentChange(null) });
    }
    if (values.status) {
      list.push({ key: "status", label: orderStatusLabel(values.status), onClear: () => onStatusChange(null) });
    }
    if (values.platform) {
      list.push({ key: "platform", label: values.platform, onClear: () => onPlatformChange(null) });
    }
    if (values.mediaBuyerName) {
      list.push({ key: "mediaBuyer", label: values.mediaBuyerName, onClear: () => onMediaBuyerChange(null) });
    }
    if (values.trackingLinkId) {
      list.push({
        key: "trackingLink",
        label: selectedTrackingLink?.label ?? "Tracking link",
        onClear: () => onTrackingLinkChange(null),
      });
    }
    return list;
  }, [
    values.dateFilter,
    values.formId,
    values.csrId,
    values.offerName,
    values.agentId,
    values.status,
    values.platform,
    values.mediaBuyerName,
    values.trackingLinkId,
    selectedForm,
    selectedCsr,
    selectedAgent,
    selectedTrackingLink,
    onDateFilterChange,
    onFormChange,
    onCsrChange,
    onOfferChange,
    onAgentChange,
    onStatusChange,
    onPlatformChange,
    onMediaBuyerChange,
    onTrackingLinkChange,
  ]);

  function clearAll() {
    onDateFilterChange("all");
    onFormChange(null);
    onCsrChange(null);
    onOfferChange(null);
    onAgentChange(null);
    onStatusChange(null);
    onPlatformChange(null);
    onMediaBuyerChange(null);
    onTrackingLinkChange(null);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
          {FILTER_OPTIONS.map(({ label, value }) => (
            <button
              key={value}
              type="button"
              onClick={() => onDateFilterChange(value)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer
                ${
                  values.dateFilter.type === value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
            >
              {label}
            </button>
          ))}
          <Popover open={customOpen} onOpenChange={setCustomOpen}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer
                  ${isCustom ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <CalendarDays className="w-3.5 h-3.5" />
                {isCustom
                  ? `${formatDay(values.dateFilter.startDate!)} – ${formatDay(values.dateFilter.endDate!)}`
                  : "Custom"}
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[min(92vw,20rem)] p-4 flex flex-col gap-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Custom date range</span>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  From
                  <input
                    type="date"
                    value={customStartDate}
                    max={customEndDate || undefined}
                    onChange={(e) => onCustomStartDateChange(e.target.value)}
                    className="min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex flex-col gap-1 text-xs text-muted-foreground">
                  To
                  <input
                    type="date"
                    value={customEndDate}
                    min={customStartDate || undefined}
                    onChange={(e) => onCustomEndDateChange(e.target.value)}
                    className="min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
              {customRangeInvalid && (
                <p className="text-xs text-danger-text">The start date is after the end date.</p>
              )}
              <Button
                type="button"
                size="sm"
                disabled={!customStartDate || !customEndDate || customRangeInvalid}
                onClick={() => {
                  onCustomDateApply();
                  setCustomOpen(false);
                }}
                className="self-start"
              >
                Apply
              </Button>
            </PopoverContent>
          </Popover>
        </div>

        {showViewToggle && (
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
            <button
              type="button"
              onClick={() => onViewModeChange("funnel")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer
                ${
                  values.viewMode === "funnel"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <Layers className="w-3.5 h-3.5" />
              Funnel
            </button>
            <button
              type="button"
              onClick={() => onViewModeChange("business")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors cursor-pointer
                ${
                  values.viewMode === "business"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
            >
              Business
            </button>
          </div>
        )}

        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-10 gap-1.5">
              <SlidersHorizontal className="w-4 h-4" />
              Filters
              {chips.length > 0 && (
                <Badge variant="secondary" className="ml-0.5 px-1.5">
                  {chips.length}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-[min(92vw,24rem)] p-4 flex flex-col gap-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                <GitBranch className="w-3.5 h-3.5" />
                Funnel
              </span>
              <Select
                value={formSelectValue}
                onValueChange={(v) => onFormChange(v === "all" ? null : v)}
              >
                <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by funnel">
                  <SelectValue placeholder="All funnels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All funnels</SelectItem>
                  {forms.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {showCsrFilter && csrUsers.length > 0 && (
              <div className="flex flex-col gap-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  <UserCircle2 className="w-3.5 h-3.5" />
                  CSR
                </span>
                <Select
                  value={csrSelectValue}
                  onValueChange={(v) => onCsrChange(v === "all" ? null : v)}
                >
                  <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by CSR">
                    <SelectValue placeholder="All CSRs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All CSRs</SelectItem>
                    {csrUsers.map((u) => (
                      <SelectItem key={u.id} value={u.id} textValue={formatCsrSelectLabel(u)}>
                        <CsrUserOption full_name={u.full_name} email={u.email} />
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {showExtendedFilters && (
              <>
                {offerNames.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Tag className="w-3.5 h-3.5" />
                      Offer
                    </span>
                    <Select value={offerSelectValue} onValueChange={(v) => onOfferChange(v === "all" ? null : v)}>
                      <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by offer">
                        <SelectValue placeholder="All offers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All offers</SelectItem>
                        {offerNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {platforms.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Megaphone className="w-3.5 h-3.5" />
                      Platform
                    </span>
                    <Select value={platformSelectValue} onValueChange={(v) => onPlatformChange(v === "all" ? null : v)}>
                      <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by platform">
                        <SelectValue placeholder="All platforms" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All platforms</SelectItem>
                        {platforms.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {mediaBuyerNames.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Users className="w-3.5 h-3.5" />
                      Media buyer
                    </span>
                    <Select value={mediaBuyerSelectValue} onValueChange={(v) => onMediaBuyerChange(v === "all" ? null : v)}>
                      <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by media buyer">
                        <SelectValue placeholder="All media buyers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All media buyers</SelectItem>
                        {mediaBuyerNames.map((name) => (
                          <SelectItem key={name} value={name}>
                            {name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {trackingLinkOptions.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Link2 className="w-3.5 h-3.5" />
                      Tracking link (funnel)
                    </span>
                    <Select
                      value={trackingLinkSelectValue}
                      onValueChange={(v) => onTrackingLinkChange(v === "all" ? null : v)}
                    >
                      <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by tracking link">
                        <SelectValue placeholder="All tracking links" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All tracking links</SelectItem>
                        {trackingLinkOptions.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {agents.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      <Truck className="w-3.5 h-3.5" />
                      Agent
                    </span>
                    <Select value={agentSelectValue} onValueChange={(v) => onAgentChange(v === "all" ? null : Number(v))}>
                      <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by agent">
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
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</span>
                  <Select value={statusSelectValue} onValueChange={(v) => onStatusChange(v === "all" ? null : v)}>
                    <SelectTrigger className="w-full border-border bg-background" aria-label="Filter by status">
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

            {chips.length > 0 && (
              <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="self-start -ml-2 text-muted-foreground">
                Clear all filters
              </Button>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <Badge key={chip.key} variant="secondary" className="gap-1 pr-1 font-normal">
              {chip.label}
              <button
                type="button"
                onClick={chip.onClear}
                aria-label={`Clear ${chip.label} filter`}
                className="rounded-sm hover:bg-foreground/10 p-0.5 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
