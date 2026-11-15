import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, ChevronRight, Copy, Info, RefreshCw } from "lucide-react";
import { PageLayout } from "../components/layout/PageLayout";
import { useOrganization } from "../contexts/OrganizationContext";
import { fetchProductsWithDetails } from "../services/products";
import {
  formIntakeApi,
  intakeAddress,
  OFFER_VALUE_PREFIX,
  type ExternalForm,
  type FormIntakeSettings,
  type IntakeProvider,
  type RecentSubmission,
} from "../services/formIntake";
import type { ProductWithDetails } from "../types/product";
import { formatCurrency } from "../utils/currency";
import { TRACKING_SCRIPT } from "../components/integrations/trackingScript";

/* ------------------------------------------------------------------ */
/* Content                                                             */
/* ------------------------------------------------------------------ */

const STEPS = [
  { id: "plugin", label: "Pick your plugin" },
  { id: "name", label: "Name your form" },
  { id: "fields", label: "Add the fields" },
  { id: "packages", label: "Add your packages" },
  { id: "tracking", label: "Track your ads" },
  { id: "connect", label: "Connect" },
  { id: "test", label: "Test it" },
] as const;

const PLUGIN_NAMES: Record<IntakeProvider, string> = { "fluent-forms": "Fluent Forms", elementor: "Elementor" };

interface FieldRow {
  what: string;
  type: string;
  name: string | null;
  note?: string;
  /** Show the note in orange, to catch the eye. */
  highlightNote?: boolean;
}

/** The boxes a form needs, per plugin. `name: null` means nothing to type. */
const NEEDED_FIELDS: Record<IntakeProvider, FieldRow[]> = {
  "fluent-forms": [
    { what: "Customer's name", type: "Name field", name: null, note: "Works as it is. Nothing to change." },
    { what: "Phone number", type: "Phone/Mobile field", name: "phone", note: "Usually already called phone." },
    { what: "State", type: "Dropdown or Simple Text", name: "state", note: "Or use the Address field: its State part works as it is." },
    { what: "Package", type: "Radio or Dropdown", name: "package", note: "You'll fill in the choices in the next step." },
  ],
  elementor: [
    { what: "Customer's name", type: "Text", name: "name" },
    { what: "Phone number", type: "Tel", name: "phone" },
    { what: "State", type: "Select or Text", name: "state" },
    { what: "Package", type: "Radio or Select", name: "package", note: "You'll fill in the choices in the next step." },
  ],
};

const OPTIONAL_FIELDS: FieldRow[] = [
  { what: "WhatsApp number", type: "", name: "whatsapp" },
  { what: "Delivery address", type: "", name: "address" },
  { what: "Email", type: "", name: "email" },
  { what: "Note from the customer", type: "", name: "notes" },
  { what: "How many packages", type: "", name: "quantity", note: "Leave it out and it counts as 1.", highlightNote: true },
];

/** Where the "name" box is, in each plugin's own words. */
const WHERE_TO_TYPE_NAME: Record<IntakeProvider, { label: string; steps: string[] }> = {
  "fluent-forms": {
    label: "Name Attribute",
    steps: [
      "In WordPress, go to Fluent Forms → All Forms, and click Edit under your order form.",
      "Click a field on the form. Its settings open on the right.",
      "Scroll down and click Advanced Options.",
      "Find Name Attribute and type the name from the table.",
      "Repeat for each field, then click Save Form at the top right.",
    ],
  },
  elementor: {
    label: "ID",
    steps: [
      "Open the page with your order form in Elementor (Edit with Elementor).",
      "Click the form. On the left, under Form Fields, click a field to open it.",
      "Click the field's Advanced tab.",
      "In the ID box, type the name from the table.",
      "Repeat for each field, then click Update (or Publish) at the bottom left.",
    ],
  },
};

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

async function copy(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  } catch {
    toast.error(`Couldn't copy ${label.toLowerCase()}`);
  }
}

