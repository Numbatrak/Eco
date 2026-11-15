import { apiRequest, PUBLIC_API_BASE_URL } from "../lib/apiClient";

export type IntakeProvider = "fluent-forms" | "elementor";

/** A form on the business's website, connected through Form Integrations. In NumbaTrak it's a funnel. */
export interface ExternalForm {
  id: string;
  name: string;
  provider: IntakeProvider;
  createdAt: string | null;
}

export interface FormIntakeSettings {
  token: string;
  forms: ExternalForm[];
  /** Field -> the names it's recognised by (mirrors FIELD_ALIASES in the API's payload.ts). */
  fieldAliases: Record<string, string[]>;
}

export interface RecentSubmission {
  kind: "order" | "abandoned_cart";
  id: string;
  formId: string | null;
  customerName: string | null;
  packageName: string | null;
  provider: string | null;
  receivedAt: string | null;
}

export interface SubmittedData {
  provider: string;
  receivedAt: string;
  fields: Record<string, string>;
}

/** Prefix on option values for website forms; the API reads the offer ID out of it. */
export const OFFER_VALUE_PREFIX = "off_";

/** The webhook address for one website form. Every address names its form; there is no shared one. */
export function intakeAddress(token: string, formId: string): string {
  return `${PUBLIC_API_BASE_URL}/public/numbatrak/intake/${token}/${formId}`;
}

export const formIntakeApi = {
  get: () => apiRequest<FormIntakeSettings>("/org/numbatrak/form-intake", { method: "GET" }),
  createForm: (name: string, provider: IntakeProvider) =>
    apiRequest<{ form: ExternalForm }>("/org/numbatrak/form-intake/forms", { method: "POST", body: { name, provider } }),
  recent: (formId?: string | null) =>
    apiRequest<{ submissions: RecentSubmission[] }>(
      `/org/numbatrak/form-intake/recent${formId ? `?formId=${encodeURIComponent(formId)}` : ""}`,
      { method: "GET" },
    ),
  rotate: () => apiRequest<{ token: string }>("/org/numbatrak/form-intake/rotate", { method: "POST" }),
  submittedDetails: (orderId: string) =>
    apiRequest<{ submittedData: SubmittedData | null }>(`/org/numbatrak/orders/${orderId}/submitted-details`, {
      method: "GET",
    }),
};
