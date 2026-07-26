import { AbandonedCartWithRelations } from "../../types/abandonedCart";
import { Pencil, Trash2, CheckCircle2, XCircle, ExternalLink } from "lucide-react";
import { FollowUpActions } from "../followUps/FollowUpActions";
import "./AbandonedCartTable.css";

interface AbandonedCartTableRowProps {
  cart: AbandonedCartWithRelations;
  index: number;
  onEdit: (cart: AbandonedCartWithRelations) => void;
  onDelete: (cartId: string) => void;
  onConvert: (cart: AbandonedCartWithRelations) => void;
  onFollowUpSuccess?: (message: string) => void;
  onFollowUpError?: (message: string) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function AbandonedCartTableRow({
  cart,
  index,
  onEdit,
  onDelete,
  onConvert,
  onFollowUpSuccess,
  onFollowUpError,
  canEdit = true,
  canDelete = true,
}: AbandonedCartTableRowProps) {
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
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateString;
    }
  };

  const truncateText = (text: string | null, limit: number) => {
    if (!text) return "N/A";
    if (text.length <= limit) return text;
    return text.substring(0, limit) + "...";
  };

  return (
    <tr>
      <td className="abandoned-cart-table-cell abandoned-cart-table-cell-medium">
        {cart.customer_name || <span className="abandoned-cart-table-empty-value">N/A</span>}
      </td>
      <td className="abandoned-cart-table-cell">
        {cart.phone_number || cart.whatsapp_number || (
          <span className="abandoned-cart-table-empty-value">N/A</span>
        )}
      </td>
      <td className="abandoned-cart-table-cell">
        {cart.location || <span className="abandoned-cart-table-empty-value">N/A</span>}
      </td>
      <td className="abandoned-cart-table-cell abandoned-cart-table-cell-medium">
        {cart.product_name || <span className="abandoned-cart-table-empty-value">N/A</span>}
      </td>
      <td className="abandoned-cart-table-cell text-right">
        {cart.quantity ?? <span className="abandoned-cart-table-empty-value">N/A</span>}
      </td>
      <td className="abandoned-cart-table-cell text-right">
        {formatCurrency(cart.sales_price)}
      </td>
      <td className="abandoned-cart-table-cell">
        {cart.page_url ? (
          <a
            href={cart.page_url}
            target="_blank"
            rel="noopener noreferrer"
            className="abandoned-cart-table-link"
            title={cart.page_url}
          >
            {truncateText(cart.page_url, 30)}
            <ExternalLink className="abandoned-cart-table-link-icon" />
          </a>
        ) : (
          <span className="abandoned-cart-table-empty-value">N/A</span>
        )}
      </td>
      <td className="abandoned-cart-table-cell text-center">
        <span className="abandoned-cart-table-badge">
          {cart.filled_fields_count}
        </span>
      </td>
      <td className="abandoned-cart-table-cell">
        {formatDate(cart.abandoned_at)}
      </td>
      <td className="abandoned-cart-table-cell text-center">
        {cart.converted_to_order ? (
          <span className="abandoned-cart-table-status-badge converted">
            <CheckCircle2 className="abandoned-cart-table-status-icon" />
            Yes
          </span>
        ) : (
          <span className="abandoned-cart-table-status-badge not-converted">
            <XCircle className="abandoned-cart-table-status-icon" />
            No
          </span>
        )}
      </td>
      <td className="abandoned-cart-table-cell abandoned-cart-table-actions-cell">
        <div className="abandoned-cart-table-actions">
          <FollowUpActions
            abandonedCartId={String(cart.id)}
            onSuccess={onFollowUpSuccess}
            onError={onFollowUpError}
            compact
          />
          {!cart.converted_to_order && canEdit && (
            <button
              onClick={() => onConvert(cart)}
              className="abandoned-cart-table-action-button convert"
              title="Convert to order"
            >
              <CheckCircle2 className="abandoned-cart-table-action-icon" />
            </button>
          )}
          {canEdit && (
            <button
              onClick={() => onEdit(cart)}
              className="abandoned-cart-table-action-button edit"
              title="Edit cart"
            >
              <Pencil className="abandoned-cart-table-action-icon" />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => onDelete(cart.id)}
              className="abandoned-cart-table-action-button delete"
              title="Delete cart"
            >
              <Trash2 className="abandoned-cart-table-action-icon" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

