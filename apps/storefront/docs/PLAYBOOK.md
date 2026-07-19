# E-commerce Build Playbook

> Captured from building ÀYỌ̀NÍ — a Nigerian fashion storefront, ~10
> products, COD-via-WhatsApp model, Meta-ads-driven. Stack-agnostic
> principles; specific tools mentioned as examples. Adapt to your stack,
> append your own learnings.

## How to use this doc

1. Read the **Phases** section end-to-end before writing code. Trying to
   reorder phases mid-build is the most common reason for rework.
2. The **Stack picks** are recommendations with the *why* — substitute
   freely if your context differs (different country, different scale,
   different team skills).
3. The **Patterns that mattered** section is the hard-earned part. Read
   it slowly. Most of these are non-obvious until you've shipped at
   least one e-commerce build.
4. At launch, walk through the **Pre-launch checklist** literally — a
   single missed item (no rate limit, no bot defense, wrong env in
   Vercel) can mean a 1am incident in week 2.

---

## Phase 0: Before any code

**Spend a day on this. Skipping these answers means rework later.**

### Business questions to answer

| Question | Why it matters |
|---|---|
| **Payment model**: full online, cash on delivery, deposit + balance, WhatsApp-confirm-then-pay? | Drives the entire checkout architecture. WhatsApp models can skip Stripe; online-pay needs it from day 1. |
| **Delivery zones + carriers** | Determines fee model (zone-based vs per-state vs per-weight). For Nigeria: 2 zones (SW + Other) usually suffices. |
| **VAT/tax requirements** | Server-side calculation, line-item display, admin-toggleability. Don't forget compliance reporting if applicable. |
| **Marketing channels day 1** | Meta? TikTok? Influencer? Each needs different tracking (Pixel + CAPI, TikTok Events API, gifted-link UTMs). |
| **Customer support channel** | WhatsApp click-to-chat is industry default for SMB. Email-only is faster to build but slower to convert. |
| **Brand identity locked** | Palette, fonts, voice, photography style. Choosing mid-build means redoing components. |
| **Inventory model** | Variants per product (size/color)? SKU per combo? One-of-a-kind pieces? Drives schema + admin UX. |
| **International orders?** | Adds country selector + currency conversion + customs. If "maybe later," still leave hooks. |
| **Returns policy** | Even "no returns" needs to be communicated. T&Cs page is mandatory. |

### Stack picks — the defaults that work

These are not the only options. They're a starting point that's worked
once. Choose based on team skill + budget + scale needs.

| Layer | Default pick | Why | Alternative when |
|---|---|---|---|
| Framework | Next.js (App Router) | Server Components + Server Actions remove huge categories of bugs. Vercel hosting is one-click. | Astro for content-heavy. Remix for similar shape, less ecosystem. SvelteKit for smaller bundle. |
| Database + Auth + Storage | Supabase | Postgres with RLS gives "browser-to-DB-safely" out of the box. One vendor for DB + auth + file storage. | Neon + Clerk + Cloudinary if you want best-of-breed per layer. Firebase if NoSQL fits (rare for e-commerce). |
| Styling | Tailwind 4 | CSS-first `@theme` tokens, automatic tree-shaking, fastest UI iteration. | Panda CSS if you want zero-runtime CSS-in-JS. Plain CSS if a designer co-owns the repo. |
| Hosting | Vercel | Made by Next.js team. Free tier covers ~100GB/mo bandwidth. | Cloudflare Pages if bill > $50/mo. Self-host on Render/Fly for full control. |
| Transactional email | Resend | Modern API, generous free tier (3k/mo), good deliverability. | Postmark for ultra-low latency. SES at scale (>100k/mo). |
| Marketing email | (skip at launch — add later) | Premature optimization. | Klaviyo for fashion ad-driven stores. Mailchimp for simpler. |
| Analytics / Conversions | Custom Pixel + CAPI | Full control of PII handling, no SaaS bill. | Segment ($120+/mo) when you run 4+ ad platforms. |
| Payments | Defer to a Nigerian processor | Paystack for Nigeria. Stripe for international (no NGN at scale). | Add post-launch once order volume justifies fees. |
| Search | Postgres ILIKE | Free, instant, fine under ~500 products. | Postgres tsvector at ~300 products. Meilisearch / Algolia at ~1000+ or when search quality drives conversion. |