function CopyButton({ text, label, children }: { text: string; label: string; children?: ReactNode }) {
  return (
    <button
      type="button"
      className="btn-secondary inline-flex shrink-0 items-center gap-1.5"
      onClick={() => copy(text, label)}
      aria-label={`Copy ${label.toLowerCase()}`}
      title={`Copy ${label.toLowerCase()}`}
    >
      <Copy className="h-4 w-4" />
      {children}
    </button>
  );
}

/** A name the user types into their plugin, with a copy button. */
function NameChip({ name }: { name: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <code className="rounded bg-muted px-2 py-0.5 font-mono text-sm text-primary-text">{name}</code>
      <button
        type="button"
        onClick={() => copy(name, `"${name}"`)}
        className="text-muted-foreground hover:text-foreground"
        aria-label={`Copy ${name}`}
        title="Copy"
      >
        <Copy className="h-3.5 w-3.5" />
      </button>
    </span>
  );
}

function Instructions({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
            {i + 1}
          </span>
          <span className="pt-0.5 text-sm text-foreground">{item}</span>
        </li>
      ))}
    </ol>
  );
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <div className="flex gap-2.5 rounded-lg border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
      <Info className="mt-0.5 h-4 w-4 shrink-0" />
      <div>{children}</div>
    </div>
  );
}

function SubHeading({ children }: { children: ReactNode }) {
  return <h3 className="text-sm font-semibold text-foreground">{children}</h3>;
}

