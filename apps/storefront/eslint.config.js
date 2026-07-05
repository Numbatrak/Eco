import { baseConfig } from "@platform/config/eslint.config.js";

export default [
  ...baseConfig,
  {
    ignores: [".next/**", "next-env.d.ts"],
  },
];
