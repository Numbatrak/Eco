import "../expenses/ExpenseTable.css";

export function GeneralExpenseTableHeader() {
  return (
    <thead>
      <tr>
        <th className="expense-table-header-cell">Date</th>
        <th className="expense-table-header-cell">Month</th>
        <th className="expense-table-header-cell">Day</th>
        <th className="expense-table-header-cell">Year</th>
        <th className="expense-table-header-cell">Product</th>
        <th className="expense-table-header-cell">Category</th>
        <th className="expense-table-header-cell">Subcategory</th>
        <th className="expense-table-header-cell text-right">Amount</th>
        <th className="expense-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}






