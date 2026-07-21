import "./AgentTable.css";

export function AgentTableEmptyState() {
  return (
    <tr>
      <td colSpan={4} className="agent-table-empty">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "16px", background: "linear-gradient(to bottom right, #eef2ff, #f3e8ff)", borderRadius: "50%" }}>
            <svg
              style={{ width: "48px", height: "48px", color: "#6366f1" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"
              />
            </svg>
          </div>
          <div>
            <p style={{ color: "#111827", fontWeight: 600, fontSize: "18px", marginBottom: "4px" }}>
              No agents yet
            </p>
            <p style={{ color: "#6b7280", fontSize: "14px" }}>
              Click "Add New Agent" to get started
            </p>
          </div>
        </div>
      </td>
    </tr>
  );
}





