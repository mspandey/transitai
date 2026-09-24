
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  // Use the Vercel Edge preset so Nitro outputs to .vercel/output/ (Build Output API v3).
  // Without this, Nitro defaults to cloudflare-module and Vercel cannot locate the Vite
  // asset manifest, causing the SSR server to fall back to injecting the dev virtual module
  // path (/@id/virtual:tanstack-start-dev-client-entry) → 404 → no React hydration.
  nitro: { preset: "vercel-edge" },
});
