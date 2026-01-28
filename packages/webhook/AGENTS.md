# Webhook Server

HTTP server receiving webhooks, enqueuing jobs to Redis.

## Patterns

- Routes extract `@dexter` instructions and enqueue jobs — they don't process work
- Always return 200 for ignored events to prevent webhook provider retries
- Middleware handles signature verification when secrets are configured

## Gotchas

- Raw body must be captured for signature verification (see `express.json` verify option)
- GitHub sends `ping` events on webhook setup — handle gracefully
