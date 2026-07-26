import { GeneralExpenseWithRelations } from "../../types/generalExpense";
import { Pencil, Trash2 } from "lucide-react";
import { getMonthName, getDayOfWeek } from "../../services/generalExpenses";
import "../expenses/ExpenseTable.css";

interface GeneralExpenseTableRowProps {
  expense: GeneralExpenseWithRelations;
  index: number;
  onEdit: (expense: GeneralExpenseWithRelations) => void;
  onDelete: (expenseId: number) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function GeneralExpenseTableRow({
  expense,
  index,
  onEdit,
  onDelete,
  canEdit = true,
  canDelete = true,
}: GeneralExpenseTableRowProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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

  const month = getMonthName(expense.date);
  const dayOfWeek = getDayOfWeek(expense.date);
  const year = new Date(expense.date).getFullYear();

  return (
    <tr>
      <td className="expense-table-cell">
        {formatDate(expense.date)}
      </td>
      <td className="expense-table-cell expense-table-cell-medium">
        {month}
      </td>
      <td className="expense-table-cell" style={{ color: "#4b5563" }}>
        {dayOfWeek}
      </td>
      <td className="expense-table-cell" style={{ color: "#4b5563" }}>{year}</td>
      <td className="expense-table-cell">
        {expense.product?.name || (
          <span className="expense-table-empty-value">N/A</span>
        )}
      </td>
      <td className="expense-table-cell">
        <span className="expense-table-category-badge">
          {expense.category}
        </span>
      </td>
      <td className="expense-table-cell">{expense.subcategory}</td>
      <td className="expense-table-cell text-right expense-table-cell-semibold">
        {formatCurrency(expense.amount)}
      </td>
      <td className="expense-table-cell text-right">
        {(canEdit || canDelete) && (
          <div className="expense-table-actions">
            {canEdit && (
              <button
                onClick={() => onEdit(expense)}
                className="expense-table-action-button edit"
                title="Edit expense"
              >
                <Pencil className="expense-table-action-icon" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(expense.id)}
                className="expense-table-action-button delete"
                title="Delete expense"
              >
                <Trash2 className="expense-table-action-icon" />
              </button>
            )}
          </div>
        )}
      </td>
    </tr>
  );
}






