
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // Use Nitro's Vercel preset so the SSR output uses Vercel's Build Output API.
  nitro: { preset: "vercel" },
});
