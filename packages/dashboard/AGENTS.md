# Dashboard

Dashboard for queue monitoring and configuration. Served by the webhook server at `/admin`.

## Stack

Vite, React 19, React Router (HashRouter), TanStack Query, Tailwind CSS

## Authentication

Auth0 with Google OAuth. Requires `admin:access` permission.

```mermaid
flowchart TD
    User([User]) --> Login[Login Page]
    Login -->|"Google OAuth"| Auth0[Auth0]
    Auth0 -->|"JWT with permissions"| AuthGuard[AuthGuard]
    AuthGuard -->|"has admin:access"| Dashboard[Dashboard Routes]
    AuthGuard -->|"no permission"| AccessDenied[Access Denied]
    Dashboard --> ApiClient[API Client]
    ApiClient -->|"Bearer Token"| WebhookServer["/api/* endpoints"]
```

## Routing

Hash-based routing for deep linking. The hash is never sent to the server, so the webhook server serves static files without SPA fallback.

## Pages

Page URLs should follow the format of existing pages.

- `#/` — Home: job counts, success rate
- `#/jobs` — Jobs list with status filtering
- `#/jobs/:id` — Job details with retry/remove
- `#/settings` — Bot name configuration

## Development

Dashboard container runs `vite build --watch`. Output goes to shared Docker volume mounted by webhook.

## Components

When building pages and components. Try and reuse existing components in the `components/` folder within reason. If an existing component doesn't fit, try and create a new reusable components, but do not overload components with too many props. Sometimes it's ok for custom components to be single-use only.