---

## The 8 phases

Build in this order. Resist the urge to jump ahead.

### Phase 1: Foundation

- [ ] Repo + framework scaffolded
- [ ] Database schema with **RLS enabled on every table from day 1**
- [ ] Admin user created in auth provider
- [ ] Storefront layout shell (header, footer, "coming soon")
- [ ] Staging deploy URL works
- [ ] Domain pointed (or at least planned)
- [ ] Env var strategy in place (`.env` for non-secret, `.env.local` for secret, both gitignored)

**Don't move on until:** you can log in to your hosted staging URL as
admin and see a "you're logged in" page.

### Phase 2: Admin panel

- [ ] Admin auth gate via middleware
- [ ] Collection CRUD (or category — whatever your data model calls it)
- [ ] Product CRUD with variant management + image uploads
- [ ] Order list + detail page (initially empty — orders come in Phase 4)
- [ ] Settings page for credentials that change without redeploys (pixel
      IDs, API keys, etc.)
- [ ] Dashboard — even just stub metric cards

**Don't move on until:** you can create a collection, add a product
with images, and the product appears in your storefront (still bare).

### Phase 3: Storefront

- [ ] Homepage
- [ ] Collection / category pages with sort + filters
- [ ] Product detail page with gallery + variant selector
- [ ] Cart (localStorage — server-side carts come with accounts later)
- [ ] Search
- [ ] Static pages (About, Contact, Shipping, Returns, FAQ, Size guide)
- [ ] 404 page
- [ ] Mobile responsive — test on a real phone, not Chrome devtools

**Don't move on until:** a friend can browse the site on their phone
without obvious bugs.

### Phase 4: Order pipeline

This is where money-trust enters the system. Be extra careful here.

- [ ] Checkout form (customer info + delivery method + address)
- [ ] `/api/orders` endpoint:
  - **Server-side recompute** every price, delivery fee, VAT, total —
    NEVER trust the client (this is the single most important rule)
  - Validate stock again at submit time
  - Generate order number with collision retry
  - Insert order + items as one logical unit (rollback if items fail)
  - Upsert customer record
- [ ] Dual transactional email (business notification + customer
      confirmation) via Resend (or equivalent)
- [ ] Order confirmation page with order number + WhatsApp pre-filled link
- [ ] Admin order status workflow: `pending → confirmed → shipped → delivered`,
      `→ cancelled` from any state. Server-enforced transition rules
- [ ] WhatsApp link from admin order detail page so the operator can
      reach the customer in one tap

**Don't move on until:** a test order goes from cart → checkout →
confirmation → admin sees it → status moves all the way to delivered.

### Phase 5: Analytics + attribution

- [ ] Multi-platform pixel scaffolding (Meta + TikTok + GA4 + Snap +
      Pinterest at minimum — most read settings from DB so they activate
      on credential paste, not redeploy)
- [ ] Browser-side events: PageView, ViewContent, AddToCart,
      InitiateCheckout, Purchase. Plus ViewCategory for collections + Search
- [ ] Server-side Conversions API (Meta CAPI minimum) — Purchase event
      with hashed PII, deduplicated via matching event_id
- [ ] UTM capture on first landing (sticky per session in localStorage
      or sessionStorage), persisted with the order
- [ ] Click-ID capture (fbclid, ttclid, gclid) — synthesize CAPI cookies
      from these as fallback
- [ ] Admin dashboard: top sources panel, per-order attribution panel
- [ ] Custom audiences NOT auto-created — admin builds them in Ads Manager
      using events you fire

