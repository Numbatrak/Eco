# WordPress Integration

The direct-to-Supabase integration options previously documented here (a
Fluent Form script using the Supabase anon key directly, and a variant
calling a Supabase Edge Function) have been removed. Both bypassed
`apps/api` and exposed order-creation to anyone with the project's anon
key.

Order-intake forms are now embedded via the CRM Form Embed WordPress
plugin, which loads `embed.js`/`embed.css` from this app's own domain and
submits through `apps/api`'s token-gated public forms endpoint
(`POST /public/numbatrak/forms/:token/submit`) instead of talking to
Supabase at all.

See [`WORDPRESS_PLUGIN_INSTALL.md`](../WORDPRESS_PLUGIN_INSTALL.md) for
setup instructions.
