import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["src/test/setup.ts"],
    // Tier B tests share one real Postgres database (TEST_DATABASE_URL) and
    // truncate it between tests - running test files in parallel workers
    // would let one file's afterEach truncate tables mid-assertion in
    // another file.
    fileParallelism: false,
  },
});
