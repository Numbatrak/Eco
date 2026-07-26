import "./AgentTable.css";

export function AgentTableHeader() {
  return (
    <thead>
      <tr>
        <th className="agent-table-header-cell">Agent ID</th>
        <th className="agent-table-header-cell">Name</th>
        <th className="agent-table-header-cell">Stock held</th>
        <th className="agent-table-header-cell">Delivery rate</th>
        <th className="agent-table-header-cell">Service Locations</th>
        <th className="agent-table-header-cell">Status</th>
        <th className="agent-table-header-cell text-right">Actions</th>
      </tr>
    </thead>
  );
}





