import "./ExpenseTable.css";

export function ExpenseTableHeader() {
  return (
    <thead>
      <tr>
        <th className="expense-table-header-cell">Date</th>
        <th className="expense-table-header-cell">Month</th>
        <th className="expense-table-header-cell">Category</th>
        <th className="expense-table-header-cell text-right">Amount</th>
        <th className="expense-table-header-cell">Agent</th>
        <th className="expense-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}






