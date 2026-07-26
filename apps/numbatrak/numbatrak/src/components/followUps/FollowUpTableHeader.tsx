import "./FollowUpTable.css";

export function FollowUpTableHeader() {
  return (
    <thead>
      <tr>
        <th className="follow-up-table-header-cell">Reference</th>
        <th className="follow-up-table-header-cell">Customer</th>
        <th className="follow-up-table-header-cell">Assigned To</th>
        <th className="follow-up-table-header-cell">Status</th>
        <th className="follow-up-table-header-cell">Priority</th>
        <th className="follow-up-table-header-cell text-center">Response Time</th>
        <th className="follow-up-table-header-cell text-center">Resolution Time</th>
        <th className="follow-up-table-header-cell">Outcome</th>
        <th className="follow-up-table-header-cell">Created</th>
        <th className="follow-up-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}

