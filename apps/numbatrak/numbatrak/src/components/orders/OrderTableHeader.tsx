import "./OrderTable.css";

/** Form minimum/compulsory fields shown first in the order table */
const COMPULSORY_COLUMNS = [
  { key: "customer_name", label: "Customer Name", required: true },
  { key: "phone", label: "Phone", required: true },
  { key: "location", label: "Location (State / Address)", required: true },
  { key: "product", label: "Product (Package)", required: true },
] as const;

export function OrderTableHeader() {
  return (
    <thead>
      <tr>
        {COMPULSORY_COLUMNS.map(({ label, required }) => (
          <th
            key={label}
            className={`order-table-header-cell ${
              required ? "order-table-header-required" : ""
            }`}
            title={required ? "Required form field" : undefined}
          >
            <span className="order-table-header-label">{label}</span>
            {required && (
              <span className="order-table-header-required-badge" aria-hidden>
                Required
              </span>
            )}
          </th>
        ))}
        <th className="order-table-header-cell">Order Date</th>
        <th className="order-table-header-cell">Order Month</th>
        <th className="order-table-header-cell">Order Year</th>
        <th className="order-table-header-cell text-right">Mail Qty</th>
        <th className="order-table-header-cell text-right">Agent Qty</th>
        <th className="order-table-header-cell text-right">Quantity</th>
        <th className="order-table-header-cell">Product 2</th>
        <th className="order-table-header-cell text-right">Mail Qty 2</th>
        <th className="order-table-header-cell text-right">Agent Qty 2</th>
        <th className="order-table-header-cell text-right">Quantity 2</th>
        <th className="order-table-header-cell text-right">Cost Price</th>
        <th className="order-table-header-cell text-right">Delivery Fee</th>
        <th className="order-table-header-cell text-right">Sales Price</th>
        <th className="order-table-header-cell text-right">Profit</th>
        <th className="order-table-header-cell">Status</th>
        <th className="order-table-header-cell">Delivery Date</th>
        <th className="order-table-header-cell">Delivery Month</th>
        <th className="order-table-header-cell">Delivery Year</th>
        <th className="order-table-header-cell">Confirmed</th>
        <th className="order-table-header-cell">Agent</th>
        <th className="order-table-header-cell">Note</th>
        <th className="order-table-header-cell">Subject</th>
        <th className="order-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}
