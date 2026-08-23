import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// No generateStaticParams/revalidate/ISR usage in this app today, so the
// default (non-persistent) cache is fine - swap in the R2 incremental cache
// override here if ISR gets added later.
export default defineCloudflareConfig();
