import { useCallback, useEffect, useState } from "react";
import { PageLayout } from "../layout/PageLayout";
import { useOrganization } from "../../contexts/OrganizationContext";
import { usePermissions } from "../../hooks/usePermissions";
import {
  fetchPayStructures,
  fetchPayrollRun,
  runPayroll,
  awardSotm,
  markLinePaid,
  fetchMyEarnings,
  type PayStructure,
  type PayrollRun,
  type PayrollLine,
  type MyEarnings,
} from "../../services/payroll";
import { DollarSign, Play, Check, Star, AlertTriangle } from "lucide-react";

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

  const load = useCallback(async () => {
    if (!currentOrganization) return;
    setLoading(true);
    try {
      if (isStaffOnly) {
        const earnings = await fetchMyEarnings();
        setMyEarnings(earnings);
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
    try {
      const run = await runPayroll(month);
      setPayrollRun(run);
    } catch (err) {
      console.error("Failed to run payroll", err);
    } finally {
      setRunning(false);
    }
  };

  const handleMarkPaid = async (lineId: string, paid: boolean) => {
    await markLinePaid(lineId, paid);
    void load();
  };

  const handleAwardSotm = async (lineId: string, awarded: boolean) => {
    await awardSotm(lineId, awarded);
    void load();
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
      </PageLayout>
    );
  }

  return (
    <PageLayout>
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
              disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {running ? "Running..." : "Run Payroll"}
            </button>
          )}
        </div>
      </div>

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
                  {canManage && <th className="text-center px-4 py-3 font-medium text-muted-foreground">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {payrollRun.lines.map((line) => (
                  <PayrollLineRow
                    key={line.id}
                    line={line}
                    canManage={canManage}
                    onMarkPaid={handleMarkPaid}
                    onAwardSotm={handleAwardSotm}
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

      {structures.length > 0 && (
        <div>
          <h2 className="text-lg font-medium text-foreground mb-3">Pay Structures ({structures.length})</h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {structures.map((s) => (
              <div key={s.id} className="p-4 rounded-lg border border-border bg-card">
                <div className="font-medium text-foreground mb-2">
                  {s.scope_type === "role" ? `Role: ${s.role}` : `Staff: ${s.staff_name ?? s.staff_id}`}
                </div>
                <div className="space-y-1 text-sm text-muted-foreground">
                  {s.base_salary_enabled && <div>Base: {formatCurrency(s.base_salary_amount)}</div>}
                  {s.commission_enabled && (
                    <div>
                      Commission: {s.commission_basis === "flat_per_order" ? formatCurrency(s.commission_rate) + "/order" : s.commission_rate + "%"}
                      {s.commission_gate_enabled && ` (gate: ${s.commission_gate_threshold_percent}% delivery rate)`}
                    </div>
                  )}
                  {s.upsell_bonus_enabled && <div>Upsell: {formatCurrency(s.upsell_bonus_amount)}/upsell</div>}
                  {s.sotm_bonus_enabled && <div>SOTM: {formatCurrency(s.sotm_bonus_amount)}</div>}
                  {s.manager_bonus_enabled && <div>Manager: {formatCurrency(s.manager_bonus_amount)}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  );
}

function PayrollLineRow({
  line,
  canManage,
  onMarkPaid,
  onAwardSotm,
}: {
  line: PayrollLine;
  canManage: boolean;
  onMarkPaid: (lineId: string, paid: boolean) => void;
  onAwardSotm: (lineId: string, awarded: boolean) => void;
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
      <td className="px-4 py-3 text-right text-foreground">{formatCurrency(line.calculated_manager_bonus)}</td>
      <td className="px-4 py-3 text-right text-foreground">
        {line.manual_adjustment !== 0 ? formatCurrency(line.manual_adjustment) : "-"}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-foreground">{formatCurrency(line.total_pay)}</td>
      <td className="px-4 py-3 text-center">
        {line.paid ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
            <Check className="w-3 h-3" /> Paid
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unpaid</span>
        )}
      </td>
      {canManage && (
        <td className="px-4 py-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <button
              onClick={() => onMarkPaid(line.id, !line.paid)}
              className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title={line.paid ? "Mark unpaid" : "Mark paid"}
            >
              <DollarSign className="w-4 h-4" />
            </button>
            <button
              onClick={() => onAwardSotm(line.id, !line.sotm_awarded)}
              className={`p-1.5 rounded hover:bg-muted ${line.sotm_awarded ? "text-yellow-500" : "text-muted-foreground hover:text-foreground"}`}
              title={line.sotm_awarded ? "Remove SOTM" : "Award SOTM"}
            >
              <Star className="w-4 h-4" />
            </button>
          </div>
        </td>
      )}
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
