import { Agent } from "../../types/agent";
import { AgentMetrics } from "../../services/agentMetrics";
import { AgentTableHeader } from "./AgentTableHeader";
import { AgentTableRow } from "./AgentTableRow";
import { AgentTableLoadingState } from "./AgentTableLoadingState";
import { AgentTableErrorState } from "./AgentTableErrorState";
import { AgentTableEmptyState } from "./AgentTableEmptyState";
import { Search, ArrowUp, ArrowDown } from "lucide-react";
import { useClientPagination } from "../../hooks/useClientPagination";
import { TablePagination } from "../ui/TablePagination";
import "./AgentTable.css";

interface AgentTableProps {
  agents: Agent[];
  agentMetrics?: Map<number, AgentMetrics>;
  metricsLoading?: boolean;
  loading: boolean;
  error: string | null;
  onEdit: (agent: Agent) => void;
  onDelete: (agentId: number) => void;
  onSetActive?: (agent: Agent, active: boolean) => void;
  activeCount?: number;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOrder: "asc" | "desc";
  onSortChange: (order: "asc" | "desc") => void;
  canEdit?: boolean;
  canDelete?: boolean;
  hideInactive?: boolean;
  onHideInactiveChange?: (hide: boolean) => void;
}

export function AgentTable({
  agents,
  agentMetrics,
  metricsLoading,
  loading,
  error,
  onEdit,
  onDelete,
  onSetActive,
  activeCount,
  searchQuery,
  onSearchChange,
  sortOrder,
  onSortChange,
  canEdit = true,
  canDelete = true,
  hideInactive = false,
  onHideInactiveChange,
}: AgentTableProps) {
  const {
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems,
    itemsPerPage,
    paginatedItems,
  } = useClientPagination(agents);

  return (
    <div className="agent-table-container">
      <div className="agent-table-header">
        <div className="agent-table-header-content">
          <div className="agent-table-title-section">
            <div className="agent-table-icon">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <h2 className="agent-table-title">Agents</h2>
              <p className="agent-table-subtitle">
                {activeCount ?? agents.length} active · {agents.length} total
                {metricsLoading ? " · loading metrics…" : ""}
              </p>
            </div>
          </div>

          <div className="agent-table-controls">
            {/* Search Input */}
            <div className="agent-table-search">
              <Search className="agent-table-search-icon" />
              <input
                type="text"
                placeholder="Filter agents..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="agent-table-search-input"
              />
            </div>

            {onHideInactiveChange && (
              <label className="agent-table-hide-inactive">
                <input
                  type="checkbox"
                  checked={hideInactive}
                  onChange={(e) => onHideInactiveChange(e.target.checked)}
                />
                <span>Hide inactive</span>
              </label>
            )}

            {/* Sort Toggle */}
            <div className="agent-table-sort">
              <button
                onClick={() =>
                  onSortChange(sortOrder === "asc" ? "desc" : "asc")
                }
                className="agent-table-sort-button"
                title={`Sort ${
                  sortOrder === "asc" ? "Descending" : "Ascending"
                }`}
              >
                {sortOrder === "asc" ? (
                  <>
                    <ArrowUp className="agent-table-sort-icon" />
                    <span>Asc</span>
                  </>
                ) : (
                  <>
                    <ArrowDown className="agent-table-sort-icon" />
                    <span>Desc</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="agent-table-wrapper">
        <table className="agent-table">
          <AgentTableHeader />
          <tbody>
            {loading ? (
              <AgentTableLoadingState />
            ) : error ? (
              <AgentTableErrorState error={error} />
            ) : paginatedItems.length === 0 ? (
              <AgentTableEmptyState />
            ) : (
              paginatedItems.map((agent, index) => (
                <AgentTableRow
                  key={agent.id}
                  agent={agent}
                  metrics={agentMetrics?.get(agent.id)}
                  index={(currentPage - 1) * itemsPerPage + index}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onSetActive={onSetActive}
                  canEdit={canEdit}
                  canDelete={canDelete}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <TablePagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={totalItems}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />
    </div>
  );
}