**Don't move on until:** placing a test order with
`?utm_source=facebook&utm_campaign=test` shows "facebook" as the source
on the admin order detail page.

### Phase 6: Product catalog feed

- [ ] Public XML feed at `/api/catalog.xml` (or wherever — Google Merchant
      spec works for Meta + Pinterest + most platforms)
- [ ] **Use product-level IDs** (`g:id = product.id`), not variant-level.
      Variant catalogs work in theory; product-level catalogs match more
      reliably across platforms.
- [ ] Match the IDs in your events exactly. Every event's `content_ids`
      should be a product UUID, not a variant UUID.
- [ ] Set up the feed in Commerce Manager (or equivalent), schedule daily
      refresh
- [ ] Wait 24h, verify match rate > 90% in the catalog dashboard

### Phase 7: Delivery + tax configuration

- [ ] Admin-controllable delivery methods (don't hardcode in
      constants.ts past v1 — Oluwatoyin shouldn't need a redeploy to
      change a ₦4,000 fee to ₦4,500)
- [ ] Zone-based pricing (not per-state) for nationwide carriers
- [ ] International rates as a country → price map for flexibility
- [ ] VAT toggle — some markets don't charge it; admin shouldn't have to
      ask an engineer to flip it
- [ ] Free-shipping-over-threshold rule
- [ ] Server-authoritative calculation called from /api/orders submit

### Phase 8: Pre-launch hardening

**Mandatory before paid traffic. Skipping these = bots find you the day
you launch ads.**

- [ ] Rate limit `/api/orders` and `/api/contact` (even simple — Vercel
      KV or Upstash Redis or in-memory). Cap: ~5 submissions / IP / hour
- [ ] Honeypot field on every public form
- [ ] CAPTCHA on contact form (Cloudflare Turnstile is free)
- [ ] Verify your file-storage bucket policies require auth for writes
      (anon users should NOT be able to upload to your product-images
      bucket — RLS / bucket policy / signed URL — pick one)
- [ ] Test that a customer manipulating browser JS to send ₦1 for a
      ₦30,000 product gets rejected (server recalc)
- [ ] Test that an unauthenticated user trying to read `orders` table
      from the public anon key gets RLS-denied
- [ ] All `NEXT_PUBLIC_*` env vars contain only intentionally-public
      values (Supabase anon key OK, service-role key NOT)
- [ ] Vercel (or equivalent) project has every env var mirrored from
      `.env.local` — order creation will silently fail without service
      role key
- [ ] DKIM + SPF + DMARC verified in your email provider, sending from
      your real domain (`orders@yourdomain.com`), not the provider's
      sandbox
- [ ] Real test order placed by a real person (not you) end-to-end
- [ ] Image bucket has CDN in front (most providers do this by default)
- [ ] Open Graph + favicon set so links shared on WhatsApp/Twitter look
      branded

---

## Patterns that mattered

These are the patterns where "the obvious approach" wasn't the right one.
The lessons came from real misfires.

### Pattern 1: Server-authoritative business logic

**Rule:** Anything tied to money, trust, or state — prices, totals,
stock, status transitions, role flags — is recomputed server-side from
the database on every request. Client-sent values are previews, never
truth.

**The implementation:**

- Browser shows order subtotal/VAT/delivery/total as a preview using the
  same calculation function as the server (sharing math is fine — sharing
  *authority* is not)
- On submit, the API endpoint **ignores** the client's totals
- It fetches authoritative product prices, recomputes everything,
  validates stock, returns the order with the recomputed values

**Why this is non-obvious:** Beginners ship the client-computed total to
the server and save it. Customer hacks browser console → pays ₦10 for a
₦30,000 dress → store loses ₦29,990.

### Pattern 2: RLS-enabled by default, not as an afterthought

**Rule:** Every new table turns on Row Level Security in the same
migration that creates it. Policies live in the same SQL file as the
schema.

