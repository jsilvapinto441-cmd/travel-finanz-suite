// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, cloudflare (build-only),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... } }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/tanstack/vite";

// Build ID injected at build time. Same value baked into both client and server
// bundles so /api/public/version can advertise the running build to clients,
// which then silently reload when a new build is deployed.
const BUILD_ID = process.env.BUILD_ID ?? `${Date.now()}`;

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  vite: {
    plugins: [mcpPlugin()],
    define: {
      __BUILD_ID__: JSON.stringify(BUILD_ID),
    },
  },
});
