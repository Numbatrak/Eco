import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Copy, RefreshCw } from "lucide-react";
import { PageLayout } from "../components/layout/PageLayout";
import { useOrganization } from "../contexts/OrganizationContext";
import { fetchProductsWithDetails } from "../services/products";
import {
  formIntakeApi,
  intakeAddress,
  OFFER_VALUE_PREFIX,
  type FormIntakeSettings,
  type IntakeProvider,
} from "../services/formIntake";
import type { ProductWithDetails } from "../types/product";
import { formatCurrency } from "../utils/currency";
import { TRACKING_SCRIPT } from "../components/integrations/trackingScript";

const PROVIDERS: Array<{ id: IntakeProvider; label: string }> = [
  { id: "fluent-forms", label: "Fluent Forms" },
  { id: "elementor", label: "Elementor" },
];

/** What each recognised field is, in the order the business should care about it. */
const FIELD_GUIDE: Array<{ key: string; label: string; required?: boolean }> = [
  { key: "name", label: "Customer's full name (or use first name + last name)", required: true },
  { key: "firstName", label: "First name" },
  { key: "lastName", label: "Last name" },
  { key: "phone", label: "Phone number (phone or WhatsApp is needed)", required: true },
  { key: "whatsapp", label: "WhatsApp number" },
  { key: "address", label: "Delivery address" },
  { key: "state", label: "State / region", required: true },
  { key: "package", label: "The package they chose (see step 3)", required: true },
  { key: "quantity", label: "How many of the package (defaults to 1)" },
  { key: "email", label: "Email address" },
  { key: "country", label: "Country" },
  { key: "amount", label: "Amount (kept for reference; the price comes from the offer)" },
  { key: "notes", label: "Customer's notes, copied onto the order" },
  { key: "trackingLinkCode", label: "Tracking link code from the ad (see step 4)" },
];

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label.toLowerCase()}`);
  }
}

function CopyButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      className="btn-secondary shrink-0"
      onClick={() => copy(text, label)}
      title={`Copy ${label.toLowerCase()}`}
      aria-label={`Copy ${label.toLowerCase()}`}
    >
      <Copy className="h-4 w-4" />
    </button>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="mb-3 flex items-center gap-3 text-base font-semibold text-foreground">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground">
          {n}
        </span>
        {title}
      </h2>
      <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
    </section>
  );
}

const offerOptionLabel = (label: string, price: number) => `${label} — ${formatCurrency(price, "NGN", { decimals: 0 })}`;

/**
 * Org-wide setup for outside form plugins: one webhook address for every
 * Fluent Forms / Elementor form, fields recognised by their usual names, and
 * package choices whose values are NumbaTrak offer IDs, so an order arrives
 * with the offer's real units, cost and price.
 */
export function FormIntegrationsPage() {
  const { currentOrganization } = useOrganization();
  const [settings, setSettings] = useState<FormIntakeSettings | null>(null);
  const [products, setProducts] = useState<ProductWithDetails[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [provider, setProvider] = useState<IntakeProvider>("fluent-forms");
  const [productId, setProductId] = useState("");
  const [offersLoaded, setOffersLoaded] = useState(false);
  const [fetchingOffers, setFetchingOffers] = useState(false);
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadError(false);
    formIntakeApi
      .get()
      .then((s) => !cancelled && setSettings(s))
      .catch((err) => {
        console.error("Error loading form intake settings:", err);
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [currentOrganization?.id]);

  const fetchOffers = async () => {
    setFetchingOffers(true);
    try {
      const list = await fetchProductsWithDetails(currentOrganization?.id ?? null);
      setProducts(list.filter((p) => p.active));
      setOffersLoaded(true);
      if (!productId && list.length > 0) setProductId(list.find((p) => p.active)?.id ?? "");
    } catch (err) {
      console.error("Error loading offers:", err);
      toast.error("Couldn't load your offers. Try again.");
    } finally {
      setFetchingOffers(false);
    }
  };

  const product = products.find((p) => p.id === productId) ?? null;
  const offers = useMemo(
    () => (product?.offers ?? []).filter((o) => o.active).sort((a, b) => a.display_order - b.display_order),
    [product],
  );
  const optionLines = offers.map((o) => `${offerOptionLabel(o.label, o.price)}|${OFFER_VALUE_PREFIX}${o.id}`).join("\n");

  const rotate = async () => {
    setRotating(true);
    try {
      const { token } = await formIntakeApi.rotate();
      setSettings((s) => (s ? { ...s, token } : s));
      setConfirmRotate(false);
      toast.success("New address created. Paste it into your forms.");
    } catch (err) {
      console.error("Error rotating intake address:", err);
      toast.error("Couldn't create a new address.");
    } finally {
      setRotating(false);
    }
  };

  const address = settings ? intakeAddress(settings.token, provider) : "";
  const isFluent = provider === "fluent-forms";

  return (
    <PageLayout>
      <div className="mx-auto max-w-4xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Form integrations</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Send orders from any Fluent Forms or Elementor form on your website straight into NumbaTrak. One
            address works for all your forms and sites. To set up a single NumbaTrak form instead, open it from{" "}
            <Link to="/forms" className="underline">
              Order Forms
            </Link>{" "}
            and use its Integrations tab.
          </p>
        </div>

        <div role="tablist" aria-label="Form plugin" className="inline-flex rounded-lg border border-border bg-muted p-1">
          {PROVIDERS.map((p) => (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={provider === p.id}
              onClick={() => setProvider(p.id)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium ${
                provider === p.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <Step n={1} title="Add the webhook to your form">
          {loadError ? (
            <p>Couldn&apos;t load your address. Refresh the page to try again.</p>
          ) : !settings ? (
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
          ) : (
            <>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
                  {address}
                </code>
                <CopyButton text={address} label="Address" />
              </div>
              {isFluent ? (
                <ol className="list-decimal space-y-1 pl-5">
                  <li>In WordPress, open your form, then go to Settings &amp; Integrations → Webhook.</li>
                  <li>Add a new webhook and paste the address above as the Request URL.</li>
                  <li>Set Request Method to POST, Request Format to JSON, and Request Body to All Data.</li>
                  <li>Save.</li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-1 pl-5">
                  <li>In Elementor, edit your form and open Actions After Submit.</li>
                  <li>Add Webhook, then open the Webhook section and paste the address above.</li>
                  <li>Turn on Advanced Data, then update the page.</li>
                </ol>
              )}
              <p className="text-xs">
                Orders that don&apos;t come through a tracking link are grouped by product. To group a form&apos;s
                orders under its own name, add <code>?funnel=Your funnel name</code> to the end of the address.
              </p>
              <p className="text-xs">
                Keep this address private: anyone who has it can send orders in.{" "}
                {confirmRotate ? (
                  <span className="inline-flex flex-wrap items-center gap-2">
                    The old address will stop working straight away.
                    <button type="button" className="underline" onClick={rotate} disabled={rotating}>
                      {rotating ? "Creating…" : "Yes, create a new one"}
                    </button>
                    <button type="button" className="underline" onClick={() => setConfirmRotate(false)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button type="button" className="underline" onClick={() => setConfirmRotate(true)}>
                    Create a new address
                  </button>
                )}
              </p>
            </>
          )}
        </Step>

        <Step n={2} title="Name your fields so NumbaTrak can read them">
          <p>
            NumbaTrak recognises fields by their usual names, so there&apos;s nothing to map. Make sure each field&apos;s{" "}
            {isFluent ? "Name Attribute" : "ID or Label"} is one of the names below. Capitals, spaces, dashes and
            underscores don&apos;t matter. Anything else on the form is still saved with the order under Submitted
            details.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {FIELD_GUIDE.map((field) => {
              const aliases = settings?.fieldAliases[field.key] ?? [];
              if (aliases.length === 0) return null;
              return (
                <div key={field.key} className="rounded-lg border border-border bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <code className="font-mono text-sm text-primary-text">{aliases[0]}</code>
                    {field.required && (
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide">needed</span>
                    )}
                  </div>
                  {aliases.length > 1 && (
                    <p className="mt-1 font-mono text-xs">also: {aliases.slice(1).join(", ")}</p>
                  )}
                  <p className="mt-1 text-xs">{field.label}</p>
                </div>
              );
            })}
          </div>
        </Step>

        <Step n={3} title="Set up the package choices">
          <p>
            Give your package field one choice per offer, using NumbaTrak&apos;s values. The customer sees the
            offer name and price; NumbaTrak receives the offer itself, so the order comes in with the right units,
            cost and price.
          </p>
          {!offersLoaded ? (
            <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={fetchOffers} disabled={fetchingOffers}>
              <RefreshCw className={`h-4 w-4 ${fetchingOffers ? "animate-spin" : ""}`} />
              {fetchingOffers ? "Fetching offers…" : "Fetch my offers"}
            </button>
          ) : products.length === 0 ? (
            <p>
              No active products yet. Add a product and its offers under{" "}
              <Link to="/products" className="underline">
                Products
              </Link>
              .
            </p>
          ) : (
            <>
              <label className="flex flex-wrap items-center gap-2">
                <span className="text-foreground">Product</span>
                <select
                  value={productId}
                  onChange={(e) => setProductId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              {offers.length === 0 ? (
                <p>
                  This product has no active offers. Add them under{" "}
                  <Link to="/products" className="underline">
                    Products
                  </Link>
                  .
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider">
                          <th className="px-3 py-2 font-medium">Label (what the customer sees)</th>
                          <th className="px-3 py-2 font-medium">Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {offers.map((o) => {
                          const label = offerOptionLabel(o.label, o.price);
                          const value = `${OFFER_VALUE_PREFIX}${o.id}`;
                          return (
                            <tr key={o.id} className="border-b border-border last:border-0">
                              <td className="px-3 py-2 text-foreground">
                                <div className="flex items-center justify-between gap-2">
                                  {label}
                                  <CopyButton text={label} label="Label" />
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                  <code className="break-all font-mono text-xs">{value}</code>
                                  <CopyButton text={value} label="Value" />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {isFluent ? (
                    <ol className="list-decimal space-y-1 pl-5">
                      <li>Add a Radio or Dropdown field and set its Name Attribute to <code>package</code>.</li>
                      <li>Turn on Show Values.</li>
                      <li>For each offer, paste the label and value from the table into one choice.</li>
                    </ol>
                  ) : (
                    <>
                      <ol className="list-decimal space-y-1 pl-5">
                        <li>Add a Radio or Select field and set its Label to Package.</li>
                        <li>Paste these lines into its Options box, one per line:</li>
                      </ol>
                      <div className="flex items-start gap-2">
                        <pre className="flex-1 overflow-x-auto whitespace-pre rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
                          {optionLines}
                        </pre>
                        <CopyButton text={optionLines} label="Options" />
                      </div>
                    </>
                  )}
                  <p className="text-xs">
                    If NumbaTrak can&apos;t recognise the package, the entry is saved under Abandoned carts so you
                    still have the customer&apos;s details. Fetch again after changing an offer&apos;s name or price.
                  </p>
                </>
              )}
            </>
          )}
        </Step>

        <Step n={4} title="Credit orders to the right ad (optional)">
          <p>
            If you run ads with NumbaTrak{" "}
            <Link to="/tracking-links" className="underline">
              tracking links
            </Link>
            , add a hidden field that picks up the <code>tl</code> code from the page address.
          </p>
          {isFluent ? (
            <p>
              Add a Hidden field and set its Name Attribute to <code>tl</code>.
            </p>
          ) : (
            <p>
              Add a Hidden field and set its ID to <code>tl</code>.
            </p>
          )}
          <p>
            Then paste this script into your website&apos;s custom code, in the footer of every page (for example
            with Elementor → Custom Code, or the WPCode plugin). It remembers the code for 30 days when a visitor
            arrives from an ad, so the order is still credited if they look around other pages first, and fills
            your hidden field, including in popups.
          </p>
          <div className="flex items-start gap-2">
            <pre className="max-h-48 flex-1 overflow-auto whitespace-pre rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {TRACKING_SCRIPT}
            </pre>
            <CopyButton text={TRACKING_SCRIPT} label="Script" />
          </div>
          <p>The order is then credited to that link&apos;s media buyer and platform, and filed under its form.</p>
        </Step>

        <Step n={5} title="Test it">
          <p>
            Submit a test entry on your website, then check{" "}
            <Link to="/orders" className="underline">
              Orders
            </Link>
            . If nothing shows up, open the {isFluent ? "webhook" : "form submission"} log in WordPress: it shows
            NumbaTrak&apos;s reply, which says what&apos;s missing.
          </p>
        </Step>
      </div>
    </PageLayout>
  );
}
