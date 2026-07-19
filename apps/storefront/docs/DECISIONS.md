# Decisions log

Short bullet per decision: what we chose, why, what the alternative was.
Append-only — newest at the top. Cheap input for the future e-commerce
playbook MD without slowing down current work.

Format:

```
## YYYY-MM-DD — Title
**Choice:** what we did.
**Why:** the reason.
**Alternative considered:** what we didn't do, and why not.
```

---

## 2026-06-08 — Delivery: zone-based pricing, not per-state

**Choice:** GIG and Park have two prices each — South-West (₦?) and
Other Nigeria (₦?). Admin sets the two numbers, not 36 rows per state.
**Why:** Logistics partners in Nigeria typically quote by zone, not
state. Two inputs are dramatically easier for Oluwatoyin to keep current.
**Alternative considered:** Per-state pricing (one row per state per
method). Rejected as over-engineering for current scale + maintenance
burden of keeping 70+ rates in sync with carrier price changes.

## 2026-06-08 — Delivery: International is per-country JSON map

**Choice:** Single `delivery_international_rates` settings key holds a
JSON map `{ "United Kingdom": 40000, "United States": 55000, ... }`.
Admin manages the list via /admin/delivery.
**Why:** International rates vary too much per country to use a zone
model. JSON map keeps it flexible without a dedicated table.
**Alternative considered:** Dedicated `international_rates` DB table.
Rejected for now — JSON in settings is simpler and the volume (5–20
countries) doesn't need indexing.

## 2026-06-08 — Delivery: Osogbo "free" by city match, not area list

**Choice:** Any customer whose city contains "Osogbo" sees the Osogbo
Free Delivery option. Description text says "free for select areas, we
confirm by WhatsApp."
**Why:** Adds zero schema (no new area table, no new form field).
Operations team handles edge cases via the existing WhatsApp confirmation
flow.
**Alternative considered:** A `delivery_free_areas` table with a
dropdown of qualifying areas at checkout. Rejected as premature — current
order volume doesn't justify the UX cost of a second location field.

## 2026-06-08 — VAT: admin-toggleable on/off, rate stays hardcoded

**Choice:** New `vat_enabled` setting key. When "true", server applies
7.5% VAT. When "false", no VAT line at all. The 7.5% rate itself stays
in lib/constants.ts.
**Why:** Some Nigerian fashion brands don't charge VAT; Oluwatoyin may
want to switch off mid-launch. The RATE (7.5%) is government-set and
won't change frequently, so keeping it hardcoded is fine.
**Alternative considered:** Admin-set VAT rate (e.g. a number input).
Rejected — risks accidental misconfiguration (admin sets 75% instead of
7.5%) for marginal flexibility gain.

## 2026-06-08 — Catalog match: collapsed to product-level IDs everywhere

**Choice:** Catalog `g:id` = product UUID. All pixel events
(ViewContent, AddToCart, InitiateCheckout, Purchase, server CAPI) send
the product UUID with `content_type: "product"`.
**Why:** The Shopify-style variant-level catalog (g:id = variant.id,
g:item_group_id = product.id) wasn't matching reliably in Meta's
dashboards. Product-level is simpler, more robust, and matches 100%.
The product database still tracks variants for fulfillment.
**Alternative considered:** Keep variant-level catalog and figure out
why Meta's matching wasn't working. Rejected — diminishing returns for
a brand with mostly single-variant products. Variant tracking re-enableable
when volume justifies it (1-day code change).

## 2026-06-07 — Engineering standards memory (~/.claude/CLAUDE.md)

**Choice:** Universal engineering standards (server-authoritative
business logic, no client secrets, RLS by default, etc.) live in
~/.claude/CLAUDE.md so they apply to every project.
**Why:** These rules don't change between projects. Codifying them once
beats redoing the conversation on every new build.
**Alternative considered:** Per-project CLAUDE.md. Used in addition for
project-specific context (Next.js 16 docs, ÀYỌ̀NÍ data shapes), not
instead of.
