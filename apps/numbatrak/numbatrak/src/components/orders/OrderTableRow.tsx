import { OrderWithRelations } from "../../types/order";
import {
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
} from "lucide-react";
import { FollowUpActions } from "../followUps/FollowUpActions";
import { useOrganization } from "../../contexts/OrganizationContext";
import { generateInvoicePDF } from "../../utils/generateInvoice";
import "./OrderTable.css";

interface OrderTableRowProps {
  order: OrderWithRelations;
  index: number;
  onEdit: (order: OrderWithRelations) => void;
  onDelete: (orderId: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function OrderTableRow({
  order,
  index,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: OrderTableRowProps) {
  const { currentOrganization } = useOrganization();
  console.log(order);

  const handleDownloadInvoice = () => {
    generateInvoicePDF(order, currentOrganization?.name);
  };

  // Check if order is eligible for invoice (Delivered or Pending with pay on delivery)
  const isEligibleForInvoice = () => {
    const status = order.order_status?.toLowerCase();
    return status === "delivered" || status === "pending";
  };
  const formatCurrency = (value: number | null) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
    } catch {
      return dateString;
    }
  };

  const getStatusBadge = (status: string | null) => {
    if (!status) return null;
    const statusLower = status.toLowerCase();

    if (statusLower === "delivered") {
      return (
        <span className="order-table-status-badge delivered">
          <CheckCircle2 className="order-table-status-icon" />
          Delivered
        </span>
      );
    } else if (statusLower === "pending") {
      return (
        <span className="order-table-status-badge pending">
          <Clock className="order-table-status-icon" />
          Pending
        </span>
      );
    } else if (statusLower === "cancelled") {
      return (
        <span className="order-table-status-badge cancelled">
          <XCircle className="order-table-status-icon" />
          Cancelled
        </span>
      );
    }

    return <span className="order-table-status-badge">{status}</span>;
  };

  const truncateText = (text: string | null, maxLength: number = 30) => {
    if (!text) return <span className="order-table-empty-value">N/A</span>;
    if (text.length <= maxLength) return text;
    return <span title={text}>{text.substring(0, maxLength)}...</span>;
  };

  return (
    <tr>
      <td className="order-table-cell order-table-cell-medium">
        {order.customer_name || (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell">
        {order.phone_number || (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell">
        {order.location || <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell">{formatDate(order.order_date)}</td>
      <td className="order-table-cell">
        {order.order_month || (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell">
        {order.order_year || <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell order-table-cell-medium">
        {order.product_name || (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell text-right">
        {order.mail_quan ?? <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell text-right">
        {order.agent_quan ?? <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell text-right">
        {order.quantity ?? <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell">
        {order.product2 || <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell text-right">
        {order.mail_quan2 ?? <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell text-right">
        {order.agent_quan2 ?? (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell text-right">
        {order.quantity2 ?? <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell text-right">
        {formatCurrency(order.cost_price)}
      </td>
      <td className="order-table-cell text-right">
        {formatCurrency(order.delivery_fee)}
      </td>
      <td className="order-table-cell text-right">
        {formatCurrency(order.sales_price)}
      </td>
      <td className="order-table-cell text-right order-table-cell-semibold">
        {formatCurrency(order.profit)}
      </td>
      <td className="order-table-cell">{getStatusBadge(order.order_status)}</td>
      <td className="order-table-cell">{formatDate(order.delivery_date)}</td>
      <td className="order-table-cell">
        {order.delivery_month || (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell">
        {order.delivery_year || (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell">
        {order.confirmed_delivery ? (
          <span
            className="order-table-status-badge delivered"
            style={{ padding: "2px 8px", fontSize: "11px" }}
          >
            ✓
          </span>
        ) : (
          <span className="order-table-empty-value">N/A</span>
        )}
      </td>
      <td className="order-table-cell">
        {order.agent_name || <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell" style={{ maxWidth: "200px" }}>
        {truncateText(order.note, 30)}
      </td>
      <td className="order-table-cell">
        {order.subject || <span className="order-table-empty-value">N/A</span>}
      </td>
      <td className="order-table-cell text-right">
        <div className="order-table-actions">
          <div className="mr-2">
            <FollowUpActions
              orderId={order.id}
              onFollowUpCreated={() => {}}
              onFollowUpUpdated={() => {}}
            />
          </div>
          {isEligibleForInvoice() && (
            <button
              onClick={handleDownloadInvoice}
              className="order-table-action-button invoice"
              title="Download Invoice"
            >
              <FileText className="order-table-action-icon" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(order)}
              className="order-table-action-button edit"
              title="Edit order"
            >
              <Pencil className="order-table-action-icon" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(order.id)}
              className="order-table-action-button delete"
              title="Delete order"
            >
              <Trash2 className="order-table-action-icon" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}
