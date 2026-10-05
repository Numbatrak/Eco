import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import { fetchStaff, updateMyBankDetails } from "../../services/staff";
import type { Staff } from "../../types/staff";
import {
  fetchPayStructures,
  fetchPayrollRun,
  runPayroll,
  closePayrollPeriod,
  reopenPayrollPeriod,
  awardSotm,
  markLinePaid,
  fetchMyEarnings,
  overridePayrollLine,
  setManualAdjustment,
  fetchPayrollLineTrace,
  type PayStructure,
  type PayrollRun,
  type PayrollLine,
  type MyEarnings,
  type PayrollTrace,
} from "../../services/payroll";
import { PayrollLineEditDialog, type PayrollLineEditValues } from "./PayrollLineEditDialog";
import { PayrollTraceDialog } from "./PayrollTraceDialog";
import { DollarSign, Play, Check, Star, AlertTriangle, PenLine, FileSearch, Settings, Lock, Unlock } from "lucide-react";

function getCurrentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

export function PayrollPage() {
  const { currentOrganization } = useOrganization();
  const { hasPermission, hasAnyRole } = usePermissions();
  const canManage = hasPermission("payroll", "canUpdate");
  const isStaffOnly = !hasAnyRole(["Owner", "Admin", "Manager"]);

  const [month, setMonth] = useState(getCurrentMonth);
  const [payrollRun, setPayrollRun] = useState<PayrollRun | null>(null);
  const [structures, setStructures] = useState<PayStructure[]>([]);
  const [myEarnings, setMyEarnings] = useState<MyEarnings | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [togglingPeriod, setTogglingPeriod] = useState(false);

  const [lineDialogOpen, setLineDialogOpen] = useState(false);
  const [editingLine, setEditingLine] = useState<PayrollLine | null>(null);
  const [lineSaving, setLineSaving] = useState(false);
  const [lineError, setLineError] = useState<string | null>(null);

  const [traceDialogOpen, setTraceDialogOpen] = useState(false);
  const [trace, setTrace] = useState<PayrollTrace | null>(null);
  const [traceLoading, setTraceLoading] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);
  const isClosed = payrollRun?.status === "closed";

  const [myStaff, setMyStaff] = useState<Staff | null>(null);
  const [bankForm, setBankForm] = useState({ bank_name: "", bank_account_number: "", bank_account_name: "" });
  const [bankSaving, setBankSaving] = useState(false);
  const [bankError, setBankError] = useState<string | null>(null);
  const [bankSuccess, setBankSuccess] = useState(false);

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      if (isStaffOnly) {
        const [earnings, ownStaff] = await Promise.all([fetchMyEarnings(), fetchStaff(currentOrganization.id)]);
        setMyEarnings(earnings);
        const record = ownStaff[0] ?? null;
        setMyStaff(record);
        setBankForm({
          bank_name: record?.bank_name ?? "",
          bank_account_number: record?.bank_account_number ?? "",
          bank_account_name: record?.bank_account_name ?? "",
        });
      } else {
        const [s, r] = await Promise.all([fetchPayStructures(), fetchPayrollRun(month)]);
        setStructures(s);
        setPayrollRun(r);
      }
    } catch (err) {
      console.error("Failed to load payroll data", err);
    } finally {
      setLoading(false);
    }
  }, [currentOrganization, month, isStaffOnly]);

  useEffect(() => { void load(); }, [load]);

  const handleRun = async () => {
    setRunning(true);
    setActionError(null);
    try {
      const run = await runPayroll(month);
      setPayrollRun(run);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to run payroll.");
    } finally {
      setRunning(false);
    }
  };

  const handleTogglePeriod = async () => {
    setTogglingPeriod(true);
    setActionError(null);
    try {
      const run = isClosed ? await reopenPayrollPeriod(month) : await closePayrollPeriod(month);
      setPayrollRun(run);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update period status.");
    } finally {
      setTogglingPeriod(false);
    }
  };

  const handleMarkPaid = async (lineId: string, paid: boolean) => {
    setActionError(null);
    try {
      await markLinePaid(lineId, paid);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update paid status.");
    }
  };

  const handleAwardSotm = async (lineId: string, awarded: boolean) => {
    setActionError(null);
    try {
      await awardSotm(lineId, awarded);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to update SOTM award.");
    }
  };

  const handleSaveBankDetails = async () => {
    setBankSaving(true);
    setBankError(null);
    setBankSuccess(false);
    try {
      const updated = await updateMyBankDetails({
        bank_name: bankForm.bank_name || null,
        bank_account_number: bankForm.bank_account_number || null,
        bank_account_name: bankForm.bank_account_name || null,
      });
      setMyStaff(updated);
      setBankSuccess(true);
      setTimeout(() => setBankSuccess(false), 3000);
    } catch (err) {
      setBankError(err instanceof Error ? err.message : "Failed to save bank details.");
    } finally {
      setBankSaving(false);
    }
  };

  const openEditLine = (line: PayrollLine) => {
    setEditingLine(line);
    setLineError(null);
    setLineDialogOpen(true);
  };

  const handleSaveLine = async (values: PayrollLineEditValues) => {
    if (!editingLine) return;
    setLineSaving(true);
    setLineError(null);
    try {
      await Promise.all([
        overridePayrollLine(editingLine.id, {
          overrideBaseSalary: values.overrideBaseSalary,
          overrideCommission: values.overrideCommission,
        }),
        setManualAdjustment(editingLine.id, {
          manualAdjustment: values.manualAdjustment,
          manualAdjustmentNote: values.manualAdjustmentNote,
        }),
      ]);
      await load();
    } catch (err) {
      setLineError(err instanceof Error ? err.message : "Failed to save changes.");
      throw err;
    } finally {
      setLineSaving(false);
    }
  };

  const openTrace = async (lineId: string) => {
    setTraceDialogOpen(true);
    setTraceLoading(true);
    setTrace(null);
    try {
      const t = await fetchPayrollLineTrace(lineId);
      setTrace(t);
    } finally {
      setTraceLoading(false);
    }
  };

  if (isStaffOnly) {
    return (
      <PageLayout>
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-foreground">My Earnings</h1>
        </div>
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : myEarnings ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Month" value={myEarnings.month} />
            <StatCard label="Base Salary" value={formatCurrency(myEarnings.base_salary)} />
            <StatCard label="Commission" value={formatCurrency(myEarnings.commission_so_far)} />
            <StatCard label="Upsell Bonus" value={formatCurrency(myEarnings.upsell_bonus_so_far)} />
            <StatCard label="On-Track Total" value={formatCurrency(myEarnings.on_track_total)} highlight />
            {myEarnings.gate_status_message && (
              <div className="col-span-full p-4 rounded-lg border border-border bg-card">
                <div className="flex items-center gap-2 text-sm">
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  <span className="text-muted-foreground">{myEarnings.gate_status_message}</span>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-muted-foreground">No pay structure configured for your role.</div>
        )}

        {!loading && myStaff && (
          <div className="max-w-md p-4 rounded-lg border border-border bg-card space-y-3">
            <h2 className="text-sm font-semibold text-foreground">My bank details</h2>
            <p className="text-xs text-muted-foreground">Used by Payroll when marking your pay as paid.</p>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Bank name</label>
              <input
                type="text"
                value={bankForm.bank_name}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Account number</label>
              <input
                type="text"
                value={bankForm.bank_account_number}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_account_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs text-muted-foreground">Account name</label>
              <input
                type="text"
                value={bankForm.bank_account_name}
                onChange={(e) => setBankForm((f) => ({ ...f, bank_account_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
              />
            </div>
            {bankError && <p className="text-xs text-destructive">{bankError}</p>}
            {bankSuccess && <p className="text-xs text-green-600">Saved.</p>}
            <button
              onClick={handleSaveBankDetails}
              disabled={bankSaving}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              {bankSaving ? "Saving..." : "Save bank details"}
            </button>
          </div>
        )}
      </PageLayout>
    );
  }

  return (
    <PageLayout>
      <PayrollLineEditDialog
        open={lineDialogOpen}
        onOpenChange={setLineDialogOpen}
        line={editingLine}
        saving={lineSaving}
        error={lineError}
        onSubmit={handleSaveLine}
      />

      <PayrollTraceDialog open={traceDialogOpen} onOpenChange={setTraceDialogOpen} trace={trace} loading={traceLoading} />

      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-semibold text-foreground">Payroll</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="px-3 py-2 rounded-md border border-border bg-background text-foreground text-sm"
          />
          {canManage && (
            <button
              onClick={handleRun}
              disabled={running || isClosed}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {running ? "Running..." : "Run Payroll"}
            </button>
          )}
          {canManage && payrollRun && (
            <button
              onClick={handleTogglePeriod}
              disabled={togglingPeriod}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              {isClosed ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {togglingPeriod ? "Working..." : isClosed ? "Reopen period" : "Close period"}
            </button>
          )}
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-lg border border-destructive/40 bg-destructive/10 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {isClosed && (
        <div className="p-3 rounded-lg border border-border bg-muted/40 text-sm text-muted-foreground flex items-center gap-2">
          <Lock className="w-4 h-4" />
          Payroll for {month} is closed{payrollRun?.closed_by_name ? ` by ${payrollRun.closed_by_name}` : ""} — recompute, overrides,
          SOTM, and mark-paid are locked until it's reopened.
        </div>
      )}

      {loading ? (
        <div className="text-muted-foreground">Loading...</div>
      ) : payrollRun ? (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Staff</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Base</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Commission</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Upsell</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">SOTM</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Mgr Bonus</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Adj.</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Total</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payrollRun.lines.map((line) => (
                  <PayrollLineRow
                    key={line.id}
                    line={line}
                    canManage={canManage}
                    disabled={isClosed}
                    onMarkPaid={handleMarkPaid}
                    onAwardSotm={handleAwardSotm}
                    onEdit={openEditLine}
                    onViewTrace={openTrace}
                  />
                ))}
              </tbody>
            </table>
          </div>
          {payrollRun.lines.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              No payroll lines. Make sure staff have pay structures configured.
            </div>
          )}
        </div>
      ) : (
        <div className="p-8 text-center text-muted-foreground border border-border rounded-lg">
          No payroll run for {month}. Click "Run Payroll" to calculate.
        </div>
      )}

      <div className="flex items-center justify-between gap-4 p-4 rounded-lg border border-border bg-card">
        <div className="text-sm text-muted-foreground">
          {structures.length > 0
            ? `${structures.length} pay structure${structures.length === 1 ? "" : "s"} configured`
            : "No pay structures configured yet"}
        </div>
        {canManage && (
          <Link
            to="/organization-settings"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md border border-border text-sm font-medium text-foreground hover:bg-muted"
          >
            <Settings className="w-4 h-4" />
            Manage pay structures in Settings
          </Link>
        )}
      </div>
    </PageLayout>
  );
}

