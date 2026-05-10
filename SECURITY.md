# LangBridge Security Notes

## Backend Auth Model

- LangBridge uses a JWT stored in an `httpOnly` cookie for browser auth.
- OAuth and email/password login both converge into the same JWT cookie flow.
- Logout blacklists the active JWT in Redis until token expiry.
- Redis-backed rate limits protect auth, verification, message, and typing paths.

## Cookie + CSRF Strategy

- Auth cookies are `httpOnly` and use `sameSite=lax` in development.
- In production, `sameSite=none` requires HTTPS-only cookies.
- Because cookies are automatically sent by browsers, unsafe state-changing routes should stay behind:
  - strict CORS allowlists,
  - JSON-only request bodies,
  - rate limiting,
  - and a future CSRF token or double-submit cookie before public production launch.

## Security Headers

- Express uses Helmet to add baseline HTTP security headers.
- Local development disables Helmet CSP to avoid blocking Vite/dev assets.
- Production keeps CSP enabled by default; update it when adding external image/CDN/object-storage domains.

## Phase 1 Boundary

This phase does not add production file upload scanning, Sentry/OpenTelemetry, Kafka, or AI moderation. Those belong to later phases in `PLAN.md`.
