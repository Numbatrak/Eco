import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
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
    <div className="form-section space-y-8 max-w-2xl">
      <div className="space-y-4">
        <div className="section-header">
          <h2 className="section-title">WPForms</h2>
          <p className="text-xs text-muted-foreground mt-1">
            WPForms' Webhooks addon lets you template the outgoing JSON yourself, so it hits our existing submit
            endpoint directly — no extra setup here beyond pasting the URL and template into "Settings → Webhooks" on
            your WPForms form.
          </p>
        </div>

        <div>
          <label className="form-label text-xs">Request URL</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">{submitUrl}</code>
            <button type="button" className="btn-secondary shrink-0" onClick={() => onCopy(submitUrl, "Request URL")}>
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="form-label text-xs">Request Body (JSON) template</label>
          <div className="flex items-start gap-2">
            <pre className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs overflow-x-auto whitespace-pre">
              {wpFormsTemplate}
            </pre>
            <button type="button" className="btn-secondary shrink-0" onClick={() => onCopy(wpFormsTemplate, "JSON template")}>
              <Copy className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Replace each {'{field_id="N"}'} smart tag with your own WPForms field IDs. WPForms has no concept of our
            product catalog, so the "items" array must be hardcoded to real product IDs — best suited to
            single-product or fixed-quantity forms.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <div className="section-header">
          <h2 className="section-title">Elementor Pro</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Elementor's native Webhook action always sends a fixed payload we can't reshape, so map its field IDs or
            titles to the roles below.
          </p>
        </div>

        {!formId ? (
          <p className="text-sm text-muted-foreground italic">Save this form first to configure the Elementor webhook.</p>
        ) : (
          <>
            <div>
              <label className="form-label text-xs">Webhook URL</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">{webhookUrl}</code>
                <button type="button" className="btn-secondary shrink-0" onClick={() => onCopy(webhookUrl, "Webhook URL")}>
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div>
              <label className="form-label text-xs">Webhook secret</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 bg-muted rounded-lg font-mono text-xs break-all">
                  {revealedSecret ?? (hasWebhookSecret ? "Configured — rotate to view" : "Not generated yet")}
                </code>
                {revealedSecret && (
                  <button
                    type="button"
                    className="btn-secondary shrink-0"
                    onClick={() => onCopy(revealedSecret, "Webhook secret")}
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}
                <button type="button" className="btn-secondary shrink-0" onClick={() => void handleRotate()} disabled={rotating}>
                  <RefreshCw className={`w-4 h-4 ${rotating ? "animate-spin" : ""}`} />
                  {hasWebhookSecret ? "Rotate" : "Generate"}
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Send it as header <code className="font-mono">x-numbatrak-webhook-secret</code> or query param{" "}
                <code className="font-mono">?secret=</code> in Elementor's Webhook action. Rotating invalidates the
                previous secret immediately.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  For each package option, enter the exact answer text Elementor will send when that option is chosen.
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
              {savingMapping ? "Saving..." : "Save mapping"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
