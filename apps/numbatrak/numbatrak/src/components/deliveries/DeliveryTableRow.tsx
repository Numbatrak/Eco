import { DeliveryWithRelations } from "../../types/delivery";
import { Pencil, Trash2, Clock, CheckCircle2 } from "lucide-react";
import { getMonthName } from "../../services/deliveries";
import "./DeliveryTable.css";

interface DeliveryTableRowProps {
  delivery: DeliveryWithRelations;
  index: number;
  onEdit: (delivery: DeliveryWithRelations) => void;
  onDelete: (deliveryId: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function DeliveryTableRow({
  delivery,
  index,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: DeliveryTableRowProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const month = getMonthName(delivery.date);
  const status = delivery.status;
  const isDelivered = status === "Delivered";
  const isWaybilled = status === "Waybilled";

  return (
    <tr>
      <td className="delivery-table-cell">
        {formatDate(delivery.date)}
      </td>
      <td className="delivery-table-cell delivery-table-cell-medium">
        {month}
      </td>
      <td className="delivery-table-cell">
        {delivery.csr || <span className="delivery-table-empty-value">N/A</span>}
      </td>
      <td className="delivery-table-cell">
        {delivery.agent?.name || <span className="delivery-table-empty-value">N/A</span>}
      </td>
      <td className="delivery-table-cell">
        <span className={`delivery-table-status-badge ${isDelivered ? "delivered" : "waybilled"}`}>
          {isDelivered ? (
            <>
              <CheckCircle2 className="delivery-table-status-icon" />
              Delivered
            </>
          ) : (
            <>
              <Clock className="delivery-table-status-icon" />
              Waybilled
            </>
          )}
        </span>
      </td>
      <td className="delivery-table-cell delivery-table-cell-medium">
        {delivery.product?.name || "Unknown"}
      </td>
      <td className="delivery-table-cell text-right">
        {delivery.quantity}
      </td>
      <td className="delivery-table-cell text-right delivery-table-cell-semibold">
        {formatCurrency(delivery.cost)}
      </td>
      <td className="delivery-table-cell text-right">
        {delivery.waybilling_fee > 0 ? (
          formatCurrency(delivery.waybilling_fee)
        ) : (
          <span className="delivery-table-empty-value">N/A</span>
        )}
      </td>
      <td className="delivery-table-cell text-right">
        {(canEdit || canDelete) && (
          <div className="delivery-table-actions">
            {canEdit && (
              <button
                onClick={() => onEdit(delivery)}
                className="delivery-table-action-button edit"
                title="Edit delivery"
              >
                <Pencil className="delivery-table-action-icon" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(delivery.id)}
                className="delivery-table-action-button delete"
                title="Delete delivery"
              >
                <Trash2 className="delivery-table-action-icon" />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}





