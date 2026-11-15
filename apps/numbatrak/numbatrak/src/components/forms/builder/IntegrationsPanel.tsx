import { ReactNode, useState } from "react";
import { Copy, RefreshCw, Webhook, Braces, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { FormSchema, FieldMapping, RadioOption } from "../../../types/form";
import { PUBLIC_API_BASE_URL } from "../../../lib/apiClient";

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

function TemplateBlock({ template, onCopy }: { template: string; onCopy: (text: string, label: string) => void }) {
  return (
    <div className="flex items-start gap-2">
      <pre className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">{template}</pre>
      <button type="button" className="btn-secondary shrink-0" onClick={() => onCopy(template, "Request body")} title="Copy">
        <Copy className="w-4 h-4" />
      </button>
    </div>
  );
}

/** How to pass the ad's tracking code (?tl=...) through a hidden field. */
function TrackingHint({ setup }: { setup: ReactNode }) {
  return (
    <p className="text-xs text-muted-foreground">
      <strong className="text-foreground">To see which media buyer each order came from:</strong> {setup} Leave it
      out and orders still come in, just without a media buyer.
    </p>
  );
}

function ProductsHint({ hasProducts }: { hasProducts: boolean }) {
  return hasProducts ? (
    <p className="text-xs text-muted-foreground">
      The products are filled in from your first package. Every order from this form will be for those products, so
      this suits forms that sell one fixed package.
    </p>
  ) : (
    <p className="text-xs text-warn-text">
      This form has no package with products yet. Add one on the Fields tab first, so the products can be filled in
      here for you.
    </p>
  );
}

/** WPForms/Fluent Forms/Elementor order-intake setup - WPForms and Fluent Forms both post a merchant-authored JSON template straight to the public /submit endpoint; Elementor's webhook can't be reshaped, so it gets its own endpoint + field-mapping UI instead. */
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
  // Always the live address: these get pasted into the merchant's website,
  // which can never reach localhost (see PUBLIC_API_BASE_URL).
  const submitUrl = `${PUBLIC_API_BASE_URL}/public/numbatrak/forms/${formToken}/submit`;
  const webhookUrl = `${PUBLIC_API_BASE_URL}/public/numbatrak/forms/${formToken}/webhook/elementor`;

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

  // Products come from the form's first package; without one there's nothing
  // real to put in the template, and the panel says so instead of showing a
  // placeholder id a merchant might paste as-is.
  const templateItems = radioOptions[0]?.products?.length
    ? radioOptions[0].products.map((p) => ({ productId: p.product_id, quantity: p.quantity }))
    : null;

  const wpFormsTemplate = JSON.stringify(
    {
      fieldValues: {
        customer_name: '{field_id="1"}',
        phone: '{field_id="2"}',
        whatsapp: '{field_id="2"}',
        address: '{field_id="3"}',
        state: '{field_id="4"}',
      },
      items: templateItems ?? [],
      source: "wpforms",
      trackingLinkCode: '{field_id="5"}',
    },
    null,
    2,
  );

  const fluentFormsTemplate = JSON.stringify(
    {
      fieldValues: {
        customer_name: "{inputs.names.first_name} {inputs.names.last_name}",
        phone: "{inputs.phone}",
        whatsapp: "{inputs.phone}",
        address: "{inputs.address}",
        state: "{inputs.state}",
      },
      items: templateItems ?? [],
      source: "fluentforms",
      trackingLinkCode: '{inputs.tl}',
    },
    null,
    2,
  );

  const handleSaveMapping = async () => {
    try {
      setSavingMapping(true);
      await onSaveMapping(mapping);
      toast.success("Saved");
    } catch (err: any) {
      toast.error(err?.message || "Couldn't save");
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
      toast.error(err?.message || "Couldn't create the secret key");
    } finally {
      setRotating(false);
    }
  };

  return (
    <div className="form-section space-y-6 max-w-2xl">
      <div>
        <h1 className="text-base font-bold text-foreground">Get orders from your WordPress form</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Already have an order form built with WPForms, Fluent Forms or Elementor? Connect it here and every order
          lands in NumbaTrak automatically. Follow the steps for the one you use.
        </p>
      </div>

      <IntegrationCard
        icon={<Braces className="w-4 h-4" />}
        title="WPForms"
        tagline="Needs WPForms Pro (for its Webhooks add-on)."
      >
        <Step number={1} title="Turn on Webhooks">
          <p className="text-xs text-muted-foreground">
            In WordPress, go to <strong>WPForms → Addons</strong>, find <strong>Webhooks</strong> and click{" "}
            <strong>Install &amp; Activate</strong>.
          </p>
        </Step>

        <Step number={2} title="Add a webhook to your form">
          <p className="text-xs text-muted-foreground">
            Open your form in WPForms, go to <strong>Settings → Webhooks</strong> and click <strong>Add New</strong>.
          </p>
        </Step>

        <Step number={3} title="Paste this address">
          <CopyField value={submitUrl} label="Address" onCopy={onCopy} />
          <p className="text-xs text-muted-foreground">
            Put it in the <strong>Request URL</strong> box. Then set <strong>Request Method</strong> to{" "}
            <strong>POST</strong> and <strong>Request Format</strong> to <strong>JSON</strong>.
          </p>
        </Step>

        <Step number={4} title="Paste this into the request body">
          <TemplateBlock template={wpFormsTemplate} onCopy={onCopy} />
          <p className="text-xs text-muted-foreground">
            Each <code className="font-mono">{'{field_id="1"}'}</code> stands for one of your form&apos;s fields. Swap
            the number for your own field&apos;s number (hover over a field in the WPForms builder to see it): name,
            phone, address and state, in that order.
          </p>
          <TrackingHint
            setup={
              <>
                Add a <strong>Hidden Field</strong> to your form and set its default value to{" "}
                <code className="font-mono">{'{query_var key="tl"}'}</code>. Then put that field&apos;s number in{" "}
                <code className="font-mono">{'{field_id="5"}'}</code> above.
              </>
            }
          />
          <ProductsHint hasProducts={templateItems != null} />
        </Step>

        <Step number={5} title="Save and send a test order">
          <p className="text-xs text-muted-foreground">
            Save, then place a test order on your website. It should show up in NumbaTrak within a few seconds. If
            the package didn&apos;t come through, it shows under abandoned carts instead.
          </p>
        </Step>
      </IntegrationCard>

      <IntegrationCard
        icon={<Braces className="w-4 h-4" />}
        title="Fluent Forms"
        tagline="Needs Fluent Forms Pro (for webhooks)."
      >
        <Step number={1} title="Add a webhook to your form">
          <p className="text-xs text-muted-foreground">
            Open your form in Fluent Forms, go to <strong>Settings &amp; Integrations → Webhook</strong> and add a new
            webhook.
          </p>
        </Step>

        <Step number={2} title="Paste this address">
          <CopyField value={submitUrl} label="Address" onCopy={onCopy} />
          <p className="text-xs text-muted-foreground">
            Put it in the <strong>Request URL</strong> box. Then set <strong>Request Method</strong> to{" "}
            <strong>POST</strong> and <strong>Request Format</strong> to <strong>JSON</strong>.
          </p>
        </Step>

        <Step number={3} title="Paste this into the request body">
          <TemplateBlock template={fluentFormsTemplate} onCopy={onCopy} />
          <p className="text-xs text-muted-foreground">
            Each <code className="font-mono">{"{inputs.…}"}</code> stands for one of your form&apos;s fields. If your
            fields are named differently, swap them using the field picker next to the request body.
          </p>
          <TrackingHint
            setup={
              <>
                Add a <strong>Hidden Field</strong> named <code className="font-mono">tl</code> whose default value
                takes <code className="font-mono">tl</code> from the page address (in Fluent Forms that&apos;s{" "}
                <code className="font-mono">{"{get.tl}"}</code>).
              </>
            }
          />
          <ProductsHint hasProducts={templateItems != null} />
        </Step>

        <Step number={4} title="Save and send a test order">
          <p className="text-xs text-muted-foreground">
            Save, then place a test order on your website. It should show up in NumbaTrak within a few seconds. If
            the package didn&apos;t come through, it shows under abandoned carts instead.
          </p>
        </Step>
      </IntegrationCard>

      <IntegrationCard
        icon={<Webhook className="w-4 h-4" />}
        title="Elementor Pro"
        tagline="Needs Elementor Pro. Tell us which of your fields is which, below."
      >
        {!formId ? (
          <Step number={1} title="Save this form first">
            <p className="text-xs text-muted-foreground">
              Click <strong>Save Form</strong> above, then come back here. We need a saved form to create your
              connection details.
            </p>
          </Step>
        ) : (
          <>
            <Step number={1} title="Create your secret key">
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">
                  {revealedSecret ?? (hasWebhookSecret ? "Already set up. Make a new one to see it." : "Not created yet")}
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
                  {hasWebhookSecret ? "Make a new one" : "Create"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                It works like a password, so only your form can send orders here. You&apos;ll need it in step 4.
                Making a new one stops the old one working straight away.
              </p>
            </Step>

            <Step number={2} title="Copy this address">
              <CopyField value={webhookUrl} label="Address" onCopy={onCopy} />
            </Step>

            <Step number={3} title="Tell us which field is which">
              <p className="text-xs text-muted-foreground mb-1">
                For each box, type the name (or ID) of the matching field in your Elementor form, spelled exactly the
                same.
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
                      placeholder="e.g. name"
                      className="form-input text-sm"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="form-label text-xs">Package field</label>
                <input
                  type="text"
                  value={mapping.productField ?? ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, productField: e.target.value }))}
                  placeholder="The field where customers pick a package"
                  className="form-input text-sm"
                />
              </div>

              <div>
                <label className="form-label text-xs">Tracking field (optional)</label>
                <input
                  type="text"
                  value={mapping.trackingLinkCodeField ?? ""}
                  onChange={(e) => setMapping((prev) => ({ ...prev, trackingLinkCodeField: e.target.value }))}
                  placeholder="e.g. tl"
                  className="form-input text-sm"
                />
                <div className="text-xs text-muted-foreground mt-1 space-y-1">
                  <p>
                    Shows which media buyer&apos;s ad each order came from. In Elementor, add a{" "}
                    <strong>Hidden</strong> field called <code>tl</code>. For its <em>Default Value</em>, click the
                    dynamic tags icon, choose <strong>Request Parameter</strong>, set the type to{" "}
                    <strong>GET</strong> and the name to <code>tl</code>. Then type <code>tl</code> here.
                  </p>
                  <p>
                    Don&apos;t type a code into that field yourself. Every order would then be credited to the same
                    buyer.
                  </p>
                </div>
              </div>

              {radioOptions.length > 0 && (
                <div>
                  <label className="form-label text-xs">Package choices</label>
                  <p className="text-xs text-muted-foreground mb-2">
                    Next to each package, type the option exactly as it reads in your Elementor form.
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
                          placeholder="As written in Elementor"
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
                    Save
                  </>
                )}
              </button>
            </Step>

            <Step number={4} title="Connect it in Elementor">
              <p className="text-xs text-muted-foreground">
                Open your Elementor form, go to <strong>Actions After Submit</strong> and add{" "}
                <strong>Webhook</strong>. Paste the address from step 2, then add{" "}
                <code className="font-mono">?secret=</code> and your secret key from step 1 to the end of it:
              </p>
              <code className="block px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">
                {webhookUrl}?secret=<span className="text-muted-foreground">your-secret-key</span>
              </code>
            </Step>

            <Step number={5} title="Send a test order">
              <p className="text-xs text-muted-foreground">
                Place a test order on your website. It should show up in NumbaTrak within a few seconds. If the
                package didn&apos;t come through, it shows under abandoned carts instead.
              </p>
            </Step>
          </>
        )}
      </IntegrationCard>
    </div>
  );
}
