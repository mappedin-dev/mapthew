# Dashboard

React 19 SPA for queue monitoring and configuration. Served by the webhook server at `/admin`.

## Stack

Vite, React Router (HashRouter), TanStack Query, Tailwind CSS

## Routing

Hash-based routing for deep linking. The hash is never sent to the server, so the webhook server serves static files without SPA fallback.

## Pages

- `#/` — Home: job counts, success rate
- `#/jobs` — Jobs list with status filtering
- `#/jobs/:id` — Job details with retry/remove
- `#/settings` — Bot name configuration

## Development

Dashboard container runs `vite build --watch`. Output goes to shared Docker volume mounted by webhook.
