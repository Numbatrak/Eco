import { FormSchema } from "../../../types/form";

interface BasicSettingsPanelProps {
  mode: "create" | "edit";
  formName: string;
  onFormNameChange: (value: string) => void;
  formToken: string;
  funnelName: string;
  onFunnelNameChange: (value: string) => void;
  subBrand: string;
  onSubBrandChange: (value: string) => void;
  active: boolean;
  onActiveChange: (value: boolean) => void;
  schema: FormSchema;
  /** `coalesceKey` groups rapid edits to the same setting into one undo step. */
  onSchemaChange: (updates: Partial<FormSchema>, coalesceKey?: string | null) => void;
}

/** Form name/token/funnel/sub-brand/status/confirmation/submit-button settings — the "Settings" tab. */
export function BasicSettingsPanel({
  mode,
  formName,
  onFormNameChange,
  formToken,
  funnelName,
  onFunnelNameChange,
  subBrand,
  onSubBrandChange,
  active,
  onActiveChange,
  schema,
  onSchemaChange,
}: BasicSettingsPanelProps) {
  return (
    <div className="form-section space-y-8 max-w-2xl">
      <div className="space-y-5">
        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Form Name *</label>
          <input
            type="text"
            value={formName}
            onChange={(e) => onFormNameChange(e.target.value)}
            placeholder="e.g., Product Order Form"
            className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 transition-colors"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-foreground mb-2">Form Token *</label>
          <input
            type="text"
            value={formToken}
            placeholder="e.g., form_live_abc123"
            className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm font-mono focus:border-primary focus:ring-0 transition-colors disabled:bg-muted disabled:cursor-not-allowed"
            required
            disabled
            readOnly
          />
          <p className="text-xs text-muted-foreground mt-2">
            {mode === "create" ? "Auto-generated identifier for embedding this form" : "Token cannot be changed after creation"}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Funnel Name</label>
            <input
              type="text"
              value={funnelName}
              onChange={(e) => onFunnelNameChange(e.target.value)}
              placeholder="Defaults to form name on orders"
              className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 transition-colors"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-foreground mb-2">Sub-brand</label>
            <input
              type="text"
              value={subBrand}
              onChange={(e) => onSubBrandChange(e.target.value)}
              placeholder="Optional filter tag"
              className="w-full px-4 py-3 border-2 border-border rounded-lg text-sm focus:border-primary focus:ring-0 transition-colors"
            />
          </div>
        </div>

        <div className="flex items-center justify-between p-4 bg-muted rounded-lg border-2 border-border">
          <div>
            <div className="text-sm font-semibold text-foreground">Form Status</div>
            <p className="text-xs text-muted-foreground mt-1">
              {active ? "Form is live and accepting submissions" : "Form is disabled"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onActiveChange(!active)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
              active ? "bg-primary" : "bg-muted-foreground/40"
            }`}
            aria-label="Toggle form status"
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-card transition-transform ${
                active ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>

        <div className="p-4 border-2 border-border rounded-lg space-y-4">
          <div>
            <div className="text-sm font-semibold text-foreground">After Submit</div>
            <p className="text-xs text-muted-foreground mt-1">
              Thank-you message or redirect. Use {"{{field_name}}"} for field values.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="form-label text-xs">Confirmation type</label>
              <select
                value={schema.confirmation?.type ?? "message"}
                onChange={(e) =>
                  onSchemaChange({
                    confirmation: {
                      ...schema.confirmation,
                      type: e.target.value as "message" | "redirect",
                      message: schema.confirmation?.message ?? "Thank you for your order. We'll be in touch soon.",
                      redirectUrl: schema.confirmation?.redirectUrl ?? "",
                    },
                  }, null)
                }
                className="form-input text-sm"
              >
                <option value="message">Thank-you message</option>
                <option value="redirect">Redirect to URL</option>
              </select>
            </div>
            <div>
              {(schema.confirmation?.type ?? "message") === "redirect" ? (
                <>
                  <label className="form-label text-xs">Redirect URL</label>
                  <input
                    type="url"
                    value={schema.confirmation?.redirectUrl ?? ""}
                    onChange={(e) =>
                      onSchemaChange({
                        confirmation: {
                          type: "redirect",
                          redirectUrl: e.target.value,
                          message: schema.confirmation?.message,
                        },
                      }, "settings:confirmation.redirectUrl")
                    }
                    placeholder="https://example.com/thank-you?phone={{phone}}"
                    className="form-input text-sm"
                  />
                </>
              ) : (
                <>
                  <label className="form-label text-xs">Thank-you message</label>
                  <textarea
                    value={schema.confirmation?.message ?? "Thank you for your order. We'll be in touch soon."}
                    onChange={(e) =>
                      onSchemaChange({
                        confirmation: {
                          type: "message",
                          message: e.target.value,
                          redirectUrl: schema.confirmation?.redirectUrl,
                        },
                      }, "settings:confirmation.message")
                    }
                    rows={2}
                    className="form-input text-sm"
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <div className="section-header">
          <h2 className="section-title">Submit Button</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Button Text</label>
            <input
              type="text"
              value={schema.submitButton?.text || "Submit Order"}
              onChange={(e) =>
                onSchemaChange({
                  submitButton: { text: e.target.value, loadingText: schema.submitButton?.loadingText },
                }, "settings:submitButton.text")
              }
              placeholder="Submit Order"
              className="form-input"
            />
          </div>
          <div>
            <label className="form-label">Loading Text</label>
            <input
              type="text"
              value={schema.submitButton?.loadingText || ""}
              onChange={(e) =>
                onSchemaChange({
                  submitButton: { text: schema.submitButton?.text ?? "Submit Order", loadingText: e.target.value },
                }, "settings:submitButton.loadingText")
              }
              placeholder="Processing..."
              className="form-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
