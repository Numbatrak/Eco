import "./DeliveryTable.css";

export function DeliveryTableHeader() {
  return (
    <thead>
      <tr>
        <th className="delivery-table-header-cell">Date</th>
        <th className="delivery-table-header-cell">Month</th>
        <th className="delivery-table-header-cell">CSR</th>
        <th className="delivery-table-header-cell">Agent</th>
        <th className="delivery-table-header-cell">Status</th>
        <th className="delivery-table-header-cell">Product</th>
        <th className="delivery-table-header-cell text-right">Quantity</th>
        <th className="delivery-table-header-cell text-right">Cost</th>
        <th className="delivery-table-header-cell text-right">Waybilling Fee</th>
        <th className="delivery-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}





