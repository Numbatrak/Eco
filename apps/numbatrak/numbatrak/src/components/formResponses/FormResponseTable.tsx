import { FormResponseWithItems } from "../../types/formResponse";
import { Agent } from "../../types/agent";
import { FormResponseTableHeader } from "./FormResponseTableHeader";
import { FormResponseTableRow } from "./FormResponseTableRow";
import { Search, FileText, X, UserCircle2 } from "lucide-react";
import { TablePagination } from "../ui/TablePagination";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { CsrUserOption } from "../users/CsrUserOption";
import { TableLoadingCell } from "../ui/LoadingState";
import { groupOrdersByMonth } from "../../utils/orderMonthGroups";
import {
  ORDER_STATUS_SELECT_OPTIONS,
  orderStatusLabel,
} from "../../constants/orderStatus";
import { DateInput } from "../ui/date-input";

interface FormResponseTableProps {
  responses: FormResponseWithItems[];
  agents: Agent[];
  loading: boolean;
  error: string | null;
  onEdit: (response: FormResponseWithItems) => void;
  onDelete: (responseId: string) => void;
  onNotesUpdate?: (responseId: string, notes: string) => Promise<void>;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortColumn?: string;
  sortOrder?: "asc" | "desc";
  onSortChange?: (column: string, order?: "asc" | "desc") => void;
  filters?: {
    status?: string;
    form_id?: string;
    csr_id?: string;
    agent_id?: number;
    date_from?: string;
    date_to?: string;
    sub_brand?: string;
    funnel_name?: string;
  };
  onFilterChange?: (filters: {
    status?: string;
    form_id?: string;
    csr_id?: string;
    agent_id?: number;
    date_from?: string;
    date_to?: string;
    sub_brand?: string;
    funnel_name?: string;
  }) => void;
  /** When provided, a form dropdown is shown and filter tags use these names */
  formOptions?: { id: string; name: string }[];
  /** Customer Relations reps — when set, a CSR filter dropdown is shown */
  csrOptions?: {
    id: string;
    name: string;
    full_name?: string | null;
    email?: string | null;
  }[];
  currentPage?: number;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  canEdit?: boolean;
  canDelete?: boolean;
  /** Render month section headers (newest first); disables pagination */
  groupByMonth?: boolean;
  agentOptions?: { id: number; name: string }[];
  funnelOptions?: string[];
  subBrandOptions?: string[];
}

const TABLE_COLUMN_COUNT = 13;