**Why this matters:** "We'll add RLS later" almost always means "we
forget, deploy, and a curious customer reads your orders table from
their browser console using the anon key." Row Level Security has to be
the default state of every table.

### Pattern 3: Two-tier env vars (`.env` vs `.env.local`)

**Rule:** Non-secret config goes in `.env` (Claude/AI can read it,
gitignored). Secrets go in `.env.local` (denied to Claude, gitignored).

**Why this matters:** When AI tools help you build, they need to read
some config (which port, what's the public site URL) but should NEVER
have access to your service-role key or payment provider secret. The
two-file split makes this explicit and safe.

### Pattern 4: Custom analytics, not GTM

**Rule:** Wire your pixel + CAPI events in code, not in Google Tag
Manager.

**Why:** GTM tags live in their UI, not your code. Version control
becomes guessing. Latency goes up. The dependency on GTM going down is a
single point of failure for your tracking. Custom-coded events match
Server Actions naturally — fire one in your AddToCart server action,
done.

### Pattern 5: Multi-platform analytics from day 1

**Rule:** Even if you're only running Meta ads at launch, scaffold for
TikTok + GA4 + Snap + Pinterest. Each platform has the same shape
(pixel ID + access token + test event code) — write the admin UI once
to handle all of them.

**Why:** Adding a second platform mid-launch means rewriting the
analytics dispatcher. Adding it at launch with 5 platforms scaffolded
means pasting a Pixel ID and saving.

### Pattern 6: UTM capture once per session, then sticky

**Rule:** Capture utm_source/medium/campaign on first landing into
sessionStorage. Don't overwrite on subsequent navigations.

**Why:** If a customer arrives via `?utm_source=facebook` then clicks
around your site, every internal page navigation has empty UTMs. Without
sticky-first capture, you'd overwrite "facebook" with "" on page 2 and
lose the attribution.

### Pattern 7: Product-level catalog IDs (not variant)

**Rule:** Your Meta / TikTok / Google catalog uses PRODUCT IDs as the
primary item ID. Pixel events also send product IDs. Variant info goes
in the order_items table for fulfillment, not into the ad platform.

**Why:** Variant-level catalogs sound more granular but cause real
catalog match rate issues. Product-level keeps matching at 100% and
suffices for fashion-grade DPA.

### Pattern 8: Dynamic delivery quote, server-validated

**Rule:** Customer's checkout shows delivery methods + prices fetched
from a server endpoint. The same server function runs again at order
submit — never trust the browser's quote.

**Why:** The customer might keep an old browser tab open while admin
updates GIG's price from ₦4,000 to ₦4,500. The customer's browser still
shows ₦4,000. Server recomputation at submit catches this without UX
friction.

### Pattern 9: Cart in localStorage, until accounts exist

**Rule:** Anonymous customers' carts live in localStorage. When you ship
customer accounts (later), migrate cart storage to a server-side
`carts` table keyed by user ID.

**Why:** localStorage is per-device per-browser. That's correct for
anonymous shopping intent. Cross-device cart sync requires a server
side, which requires accounts. Don't build accounts before they're
needed.

### Pattern 10: WhatsApp deep links are leverage

**Rule:** Every customer-facing surface that could benefit from human
contact gets a `wa.me/<number>?text=<prefilled>` link.

**Why:** Order confirmation page → "Send your order on WhatsApp" with
the order details prefilled. Pending order in admin → tap to WhatsApp
the customer with their order number filled in. Floating WhatsApp button
on every page. Each link saves the customer/operator typing — converts
better and reduces support load.

---

## Operational decisions matrix

When to add what, indexed by customer count or revenue.

| Milestone | Add this |
|---|---|
| **0–50 customers (launch)** | Just the basics. Resist all SaaS additions. Focus on traffic + conversion. |
| **50 customers** | Marketing email platform (Klaviyo / Mailchimp). Start segmentation. |
| **100 orders/month** | Payment processor (Paystack / Stripe). Automate the cash flow. |
| **300+ products** | Postgres full-text search (tsvector) → eventually Meilisearch. ILIKE struggles at this size. |
| **₦5M+ ad spend / mo** | Segment (or equivalent data layer) — saves dev time when juggling 4+ ad platforms. |
| **Vercel bill > $50/mo** | Migrate hosting to Cloudflare Pages — significantly cheaper at high bandwidth. |
| **Customer accounts feature** | Migrate cart from localStorage to server-side `carts` table. Cross-device sync. |
| **₦100M+ monthly revenue** | Consider managed e-commerce platform (Shopify Plus) for the storefront + keep custom-built backend for proprietary logic. Or invest in dedicated engineers. |

---

## Common mistakes to avoid

The shortlist of things that cause the most regret:

1. **Trusting client-sent prices.** See Pattern 1.
2. **Per-state delivery pricing in a country with 36+ states.** It's
   admin hell to maintain. Use 2-3 zones.
3. **Variant-level catalog before you need it.** Adds matching headaches
   for marginal granularity. Wait until DPA-by-color is a measurable
   revenue driver.
4. **Sending marketing emails through your transactional sender.**
   Tanks deliverability for the emails that actually matter (order
   confirmations). Use separate platforms.
5. **Skipping UTM capture before launching ads.** Means you can't tell
   which campaign drove which orders. Wires through cleanly when added
   at the start; very painful to retrofit.
6. **No rate limit on /api/orders or /api/contact.** Bots find you the
   day you launch ads. Add a simple cap from day 1.
7. **Hardcoding business rules (VAT, delivery, free-shipping
   threshold) so changes require a redeploy.** v1 is fine; past v1,
   move to admin-controllable.
8. **Per-product variant ID in events + product-level catalog (or vice
   versa).** Mismatched IDs = 0% catalog match rate. Pick one level
   everywhere.
9. **GTM for analytics.** See Pattern 4.
10. **Forgetting bucket policies.** Browser uploads to your product
    image bucket with the anon key — if policies aren't tight, anyone
    can upload to your bucket and fill your storage quota.

---

## Pre-launch checklist (final pass)

Run through this **the day before** you announce launch. Each item is a
yes/no question you should be able to answer in seconds.

- [ ] Can a customer place an order end-to-end on the LIVE domain?
- [ ] Do the business + customer emails actually arrive (check spam too)?
- [ ] Does the admin dashboard show the test order?
- [ ] Can admin move the test order through all statuses?
- [ ] Can admin delete a test order without breaking the customer record?
- [ ] Does the WhatsApp deep link open with prefilled text on a real phone?
- [ ] Does the cart persist across browser refresh?
- [ ] Does mobile checkout work? (Real phone, not devtools.)
- [ ] Are SSL/HTTPS, favicon, OG tags set?
- [ ] Is the catalog feed live at the public URL?
- [ ] Does Meta Test Events tab show ViewContent / AddToCart / Purchase
      with matching content_ids?
- [ ] Does Purchase show as "Deduplicated" (browser + server matched)?
- [ ] Are rate limits + bot defenses in place?
- [ ] Are storage bucket policies tight?
- [ ] Is RLS on for every table?
- [ ] Do `NEXT_PUBLIC_*` vars only contain public values?
- [ ] Are all `.env.local` keys mirrored in hosting provider's env vars?
- [ ] Does the live site load in < 2 seconds (Lighthouse > 80)?

---

## Appendices

### A. Example env var split

`.env` (Claude-readable, public):
```
NEXT_PUBLIC_SITE_URL=https://your-store.com
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_WHATSAPP_NUMBER=234...
ADMIN_EMAILS=oluwatoyin@store.com
ORDER_NOTIFICATION_EMAIL=orders@store.com
```

`.env.local` (Claude-denied, secrets):
```
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
[payment provider secret when added]
```

### B. Order flow API contract (sketch)

```
POST /api/orders
Body:
  customer: { firstName, lastName, email?, phone, whatsapp, ... }
  items: [{ productId, variantId, quantity }, ...]
  deliveryMethod: "pickup" | "gig" | "park" | "international" | ...
  country?: string (only for international)
  attribution: { utmSource, utmCampaign, fbclid, ... }
Server actions:
  1. Validate customer (required fields, normalize phone)
  2. Validate items (fetch authoritative prices from DB)
  3. Validate stock
  4. Compute subtotal + delivery + VAT + total (SERVER, not browser)
  5. Generate order_number with collision retry
  6. Insert order (with retry on unique-violation)
  7. Insert order_items (compensating delete on failure)
  8. Upsert customer (by phone)
  9. Send dual emails (best-effort)
 10. Dispatch CAPI Purchase event with hashed PII
 11. Return { orderNumber, whatsappLink, customerName, total }
```

### C. Catalog feed shape (Meta / Google Merchant XML)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>YOUR BRAND</title>
    <link>https://your-store.com</link>
    <description>...</description>
    <item>
      <g:id>PRODUCT_UUID</g:id>
      <g:title>Senator Gown</g:title>
      <g:description>...</g:description>
      <g:link>https://your-store.com/products/senator-gown</g:link>
      <g:image_link>...</g:image_link>
      <g:availability>in stock</g:availability>
      <g:price>25000.00 NGN</g:price>
      <g:brand>YOUR BRAND</g:brand>
      <g:condition>new</g:condition>
      <g:google_product_category>Apparel &amp; Accessories &gt; Clothing</g:google_product_category>
    </item>
    ...
  </channel>
</rss>
```

### D. RLS policy patterns

```sql
-- Public read of active products
CREATE POLICY "Anyone can read active products"
  ON public.products FOR SELECT TO anon, authenticated
  USING (is_active = true);

-- Admin can read all orders
CREATE POLICY "Admin reads orders"
  ON public.orders FOR SELECT TO authenticated
  USING (public.is_admin());

-- Anyone can insert an order (checkout is anonymous)
CREATE POLICY "Anonymous order creation"
  ON public.orders FOR INSERT TO anon, authenticated
  WITH CHECK (true);
-- (Validation happens server-side in /api/orders, not in RLS)
```

### E. Admin role check function (Supabase)

```sql
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users
    WHERE id = auth.uid()
    AND email = ANY(string_to_array(current_setting('app.admin_emails', true), ','))
  );
