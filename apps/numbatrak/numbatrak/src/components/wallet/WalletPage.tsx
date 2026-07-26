import { useCallback, useEffect, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import { useAuth } from "../../auth/AuthProvider";
import { SuccessNotification } from "../agents/SuccessNotification";
import { WalletDateFilterBar } from "./WalletDateFilterBar";
import { WalletSummaryCards } from "./WalletSummaryCards";
import { WalletRemittanceTable } from "./WalletRemittanceTable";
import { RecordRemittanceDialog } from "./RecordRemittanceDialog";
import { NetOffDialog } from "./NetOffDialog";
import { Input } from "../ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { TablePagination } from "../ui/TablePagination";
import { useClientPagination } from "../../hooks/useClientPagination";
import { fetchAgents } from "../../services/agents";
import {
  fetchWalletRemittanceLines,
  computeWalletSummary,
  filterRemittanceLines,
  recordRemittance,
  addNetOffToLine,
  collectWalletSubBrands,
} from "../../services/wallet";
import {
  WalletRemittanceLine,
  RemittanceStatusFilter,
  WalletDateFilter,
} from "../../types/wallet";
import type { Agent } from "../../services/agents";

const STATUS_FILTER_OPTIONS: { value: RemittanceStatusFilter; label: string }[] =
  [
    { value: "all", label: "All statuses" },
    { value: "standing", label: "Standing" },
    { value: "remitted", label: "Remitted" },
    { value: "short", label: "Short" },
    { value: "net_owed", label: "Net owed to agent" },
  ];

export function WalletPage() {
  const { currentOrganization } = useOrganization();
  const { hasAnyRole } = usePermissions();
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const agentFromUrl = searchParams.get("agent");

  const canView = hasAnyRole(["Manager", "Admin", "Owner"]);
  const canManage = canView;

  const [lines, setLines] = useState<WalletRemittanceLine[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<WalletDateFilter>({
    type: "this_month",
  });
  const [statusFilter, setStatusFilter] =
    useState<RemittanceStatusFilter>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [subBrandFilter, setSubBrandFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [actionKey, setActionKey] = useState<string | null>(null);
  const [remitLine, setRemitLine] = useState<WalletRemittanceLine | null>(null);
  const [netOffLine, setNetOffLine] = useState<WalletRemittanceLine | null>(null);
  const [dialogSaving, setDialogSaving] = useState(false);

  const loadLines = useCallback(async () => {
    if (!currentOrganization?.id) {
      setLines([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [rows, agentList] = await Promise.all([
        fetchWalletRemittanceLines(currentOrganization.id),
        fetchAgents(currentOrganization.id, { activeOnly: true }),
      ]);
      setLines(rows);
      setAgents(agentList);
    } catch (e) {
      console.error(e);
      setError(
        "Could not load wallet data. Apply wallet migrations if tables or columns are missing."
      );
      setLines([]);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  useEffect(() => {
    loadLines();
  }, [loadLines]);

  useEffect(() => {
    if (agentFromUrl && /^\d+$/.test(agentFromUrl)) {
      setAgentFilter(agentFromUrl);
    }
  }, [agentFromUrl]);

  const subBrandOptions = useMemo(
    () => collectWalletSubBrands(lines),
    [lines]
  );

  const summary = useMemo(
    () => computeWalletSummary(lines, dateFilter),
    [lines, dateFilter]
  );

  const filteredLines = useMemo(
    () =>
      filterRemittanceLines(lines, {
        dateFilter,
        statusFilter,
        agentId: agentFilter === "all" ? null : Number(agentFilter),
        subBrand: subBrandFilter === "all" ? null : subBrandFilter,
        search: searchQuery,
      }),
    [lines, dateFilter, statusFilter, agentFilter, subBrandFilter, searchQuery]
  );

  const {
    currentPage,
    setCurrentPage,
    totalPages,
    paginatedItems,
    itemsPerPage,
  } = useClientPagination(filteredLines, 15);

  useEffect(() => {
    setCurrentPage(1);
  }, [
    dateFilter,
    statusFilter,
    agentFilter,
    subBrandFilter,
    searchQuery,
    setCurrentPage,
  ]);

  const handleRecordRemittance = async (actualAmount: number) => {
    if (!user?.id || !remitLine) return;
    try {
      setDialogSaving(true);
      setActionKey(remitLine.lineKey);
      await recordRemittance(remitLine, actualAmount, user.id);
      setRemitLine(null);
      setSuccess("Remittance recorded.");
      await loadLines();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error ? e.message : "Failed to record remittance."
      );
    } finally {
      setDialogSaving(false);
      setActionKey(null);
    }
  };

  const handleNetOff = async (amount: number, note: string) => {
    if (!user?.id || !netOffLine) return;
    try {
      setDialogSaving(true);
      setActionKey(netOffLine.lineKey);
      await addNetOffToLine(netOffLine, amount, user.id, note);
      setNetOffLine(null);
      setSuccess("Net-off recorded and expense created.");
      await loadLines();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : "Failed to add net-off.");
    } finally {
      setDialogSaving(false);
      setActionKey(null);
    }
  };

  if (!canView) {
    return <Navigate to="/" replace />;
  }

  return (
    <PageLayout>
      {success && (
        <SuccessNotification
          message={success}
          onClose={() => setSuccess(null)}
        />
      )}

      <div className="space-y-1">
        <h1 className="text-2xl font-semibold text-foreground">Wallet</h1>
        <p className="text-muted-foreground text-sm max-w-3xl">
          Agent-per-day COD remittance: expected amount is delivered value minus
          delivery fees (agent keeps) minus net-offs. Only orders where the agent
          collected cash appear here.
        </p>
      </div>

      <WalletDateFilterBar
        dateFilter={dateFilter}
        onDateFilterChange={setDateFilter}
      />

      <WalletSummaryCards summary={summary} loading={loading} />

      <section className="space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            Remittance lines
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 sm:items-center flex-wrap">
            <Input
              placeholder="Search agent or date…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full sm:w-48 h-9"
            />
            <Select value={agentFilter} onValueChange={setAgentFilter}>
              <SelectTrigger className="w-full sm:w-[10rem] h-9">
                <SelectValue placeholder="All agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All agents</SelectItem>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {subBrandOptions.length > 0 && (
              <Select value={subBrandFilter} onValueChange={setSubBrandFilter}>
                <SelectTrigger className="w-full sm:w-[10rem] h-9">
                  <SelectValue placeholder="All sub-brands" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sub-brands</SelectItem>
                  {subBrandOptions.map((b) => (
                    <SelectItem key={b} value={b}>
                      {b}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Select
              value={statusFilter}
              onValueChange={(v: RemittanceStatusFilter) => setStatusFilter(v)}
            >
              <SelectTrigger className="w-full sm:w-[11rem] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {error && (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        )}

        <WalletRemittanceTable
          lines={paginatedItems}
          loading={loading}
          canManage={canManage}
          onMarkRemitted={setRemitLine}
          onAddNetOff={setNetOffLine}
          actionKey={actionKey}
        />

        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredLines.length}
          itemsPerPage={itemsPerPage}
          onPageChange={setCurrentPage}
        />
      </section>

      <div className="rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
        <p className="font-medium text-foreground mb-1">Remittance flow</p>
        <ol className="list-decimal list-inside space-y-1">
          <li>Order delivered with money received by agent</li>
          <li>Line appears grouped by agent + calendar day</li>
          <li>Expected = order value − delivery fee − net-offs</li>
          <li>Manager marks remitted with actual amount received</li>
          <li>Shortfalls stay standing until cleared</li>
        </ol>
      </div>

      <RecordRemittanceDialog
        line={remitLine}
        open={remitLine != null}
        onOpenChange={(open) => !open && setRemitLine(null)}
        onSubmit={handleRecordRemittance}
        saving={dialogSaving}
      />

      <NetOffDialog
        line={netOffLine}
        open={netOffLine != null}
        onOpenChange={(open) => !open && setNetOffLine(null)}
        onSubmit={handleNetOff}
        saving={dialogSaving}
      />
    </PageLayout>
  );
}
