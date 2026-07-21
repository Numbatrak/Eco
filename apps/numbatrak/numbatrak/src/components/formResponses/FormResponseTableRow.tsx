import { useState, useEffect } from "react";
import { FormResponseWithItems } from "../../types/formResponse";
import { Agent } from "../../types/agent";
import {
  Pencil,
  Trash2,
  CheckCircle2,
  Clock,
  XCircle,
  ChevronDown,
  ChevronRight,
  Package,
  FileText,
  StickyNote,
} from "lucide-react";
import {
  extractCustomerName,
  extractPhoneNumber,
  extractPackageName,
  extractLocation,
  potentialOrderProfit,
  isCompleted,
} from "../../utils/formResponseHelpers";
import { orderStatusLabel } from "../../constants/orderStatus";
import { FormFieldRenderer } from "./FormFieldRenderer";
import { fetchProducts } from "../../services/products";
import { useOrganization } from "../../contexts/OrganizationContext";
import "./FormResponseTable.css";

const TABLE_COLUMN_COUNT = 13;

interface FormResponseTableRowProps {
  response: FormResponseWithItems;
  agents: Agent[];
  index: number;
  onEdit: (response: FormResponseWithItems) => void;
  onDelete: (responseId: string) => void;
  onNotesUpdate?: (responseId: string, notes: string) => Promise<void>;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function FormResponseTableRow({
  response,
  agents,
  index,
  onEdit,
  onDelete,
  onNotesUpdate,
  canEdit = true,
  canDelete = true,
}: FormResponseTableRowProps) {
  const { currentOrganization } = useOrganization();
  const [isExpanded, setIsExpanded] = useState(false);
  const [notes, setNotes] = useState(response.notes || "");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [productsMap, setProductsMap] = useState<Map<string, string>>(
    new Map()
  );

  // Update notes when response changes
  useEffect(() => {
    setNotes(response.notes || "");
  }, [response.notes]);

  // Load product names when expanded
  useEffect(() => {
    if (isExpanded && response.items.length > 0 && currentOrganization) {
      const loadProductNames = async () => {
        try {
          const productIds = response.items.map((item) => item.product_id);
          const products = await fetchProducts(currentOrganization.id);
          const map = new Map<string, string>();
          products.forEach((product) => {
            if (productIds.includes(product.id)) {
              map.set(product.id, product.name);
            }
          });
          setProductsMap(map);
        } catch (err) {
          console.error("Error loading product names:", err);
        }
      };
      loadProductNames();
    }
  }, [isExpanded, response.items, currentOrganization?.id]);

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return "N/A";
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  const getStatusBadge = (status: string) => {
    const label = orderStatusLabel(status);
    const statusLower = status.toLowerCase();

    if (statusLower === "completed" || statusLower === "delivered") {
      return (
        <span className="form-response-status-badge completed">
          <CheckCircle2 className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (statusLower === "pending" || statusLower === "new") {
      return (
        <span className="form-response-status-badge pending">
          <Clock className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (
      statusLower === "confirmed" ||
      statusLower === "packed" ||
      statusLower === "dispatched"
    ) {
      return (
        <span className="form-response-status-badge pending">
          <Clock className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (statusLower === "failed" || statusLower === "abandoned") {
      return (
        <span className="form-response-status-badge abandoned">
          <XCircle className="w-3 h-3" />
          {label}
        </span>
      );
    }
    if (
      statusLower === "cancelled" ||
      statusLower === "returned" ||
      statusLower === "lost"
    ) {
      return (
        <span className="form-response-status-badge cancelled">
          <XCircle className="w-3 h-3" />
          {label}
        </span>
      );
    }

    return <span className="form-response-status-badge">{label}</span>;
  };

  const isCompletedOrder = isCompleted(response.status);

  // Fall back to field_values when DB-extracted columns are empty (e.g. trigger not run or different field names)
  const displayCustomerName =
    response.customer_name ||
    extractCustomerName(response.field_values) ||
    null;
  const displayPhoneNumber =
    response.phone_number || extractPhoneNumber(response.field_values) || null;
  const displayPackageName =
    response.package_name || extractPackageName(response.field_values) || null;
  const displayLocation = extractLocation(response.field_values);

  const netProfit = isCompletedOrder
    ? (response.profit ?? 0)
    : potentialOrderProfit(response.items, response.delivery_fee);
  const profitLabel = isCompletedOrder ? "" : " (potential)";

  const handleNotesSave = async () => {
    if (!onNotesUpdate) return;

    setIsSavingNotes(true);
    setNotesError(null);
    try {
      await onNotesUpdate(response.id, notes.trim());
      setIsEditingNotes(false);
    } catch (error) {
      console.error("Error saving notes:", error);
      setNotesError("Failed to save notes. Please try again.");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleNotesCancel = () => {
    setNotes(response.notes || "");
    setNotesError(null);
    setIsEditingNotes(false);
  };

  const startEditingNotes = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canEdit || !onNotesUpdate) return;
    setNotesError(null);
    setIsEditingNotes(true);
  };

  const truncateText = (text: string | null, maxLength: number = 30) => {
    if (!text)
      return <span className="form-response-table-empty-value">N/A</span>;
    if (text.length <= maxLength) return text;
    return <span title={text}>{text.substring(0, maxLength)}...</span>;
  };

  return (
    <>
      <tr
        className={`form-response-table-row ${isExpanded ? "expanded" : ""}`}
        onClick={() => {
          if (isEditingNotes) return;
          setIsExpanded(!isExpanded);
        }}
      >
        <td className="form-response-table-cell font-medium">
          {displayCustomerName || (
            <span className="form-response-table-empty-value text-xs italic">
              No name
            </span>
          )}
        </td>
        <td className="form-response-table-cell font-medium">
          {displayPhoneNumber || (
            <span className="form-response-table-empty-value text-xs italic">
              No number
            </span>
          )}
        </td>
        <td className="form-response-table-cell">
          {displayLocation || (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td className="form-response-table-cell">
          {displayPackageName || (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td className="form-response-table-cell">
          {response.funnel_name || response.offer_name || response.form?.name ? (
            truncateText(
              response.funnel_name ||
                response.offer_name ||
                response.form?.name ||
                null,
              28
            )
          ) : (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td className="form-response-table-cell">
          {getStatusBadge(response.status)}
        </td>
        <td className="form-response-table-cell">
          {formatDate(response.created_at)}
        </td>
        <td className="form-response-table-cell">
          {response.agent_id != null ? (
            agents.find((a) => a.id === response.agent_id)?.name ?? (
              <span className="form-response-table-empty-value">N/A</span>
            )
          ) : (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td className="form-response-table-cell text-right">
          {response.delivery_fee != null && response.delivery_fee !== 0 ? (
            formatCurrency(response.delivery_fee)
          ) : (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td className="form-response-table-cell text-right">
          {response.amount_paid != null ? (
            formatCurrency(response.amount_paid)
          ) : (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td className="form-response-table-cell text-right font-semibold">
          {isCompletedOrder || netProfit !== 0 ? (
            <span className={netProfit >= 0 ? "text-primary" : "text-destructive"}>
              {formatCurrency(netProfit)}
              {profitLabel && (
                <span className="text-xs text-muted-foreground ml-1">
                  {profitLabel}
                </span>
              )}
            </span>
          ) : (
            <span className="form-response-table-empty-value">N/A</span>
          )}
        </td>
        <td
          className="form-response-table-cell form-response-notes-cell"
          onClick={(e) => e.stopPropagation()}
        >
          {isEditingNotes ? (
            <div className="form-response-notes-editor">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    e.preventDefault();
                    handleNotesCancel();
                  } else if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    void handleNotesSave();
                  }
                }}
                className="form-response-notes"
                rows={3}
                placeholder="Add notes..."
                autoFocus
              />
              {notesError && (
                <p className="form-response-notes-error">{notesError}</p>
              )}
              <div className="form-response-notes-actions">
                <button
                  type="button"
                  onClick={() => void handleNotesSave()}
                  disabled={isSavingNotes}
                  className="form-response-notes-save-btn"
                >
                  {isSavingNotes ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleNotesCancel}
                  disabled={isSavingNotes}
                  className="form-response-notes-cancel-btn"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="form-response-notes-display">
              <button
                type="button"
                className={`form-response-notes-trigger ${
                  canEdit && onNotesUpdate ? "editable" : ""
                }`}
                onClick={startEditingNotes}
                disabled={!canEdit || !onNotesUpdate}
                title={canEdit ? "Click to edit notes" : undefined}
              >
                {notes ? (
                  truncateText(notes, 40)
                ) : (
                  <span className="form-response-notes-placeholder">
                    {canEdit && onNotesUpdate ? "Click to add notes" : "N/A"}
                  </span>
                )}
              </button>
              {canEdit && onNotesUpdate && (
                <button
                  type="button"
                  className="form-response-notes-edit-btn"
                  onClick={startEditingNotes}
                  title="Edit notes"
                >
                  <StickyNote className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </td>
        <td
          className="form-response-table-cell text-right"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="form-response-table-actions">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )}
            {canEdit && (
              <button
                onClick={() => onEdit(response)}
                className="form-response-action-button edit"
                title="Edit response"
              >
                <Pencil className="form-response-action-icon" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(response.id)}
                className="form-response-action-button delete"
                title="Delete response"
              >
                <Trash2 className="form-response-action-icon" />
              </button>
            )}
          </div>
        </td>
      </tr>

      {isExpanded && (
        <tr>
          <td colSpan={TABLE_COLUMN_COUNT} className="form-response-table-cell p-0">
            <div className="form-response-details">
              {/* Products Section */}
              {response.items.length > 0 && (
                <div className="form-response-details-section">
                  <div className="form-response-details-title flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Products ({response.items.length})
                  </div>
                  <div className="form-response-products-list">
                    {response.items.map((item, idx) => (
                      <div key={item.id} className="form-response-product-item">
                        <div>
                          <div className="form-response-product-name">
                            Product {idx + 1} (Qty: {item.quantity})
                          </div>
                          <div className="form-response-product-details">
                            Price:{" "}
                            {formatCurrency(item.unit_price_at_submission)} ×{" "}
                            {item.quantity} = {formatCurrency(item.total_price)}{" "}
                            | Cost:{" "}
                            {formatCurrency(item.unit_cost_at_submission)} ×{" "}
                            {item.quantity} = {formatCurrency(item.total_cost)}{" "}
                            | Profit: {formatCurrency(item.profit)}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-2 pt-2 border-t border-border">
                      <div className="flex justify-between items-center text-sm">
                        <span className="font-semibold text-foreground">
                          Total Potential Profit:
                        </span>
                        <span
                          className={`font-bold ${
                            netProfit >= 0 ? "text-primary" : "text-destructive"
                          }`}
                        >
                          {formatCurrency(netProfit)}
                        </span>
                      </div>
                      {isCompletedOrder && response.profit != null && (
                        <div className="flex justify-between items-center text-sm mt-1">
                          <span className="text-muted-foreground">
                            Actual Profit (Completed):
                          </span>
                          <span
                            className={`font-semibold ${
                              response.profit >= 0
                                ? "text-primary"
                                : "text-destructive"
                            }`}
                          >
                            {formatCurrency(response.profit)}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Form Fields Section */}
              <div className="form-response-details-section">
                <div className="form-response-details-title flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Form Data
                </div>
                <FormFieldRenderer
                  fieldValues={response.field_values}
                  formSchema={response.form?.schema || null}
                />
              </div>

              {/* Metadata Section */}
              <div className="form-response-details-section">
                <div className="form-response-details-title">Metadata</div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Form:</span>{" "}
                    <span className="font-medium">
                      {response.form?.name || "Unknown"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Source:</span>{" "}
                    <span className="font-medium capitalize">
                      {response.source}
                    </span>
                  </div>
                  {response.page_url && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Page URL:</span>{" "}
                      <a
                        href={response.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        {response.page_url}
                      </a>
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">Response Type:</span>{" "}
                    <span className="font-medium capitalize">
                      {response.response_type.replace("_", " ")}
                    </span>
                  </div>
                  {response.completed_at && (
                    <div>
                      <span className="text-muted-foreground">Completed:</span>{" "}
                      <span className="font-medium">
                        {formatDate(response.completed_at)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
