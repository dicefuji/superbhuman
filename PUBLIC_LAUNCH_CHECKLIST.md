# Superbhuman Public Launch Checklist

This checklist covers the non-code work required to turn the current repo into a public product release.

## Phase 1: Public Gmail Extension

### Product

- Confirm the default build ships Gmail features only.
- Keep read statuses disabled unless `WXT_PUBLIC_ENABLE_TRACKING_BETA=true`.
- Verify a fresh install works with no Superbhuman backend available.

### Google OAuth

- Use a stable `WXT_EXTENSION_KEY` for release builds.
- Create a production Chrome Extension OAuth client tied to the release extension ID.
- Enable the Gmail API in the release Google Cloud project.
- Configure Google Auth Platform branding for the public app.
- Move from test-user-only setup to the production-ready OAuth flow.
- Complete Google sensitive-scope verification for:
  - `https://www.googleapis.com/auth/gmail.modify`
  - `https://www.googleapis.com/auth/gmail.settings.basic`
  - `https://www.googleapis.com/auth/userinfo.email`

### Chrome Web Store

- Prepare the store listing title, short description, and long description.
- Capture screenshots and promo assets for the Gmail UI.
- Publish privacy policy and support URLs.
- Document permission rationale for:
  - `identity`
  - `identity.email`
  - `storage`
  - Gmail host permissions
- Verify the store listing matches actual runtime behavior and permissions.

### Release Validation

- Test install from a clean Chrome profile.
- Test first-run Gmail connect.
- Test reconnect after token expiry or revoked consent.
- Test command center, split inbox, archive preview/run, and Gmail cleanup actions.
- Confirm backend downtime does not block Gmail features.

## Phase 2: Hosted Read-Status Beta

### Backend Product Shape

- Use a fixed first-party HTTPS origin for the beta backend.
- Do not accept user-provided API origins in the public product UI.
- Keep the public backend surface narrow:
  - `GET /healthz`
  - `POST /track/register`
  - `GET /track/status/:token`
  - `GET /t/:token.gif`

### Data / Auth

- Add backend auth tied to the Google identity used in the extension.
- Associate tracking tokens with a user or account.
- Prevent cross-user status access.
- Use durable Postgres-backed persistence in production.

### Operations

- Add monitoring and uptime checks.
- Add structured logging.
- Add rate limiting and abuse controls.
- Define retention and deletion policy for tracking data.

### Beta Validation

- Verify registration succeeds from the extension.
- Verify pixel opens increment `openCount` through the public HTTPS endpoint.
- Verify status refresh stays prompt and correct.
- Verify outages only degrade read statuses and do not break Gmail features.
