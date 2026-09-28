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
    // TEST_DATABASE_URL may point at a remote Neon branch rather than local
    // Postgres - the default 5s timeout is tuned for a same-host DB and
    // trips on ordinary network + cold-compute-start latency, not a hung
    // test.
    testTimeout: 60000,
  },
});
