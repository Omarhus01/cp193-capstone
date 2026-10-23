import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    // next-intl imports "next/server" without an extension, which Node's ESM loader can't
    // resolve. Bundling it through Vite resolves the import (needed by src/proxy.test.ts).
    server: { deps: { inline: ["next-intl"] } },
    include: ["src/**/*.test.ts"],
  },
});
