import { createFileRoute } from "@tanstack/react-router";
import { BUILD_ID } from "@/lib/build-id";

// Public version endpoint. Clients poll this to detect new deploys and
// trigger a silent reload. The Lovable proxy serves /api/* with no-store
// semantics, so the response is never cached.
export const Route = createFileRoute("/api/public/version")({
  server: {
    handlers: {
      GET: async () => {
        return new Response(
          JSON.stringify({ buildId: BUILD_ID, ts: Date.now() }),
          {
            status: 200,
            headers: {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store, no-cache, must-revalidate, max-age=0",
              "access-control-allow-origin": "*",
            },
          },
        );
      },
    },
  },
});