function PayrollLineRow({
  line,
  canManage,
  disabled,
  onMarkPaid,
  onAwardSotm,
  onEdit,
  onViewTrace,
}: {
  line: PayrollLine;
  canManage: boolean;
  disabled: boolean;
  onMarkPaid: (lineId: string, paid: boolean) => void;
  onAwardSotm: (lineId: string, awarded: boolean) => void;
  onEdit: (line: PayrollLine) => void;
  onViewTrace: (lineId: string) => void;
}) {
  const effectiveBase = line.override_base_salary ?? line.calculated_base_salary;
  const effectiveCommission = line.override_commission ?? line.calculated_commission;

  return (
    <tr className="hover:bg-muted/30">
      <td className="px-4 py-3 font-medium text-foreground">{line.staff_name ?? line.staff_id}</td>
      <td className="px-4 py-3 text-right text-foreground">
        {formatCurrency(effectiveBase)}
        {line.override_base_salary != null && <span className="text-xs text-yellow-500 ml-1">(override)</span>}
      </td>
      <td className="px-4 py-3 text-right text-foreground">
        {line.commission_gate_missed ? (
          <span className="text-destructive">Gate missed</span>
        ) : (
          formatCurrency(effectiveCommission)
        )}
        {line.override_commission != null && <span className="text-xs text-yellow-500 ml-1">(override)</span>}
      </td>
      <td className="px-4 py-3 text-right text-foreground">{formatCurrency(line.calculated_upsell_bonus)}</td>
      <td className="px-4 py-3 text-right text-foreground">
        {line.sotm_awarded ? formatCurrency(line.calculated_sotm_bonus) : "-"}
      </td>
      <td className="px-4 py-3 text-right text-foreground">
        {line.manager_gate_missed ? <span className="text-destructive">Gate missed</span> : formatCurrency(line.calculated_manager_bonus)}
      </td>
      <td className="px-4 py-3 text-right text-foreground">
        {line.manual_adjustment !== 0 ? formatCurrency(line.manual_adjustment) : "-"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(line.total_pay)}</td>
      <td className="px-4 py-3 text-center">
        {line.paid ? (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full"
            title={[
              line.paid_amount != null ? `Paid ${formatCurrency(line.paid_amount)}` : null,
              line.paid_by_name ? `by ${line.paid_by_name}` : null,
              line.paid_notes ? `— ${line.paid_notes}` : null,
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <Check className="w-3 h-3" /> Paid
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unpaid</span>
        )}
      </td>
      <td className="px-4 py-3 text-center">
        <div className="flex items-center justify-center gap-1">
          <button
            onClick={() => onViewTrace(line.id)}
            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="View calculation trace"
          >
            <FileSearch className="w-4 h-4" />
          </button>
          {canManage && (
            <>
              <button
                onClick={() => onEdit(line)}
                disabled={disabled}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                title="Override or adjust this line"
              >
                <PenLine className="w-4 h-4" />
              </button>
              <button
                onClick={() => onMarkPaid(line.id, !line.paid)}
                disabled={disabled}
                className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:pointer-events-none"
                title={line.paid ? "Mark unpaid" : "Mark paid"}
              >
                <DollarSign className="w-4 h-4" />
              </button>
              <button
                onClick={() => onAwardSotm(line.id, !line.sotm_awarded)}
                disabled={disabled}
                className={`p-1.5 rounded hover:bg-muted disabled:opacity-40 disabled:pointer-events-none ${line.sotm_awarded ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"}`}
                title={line.sotm_awarded ? "Remove SOTM" : "Award SOTM"}
              >
                <Star className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`p-4 rounded-lg border ${highlight ? "border-primary bg-primary/5" : "border-border bg-card"}`}>
      <div className="text-sm text-muted-foreground mb-1">{label}</div>
      <div className={`text-lg font-semibold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</div>
    </div>
  );
}
