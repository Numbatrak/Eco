import "../deliveries/DeliveryTable.css";
import "./WaybillStatisticsTable.css";

export function WaybillStatisticsTableHeader() {
  return (
    <thead>
      <tr>
        <th className="delivery-table-header-cell">#</th>
        <th className="delivery-table-header-cell">State/Region</th>
        <th className="delivery-table-header-cell text-right">Quantity</th>
        <th className="delivery-table-header-cell text-right">Waybill Count</th>
        <th className="delivery-table-header-cell text-right">Total Value</th>
        <th className="delivery-table-header-cell">Time Frame</th>
        <th className="delivery-table-header-cell text-right">
          Avg. Days Since Waybill
        </th>
      </tr>
    </thead>
  );
}

