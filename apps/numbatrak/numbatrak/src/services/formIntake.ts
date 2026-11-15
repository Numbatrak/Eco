import { apiRequest, PUBLIC_API_BASE_URL } from "../lib/apiClient";

export type IntakeProvider = "fluent-forms" | "elementor";

export interface FormIntakeSettings {
  token: string;
  /** Field -> the names it's recognised by (mirrors FIELD_ALIASES in the API's payload.ts). */
  fieldAliases: Record<string, string[]>;
}

export interface SubmittedData {
  provider: string;
  receivedAt: string;
  fields: Record<string, string>;
}

/** Prefix on option values for website forms; the API reads the offer ID out of it. */
export const OFFER_VALUE_PREFIX = "off_";

export function intakeAddress(token: string, provider: IntakeProvider): string {
  return `${PUBLIC_API_BASE_URL}/public/numbatrak/intake/${token}/${provider}`;
}

export const formIntakeApi = {
  get: () => apiRequest<FormIntakeSettings>("/org/numbatrak/form-intake", { method: "GET" }),
  rotate: () => apiRequest<{ token: string }>("/org/numbatrak/form-intake/rotate", { method: "POST" }),
  submittedDetails: (orderId: string) =>
    apiRequest<{ submittedData: SubmittedData | null }>(`/org/numbatrak/orders/${orderId}/submitted-details`, {
      method: "GET",
    }),
};
