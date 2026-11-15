/**
 * Turns whatever a website form plugin posts (Fluent Forms, Elementor,
 * WPForms, a hand-rolled fetch...) into something NumbaTrak can read without
 * the business mapping fields one by one: the body is flattened into
 * "label -> value" pairs, then each field we care about is picked out by
 * its usual names (case, spaces, dashes and underscores ignored).
 */

const MAX_FIELDS = 200;
const MAX_VALUE_LENGTH = 2000;

/**
 * Rebuilds an x-www-form-urlencoded body (Elementor's and Fluent Forms'
 * "form data" webhooks) into nested objects, so `fields[name][value]=Ada`
 * reads the same as the JSON `{ fields: { name: { value: "Ada" } } }`.
 */
export function parseUrlEncodedBody(raw: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of new URLSearchParams(raw)) {
    const path = key.replace(/\]/g, "").split("[").filter((p) => p !== "");
    if (path.length === 0) continue;
    let node = out;
    for (let i = 0; i < path.length - 1; i++) {
      const seg = path[i]!;
      const next = node[seg];
      if (typeof next !== "object" || next === null) node[seg] = {};
      node = node[seg] as Record<string, unknown>;
    }
    const last = path[path.length - 1]!;
    const existing = node[last];
    // Repeated keys (checkbox groups) keep every value.
    node[last] = existing === undefined ? value : `${String(existing)}, ${value}`;
  }
  return out;
}

function scalarText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return text === "" ? null : text.slice(0, MAX_VALUE_LENGTH);
  }
  if (Array.isArray(value) && value.every((v) => typeof v !== "object" || v === null)) {
    const text = value.map((v) => String(v ?? "").trim()).filter(Boolean).join(", ");
    return text === "" ? null : text.slice(0, MAX_VALUE_LENGTH);
  }
  return null;
}

/**
 * Flattens a submission body into readable "field -> value" pairs, keeping
 * the order the plugin sent them in.
 *
 * Elementor's webhook wraps each field as `fields.<id>.{id,title,value}`;
 * those are unwrapped to `<title or id> -> value` so the stored copy reads
 * like the form the customer filled in. Everything else nests with dots
 * (Fluent Forms' name field arrives as `names.first_name`).
 */
export function flattenSubmission(body: unknown): Record<string, string> {
  const flat: Record<string, string> = {};
  const put = (key: string, value: string) => {
    if (Object.keys(flat).length >= MAX_FIELDS && !(key in flat)) return;
    flat[key] = value;
  };

  const walk = (node: unknown, prefix: string) => {
    const text = scalarText(node);
    if (text !== null) {
      if (prefix) put(prefix, text);
      return;
    }
    if (typeof node !== "object" || node === null) return;
    for (const [key, child] of Object.entries(node as Record<string, unknown>)) {
      walk(child, prefix ? `${prefix}.${key}` : key);
    }
  };

  const root = body as Record<string, unknown> | null;
  const elementorFields = root && typeof root === "object" ? root.fields : undefined;
  if (elementorFields && typeof elementorFields === "object" && !Array.isArray(elementorFields)) {
    for (const [key, field] of Object.entries(elementorFields as Record<string, unknown>)) {
      if (field && typeof field === "object" && ("value" in field || "raw_value" in field)) {
        const f = field as { id?: unknown; title?: unknown; value?: unknown; raw_value?: unknown };
        const text = scalarText(f.value) ?? scalarText(f.raw_value);
        const label = scalarText(f.title) ?? scalarText(f.id) ?? key;
        if (text !== null) put(label, text);
        // Keep the id reachable too when the title differs (e.g. title "Your
        // name", id "name") - detection below tries both.
        const id = scalarText(f.id) ?? key;
        if (text !== null && id !== label) put(`fields.${id}`, text);
      } else {
        walk(field, `fields.${key}`);
      }
    }
    for (const [key, child] of Object.entries(root as Record<string, unknown>)) {
      if (key !== "fields") walk(child, key);
    }
    return flat;
  }

  walk(body, "");
  return flat;
}

export type DetectedFieldKey =
  | "name"
  | "firstName"
  | "lastName"
  | "phone"
  | "whatsapp"
  | "email"
  | "address"
  | "state"
  | "country"
  | "package"
  | "quantity"
  | "amount"
  | "notes"
  | "trackingLinkCode";

/** The names each field is recognised by; shown to the business on the Form integrations page. */
export const FIELD_ALIASES: Record<DetectedFieldKey, string[]> = {
  name: ["name", "full_name", "fullname", "customer_name", "your_name"],
  firstName: ["first_name", "firstname", "first"],
  lastName: ["last_name", "lastname", "surname", "last"],
  phone: ["phone", "phone_number", "mobile", "tel", "telephone", "customer_phone"],
  whatsapp: ["whatsapp", "whatsapp_number", "wa"],
  email: ["email", "email_address", "e_mail"],
  address: ["address", "delivery_address", "street", "address_line_1", "full_address"],
  state: ["state", "region", "province", "location"],
  country: ["country"],
  package: ["package", "offer", "product", "variant", "option", "package_choice", "select_package"],
  quantity: ["quantity", "qty"],
  amount: ["amount", "price", "total"],
  notes: ["notes", "note", "message", "comment", "comments"],
  trackingLinkCode: ["tl", "tracking_link", "tracking_code", "tracking_link_code"],
};

const normalize = (key: string) => key.toLowerCase().replace(/[\s_\-]/g, "");

const ALIAS_LOOKUP: Map<string, DetectedFieldKey> = (() => {
  const map = new Map<string, DetectedFieldKey>();
  for (const [field, aliases] of Object.entries(FIELD_ALIASES) as Array<[DetectedFieldKey, string[]]>) {
    for (const alias of aliases) map.set(normalize(alias), field);
  }
  return map;
})();

/**
 * Picks the known fields out of a flattened submission. A key matches on its
 * whole name or its last dotted part (`names.first_name` -> first name). The
 * first key that matches wins, so a top-level `name` beats a nested one.
 */
export function detectFields(flat: Record<string, string>): Partial<Record<DetectedFieldKey, string>> {
  const found: Partial<Record<DetectedFieldKey, string>> = {};
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split(".");
    const candidates = [normalize(key), normalize(parts[parts.length - 1]!)];
    for (const candidate of candidates) {
      const field = ALIAS_LOOKUP.get(candidate);
      if (field && found[field] === undefined) {
        found[field] = value;
        break;
      }
    }
  }
  return found;
}

const UUID_PATTERN = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/**
 * Pulls a NumbaTrak offer ID out of a package answer. The option values we
 * hand out look like `off_<uuid>`, but a plugin may send the label alongside
 * it ("Buy 2 Get 2 Free | off_<uuid>"), so any UUID inside the text counts.
 */
export function extractOfferId(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.match(UUID_PATTERN)?.[0]?.toLowerCase() ?? null;
}

/** Prefix on the option values handed out for website forms. */
export const OFFER_VALUE_PREFIX = "off_";

export interface SubmittedData {
  provider: string;
  receivedAt: string;
  fields: Record<string, string>;
}

export function buildSubmittedData(provider: string, flat: Record<string, string>): SubmittedData {
  return { provider, receivedAt: new Date().toISOString(), fields: flat };
}
