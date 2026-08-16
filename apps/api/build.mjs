import { build } from "esbuild";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

await build({
  entryPoints: [resolve(__dirname, "src/lambda.ts")],
  bundle: true,
  platform: "node",
  target: "node20",
  format: "esm",
  outfile: resolve(__dirname, ".build/lambda.mjs"),
  // Mark native addons as external; everything else gets bundled
  // (including workspace packages like @platform/db).
  external: [],
  sourcemap: true,
  minify: false,
  // esbuild needs this banner so that bundled CJS deps that reference
  // `require` / `__dirname` work inside the ESM output.
  banner: {
    js: [
      'import { createRequire } from "module";',
      "const require = createRequire(import.meta.url);",
      'import { fileURLToPath as __file } from "url";',
      'import { dirname as __dir } from "path";',
      "const __filename = __file(import.meta.url);",
      "const __dirname = __dir(__filename);",
    ].join("\n"),
  },
});

console.log("Lambda bundle built → apps/api/.build/lambda.mjs");
