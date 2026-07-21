import "./AgentTable.css";

interface AgentTableErrorStateProps {
  error: string;
}

export function AgentTableErrorState({ error }: AgentTableErrorStateProps) {
  return (
    <tr>
      <td colSpan={4} className="agent-table-error">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <div style={{ padding: "12px", backgroundColor: "#fee2e2", borderRadius: "50%" }}>
            <svg
              style={{ width: "32px", height: "32px", color: "#dc2626" }}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p style={{ color: "#dc2626", fontWeight: 600 }}>{error}</p>
        </div>
      </td>
    </tr>
  );
}





