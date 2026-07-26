import { ArrowUp, ArrowDown } from "lucide-react";
import "./FormResponseTable.css";

interface FormResponseTableHeaderProps {
  sortColumn?: string;
  sortOrder?: "asc" | "desc";
  onSort?: (column: string) => void;
}

export function FormResponseTableHeader({
  sortColumn,
  sortOrder,
  onSort,
}: FormResponseTableHeaderProps) {
  const handleSort = (column: string) => {
    if (onSort) {
      onSort(column);
    }
  };

  const SortIcon = ({ column }: { column: string }) => {
    if (sortColumn !== column) {
      return (
        <span className="opacity-30">
          <ArrowUp className="w-3 h-3" />
        </span>
      );
    }
    return sortOrder === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  /** Form minimum/compulsory fields – shown with Required badge */
  const requiredColumns = [
    { key: "customer_name", label: "Customer Name" },
    { key: "phone_number", label: "Phone Number" },
    { key: "location", label: "Location (State / Address)" },
    { key: "package_name", label: "Package" },
  ] as const;

  return (
    <thead>
      <tr>
        {requiredColumns.map(({ key, label }) => (
          <th
            key={key}
            className="form-response-table-header-cell form-response-table-header-required font-semibold"
            title="Required form field"
          >
            <button
              type="button"
              onClick={() => handleSort(key)}
              className="flex items-center gap-1 hover:text-primary flex-wrap"
            >
              <span>{label}</span>
              <span className="form-response-table-required-badge" aria-hidden>
                Required
              </span>
              <SortIcon column={key} />
            </button>
          </th>
        ))}
        <th className="form-response-table-header-cell">
          Funnel / Offer
        </th>
        <th className="form-response-table-header-cell">
          <button
            type="button"
            onClick={() => handleSort("status")}
            className="flex items-center gap-1 hover:text-primary"
          >
            Status
            <SortIcon column="status" />
          </button>
        </th>
        <th className="form-response-table-header-cell">
          <button
            type="button"
            onClick={() => handleSort("created_at")}
            className="flex items-center gap-1 hover:text-primary"
          >
            Date
            <SortIcon column="created_at" />
          </button>
        </th>
        <th className="form-response-table-header-cell">Agent</th>
        <th className="form-response-table-header-cell text-right">
          Delivery Fee
        </th>
        <th className="form-response-table-header-cell text-right">
          Amount paid
        </th>
        <th className="form-response-table-header-cell text-right">
          <button
            type="button"
            onClick={() => handleSort("profit")}
            className="flex items-center gap-1 hover:text-primary ml-auto"
          >
            Net Profit
            <SortIcon column="profit" />
          </button>
        </th>
        <th
          className="form-response-table-header-cell"
          style={{ maxWidth: "200px" }}
        >
          Notes
        </th>
        <th className="form-response-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}