$$;
```

(Set `app.admin_emails` as a Postgres GUC or just hardcode the email
list in the function — pick what fits your auth provider.)

---

## What this doc doesn't cover (yet)

This playbook grows as we ship more. Sections to add when we have real
experience:

- **Customer accounts**: registration, password reset, address book,
  order history page. Skipped at launch because most COD/WhatsApp flows
  don't need accounts.
- **Reviews + ratings**: schema, anti-spam, display, fake-review
  detection. Add when traffic > 100/day.
- **Inventory sync with offline stock**: when you sell on multiple
  channels (Instagram DM, Selar, physical store) and need a single
  source of truth.
- **Multi-currency / multi-locale**: if international becomes
  significant revenue.
- **Returns flow**: refund/exchange UI + email templates.
- **Subscription / recurring revenue**: if your business model evolves.
- **PWA / offline mode**: for low-connectivity markets.

When you build one of these, capture the decisions in `DECISIONS.md`,
then promote the principles up here.

---

## Living document

This playbook is opinionated based on one build. The opinions are
testable — when one is wrong, fix it here, commit, move on. Don't treat
the doc as canon; treat it as a starting brief that gets sharper each
build.

Last updated: end of ÀYỌ̀NÍ Phase 7 (delivery + VAT admin-controllable).
Next update target: after ÀYỌ̀NÍ's first ₦1M revenue month, when the
"things we wish we'd done sooner" section will write itself.
