import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Prove complete contro Supabase sul PC (npm run db:local). Più lente: si
// lanciano a parte con npm run test:e2e, non con npm test.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["src/**/*.e2e.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
