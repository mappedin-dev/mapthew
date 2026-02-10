# Webhook Server

HTTP server receiving webhooks, enqueuing jobs to Redis.

Also serves the dashboard at `/admin` with supporting API routes under `/api/` for queue management, config, and session management.

## Patterns

- Routes extract `@mapthew` instructions and enqueue jobs — they don't process work
- Always return 200 for ignored events to prevent webhook provider retries
- Middleware handles signature verification when secrets are configured

## Sessions API

`/api/sessions` routes (protected by JWT auth) provide session monitoring and cleanup:

- `GET /` — List all sessions with metadata
- `GET /stats` — Aggregated session statistics
- `DELETE /:issueKey` — Directly remove a specific session's workspace and Claude data

## Gotchas

- Raw body must be captured for signature verification (see `express.json` verify option)
- GitHub sends `ping` events on webhook setup — handle gracefully
- Sessions API routes require auth (`jwtCheck` + `requireAdminPermission`)
