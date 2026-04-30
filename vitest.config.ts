import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Pure functions only — no DOM needed.
    environment: "node",
    include: ["app/lib/**/*.test.ts"],
  },
});
