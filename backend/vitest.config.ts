import { defineConfig } from "vitest/config";
import { loadRepoDatabaseUrl } from "./src/lib/load-repo-env.js";

loadRepoDatabaseUrl();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.integration.test.ts"],
  },
});
