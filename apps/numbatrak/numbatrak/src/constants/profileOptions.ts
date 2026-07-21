/** Curated IANA timezones for profile / org settings. */
export const TIMEZONE_OPTIONS = [
  { value: "Africa/Lagos", label: "West Africa (Lagos)" },
  { value: "Africa/Accra", label: "Ghana (Accra)" },
  { value: "Africa/Nairobi", label: "East Africa (Nairobi)" },
  { value: "Africa/Johannesburg", label: "South Africa (Johannesburg)" },
  { value: "Europe/London", label: "UK (London)" },
  { value: "Europe/Paris", label: "Central Europe (Paris)" },
  { value: "America/New_York", label: "US Eastern (New York)" },
  { value: "America/Los_Angeles", label: "US Pacific (Los Angeles)" },
  { value: "Asia/Dubai", label: "Gulf (Dubai)" },
  { value: "UTC", label: "UTC" },
] as const;

/** ISO 4217 codes supported for org currency display. */
export const CURRENCY_OPTIONS = [
  { value: "NGN", label: "Nigerian Naira (₦)" },
  { value: "USD", label: "US Dollar ($)" },
  { value: "GBP", label: "British Pound (£)" },
  { value: "EUR", label: "Euro (€)" },
  { value: "GHS", label: "Ghanaian Cedi (₵)" },
  { value: "KES", label: "Kenyan Shilling (KSh)" },
  { value: "ZAR", label: "South African Rand (R)" },
] as const;

export type SupportedCurrency = (typeof CURRENCY_OPTIONS)[number]["value"];

export const DEFAULT_TIMEZONE = "Africa/Lagos";
export const DEFAULT_CURRENCY: SupportedCurrency = "NGN";
