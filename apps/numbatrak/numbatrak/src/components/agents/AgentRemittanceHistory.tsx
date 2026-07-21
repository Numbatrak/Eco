import { Link } from "react-router-dom";
import { WalletRemittanceLine } from "../../types/wallet";
import { formatNaira } from "../../utils/currency";
import { LoadingState } from "../ui/LoadingState";

const STATUS_LABELS: Record<WalletRemittanceLine["status"], string> = {
  standing: "Standing",
  remitted: "Remitted",
  short: "Short",
  net_owed: "Net owed",
};

interface AgentRemittanceHistoryProps {
  lines: WalletRemittanceLine[];
  loading?: boolean;
  agentId: number;
  canViewWallet?: boolean;
}

function formatDate(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-NG", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function AgentRemittanceHistory({
  lines,
  loading,
  agentId,
  canViewWallet = true,
}: AgentRemittanceHistoryProps) {
  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6">
        <LoadingState label="Loading remittance history…" size="sm" />
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-foreground">
          Remittance history
        </h2>
        {canViewWallet && (
          <Link
            to={`/wallet?agent=${agentId}`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Open in Wallet →
          </Link>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-sm text-muted-foreground">
          No agent-collected remittance lines yet. Lines appear when COD orders
          assigned to this agent are marked delivered.
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Day
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Delivered
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Expected
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">
                    Actual
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.slice(0, 20).map((line) => (
                  <tr
                    key={line.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3">{formatDate(line.remittance_date)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNaira(line.total_delivered_value)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatNaira(line.expected_remittance)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {line.actual_amount != null
                        ? formatNaira(line.actual_amount)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {STATUS_LABELS[line.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {lines.length > 20 && (
            <p className="px-4 py-2 text-xs text-muted-foreground border-t border-border">
              Showing 20 of {lines.length} lines.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
