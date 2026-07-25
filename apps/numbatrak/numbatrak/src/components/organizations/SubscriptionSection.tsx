import { useCallback, useEffect, useState } from "react";
import { fetchSubscription, fetchPlans, type Subscription, type Plan } from "../../services/subscription";
import { CreditCard } from "lucide-react";

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function formatCurrency(cents: number): string {
  return `₦${(cents / 100).toLocaleString("en-NG", { minimumFractionDigits: 0 })}`;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  trial: { label: "Trial", color: "bg-blue-100 text-blue-700" },
  active: { label: "Active", color: "bg-green-100 text-green-700" },
  past_due: { label: "Past Due", color: "bg-amber-100 text-amber-700" },
  locked: { label: "Locked", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-700" },
};

export function SubscriptionSection() {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [sub, p] = await Promise.all([fetchSubscription(), fetchPlans()]);
      setSubscription(sub);
      setPlans(p);
    } catch (e) {
      console.error("Failed to load subscription", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="org-settings-section">
        <h2 className="org-settings-section-title">Subscription & Billing</h2>
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  const statusInfo = subscription ? STATUS_LABELS[subscription.status] ?? { label: subscription.status, color: "bg-gray-100 text-gray-700" } : null;

  return (
    <div className="org-settings-section">
      <h2 className="org-settings-section-title flex items-center gap-2">
        <CreditCard className="w-5 h-5" />
        Subscription & Billing
      </h2>

      {subscription ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 border rounded-lg">
              <p className="text-xs text-muted-foreground">Current Plan</p>
              <p className="text-lg font-semibold mt-1">{subscription.plan_display_name || subscription.plan_name || "Standard"}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-xs text-muted-foreground">Status</p>
              <p className="mt-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusInfo?.color}`}>
                  {statusInfo?.label}
                </span>
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-xs text-muted-foreground">Billing Interval</p>
              <p className="text-sm font-medium mt-1 capitalize">{subscription.billing_interval}</p>
            </div>
            <div className="p-4 border rounded-lg">
              <p className="text-xs text-muted-foreground">Current Period</p>
              <p className="text-sm font-medium mt-1">
                {formatDate(subscription.current_period_start)} — {formatDate(subscription.current_period_end)}
              </p>
            </div>
          </div>

          {subscription.status === "trial" && subscription.trial_ends_at && (
            <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg text-sm">
              Trial ends on <strong>{formatDate(subscription.trial_ends_at)}</strong>
            </div>
          )}

          {subscription.status === "past_due" && subscription.grace_period_ends_at && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
              Grace period ends <strong>{formatDate(subscription.grace_period_ends_at)}</strong>. Please update payment to avoid lockout.
            </div>
          )}

          {subscription.status === "locked" && (
            <div className="p-3 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg text-sm">
              Your subscription is locked due to payment failure. Contact support to restore access.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">No active subscription</p>

          {plans.length > 0 && (
            <div>
              <h3 className="text-sm font-medium mb-3">Available Plans</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {plans.map((plan) => (
                  <div key={plan.id} className="p-4 border rounded-lg">
                    <h4 className="font-semibold">{plan.display_name}</h4>
                    <p className="text-xl font-bold mt-2">
                      {formatCurrency(plan.price_monthly_cents)}
                      <span className="text-sm font-normal text-muted-foreground">/mo</span>
                    </p>
                    {plan.price_annually_cents > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        or {formatCurrency(plan.price_annually_cents)}/year
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
