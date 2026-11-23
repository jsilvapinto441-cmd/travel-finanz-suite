# AGENTS.md

- Project documentation lives in `README.md` (overview) and `docs/` (features, architecture, database, security); update the matching doc when a module, table, endpoint or env var changes, so the public repo stays accurate.
- Never commit real customer data or screenshots of authenticated screens to `docs/`; the repo is public-facing portfolio material.
- Client and server reads of tables that can exceed 1000 rows must go through `fetchAllRows` (`src/lib/fetch-all.ts`) with `.order(..., "id")` and `.range()`; the Data API silently caps each request at 1000 rows.

- Push sending goes through `src/lib/fcm.server.ts` (Firebase Messaging connector) from TanStack server functions/routes, never Supabase Edge Functions; due-date reminders run in `check-due-items` (server route + managed cron), with pure rules in `src/lib/due-items.ts` so they stay unit-tested.
- Entry animation uses separate SVG logo/plane elements with Framer Motion transforms/opacity; session claiming is isolated in `intro-session.ts` so repeat visits and the duration cap are testable without rendering.
- The intro plane must enter from off the left edge of the *screen* on every device: derive the arc from the rendered logo width in `intro-route.ts` (`computeIntroRoute`) instead of hardcoding viewBox coordinates, and keep the dashed trail bound to the plane's own position so it never runs ahead of the nose.
