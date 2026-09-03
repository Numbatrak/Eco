import { ReactNode, useState } from "react";
import { Copy, RefreshCw, Webhook, Braces, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { FormSchema, FieldMapping, RadioOption } from "../../../types/form";
import { API_BASE_URL } from "../../../lib/apiClient";

interface IntegrationsPanelProps {
  /** null before the form has ever been saved - Elementor mapping needs a real form id to PATCH. */
  formId: string | null;
  formToken: string;
  schema: FormSchema;
  fieldMapping: FieldMapping;
  hasWebhookSecret: boolean;
  onSaveMapping: (mapping: FieldMapping) => Promise<void>;
  onRotateSecret: () => Promise<string>;
  onCopy: (text: string, label: string) => void;
}

const CONTACT_FIELD_ROLES = [
  ["customerName", "Customer name field"],
  ["phone", "Phone field"],
  ["whatsapp", "WhatsApp field"],
  ["address", "Address field"],
  ["state", "State field"],
] as const;

function collectRadioOptions(schema: FormSchema): RadioOption[] {
  const options: RadioOption[] = [];
  for (const field of schema.fields) {
    if (field.type === "radio-group" && field.radioOptions) options.push(...field.radioOptions);
    if (field.type === "order-bump" && field.orderBump) options.push(field.orderBump);
  }
  return options;
}

function IntegrationCard({ icon, title, tagline, children }: { icon: ReactNode; title: string; tagline: string; children: ReactNode }) {
  return (
    <div className="border-2 border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 bg-muted/60 border-b-2 border-border">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
        <div>
          <h2 className="text-sm font-bold text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground">{tagline}</p>
        </div>
      </div>
      <ol className="px-5 py-5 space-y-5">{children}</ol>
    </div>
  );
}

function Step({ number, title, children }: { number: number; title: string; children?: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
        {number}
      </span>
      <div className="flex-1 min-w-0 space-y-2 pt-0.5">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {children}
      </div>
    </li>
  );
}

function CopyField({ value, label, onCopy, mono = true }: { value: string; label: string; onCopy: (text: string, label: string) => void; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <code className={`flex-1 px-3 py-2 bg-muted rounded-lg text-xs break-all ${mono ? "font-mono" : ""}`}>{value}</code>
      <button type="button" className="btn-secondary shrink-0" onClick={() => onCopy(value, label)} title={`Copy ${label.toLowerCase()}`}>
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

/** WPForms/Elementor order-intake setup - see Part A/B of the integration plan for why the two are handled so differently. */
export function IntegrationsPanel({
  formId,
  formToken,
  schema,
  fieldMapping,
  hasWebhookSecret,
  onSaveMapping,
  onRotateSecret,
  onCopy,
}: IntegrationsPanelProps) {
  const [mapping, setMapping] = useState<FieldMapping>(fieldMapping);
  const [savingMapping, setSavingMapping] = useState(false);
  const [rotating, setRotating] = useState(false);
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);

  const radioOptions = collectRadioOptions(schema);
  const submitUrl = `${API_BASE_URL}/public/numbatrak/forms/${formToken}/submit`;
  const webhookUrl = `${API_BASE_URL}/public/numbatrak/forms/${formToken}/webhook/elementor`;

  const valueForOption = (optionId: string): string =>
    Object.entries(mapping.valueToOptionId).find(([, v]) => v === optionId)?.[0] ?? "";

  const setValueForOption = (optionId: string, answerValue: string) => {
    setMapping((prev) => {
      const next = { ...prev.valueToOptionId };
      for (const key of Object.keys(next)) {
        if (next[key] === optionId) delete next[key];
      }
      if (answerValue.trim()) next[answerValue.trim()] = optionId;
      return { ...prev, valueToOptionId: next };
    });
  };

  const wpFormsTemplate = JSON.stringify(
    {
      fieldValues: {
        customer_name: '{field_id="1"}',
        phone: '{field_id="2"}',
        whatsapp: '{field_id="2"}',
        address: '{field_id="3"}',
        state: '{field_id="4"}',
      },
      items: radioOptions[0]?.products?.length
        ? radioOptions[0].products.map((p) => ({ productId: p.product_id, quantity: p.quantity }))
        : [{ productId: "<product-uuid>", quantity: 1 }],
      source: "wpforms",
    },
    null,
    2,
  );

  const handleSaveMapping = async () => {
    try {
      setSavingMapping(true);
      await onSaveMapping(mapping);
      toast.success("Elementor mapping saved");
    } catch (err: any) {
      toast.error(err?.message || "Failed to save mapping");
    } finally {
      setSavingMapping(false);
    }
  };

  const handleRotate = async () => {
    try {
      setRotating(true);
      const secret = await onRotateSecret();
      setRevealedSecret(secret);
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate webhook secret");
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="form-section space-y-6 max-w-2xl">
      <div>
        <h1 className="text-base font-bold text-foreground">Order intake integrations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Accept orders from forms built in other WordPress page builders, without embedding our script. Pick whichever
          plugin you're already using below.
        </p>
      </div>

      <IntegrationCard
        icon={<Braces className="w-4 h-4" />}
        title="WPForms"
        tagline="Uses the Webhooks addon — no setup needed on our side."
      >
        <Step number={1} title="Install the Webhooks addon">
          <p className="text-xs text-muted-foreground">
            In your WordPress admin, go to <strong>WPForms → Addons</strong>, find <strong>Webhooks</strong>, and click
            Install &amp; Activate (included with WPForms Pro and above).
          </p>
        </Step>

        <Step number={2} title="Open this form's Webhooks settings">
          <p className="text-xs text-muted-foreground">
            Edit your WPForms form, go to <strong>Settings → Webhooks</strong>, and click <strong>Add New</strong>.
          </p>
        </Step>

        <Step number={3} title="Paste the request URL">
          <CopyField value={submitUrl} label="Request URL" onCopy={onCopy} />
          <p className="text-xs text-muted-foreground">
            Set <strong>Request Format</strong> to <strong>JSON</strong> and <strong>Request Method</strong> to{" "}
            <strong>POST</strong>.
          </p>
        </Step>

        <Step number={4} title="Paste the request body template">
          <div className="flex items-start gap-2">
            <pre className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">
              {wpFormsTemplate}
            </pre>
            <button
              type="button"
              className="btn-secondary shrink-0"
              onClick={() => onCopy(wpFormsTemplate, "JSON template")}
              title="Copy JSON template"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Replace each {'{field_id="N"}'} smart tag with your own field IDs — hover a field in the WPForms builder to
            see its ID, then use WPForms' smart tag picker to insert it. WPForms has no concept of our product catalog,
            so the <code className="font-mono">items</code> array must be hardcoded to real product IDs, which works
            best for single-product or fixed-quantity forms.
          </p>
        </Step>

        <Step number={5} title="Save and test">
          <p className="text-xs text-muted-foreground">
            Save the webhook, then submit a test entry on your live WordPress form. The order (or an abandoned cart, if
            no items resolved) should appear in Numbatrak within a few seconds.
          </p>
        </Step>
      </IntegrationCard>

      <IntegrationCard
        icon={<Webhook className="w-4 h-4" />}
        title="Elementor Pro"
        tagline="Always sends a fixed payload — map its fields to your form below."
      >
        {!formId ? (
          <Step number={1} title="Save this form first">
            <p className="text-xs text-muted-foreground">
              Elementor's webhook needs a saved form to generate a URL and secret for. Click <strong>Save Form</strong>{" "}
              above, then come back to this tab.
            </p>
          </Step>
        ) : (
          <>
            <Step number={1} title="Generate a webhook secret">
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">
                  {revealedSecret ?? (hasWebhookSecret ? "Configured — rotate to view" : "Not generated yet")}
                </code>
                {revealedSecret && (
                  <button
                    type="button"
                    className="btn-secondary shrink-0"
                    onClick={() => onCopy(revealedSecret, "Webhook secret")}
                    title="Copy webhook secret"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button type="button" className="btn-secondary shrink-0" onClick={() => void handleRotate()} disabled={rotating}>
                  <RefreshCw className={`w-4 h-4 ${rotating ? "animate-spin" : ""}`} />
                  {hasWebhookSecret ? "Rotate" : "Generate"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Keep this secret handy for step 4 below — rotating replaces it immediately and the old value stops
                working.
              </p>
            </Step>

            <Step number={2} title="Copy the webhook URL">
              <CopyField value={webhookUrl} label="Webhook URL" onCopy={onCopy} />
            </Step>

            <Step number={3} title="Map your Elementor fields">
              <p className="text-xs text-muted-foreground mb-1">
                Enter the field ID or title exactly as it appears in your Elementor form for each role below.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {CONTACT_FIELD_ROLES.map(([key, label]) => (
                  <div key={key}>
                    <label className="form-label text-xs">{label}</label>
                    <input
                      type="text"
                      value={mapping.contactFields[key] ?? ""}
                      onChange={(e) =>
                        setMapping((prev) => ({ ...prev, contactFields: { ...prev.contactFields, [key]: e.target.value } }))
                      }
                      placeholder="Elementor field id or title"
                      className="form-input text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="form-label text-xs">Package/product field</label>
                <input
                  type="text"
                  value={mapping.productField ?? ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, productField: e.target.value }))}
                  placeholder="Elementor field id or title holding the package choice"
                  className="form-input text-sm"
                />
              </div>

              {radioOptions.length > 0 && (
                <div>
                  <label className="form-label text-xs">Package answer values</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    For each package option, enter the exact answer text Elementor will send when that option is
                    chosen.
                  </p>
                  <div className="space-y-2">
                    {radioOptions.map((option) => (
                      <div key={option.id} className="flex items-center gap-2">
                        <span className="text-sm text-foreground w-40 shrink-0 truncate" title={option.title}>
                          {option.title || option.value}
                        </span>
                        <input
                          type="text"
                          value={valueForOption(option.id)}
                          onChange={(e) => setValueForOption(option.id, e.target.value)}
                          placeholder="Exact Elementor answer value"
                          className="form-input text-sm flex-1"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button type="button" className="btn-primary" onClick={() => void handleSaveMapping()} disabled={savingMapping}>
                {savingMapping ? (
                  "Saving..."
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    Save mapping
                  </>
                )}
              </button>
            </Step>

            <Step number={4} title="Add the webhook action in Elementor">
              <p className="text-xs text-muted-foreground">
                Edit your Elementor form → <strong>Actions After Submit</strong> → add <strong>Webhook</strong> → paste
                the URL from step 2. Then add your secret either as a custom header named{" "}
                <code className="font-mono">x-numbatrak-webhook-secret</code>, or by appending{" "}
                <code className="font-mono">?secret=your-secret</code> to the URL.
              </p>
            </Step>

            <Step number={5} title="Test it">
              <p className="text-xs text-muted-foreground">
                Submit the live Elementor form and confirm the order (or abandoned cart, if the package didn't resolve)
                shows up in Numbatrak.
              </p>
            </Step>
          </>
        )}
      </IntegrationCard>
    </div>
  );
}
