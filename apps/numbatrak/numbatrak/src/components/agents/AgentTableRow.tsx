import { Link } from "react-router-dom";
import { Agent } from "../../types/agent";
import { AgentMetrics, formatDeliveryRate } from "../../services/agentMetrics";
import { Pencil, Trash2, BarChart3, Ban, RotateCcw } from "lucide-react";
import "./AgentTable.css";

interface AgentTableRowProps {
  agent: Agent;
  metrics?: AgentMetrics;
  index: number;
  onEdit: (agent: Agent) => void;
  onDelete: (agentId: number) => void;
  onSetActive?: (agent: Agent, active: boolean) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function AgentTableRow({
  agent,
  metrics,
  index,
  onEdit,
  onDelete,
  onSetActive,
  canEdit = true,
  canDelete = true,
}: AgentTableRowProps) {
  const isActive = agent.active !== false;
  const isWarehouse = agent.is_warehouse === true;

  return (
    <tr className={!isActive ? "agent-table-row-inactive" : undefined}>
      <td className="agent-table-cell">
        <span className="agent-table-id-badge">#{agent.id}</span>
      </td>
      <td className="agent-table-cell">
        <div className="agent-table-name-section">
          <div className="agent-table-avatar">
            {agent.name.charAt(0).toUpperCase()}
          </div>
          <span className="agent-table-name">{agent.name}</span>
          {isWarehouse && (
            <span className="agent-table-warehouse-badge" title="Warehouse — holds stock, does not deliver">
              Warehouse
            </span>
          )}
        </div>
      </td>
      <td className="agent-table-cell agent-table-cell-numeric">
        <span className="tabular-nums">
          {metrics ? metrics.stock_units.toLocaleString() : "—"}
        </span>
        <span className="agent-table-metric-hint"> units</span>
      </td>
      <td className="agent-table-cell agent-table-cell-numeric">
        <span className="tabular-nums">
          {isWarehouse
            ? "—"
            : formatDeliveryRate(metrics?.delivery_rate ?? null)}
        </span>
      </td>
      <td className="agent-table-cell">
        <div className="agent-table-locations">
          {agent.locations && agent.locations.length > 0 ? (
            agent.locations.map((loc) => (
              <span key={`${agent.id}-${loc}`} className="agent-table-location-badge">
                {loc}
              </span>
            ))
          ) : (
            <span className="agent-table-empty-location">
              No locations assigned
            </span>
          )}
        </div>
      </td>
      <td className="agent-table-cell">
        <span
          className={`agent-table-status-badge ${
            isActive ? "agent-table-status-active" : "agent-table-status-inactive"
          }`}
        >
          {isActive ? "Active" : "Inactive"}
        </span>
      </td>
      <td className="agent-table-cell text-right">
        <div className="agent-table-actions">
          <Link
            to={`/agents/${agent.id}`}
            className="agent-table-action-button inline-flex items-center justify-center"
            title="Stock & movements"
          >
            <BarChart3 className="agent-table-action-icon" />
          </Link>
          {(canEdit || canDelete) && (
            <>
              {canEdit && onSetActive && (
                <button
                  onClick={() => onSetActive(agent, !isActive)}
                  className={`agent-table-action-button ${
                    isActive ? "deactivate" : "reactivate"
                  }`}
                  title={isActive ? "Deactivate agent" : "Reactivate agent"}
                >
                  {isActive ? (
                    <Ban className="agent-table-action-icon" />
                  ) : (
                    <RotateCcw className="agent-table-action-icon" />
                  )}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => onEdit(agent)}
                  className="agent-table-action-button edit"
                  title="Edit agent"
                >
                  <Pencil className="agent-table-action-icon" />
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => onDelete(agent.id)}
                  className="agent-table-action-button delete"
                  title="Delete agent"
                >
                  <Trash2 className="agent-table-action-icon" />
                </button>
              )}
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
