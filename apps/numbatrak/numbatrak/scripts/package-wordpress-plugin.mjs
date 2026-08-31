#!/usr/bin/env node
/**
 * Packages scripts/wordpress-plugin/crm-form-embed.php into the zip shape
 * WordPress expects (a single top-level folder matching the plugin slug)
 * and writes the update-manifest.json the plugin's self-hosted updater
 * polls (see the pre_set_site_transient_update_plugins/plugins_api filters
 * in crm-form-embed.php). Both land in public/wordpress-plugin/, which
 * Vite copies verbatim into build/ - same mechanism as embed.js/embed.css.
 *
 * Re-run this after bumping the `Version:` header in crm-form-embed.php.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, copyFileSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const pluginSlug = "crm-form-embed";
const pluginPhpPath = path.join(root, "scripts", "wordpress-plugin", `${pluginSlug}.php`);
const outDir = path.join(root, "public", "wordpress-plugin");
const stagingDir = path.join(root, ".wordpress-plugin-staging");

const pluginSource = readFileSync(pluginPhpPath, "utf8");
const versionMatch = pluginSource.match(/^\s*\*\s*Version:\s*(\S+)/m);
if (!versionMatch) {
  throw new Error(`Could not find a "Version:" header in ${pluginPhpPath}`);
}
const version = versionMatch[1];

rmSync(stagingDir, { recursive: true, force: true });
mkdirSync(path.join(stagingDir, pluginSlug), { recursive: true });
mkdirSync(outDir, { recursive: true });

copyFileSync(pluginPhpPath, path.join(stagingDir, pluginSlug, `${pluginSlug}.php`));

const zipPath = path.join(outDir, `${pluginSlug}.zip`);
rmSync(zipPath, { force: true });
execFileSync("zip", ["-r", zipPath, pluginSlug], { cwd: stagingDir, stdio: "inherit" });

rmSync(stagingDir, { recursive: true, force: true });

const downloadUrl = `https://app.numbatrak.io/wordpress-plugin/${pluginSlug}.zip`;
const manifestPath = path.join(outDir, "update-manifest.json");
const previousManifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, "utf8"))
  : null;

const manifest = {
  name: "CRM Form Embed",
  slug: pluginSlug,
  version,
  download_url: downloadUrl,
  requires: "5.6",
  tested: "6.6",
  last_updated: new Date().toISOString().slice(0, 10),
  sections: {
    description:
      "Embed Numbatrak order-intake forms on WordPress via [crm_form form=\"TOKEN\"].",
    changelog:
      previousManifest && previousManifest.version !== version
        ? `<h4>${version}</h4><ul><li>See plugin source for details.</li></ul>${previousManifest.sections?.changelog ?? ""}`
        : previousManifest?.sections?.changelog ?? `<h4>${version}</h4><ul><li>Initial self-hosted release.</li></ul>`,
  },
};

writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

console.log(`Packaged ${pluginSlug}.zip (version ${version}) -> ${zipPath}`);
console.log(`Wrote update manifest -> ${manifestPath}`);
