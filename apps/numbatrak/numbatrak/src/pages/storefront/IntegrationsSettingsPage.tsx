import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PageLayout } from "../../components/layout/PageLayout";
import { storefrontSettingsApi, type WhatsappSettingsResponse, type PaymentSettingsResponse } from "../../services/storefrontSettings";
import { fetchCredits, type CrmCredit } from "../../services/crm";
import { CheckCircle2, XCircle, CreditCard, MessageCircle, Mail, ExternalLink } from "lucide-react";

/**
 * Single settings hub for every outbound channel (email, WhatsApp, payment
 * gateway) plus the marketing credit balances that gate campaign sends -
 * the "one place to configure integrations" requirement. Email is
 * platform-managed (sent from the shared service account), so it has no
 * per-tenant credential form; WhatsApp connection still requires a platform
 * admin to configure Meta App credentials before the "Connect" step can run.
 */
export function IntegrationsSettingsPage() {
  const [whatsapp, setWhatsapp] = useState<WhatsappSettingsResponse | null>(null);
  const [payment, setPayment] = useState<PaymentSettingsResponse | null>(null);
  const [credits, setCredits] = useState<CrmCredit[]>([]);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [wa, pay, cr] = await Promise.all([
        storefrontSettingsApi.getWhatsappSettings(),
        storefrontSettingsApi.getPaymentSettings(),
        fetchCredits(),
      ]);
      setWhatsapp(wa);
      setPayment(pay);
      setCredits(cr);
    } catch (err) {
      console.error("Failed to load integrations", err);
      setError("Could not load integration settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  async function disconnectWhatsapp() {
    setDisconnecting(true);
    try {
      await storefrontSettingsApi.disconnectWhatsapp();
      void load();
    } catch (err) {
      console.error("Failed to disconnect WhatsApp", err);
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <PageLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
        <p className="text-sm text-muted-foreground">
          Connect email, WhatsApp, and your payment gateway once here — every feature that sends messages or collects
          payment reuses these credentials.
        </p>
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-12">Loading...</div>
      ) : (
        <div className="space-y-4">
          {error && <div className="text-sm text-red-600 dark:text-red-400">{error}</div>}

          {/* Email */}
          <div className="p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-1">
              <Mail size={18} className="text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Email</h3>
              <span className="ml-auto flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                <CheckCircle2 size={14} /> Always on
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Transactional emails (order confirmations, feedback prompts) send from the platform's shared email
              service — there's nothing to configure per business. Marketing email campaigns use the credit balance
              below.
            </p>
          </div>

          {/* WhatsApp */}
          <div className="p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle size={18} className="text-muted-foreground" />
              <h3 className="font-semibold text-foreground">WhatsApp Business</h3>
              {whatsapp?.connected ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                  <CheckCircle2 size={14} /> Connected
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <XCircle size={14} /> Not connected
                </span>
              )}
            </div>
            {whatsapp?.connected ? (
              <div className="space-y-2">
                <p className="text-sm text-foreground">
                  {whatsapp.displayName ?? "Connected number"} · {whatsapp.phoneNumber ?? whatsapp.phoneNumberId}
                </p>
                <p className="text-xs text-muted-foreground">
                  Account status: {whatsapp.accountStatus ?? "unknown"} · Used for order confirmations, feedback
                  calls, and WhatsApp marketing campaigns.
                </p>
                <button
                  onClick={() => void disconnectWhatsapp()}
                  disabled={disconnecting}
                  className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 dark:bg-red-900 dark:text-red-200 disabled:opacity-50"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Connecting a WhatsApp Business number requires the platform to have a Meta App configured for
                Embedded Signup. Ask your platform admin to set this up, then a "Connect WhatsApp" button will
                appear here.
              </p>
            )}
          </div>

          {/* Payment gateway */}
          <div className="p-4 border border-border rounded-lg bg-card">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard size={18} className="text-muted-foreground" />
              <h3 className="font-semibold text-foreground">Payment Gateway</h3>
              {payment?.enabled ? (
                <span className="ml-auto flex items-center gap-1 text-xs text-green-700 dark:text-green-300">
                  <CheckCircle2 size={14} /> Connected ({payment.provider})
                </span>
              ) : (
                <span className="ml-auto flex items-center gap-1 text-xs text-muted-foreground">
                  <XCircle size={14} /> Not connected
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Used for prepaid storefront checkout (Paystack or Flutterwave). Cash-on-delivery orders don't need this.
            </p>
            <Link
              to="/storefront/payment-settings"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Configure payment gateway <ExternalLink size={12} />
            </Link>
          </div>

          {/* Marketing credits */}
          <div className="p-4 border border-border rounded-lg bg-card">
            <h3 className="font-semibold text-foreground mb-2">Marketing Campaign Credits</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Every marketing campaign send (email or WhatsApp) uses one credit from the matching channel below.
              Transactional messages never consume credits.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-2">
              {credits.map((c) => (
                <div key={c.channel} className="p-3 border border-border rounded-lg">
                  <div className="text-xs text-muted-foreground capitalize">{c.channel}</div>
                  <div className="text-xl font-bold text-foreground">{c.balance.toLocaleString()}</div>
                </div>
              ))}
            </div>
            <Link to="/crm" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
              Manage credits &amp; campaigns <ExternalLink size={12} />
            </Link>
          </div>
        </div>
      )}
    </PageLayout>
  );
}