function Folded({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        {title}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

const offerOptionLabel = (label: string, price: number) => `${label} — ${formatCurrency(price, "NGN", { decimals: 0 })}`;

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return new Date(iso).toLocaleDateString();
}

const STORAGE_KEY = "numbatrak:form-integrations";

interface Position {
  step: number;
  provider: IntakeProvider | null;
  /** The website form (funnel) being set up; steps after naming need one. */
  formId: string | null;
}

function loadSaved(): Position {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null");
    if (saved && typeof saved.step === "number") {
      const provider = saved.provider === "fluent-forms" || saved.provider === "elementor" ? saved.provider : null;
      const formId = provider && typeof saved.formId === "string" ? saved.formId : null;
      const maxStep = !provider ? 0 : !formId ? 1 : STEPS.length - 1;
      return { step: Math.min(Math.max(saved.step, 0), maxStep), provider, formId };
    }
  } catch {
    /* storage unavailable - start at the beginning */
  }
  return { step: 0, provider: null, formId: null };
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

/**
 * Guided setup for outside form plugins, one step at a time, written for
 * someone who has never set up a webhook: pick the plugin, add the fields
 * with the exact names, add the package choices (values carry NumbaTrak
 * offer IDs), optionally track ads, connect the webhook, and confirm a test
 * entry actually arrived.
 */
export function FormIntegrationsPage() {
  const { currentOrganization } = useOrganization();
  const [settings, setSettings] = useState<FormIntakeSettings | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [{ step, provider, formId }, setPosition] = useState<Position>(loadSaved);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ step, provider, formId }));
    } catch {
      /* not essential */
    }
  }, [step, provider, formId]);

  const form: ExternalForm | null = settings?.forms.find((f) => f.id === formId) ?? null;

  // A saved form that no longer exists (deleted elsewhere): back to naming.
  useEffect(() => {
    if (settings && formId && !form) setPosition((p) => ({ ...p, formId: null, step: Math.min(p.step, 1) }));
  }, [settings, formId, form]);

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

  const goTo = (next: number) => {
    setPosition((p) => ({ ...p, step: Math.min(Math.max(next, 0), STEPS.length - 1) }));
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const choose = (p: IntakeProvider) => {
    setPosition((prev) => ({ step: 1, provider: p, formId: prev.provider === p ? prev.formId : null }));
    window.scrollTo?.({ top: 0, behavior: "smooth" });
  };
  const selectForm = (f: ExternalForm) => setPosition((p) => ({ ...p, formId: f.id }));
  const addForm = (f: ExternalForm) => {
    setSettings((s) => (s ? { ...s, forms: [f, ...s.forms] } : s));
    selectForm(f);
  };

  const current = STEPS[step]!;
  const canGoForward = step > 0 && step < STEPS.length - 1;
  const nextBlocked = current.id === "name" && !form;

  return (
    <PageLayout>
      <div className="mx-auto max-w-3xl space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Connect your website form</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow these steps once and every order placed on your website form will show up in NumbaTrak on its
            own. It takes about 10 minutes. You&apos;ll need to be logged in to your WordPress site.
          </p>
        </div>

        <nav aria-label="Setup steps">
          <ol className="flex flex-wrap gap-2">
            {STEPS.map((s, i) => {
              const done = i < step;
              const active = i === step;
              const reachable = i === 0 || (i === 1 ? provider !== null : form !== null);
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    disabled={!reachable}
                    onClick={() => goTo(i)}
                    aria-current={active ? "step" : undefined}
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${
                      active
                        ? "border-primary bg-primary text-primary-foreground"
                        : done
                          ? "border-border bg-card text-foreground"
                          : "border-border bg-card text-muted-foreground"
                    } disabled:opacity-50`}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                    {s.label}
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {form && step > 1 && (
          <p className="text-sm text-muted-foreground">
            Setting up form (funnel): <span className="font-semibold text-foreground">{form.name}</span>{" "}
            <button type="button" className="underline" onClick={() => goTo(1)}>
              change
            </button>
          </p>
        )}

        <section className="space-y-5 rounded-xl border border-border bg-card p-5 sm:p-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="mt-1 text-lg font-semibold text-foreground">
              {current.id === "plugin" && "Which plugin made your order form?"}
              {current.id === "name" && "Give this form a name"}
              {current.id === "fields" && "Make sure your form has the right boxes"}
              {current.id === "packages" && "Add your packages to the form"}
              {current.id === "tracking" && "Know which ad brought each order (optional)"}
              {current.id === "connect" && "Connect your form to NumbaTrak"}
              {current.id === "test" && "Send a test order"}
            </h2>
          </div>

          {current.id === "plugin" && <PluginStep provider={provider} onChoose={choose} />}
          {current.id === "name" && provider && (
            <NameStep
              provider={provider}
              settings={settings}
              loadError={loadError}
              selectedId={form?.id ?? null}
              onSelect={selectForm}
              onCreated={addForm}
            />
          )}
          {current.id === "fields" && provider && <FieldsStep provider={provider} settings={settings} />}
          {current.id === "packages" && provider && <PackagesStep provider={provider} />}
          {current.id === "tracking" && provider && <TrackingStep provider={provider} />}
          {current.id === "connect" && provider && form && (
            <ConnectStep
              provider={provider}
              form={form}
              settings={settings}
              loadError={loadError}
              onRotated={(token) => setSettings((s) => (s ? { ...s, token } : s))}
            />
          )}
          {current.id === "test" && provider && form && <TestStep provider={provider} form={form} />}

          {step > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={() => goTo(step - 1)}>
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
              {canGoForward && (
                <div className="flex flex-wrap items-center gap-3">
                  {current.id === "tracking" && (
                    <button type="button" className="text-sm text-muted-foreground underline" onClick={() => goTo(step + 1)}>
                      Skip this step
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={nextBlocked}
                    className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                    onClick={() => goTo(step + 1)}
                  >
                    {current.id === "tracking" ? "I've done this" : "Done, next step"}
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground">
          Setting up one of NumbaTrak&apos;s own forms instead? Open it from{" "}
          <Link to="/forms" className="underline">
            Order Forms
          </Link>{" "}
          and use its Integrations tab.
        </p>
      </div>
    </PageLayout>
  );
}

/* ------------------------------------------------------------------ */
/* Steps                                                               */
/* ------------------------------------------------------------------ */

function PluginStep({
  provider,
  onChoose,
}: {
  provider: IntakeProvider | null;
  onChoose: (p: IntakeProvider) => void;
}) {
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(PLUGIN_NAMES) as IntakeProvider[]).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onChoose(p)}
            className={`rounded-xl border p-4 text-left hover:border-primary ${
              provider === p ? "border-primary bg-primary/5" : "border-border bg-background"
            }`}
          >
            <span className="block text-base font-semibold text-foreground">{PLUGIN_NAMES[p]}</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              {p === "fluent-forms"
                ? "You made the form under Fluent Forms in your WordPress menu."
                : "You made the form inside the Elementor page editor (needs Elementor Pro)."}
            </span>
          </button>
        ))}
      </div>
      <Tip>
        Not sure? In WordPress, open the page that has your order form and click Edit. If a big editor with a panel on
        the left opens and says Elementor, pick Elementor. If your WordPress menu has a Fluent Forms item and your form
        is listed there, pick Fluent Forms.
      </Tip>
    </>
  );
}

function NameStep({
  provider,
  settings,
  loadError,
  selectedId,
  onSelect,
  onCreated,
}: {
  provider: IntakeProvider;
  settings: FormIntakeSettings | null;
  loadError: boolean;
  selectedId: string | null;
  onSelect: (form: ExternalForm) => void;
  onCreated: (form: ExternalForm) => void;
}) {
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (loadError) return <Tip>Couldn&apos;t load your forms. Refresh the page to try again.</Tip>;
  if (!settings) return <div className="h-12 animate-pulse rounded-lg bg-muted" />;

  const existing = settings.forms.filter((f) => f.provider === provider);
  const trimmed = name.trim().replace(/\s+/g, " ");
  const taken = settings.forms.some((f) => f.name.toLowerCase() === trimmed.toLowerCase());

  const save = async () => {
    if (!trimmed) return setError("Type a name for this form.");
    if (taken) return setError(`You already have a form called "${trimmed}". Pick another name.`);
    setSaving(true);
    setError(null);
    try {
      const { form } = await formIntakeApi.createForm(trimmed, provider);
      onCreated(form);
      setName("");
      toast.success(`"${form.name}" saved`);
    } catch (err: any) {
      setError(err?.message || "Couldn't save the name. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <p className="text-sm text-muted-foreground">
        In NumbaTrak, <strong className="text-foreground">every form is a funnel</strong>. The name you give this form
        is how its orders show up everywhere: in the dashboard&apos;s Funnel filter, in your reports, and when you make
        tracking links for your ads.
      </p>
      <p className="text-sm text-muted-foreground">
        Each form on your website gets its own name and its own webhook address, so orders from different forms never
        get mixed up. Have three forms? Do this setup three times, once for each.
      </p>

      <div className="space-y-2">
        <label htmlFor="fi-form-name" className="text-sm font-medium text-foreground">
          Name for this form (funnel)
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="fi-form-name"
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && void save()}
            placeholder="e.g. Sink Flusher"
            maxLength={120}
            className="min-w-0 flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
          />
          <button
            type="button"
            onClick={save}
            disabled={saving || !trimmed}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save name"}
          </button>
        </div>
        {error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Use something you&apos;ll recognise, like the product or the page: &ldquo;Sink Flusher&rdquo; or &ldquo;Sink
            Flusher TikTok page&rdquo;. Every form needs a different name.
          </p>
        )}
      </div>

      {existing.length > 0 && (
        <div className="space-y-2">
          <SubHeading>Or carry on with a {PLUGIN_NAMES[provider]} form you&apos;ve already named</SubHeading>
          <div className="flex flex-wrap gap-2">
            {existing.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => onSelect(f)}
                aria-pressed={f.id === selectedId}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
                  f.id === selectedId
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-background text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.id === selectedId && <Check className="h-3.5 w-3.5" />}
                {f.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {selectedId && settings.forms.some((f) => f.id === selectedId) && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 p-3 text-sm text-foreground">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-primary-text" />
          You&apos;re setting up <strong>{settings.forms.find((f) => f.id === selectedId)!.name}</strong>. Click Done,
          next step.
        </div>
      )}
    </>
  );
}

function FieldsStep({ provider, settings }: { provider: IntakeProvider; settings: FormIntakeSettings | null }) {
  const where = WHERE_TO_TYPE_NAME[provider];
  return (
    <>
      <p className="text-sm text-muted-foreground">
        NumbaTrak reads each box on your form by its name. Your form needs the 4 boxes below. If one is missing, add
        it. Then give each box the name in the last column.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="px-3 py-2 font-medium">What it&apos;s for</th>
              <th className="px-3 py-2 font-medium">Field type</th>
              <th className="px-3 py-2 font-medium">{where.label} to type</th>
            </tr>
          </thead>
          <tbody>
            {NEEDED_FIELDS[provider].map((f) => (
              <tr key={f.what} className="border-b border-border align-top last:border-0">
                <td className="px-3 py-2.5 font-medium text-foreground">{f.what}</td>
                <td className="px-3 py-2.5 text-muted-foreground">{f.type}</td>
                <td className="px-3 py-2.5">
                  {f.name ? <NameChip name={f.name} /> : <span className="text-muted-foreground">Nothing</span>}
                  {f.note && <p className="mt-1 text-xs text-muted-foreground">{f.note}</p>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-3">
        <SubHeading>How to give a box its name in {PLUGIN_NAMES[provider]}</SubHeading>
        <Instructions items={where.steps} />
      </div>

      <Folded title="Extra boxes you can add (optional)">
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <tbody>
              {OPTIONAL_FIELDS.map((f) => (
                <tr key={f.what} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-2 text-foreground">{f.what}</td>
                  <td className="px-3 py-2">
                    {f.name && <NameChip name={f.name} />}
                    {f.note && (
                      <p className={`mt-1 text-xs ${f.highlightNote ? "font-medium text-orange-500" : "text-muted-foreground"}`}>
                        {f.note}
                      </p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Folded>

      <Folded title="My boxes already have other names">
        <p className="mb-2 text-sm text-muted-foreground">
          These names work too. Capital letters, spaces, dashes and underscores don&apos;t matter, so “Phone Number”
          works the same as phone_number.
        </p>
        <ul className="space-y-1 text-sm">
          {Object.entries(settings?.fieldAliases ?? {}).map(([key, aliases]) => (
            <li key={key} className="font-mono text-xs text-muted-foreground">
              <span className="text-foreground">{aliases[0]}</span>: {aliases.slice(1).join(", ") || "—"}
            </li>
          ))}
        </ul>
      </Folded>

      <Tip>
        Anything else on your form (a comment box, a colour choice…) still comes through. You&apos;ll see it on the
        order under Submitted details.
      </Tip>
    </>
  );
}

function PackagesStep({ provider }: { provider: IntakeProvider }) {
  const { currentOrganization } = useOrganization();
  const [products, setProducts] = useState<ProductWithDetails[] | null>(null);
  const [productId, setProductId] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchOffers = async () => {
    setLoading(true);
    try {
      const list = (await fetchProductsWithDetails(currentOrganization?.id ?? null)).filter((p) => p.active);
      setProducts(list);
      setProductId((current) => current || list[0]?.id || "");
    } catch (err) {
      console.error("Error loading offers:", err);
      toast.error("Couldn't load your offers. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const product = products?.find((p) => p.id === productId) ?? null;
  const offers = useMemo(
    () => (product?.offers ?? []).filter((o) => o.active).sort((a, b) => a.display_order - b.display_order),
    [product],
  );
  const optionLines = offers.map((o) => `${offerOptionLabel(o.label, o.price)}|${OFFER_VALUE_PREFIX}${o.id}`).join("\n");
  const isFluent = provider === "fluent-forms";

  return (
    <>
      <p className="text-sm text-muted-foreground">
        Your Package box needs one choice for each offer you sell. Each choice has two parts: the text the customer
        sees, and a hidden code that tells NumbaTrak exactly which offer it is. That way every order comes in with the
        right price, number of units and cost.
      </p>

      {products === null ? (
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          onClick={fetchOffers}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Getting your offers…" : "Get my offers"}
        </button>
      ) : products.length === 0 ? (
        <Tip>
          You don&apos;t have any active products yet. Add your product and its offers under{" "}
          <Link to="/products" className="underline">
            Products
          </Link>
          , then come back to this step.
        </Tip>
      ) : (
        <>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-foreground">Which product is this form for?</span>
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
            <Tip>
              This product has no active offers. Add them under{" "}
              <Link to="/products" className="underline">
                Products
              </Link>
              , then click Get my offers again.
            </Tip>
          ) : isFluent ? (
            <>
              <div className="overflow-x-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-[11px] uppercase tracking-wider text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Label (customer sees this)</th>
                      <th className="px-3 py-2 font-medium">Value (hidden code)</th>
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
                              <code className="break-all font-mono text-xs text-muted-foreground">{value}</code>
                              <CopyButton text={value} label="Value" />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Instructions
                items={[
                  "In your form, click the Package box (the Radio or Dropdown field).",
                  <>On the right, turn on <strong>Show Values</strong>. Each choice now has a Label box and a Value box.</>,
                  "Add one choice per row of the table above (use the + button for more).",
                  "For each choice, copy the Label into the Label box and the Value into the Value box.",
                  "Delete any old choices that aren't in the table, then click Save Form.",
                ]}
              />
            </>
          ) : (
            <>
              <div className="flex items-start gap-2">
                <pre className="flex-1 overflow-x-auto whitespace-pre rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
                  {optionLines}
                </pre>
                <CopyButton text={optionLines} label="Choices">
                  Copy all
                </CopyButton>
              </div>
              <Instructions
                items={[
                  "In Elementor, open your form's Package field (under Form Fields).",
                  "Click into the Options box and delete what's there.",
                  <>Click <strong>Copy all</strong> above and paste into the Options box. Each line is one choice.</>,
                  "Click Update.",
                ]}
              />
              <Tip>
                The part after the | is the hidden code. Your customers only see the part before it.
              </Tip>
            </>
          )}

          {offers.length > 0 && (
            <Tip>
              Changed an offer&apos;s name or price in NumbaTrak? Come back here, click Get my offers again and update the
              choices on your form so customers see the new price.
            </Tip>
          )}
        </>
      )}
    </>
  );
}

function TrackingStep({ provider }: { provider: IntakeProvider }) {
  const isFluent = provider === "fluent-forms";
  return (
    <>
      <p className="text-sm text-muted-foreground">
        If you run ads using NumbaTrak{" "}
        <Link to="/tracking-links" className="underline">
          tracking links
        </Link>
        , this step lets NumbaTrak credit each order to the ad, media buyer and platform it came from. Not running ads
        with tracking links? Skip this step.
      </p>

      <div className="space-y-3">
        <SubHeading>Part A: add a hidden box to your form</SubHeading>
        <Instructions
          items={
            isFluent
              ? [
                  "In your form, find Hidden Field (under Advanced Fields on the right) and drag it onto the form.",
                  <>Click it, open Advanced Options, and type <NameChip name="tl" /> as the Name Attribute.</>,
                  "Click Save Form.",
                ]
              : [
                  <>In your form, click <strong>+ Add Item</strong> under Form Fields.</>,
                  "Set its Type to Hidden.",
                  <>Open its Advanced tab and type <NameChip name="tl" /> as the ID.</>,
                  "Click Update.",
                ]
          }
        />
        <p className="text-xs text-muted-foreground">Customers never see this box. Leave its value empty.</p>
      </div>

      <div className="space-y-3">
        <SubHeading>Part B: add this script to your website</SubHeading>
        <p className="text-sm text-muted-foreground">
          The script fills in the hidden box for you. It also remembers the ad for 30 days, so the order still counts
          if the customer looks around other pages first.
        </p>
        <div className="flex items-start gap-2">
          <pre className="max-h-40 flex-1 overflow-auto whitespace-pre rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
            {TRACKING_SCRIPT}
          </pre>
          <CopyButton text={TRACKING_SCRIPT} label="Script">
            Copy
          </CopyButton>
        </div>
        <Instructions
          items={
            isFluent
              ? [
                  <>In WordPress, go to Plugins → Add New, search for <strong>WPCode</strong>, then install and activate it.</>,
                  "Go to Code Snippets → Header & Footer.",
                  "Paste the script into the Footer box and click Save Changes.",
                ]
              : [
                  "In WordPress, go to Elementor → Custom Code (Elementor Pro), and click Add New.",
                  "Give it any title, paste the script into the box, and set Location to </body> - End.",
                  "Click Publish, choose Entire Site, and Save & Close.",
                ]
          }
        />
        {!isFluent && (
          <p className="text-xs text-muted-foreground">
            No Custom Code menu? Use the WPCode plugin instead: Plugins → Add New → WPCode, then Code Snippets → Header
            &amp; Footer → paste into Footer.
          </p>
        )}
      </div>
    </>
  );
}

function ConnectStep({
  provider,
  form,
  settings,
  loadError,
  onRotated,
}: {
  provider: IntakeProvider;
  form: ExternalForm;
  settings: FormIntakeSettings | null;
  loadError: boolean;
  onRotated: (token: string) => void;
}) {
  const [confirmRotate, setConfirmRotate] = useState(false);
  const [rotating, setRotating] = useState(false);
  const isFluent = provider === "fluent-forms";

  const rotate = async () => {
    setRotating(true);
    try {
      const { token } = await formIntakeApi.rotate();
      onRotated(token);
      setConfirmRotate(false);
      toast.success("New addresses created. Paste each form's new address into it.");
    } catch (err) {
      console.error("Error rotating intake address:", err);
      toast.error("Couldn't create a new address.");
    } finally {
      setRotating(false);
    }
  };

  if (loadError) return <Tip>Couldn&apos;t load your address. Refresh the page to try again.</Tip>;
  if (!settings) return <div className="h-12 animate-pulse rounded-lg bg-muted" />;

  const address = intakeAddress(settings.token, form.id);

  return (
    <>
      <p className="text-sm text-muted-foreground">
        This address belongs to <strong className="text-foreground">{form.name}</strong> only. When a customer submits
        this form, {PLUGIN_NAMES[provider]} sends their order here, and NumbaTrak files it under the {form.name} funnel.
      </p>
      <div className="flex items-center gap-2">
        <code className="flex-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">{address}</code>
        <CopyButton text={address} label="Address">
          Copy
        </CopyButton>
      </div>

      <Instructions
        items={
          isFluent
            ? [
                <>In your form&apos;s editor, click <strong>Settings &amp; Integrations</strong> at the top.</>,
                <>On the left, click <strong>Webhook</strong>, then <strong>Add New</strong>.</>,
                <>Name it NumbaTrak, and paste the address above into <strong>Request URL</strong>.</>,
                <>Set Request Method to <strong>POST</strong> and Request Format to <strong>JSON</strong>.</>,
                <>Set Request Body to <strong>All Data</strong>.</>,
                <>Click <strong>Save Feed</strong>.</>,
              ]
            : [
                "In Elementor, click your form.",
                <>On the left, open <strong>Actions After Submit</strong>, click the + and choose <strong>Webhook</strong>.</>,
                <>A new <strong>Webhook</strong> section appears further down. Open it and paste the address above.</>,
                <>Turn on <strong>Advanced Data</strong>.</>,
                <>Click <strong>Update</strong>.</>,
              ]
        }
      />

      {isFluent && (
        <Tip>
          Don&apos;t see Webhook? Go to Fluent Forms → Integrations in the WordPress menu, turn on Webhooks, and try again.
        </Tip>
      )}

      <Tip>
        Only paste this address into the {form.name} form. Each of your other forms needs its own name and address: go
        back to the Name your form step, name the other form, and you&apos;ll get a new address for it.
      </Tip>

      <Folded title="Keep this address secret">
        <p className="text-sm text-muted-foreground">
          Treat this address like a password. Anyone who has it can send orders into your account, so only paste it
          into your own forms.
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          If you think someone else has it, make new addresses below. This changes the address of every form you&apos;ve
          connected, and the old ones stop working immediately, so you&apos;ll need to come back here for each form and
          paste its new address into it.
        </p>
        <div className="mt-2">
          {confirmRotate ? (
            <span className="inline-flex flex-wrap items-center gap-3 text-sm">
              <span className="text-foreground">Are you sure?</span>
              <button type="button" className="btn-secondary" onClick={rotate} disabled={rotating}>
                {rotating ? "Creating…" : "Yes, make new addresses"}
              </button>
              <button type="button" className="text-muted-foreground underline" onClick={() => setConfirmRotate(false)}>
                Cancel
              </button>
            </span>
          ) : (
            <button type="button" className="btn-secondary" onClick={() => setConfirmRotate(true)}>
              Make new addresses
            </button>
          )}
        </div>
      </Folded>
    </>
  );
}

const POLL_MS = 10_000;

function TestStep({ provider, form }: { provider: IntakeProvider; form: ExternalForm }) {
  const [submissions, setSubmissions] = useState<RecentSubmission[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState(false);
  const [startedAt] = useState(() => Date.now());

  const check = async () => {
    setChecking(true);
    try {
      const { submissions } = await formIntakeApi.recent(form.id);
      setSubmissions(submissions);
      setError(false);
    } catch (err) {
      console.error("Error checking recent submissions:", err);
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  // Keep looking while this step is open, so the entry shows up on its own.
  useEffect(() => {
    void check();
    const timer = setInterval(() => void check(), POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const fresh = (submissions ?? []).filter(
    (s) => s.receivedAt && new Date(s.receivedAt).getTime() >= startedAt - 15 * 60_000,
  );
  const latest = fresh[0] ?? null;
  const isFluent = provider === "fluent-forms";

  return (
    <>
      <Instructions
        items={[
          <>Open your website in a new tab and go to the page with the <strong>{form.name}</strong> form.</>,
          "Fill it in like a customer would: a name, a phone number, a state, and pick a package.",
          "Submit the form, then come back to this tab.",
        ]}
      />

      <div className="rounded-lg border border-border bg-background p-4" aria-live="polite">
        {latest?.kind === "order" ? (
          <div className="flex gap-3">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-primary-text" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">It works! Your order arrived.</p>
              <p className="text-muted-foreground">
                {latest.customerName ?? "A customer"}
                {latest.packageName ? ` · ${latest.packageName}` : ""} · {timeAgo(latest.receivedAt)}
              </p>
              <p className="text-muted-foreground">
                You&apos;ll find it in{" "}
                <Link to="/orders" className="underline">
                  Orders
                </Link>
                . You can delete the test order there. You&apos;re all set.
              </p>
            </div>
          </div>
        ) : latest?.kind === "abandoned_cart" ? (
          <div className="flex gap-3">
            <Info className="h-6 w-6 shrink-0 text-muted-foreground" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Almost there. It arrived, but not as an order.</p>
              <p className="text-muted-foreground">
                {latest.customerName ?? "The entry"}
                {latest.packageName ? ` · "${latest.packageName}"` : ""} was saved under{" "}
                <Link to="/abandoned-carts" className="underline">
                  Abandoned carts
                </Link>{" "}
                because NumbaTrak couldn&apos;t tell which package was picked. Go back to the Add your packages step and check the Package
                choices use the values from NumbaTrak, then try again.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex gap-3">
            <RefreshCw className={`h-5 w-5 shrink-0 text-muted-foreground ${checking ? "animate-spin" : ""}`} />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Waiting for your test entry…</p>
              <p className="text-muted-foreground">
                {error ? "Couldn't check just now. " : ""}This updates on its own every few seconds.
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="btn-secondary inline-flex items-center gap-2" onClick={check} disabled={checking}>
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          Check now
        </button>
      </div>

      {latest?.kind !== "order" && (
        <Folded title="Submitted the form but nothing showed up?">
          <Instructions
            items={[
              "Go back to the Connect step and check the address is pasted exactly, with nothing missing at the start or end.",
              isFluent
                ? "Make sure you clicked Save Feed on the webhook and Save Form on the form."
                : "Make sure you clicked Update in Elementor after adding the webhook.",
              "Make sure the test entry had a name, a phone number and a state. Those are needed.",
              isFluent
                ? "Still stuck? In WordPress, go to Fluent Forms → Tools → Logs. It shows NumbaTrak's reply, which says what's wrong."
                : "Still stuck? In WordPress, go to Elementor → Submissions and open your test entry. It shows whether the webhook worked.",
            ]}
          />
        </Folded>
      )}
    </>
  );
}
