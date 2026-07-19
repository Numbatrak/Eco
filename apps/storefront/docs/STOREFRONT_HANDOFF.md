# Storefront feature handoff — for Numbatrak

> A developer-facing brief to add a fully-featured e-commerce storefront
> to Numbatrak. Reference build: **ÀYỌ̀NÍ** (https://ayoni.ng) — a
> Nigerian fashion store with admin panel, customer storefront,
> analytics, attribution, catalog feed, delivery configuration, and
> WhatsApp-based order confirmation. Source: this repo.
>
> Read time: ~30 min. Build time (full feature parity, single tenant):
> ~3-4 weeks for a competent full-stack dev. Multi-tenant adaptation:
> add 1-2 weeks.

---

## 1. Executive summary

**What ÀYỌ̀NÍ is:** A direct-to-consumer fashion store. Customers browse,
add to cart, check out, get a WhatsApp confirmation from the operator,
pay (off-platform — bank transfer / cash on delivery), receive their order.
The store owner manages everything through an admin panel: products,
collections, orders, dashboard, delivery rates, ad-platform credentials.

**What we want for Numbatrak:** This entire storefront as a feature that
each Numbatrak tenant can enable. Each tenant gets their own:
- Storefront on a custom domain or `tenant.numbatrak.com`
- Product catalog
- Order pipeline (with their own email + delivery + analytics config)
- Admin panel (or integration into the existing Numbatrak admin)
- Brand identity (logo, colors, fonts)

**This doc tells the developer:** what to build (feature inventory),
what architecture pattern to follow, what to be careful of, and how to
make it multi-tenant safe.

---

## 2. Feature inventory

These are all working in the reference build. Pick the subset that fits
your Numbatrak launch scope; the rest can come in v2.

### Storefront (customer-facing)

| Feature | What it does | File reference |
|---|---|---|
| Homepage | Hero, featured collections, brand promises | `app/(store)/page.tsx` |
| Collection page | Filtered/sorted product grid for a category | `app/(store)/collections/[slug]/page.tsx` |
| Product detail page | Gallery, variant selector, description, related products | `app/(store)/products/[slug]/page.tsx` |
| Cart | localStorage-based, persists across sessions, no account needed | `lib/cart.ts`, `components/store/CartIcon.tsx` |
| Wishlist | localStorage-based | `lib/wishlist.ts` |
| Checkout | Multi-section form with dynamic delivery method picker | `components/store/CheckoutClient.tsx` |
| Order confirmation | Shows order number + prefilled WhatsApp link to operator | `components/store/OrderConfirmationClient.tsx` |
| Search | Postgres ILIKE on title + description | `app/(store)/search/page.tsx` |
| Static pages | About, Contact, FAQ, Shipping, Returns, Size guide | `app/(store)/<page>/page.tsx` |
| Floating WhatsApp button | Click-to-chat anywhere on the site | `components/store/FloatingWhatsApp.tsx` |
| Mobile responsive | All pages work on phone | throughout |
| 404 + brand identity | Custom 404 + favicon + OG tags | `app/not-found.tsx`, `app/icon.png` |

### Admin panel

| Feature | What it does | File reference |
|---|---|---|
| Login + auth gate | Email/password via Supabase Auth | `app/admin/login/page.tsx`, `proxy.ts` |
| Dashboard | Date-filterable metric tiles: orders, revenue, products, customers, top performers, 30-day sparkline | `app/admin/(authed)/page.tsx`, `lib/dashboard/queries.ts` |
| Collections CRUD | Create/edit/delete categories with hero image | `app/admin/(authed)/collections/` |
| Products CRUD | Full product editor with variants (size/color), images, videos | `app/admin/(authed)/products/` |
| Orders list + detail | Filter by status + source, search by name/phone, drill into order | `app/admin/(authed)/orders/` |
| Order status workflow | pending → confirmed → shipped → delivered, → cancelled | `components/admin/OrderStatusActions.tsx` |
| Order delete | Soft-cleans associated customer if no other orders | `app/admin/(authed)/orders/actions.ts` |
| Settings page | Ad-platform credential management (Meta, TikTok, GA4, Snap, X, Pinterest) | `app/admin/(authed)/settings/` |
| Delivery configuration | Per-method toggles + zone-based rates + VAT toggle | `app/admin/(authed)/delivery/` |
| Image uploads | Direct-to-Supabase Storage, drag-to-reorder, delete-and-replace | `components/admin/MediaUploader.tsx` |

### Analytics + attribution

| Feature | What it does | File reference |
|---|---|---|
| Browser pixels | Meta, TikTok, GA4, Snap, X, Pinterest — all configured via admin settings | `components/analytics/AnalyticsScripts.tsx` |
| PageView SPA tracking | Re-fires on every client-side navigation | `components/analytics/PageViewTracker.tsx` |
| Per-page events | ViewContent (product), ViewCategory (collection), Search, AddToCart, InitiateCheckout, Purchase | `lib/analytics/pixel-events.ts` + various components |
| Server-side CAPI | Meta Conversions API for Purchase with hashed PII | `lib/analytics/meta-capi.ts`, dispatched from `/api/orders` |
| UTM capture | Sticky-first on landing, persisted with order | `lib/attribution.ts`, `components/analytics/AttributionCapture.tsx` |
| Click ID capture | fbclid, ttclid, gclid saved with order, synthesized as Meta cookies if needed | same |
| Product catalog feed | XML at `/api/catalog.xml`, Google Merchant spec, product-level IDs | `app/api/catalog.xml/route.ts` |

### Order pipeline

| Feature | What it does | File reference |
|---|---|---|
| Order creation | Server-authoritative pricing, stock revalidation, atomic insert | `app/api/orders/route.ts` |
| Dual emails | Customer confirmation + business notification | `lib/email/templates.ts`, `lib/email/send.ts` |
| Customer upsert | Find or create by phone, increment order_count + total_spent | within `/api/orders` |
| Delivery quote endpoint | Returns available methods + prices for a customer's location | `app/api/delivery-quote/route.ts` |
| Contact form endpoint | Saves to DB + sends to business email | `app/api/contact/route.ts` |

---

## 3. Reference stack (substitute as needed)

The reference build uses:

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 16 (App Router) | Server Components remove huge categories of bugs |
| DB + Auth + Storage | Supabase | One vendor, Postgres with RLS, S3-compatible storage |
| Styling | Tailwind 4 | `@theme` tokens, fast iteration |
| Email | Resend | Generous free tier, easy DKIM setup |
| Deployment | Vercel | Best Next.js support |
| Analytics | Custom Meta Pixel + CAPI | Full control, no SaaS bill |

**Use what Numbatrak already uses.** The architectural patterns below are
framework-agnostic. Pick equivalents from your stack:

- Replace Supabase with Postgres + Auth.js / Clerk + S3
- Replace Next.js with Remix / Rails / Django — anything that supports
  server-side rendering and an admin/CRUD pattern
- Replace Tailwind with whatever Numbatrak uses
- Replace Resend with Postmark / SES / SendGrid

The key is the **patterns**, not the specific tools.

---

## 4. Data model

These are the core tables. Adapt names to Numbatrak's conventions.

### `collections` (a.k.a. categories)
```
id            uuid PK
name          text
slug          text unique per tenant
description   text nullable
image_url     text nullable
sort_order    int default 0
is_active     bool default true
tenant_id     uuid (for multi-tenant)  ← see §8
created_at    timestamptz
updated_at    timestamptz
```

### `products`
```
id                 uuid PK
collection_id      uuid FK
slug               text unique per tenant
title              text
description        text
price              numeric(10,2)
compare_price      numeric(10,2) nullable  (for sale display)
images             text[]   (array of public URLs)
videos             text[]   nullable
sizes              text[]   (catalog of available sizes)
colors             text[]
fabric_details     text nullable
care_instructions  text nullable
is_active          bool default true
tenant_id          uuid
created_at, updated_at
```

### `product_variants`
```
id           uuid PK
product_id   uuid FK
size         text
color        text
stock_count  int default 0
is_available bool default true
unique (product_id, size, color)
```

### `orders`
```
id                uuid PK
order_number      text unique per tenant (e.g. "AYO-20260530-X4F2A")
status            enum: pending | confirmed | shipped | delivered | cancelled
subtotal          numeric(10,2)
delivery_fee      numeric(10,2)
vat_rate          numeric(5,4)
vat_amount        numeric(10,2)
total             numeric(10,2)
customer_name     text
customer_email    text nullable
customer_phone    text
customer_whatsapp text
delivery_address  text
delivery_state    text
delivery_city     text nullable
delivery_notes    text nullable
delivery_method   text  (slug: pickup, gig, park, international, etc.)
delivery_country  text nullable  (for international)
is_pickup         bool
pickup_location   text nullable
-- Attribution (optional but useful for paid ads)
utm_source        text nullable
utm_medium        text nullable
utm_campaign      text nullable
utm_term          text nullable
utm_content       text nullable
referrer          text nullable
landing_path      text nullable
fbclid            text nullable
ttclid            text nullable
gclid             text nullable
tenant_id         uuid
created_at, updated_at
```

### `order_items`
```
id            uuid PK
order_id      uuid FK
product_id    uuid FK
variant_id    uuid FK
product_title text  (denormalized so deletion doesn't break order history)
variant_label text  (e.g., "M / Lilac")
quantity      int
unit_price    numeric(10,2)
line_total    numeric(10,2)
created_at
```

### `customers`
```
id          uuid PK
name        text
email       text nullable
phone       text unique per tenant
whatsapp    text
address     text nullable
state       text nullable
city        text nullable
order_count int default 0
total_spent numeric(12,2) default 0
tenant_id   uuid
created_at, updated_at
```

### `site_settings` (key/value config per tenant)
```
key         text
value       text nullable
is_secret   bool
tenant_id   uuid
PRIMARY KEY (key, tenant_id)
created_at, updated_at
```

Used for: ad-platform credentials (`meta_pixel_id`,
`meta_capi_token`, etc.), delivery configuration
(`delivery_gig_southwest_price`, `delivery_international_rates` as JSON),
VAT toggle (`vat_enabled`), and any tenant-tunable knob.

### `contact_messages`
```
id, name, email, phone, subject, message, status, tenant_id,
created_at, replied_at
```

---

## 5. API surface

These are the endpoints to recreate. They're all server-side.

### `POST /api/orders`
Creates a new order from a customer's checkout submission. Server-authoritative.

**Request body:**
```json
{
  "customer": {
    "firstName": "string",
    "lastName": "string",
    "email": "string?",
    "phone": "string",
    "whatsapp": "string",
    "deliveryAddress": "string?",
    "state": "string?",
    "city": "string?",
    "notes": "string?"
  },
  "isPickup": "bool",
  "deliveryMethod": "pickup | gig | park | international | osogbo_free",
  "country": "string? (for international)",
  "items": [
    { "productId": "uuid", "variantId": "uuid", "quantity": "int" }
  ],
  "attribution": {
    "utmSource": "string?", "utmCampaign": "string?",
    "fbclid": "string?", "ttclid": "string?", "gclid": "string?"
  }
}
```

**Server actions (in this exact order):**
1. Validate customer (required fields, normalize phone)
2. Validate delivery method + collect address
3. De-dupe items by variantId, sum quantities
4. Fetch authoritative products + variants from DB (NEVER trust the
   client's prices)
5. Validate every variant is buyable + has stock
6. Compute subtotal from authoritative prices
7. Call `validateAndPriceOrder()` (see `lib/delivery/quote.ts`) to get
   delivery fee + VAT + total
8. Generate `order_number` (e.g. "AYO-YYYYMMDD-XXXXX"); retry on
   unique-violation
9. Insert order row
10. Insert order_items rows (compensating delete on failure)
11. Upsert customer by phone (increment order_count + total_spent)
12. Send dual transactional emails (best-effort — failures logged, not
    fatal)
13. Dispatch server-side CAPI Purchase event with hashed PII (also
    best-effort)
14. Return `{ orderNumber, whatsappLink, customerName, total, isPickup }`

**Response:**
```json
{
  "orderNumber": "AYO-20260530-X4F2A",
  "whatsappLink": "https://wa.me/...?text=...",
  "customerName": "Bisi Olawale",
  "total": 27500.00,
  "isPickup": false
}
```

### `POST /api/delivery-quote`
Returns the delivery methods + prices available for a given location.
Called by the checkout client to power the dynamic method picker.

**Request:** `{ state, city, country, subtotal }`

**Response:**
```json
{
  "options": [
    {
      "slug": "gig",
      "name": "GIG Logistics",
      "description": "Door-to-door...",
      "price": 4500,
      "isFree": false
    },
    { "slug": "pickup", "name": "Pickup at Ota Efun", "price": 0, "isFree": true, ... }
  ],
  "qualifiesForFreeShipping": false,
  "isInternational": false,
  "vat": { "enabled": true, "rate": 0.075 }
}
```

### `GET /api/catalog.xml`
Public product catalog feed in Google Merchant XML format. Meta /
TikTok / Google ingest this. One `<item>` per product (NOT per variant
— see Pattern 7 in PLAYBOOK.md).

### `POST /api/contact`
Contact form submission. Inserts into `contact_messages`, sends to
business email.

---

## 6. UI surface

### Customer-facing pages

| Route | Purpose | Key components |
|---|---|---|
| `/` | Homepage with hero + featured collections | `Hero`, `FeaturedCollections` |
| `/collections` | All collections grid | `CollectionCard` |
| `/collections/[slug]` | Single collection with product grid + filters | `ProductCard`, `CollectionFilters` |
| `/products/[slug]` | Product detail | `ProductGallery`, `ProductOptions`, `ProductAccordion`, `RelatedProducts`, `WishlistButton` |
| `/cart` | Cart review | (mostly inline in CartClient) |
| `/checkout` | Form + dynamic delivery picker + summary | `CheckoutClient` |
| `/order-confirmation` | Post-submit thank-you + WhatsApp CTA | `OrderConfirmationClient` |
| `/search` | Search results | `ProductCard`, `RecentSearches` |
| `/wishlist` | Local wishlist | `WishlistClient` |
| `/about`, `/contact`, `/faq`, `/shipping`, `/returns`, `/size-guide` | Static brand pages | `PageHero` |

### Admin pages

| Route | Purpose |
|---|---|
| `/admin/login` | Login form |
| `/admin` | Dashboard |
| `/admin/collections` | Collections list |
| `/admin/collections/new`, `/admin/collections/[id]` | Collection create / edit |
| `/admin/products` | Products list |
| `/admin/products/new`, `/admin/products/[id]` | Product create / edit |
| `/admin/orders` | Orders list with filters |
| `/admin/orders/[id]` | Order detail + status workflow + attribution + delete |
| `/admin/delivery` | Delivery + VAT configuration |
| `/admin/settings` | Ad-platform credentials |

### Reusable shared components

- `MetricCard` — admin dashboard stats
- `OrderStatusBadge` — colored pill
- `MediaUploader` / `ImageUploader` — drag-to-reorder + delete-and-replace
- `DeleteButton` — confirm + execute
- `DateRangeFilter` — URL-driven preset chips
- `WhatsAppFloatingButton`
- `Logo` (theme-aware)

---

## 7. Integration touchpoints

These are the third-party services the storefront depends on. Each
needs setup before launch.

| Service | Purpose | Setup |
|---|---|---|
| **Supabase (or equivalent)** | DB, Auth, Storage | Create project, run migrations, create admin user, configure storage buckets with admin-only write policies |
| **Resend (or equivalent)** | Transactional email | Verify domain (DKIM/SPF/DMARC), set sender as `orders@tenant-domain.com` |
| **Meta Business Suite** | Pixel + CAPI | Generate Pixel ID + CAPI Access Token, paste in `/admin/settings` |
| **Meta Commerce Manager** | Product catalog | Add catalog with feed URL = tenant's `https://.../api/catalog.xml` |
| **TikTok / GA4 / Snap / X / Pinterest** | Optional additional pixels | Same pattern — paste credentials in `/admin/settings` |
| **WhatsApp Business (or personal)** | Customer support | Just need a phone number in `NEXT_PUBLIC_WHATSAPP_NUMBER` env |
| **Payment processor** | NOT in this build (WhatsApp-confirm-then-pay) | Add Paystack / Stripe later when business model evolves |

---

## 8. Multi-tenant adaptation

The reference build is single-tenant (one shop = one Vercel deployment).
For Numbatrak, you need **isolation between tenants' data + theming.**

### Approach A: Schema-per-tenant (cleanest, more overhead)

Each tenant gets their own Postgres schema. The app routes requests
based on subdomain → schema. Pros: strict isolation, easy backups per
tenant. Cons: schema migrations multiply, harder for cross-tenant
admin queries.

### Approach B: Row-level tenant_id (simplest, most common)

Every table gets a `tenant_id` column. Every query is automatically
scoped by tenant via RLS or middleware. Pros: one schema to migrate,
cross-tenant analytics easy. Cons: a bug in tenant scoping = data leak
(but RLS makes this very hard).

**Recommended: Approach B with RLS enforcement.**

### Tenant resolution

The storefront's tenant is determined by:
1. Custom domain → DB lookup `domains` table → `tenant_id`
2. Subdomain `<tenant>.numbatrak.com` → parse → lookup → `tenant_id`

Middleware sets the resolved `tenant_id` in a request-scoped context,
and every DB query reads it.

### Per-tenant config

Each tenant has their own row in a `tenants` table with:
```
id, name, slug, custom_domain?, brand_colors (jsonb),
logo_url, font_family, currency, timezone, country, locale,
created_at, plan_tier, is_active
```

And their own rows in `site_settings` (already keyed by tenant_id).

### Theming

Reference build hardcodes Tailwind tokens in `app/globals.css`. For
multi-tenant, you'd need:
- Default theme baked in
- Tenant theme JSON read on every render
- CSS variables emitted at the root based on tenant's brand colors
- Logo image swapped from tenant.logo_url

### Custom domains

Vercel supports custom domains per-tenant via wildcards or per-domain
setup. Numbatrak would expose a UI for tenants to add their own domain
and provide DNS instructions.

### Tenant-scoped Storage

Supabase Storage with a bucket per tenant, OR a single bucket with
path-prefixed paths like `tenants/<tenant_id>/products/...`. The latter
is simpler; the former is stricter.

---

## 9. Suggested build phases (for Numbatrak)

In order. Each phase is independently deployable.

| Phase | What | Why first |
|---|---|---|
| **1. Multi-tenancy foundation** | Tenant table, RLS, tenant resolution middleware | Everything downstream depends on this |
| **2. Admin authentication** | Login per tenant, role-based access | Without it, no one can set up their shop |
| **3. Collections + Products CRUD** | Catalog management | Tenant can't sell what they can't list |
| **4. Storefront pages** | Homepage, collection, product detail | The viewable side |
| **5. Cart + Checkout + Orders** | Order pipeline + dual emails | The selling side. Server-authoritative pricing critical here. |
| **6. Order workflow + Admin orders pages** | Operator can manage incoming orders | Closes the loop |
| **7. Delivery configuration** | Admin-controllable rates + VAT | Decouples business config from code |
| **8. Settings page (ad platform credentials)** | Multi-platform analytics scaffolding | Required for ad-driven tenants |
| **9. Pixel events + CAPI** | Browser + server-side analytics | The reason a tenant runs ads at all |
| **10. Catalog feed** | Public XML feed per tenant | Unlocks DPA / Catalog Sales |
| **11. UTM + attribution capture** | Saved with orders, shown in admin | Tenants can measure ROAS |
| **12. Dashboard with metrics** | Tenant operating console | Day-to-day usage |
| **13. Static pages + 404 + branding** | About / Contact / FAQ / etc. | Trust signals |
| **14. Pre-launch hardening** | Rate limits, bot defenses, backups | Before paid traffic |

Approximate timeline for one competent full-stack developer:
- Phase 1–6 (storefront + orders): 2 weeks
- Phase 7–11 (delivery + analytics + catalog + attribution): 1.5 weeks
- Phase 12–14 (dashboard + static pages + hardening): 0.5 week
- **Total**: ~4 weeks for v1 feature parity

Then 1–2 more weeks for Numbatrak-specific multi-tenant polish and
admin UX integration.

---

## 10. Non-negotiable patterns (read before coding)

These are the patterns that, if violated, cause real damage. The
PLAYBOOK.md doc explains the why; the rule is here.

1. **Server-authoritative pricing.** The browser computes a preview;
   the server recomputes from DB. NEVER save what the client sends.
2. **RLS enabled on every table from day 1.** No "we'll add it later."
3. **Multi-platform analytics scaffolded from day 1.** Even if only
   Meta is needed at launch, prepare the others.
4. **UTM capture on first landing, sticky per session.** Don't overwrite
   on subsequent navigations.
5. **Product-level catalog IDs** (not variant-level). Matches better
   across all ad platforms.
6. **Rate limit `/api/orders` and `/api/contact` before paid traffic.**
   ~5 submissions / IP / hour minimum.
7. **Transactional and marketing email through separate providers.**
   Don't blast marketing through Resend.
8. **WhatsApp deep links everywhere they help.** Every prefilled link
   saves the operator typing.
9. **Storage bucket writes require auth, reads can be public.** A
   customer can SEE product images; only admins should UPLOAD them.
10. **All `NEXT_PUBLIC_*` (or framework equivalent) env vars hold ONLY
    intentionally public values.** Service-role keys, API tokens, and
    PII access stay server-side.

---

## 11. Pre-launch checklist (for the developer)

Before flipping the storefront on for any tenant in production:

- [ ] Tenant data isolation tested (Tenant A cannot read Tenant B's
      orders / customers / products)
- [ ] RLS enabled on every table; deny-by-default
- [ ] Service-role key + email API key never imported by client code
      (verify by grep)
- [ ] All public env vars contain only public values
- [ ] Custom domain or subdomain works end-to-end
- [ ] DKIM + SPF + DMARC verified for tenant's sender email
- [ ] Storage bucket write policies require auth
- [ ] Rate limits on `/api/orders` and `/api/contact`
- [ ] Honeypot field on contact form
- [ ] Test order end-to-end on the live URL
- [ ] Pricing manipulation test (browser sends ₦1 for ₦30k item →
      server rejects with correct ₦30k)
- [ ] Catalog feed serves at `/api/catalog.xml` with HTTP 200
- [ ] Meta Test Events tab shows browser + server Purchase events with
      "Deduplicated" badge
- [ ] Mobile checkout tested on a real phone
- [ ] All customer-facing emails arrive (check spam folder too)
- [ ] Lighthouse score ≥ 80 on mobile

---

## 12. Open questions for Numbatrak product/engineering

These are decisions that the reference build made for ÀYỌ̀NÍ
specifically. For Numbatrak, you'll need to decide:

1. **Multi-tenant strategy:** schema-per-tenant vs row-level tenant_id?
   (Recommendation: row-level + RLS.)
2. **Domain routing:** custom domains per tenant, subdomain
   (`tenant.numbatrak.com`), or path prefix (`/shops/tenant`)?
3. **Branding:** how much theming does each tenant get? Just colors +
   logo, or full layout customization?
4. **Payments at launch:** Stay WhatsApp-confirm model, or require
   Paystack/Stripe integration before launch?
5. **Currency support:** NGN-only or multi-currency? International
   delivery implies multi-currency.
6. **Tax model:** Each tenant configures their own VAT rate, or is it
   country-driven by their business location?
7. **Customer accounts:** Does Numbatrak's customer-facing surface need
   accounts (so customers can see order history)? The reference build
   skipped accounts.
8. **Order assignment:** Is one tenant = one shop owner, or can a shop
   have multiple admins (operations team)?
9. **Notification channel:** WhatsApp at launch, or also SMS + push
   notifications?
10. **Tenant onboarding flow:** Self-serve sign-up + automated tenant
    provisioning, or sales-assisted setup?

Answers to these shape the build. Don't start until they're decided.

---

## 13. What this doc doesn't cover

- The actual UI design (use the reference build's design system as a
  starting point — `app/globals.css` has the design tokens)
- Specific framework choices (covered in PLAYBOOK.md alternatives)
- Code-level patterns for the framework you pick (read the reference
  code; it's well-commented)
- Numbatrak-specific business rules (e.g., what each tenant pays for the
  feature) — that's product, not engineering

---

## 14. Where to get help

- **Reference codebase:** this repo. Every important pattern has a code
  comment explaining the why, not just the what.
- **`docs/PLAYBOOK.md`:** the philosophy behind the patterns.
- **`docs/DECISIONS.md`:** specific decisions made during the build,
  with alternatives considered.
- **`~/.claude/CLAUDE.md`:** universal engineering standards (Claude
  AI's standing instructions).

Good luck. Build it well.
