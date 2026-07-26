import "./AbandonedCartTable.css";

export function AbandonedCartTableHeader() {
  return (
    <thead>
      <tr>
        <th className="abandoned-cart-table-header-cell">Customer Name</th>
        <th className="abandoned-cart-table-header-cell">Phone</th>
        <th className="abandoned-cart-table-header-cell">Location</th>
        <th className="abandoned-cart-table-header-cell">Product</th>
        <th className="abandoned-cart-table-header-cell text-right">Quantity</th>
        <th className="abandoned-cart-table-header-cell text-right">Sales Price</th>
        <th className="abandoned-cart-table-header-cell">Page URL</th>
        <th className="abandoned-cart-table-header-cell text-center">Fields Filled</th>
        <th className="abandoned-cart-table-header-cell">Abandoned At</th>
        <th className="abandoned-cart-table-header-cell text-center">Converted</th>
        <th className="abandoned-cart-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}