export function FormResponseTable({
  responses,
  agents,
  loading,
  error,
  onEdit,
  onDelete,
  onNotesUpdate,
  searchQuery,
  onSearchChange,
  sortColumn = "created_at",
  sortOrder = "desc",
  onSortChange,
  filters = {},
  onFilterChange,
  formOptions = [],
  csrOptions = [],
  currentPage = 1,
  onPageChange,
  itemsPerPage = 20,
  canEdit = true,
  canDelete = true,
  groupByMonth = false,
  agentOptions = [],
  funnelOptions = [],
  subBrandOptions = [],
}: FormResponseTableProps) {
  const [activeFilter, setActiveFilter] = useState<string | null>(null);

  const monthSections = groupByMonth ? groupOrdersByMonth(responses) : null;

  // Calculate pagination (skipped when month-grouped)
  const totalPages = groupByMonth
    ? 1
    : Math.ceil(responses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedResponses = groupByMonth
    ? responses
    : responses.slice(startIndex, endIndex);

  const handleSort = (column: string) => {
    if (onSortChange) {
      // Toggle sort order if clicking same column
      const newOrder =
        sortColumn === column && sortOrder === "asc" ? "desc" : "asc";
      onSortChange(column, newOrder);
    }
  };

  const handleFilterRemove = (filterType: keyof typeof filters) => {
    if (onFilterChange) {
      const newFilters = { ...filters };
      delete newFilters[filterType];
      onFilterChange(newFilters);
    }
  };

  const formSelectValue = filters.form_id ?? "all";
  const selectedFormName =
    filters.form_id &&
    formOptions.find((f) => f.id === filters.form_id)?.name;

  const handleFormSelect = (value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      form_id: value === "all" ? undefined : value,
    });
  };

  const csrSelectValue = filters.csr_id ?? "all";
  const selectedCsrName =
    filters.csr_id &&
    csrOptions.find((c) => c.id === filters.csr_id)?.name;
  const handleCsrSelect = (value: string) => {
    if (!onFilterChange) return;
    onFilterChange({
      ...filters,
      csr_id: value === "all" ? undefined : value,
    });
  };

  const statusSelectValue = filters.status ?? "all";
  const agentSelectValue =
    filters.agent_id != null ? String(filters.agent_id) : "all";

  const renderRows = (rows: typeof responses, indexOffset = 0) =>
    rows.map((response, index) => (
      <FormResponseTableRow
        key={response.id}
        response={response}
        agents={agents}
        index={indexOffset + index}
        onEdit={onEdit}
        onDelete={onDelete}
        onNotesUpdate={onNotesUpdate}
        canEdit={canEdit}
        canDelete={canDelete}
      />
    ));

  return (
    <div className="form-response-table-container">
      {/* Search and Filters */}
      <div className="form-response-table-controls">
        <div
          className="form-response-table-search-row"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.75rem",
            alignItems: "center",
            width: "100%",
          }}
        >
          <div
            className="form-response-search-container"
            style={{ flex: "1 1 220px", minWidth: 0 }}
          >
            <Search className="form-response-search-icon" />
            <input
              type="text"
              placeholder="Search by customer, phone, package, or notes..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="form-response-search-input"
            />
          </div>
          {formOptions.length > 0 && onFilterChange && (
            <div
              className="flex items-center gap-2 shrink-0"
              style={{ flex: "0 1 280px" }}
            >
              <FileText
                className="w-4 h-4 text-muted-foreground shrink-0"
                aria-hidden
              />
              <Select value={formSelectValue} onValueChange={handleFormSelect}>
                <SelectTrigger
                  className="w-full border-border bg-background"
                  aria-label="Filter by product"
                >
                  <SelectValue placeholder="All products" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All products</SelectItem>
                  {formOptions.map((f) => (
                    <SelectItem key={f.id} value={f.id}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {csrOptions.length > 0 && onFilterChange && (
            <div
              className="flex items-center gap-2 shrink-0"
              style={{ flex: "0 1 260px" }}
            >
              <UserCircle2
                className="w-4 h-4 text-muted-foreground shrink-0"
                aria-hidden
              />
              <Select value={csrSelectValue} onValueChange={handleCsrSelect}>
                <SelectTrigger
                  className="w-full border-border bg-background"
                  aria-label="Filter by CSR"
                >
                  <SelectValue placeholder="All CSRs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All CSRs</SelectItem>
                  {csrOptions.map((c) => (
                    <SelectItem key={c.id} value={c.id} textValue={c.name}>
                      <CsrUserOption
                        full_name={c.full_name}
                        email={c.email}
                      />
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {onFilterChange && (
            <Select
              value={statusSelectValue}
              onValueChange={(v) =>
                onFilterChange({
                  ...filters,
                  status: v === "all" ? undefined : v,
                })
              }
            >
              <SelectTrigger
                className="w-[160px] border-border bg-background shrink-0"
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
          )}
          {agentOptions.length > 0 && onFilterChange && (
            <Select
              value={agentSelectValue}
              onValueChange={(v) =>
                onFilterChange({
                  ...filters,
                  agent_id: v === "all" ? undefined : Number(v),
                })
              }
            >
              <SelectTrigger
                className="w-[160px] border-border bg-background shrink-0"
                aria-label="Filter by agent"
              >
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agentOptions.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {funnelOptions.length > 0 && onFilterChange && (
            <Select
              value={filters.funnel_name ?? "all"}
              onValueChange={(v) =>
                onFilterChange({
                  ...filters,
                  funnel_name: v === "all" ? undefined : v,
                })
              }
            >
              <SelectTrigger className="w-[160px] border-border bg-background shrink-0">
                <SelectValue placeholder="All funnels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All funnels</SelectItem>
                {funnelOptions.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {subBrandOptions.length > 0 && onFilterChange && (
            <Select
              value={filters.sub_brand ?? "all"}
              onValueChange={(v) =>
                onFilterChange({
                  ...filters,
                  sub_brand: v === "all" ? undefined : v,
                })
              }
            >
              <SelectTrigger className="w-[160px] border-border bg-background shrink-0">
                <SelectValue placeholder="All sub-brands" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sub-brands</SelectItem>
                {subBrandOptions.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {onFilterChange && (
            <>
              <DateInput
                value={filters.date_from ?? ""}
                onChange={(v) =>
                  onFilterChange({ ...filters, date_from: v || undefined })
                }
                className="w-[140px] shrink-0"
                aria-label="From date"
              />
              <DateInput
                value={filters.date_to ?? ""}
                onChange={(v) =>
                  onFilterChange({ ...filters, date_to: v || undefined })
                }
                className="w-[140px] shrink-0"
                aria-label="To date"
              />
            </>
          )}
        </div>

        {/* Active Filters */}
        {(filters.status ||
          filters.form_id ||
          filters.csr_id ||
          filters.agent_id != null ||
          filters.sub_brand ||
          filters.funnel_name ||
          filters.date_from ||
          filters.date_to) && (
          <div className="form-response-active-filters">
            {filters.status && (
              <span className="form-response-filter-tag">
                Status: {orderStatusLabel(filters.status)}
                <button
                  onClick={() => handleFilterRemove("status")}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.form_id && (
              <span className="form-response-filter-tag">
                Product: {selectedFormName || filters.form_id}
                <button
                  onClick={() => handleFilterRemove("form_id")}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.csr_id && (
              <span className="form-response-filter-tag">
                CSR: {selectedCsrName || filters.csr_id}
                <button
                  onClick={() => handleFilterRemove("csr_id")}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.agent_id != null && (
              <span className="form-response-filter-tag">
                Agent:{" "}
                {agentOptions.find((a) => a.id === filters.agent_id)?.name ||
                  filters.agent_id}
                <button
                  onClick={() => handleFilterRemove("agent_id")}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.funnel_name && (
              <span className="form-response-filter-tag">
                Funnel: {filters.funnel_name}
                <button
                  onClick={() => handleFilterRemove("funnel_name")}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {filters.sub_brand && (
              <span className="form-response-filter-tag">
                Sub-brand: {filters.sub_brand}
                <button
                  onClick={() => handleFilterRemove("sub_brand")}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {(filters.date_from || filters.date_to) && (
              <span className="form-response-filter-tag">
                Date Range
                <button
                  onClick={() => {
                    if (onFilterChange) {
                      onFilterChange({
                        ...filters,
                        date_from: undefined,
                        date_to: undefined,
                      });
                    }
                  }}
                  className="form-response-filter-remove"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Table */}
      <div className="form-response-table-wrapper">
        <table className="form-response-table">
          <FormResponseTableHeader
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            onSort={handleSort}
          />
          <tbody>
            {loading ? (
              <tr>
                <TableLoadingCell
                  colSpan={TABLE_COLUMN_COUNT}
                  message="Loading form responses…"
                />
              </tr>
            ) : error ? (
              <tr>
                <td
                  colSpan={TABLE_COLUMN_COUNT}
                  className="form-response-table-error"
                >
                  {error}
                </td>
              </tr>
            ) : paginatedResponses.length === 0 ? (
              <tr>
                <td
                  colSpan={TABLE_COLUMN_COUNT}
                  className="form-response-table-empty"
                >
                  No form responses found.
                </td>
              </tr>
            ) : groupByMonth && monthSections ? (
              monthSections.flatMap((section, sectionIdx) => {
                let rowIndex = monthSections
                  .slice(0, sectionIdx)
                  .reduce((n, s) => n + s.items.length, 0);
                return [
                  <tr key={`month-${section.key}`} className="form-response-month-row">
                    <td
                      colSpan={TABLE_COLUMN_COUNT}
                      className="form-response-month-header px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground bg-muted/40 border-y border-border"
                    >
                      {section.label}
                    </td>
                  </tr>,
                  ...section.items.map((response, index) => (
                    <FormResponseTableRow
                      key={response.id}
                      response={response}
                      agents={agents}
                      index={rowIndex + index}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onNotesUpdate={onNotesUpdate}
                      canEdit={canEdit}
                      canDelete={canDelete}
                    />
                  )),
                ];
              })
            ) : (
              renderRows(paginatedResponses, startIndex)
            )}
          </tbody>
        </table>
      </div>

      {onPageChange && !groupByMonth && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={responses.length}
          itemsPerPage={itemsPerPage}
          onPageChange={onPageChange}
        />
      )}
    </div>
  );
}
