import { WaybillByState } from "../../services/waybillsByState";
import "../deliveries/DeliveryTable.css";
import "./WaybillStatisticsTable.css";

interface WaybillStatisticsTableRowProps {
  item: WaybillByState;
  index: number;
}

export function WaybillStatisticsTableRow({
  item,
  index,
}: WaybillStatisticsTableRowProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getTimeFrame = (earliest: string | null, latest: string | null) => {
    if (!earliest || !latest) return "N/A";
    return `${formatDate(earliest)} - ${formatDate(latest)}`;
  };

  return (
    <tr>
      <td className="delivery-table-cell">{index + 1}</td>
      <td className="delivery-table-cell delivery-table-cell-medium">
        {item.state}
      </td>
      <td className="delivery-table-cell text-right">
        {item.totalQuantity.toLocaleString()}
      </td>
      <td className="delivery-table-cell text-right">
        {item.waybillCount.toLocaleString()}
      </td>
      <td className="delivery-table-cell text-right delivery-table-cell-semibold">
        {formatCurrency(item.totalCost)}
      </td>
      <td className="delivery-table-cell">
        {getTimeFrame(item.earliestDate, item.latestDate)}
      </td>
      <td className="delivery-table-cell text-right">
        {item.averageDaysSinceWaybill !== null ? (
          `${item.averageDaysSinceWaybill} days`
        ) : (
          <span className="delivery-table-empty-value">N/A</span>
        )}
      </td>
    </tr>
  );
}

