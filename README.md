# Superbhuman

Gmail power layer inspired by Superhuman and Simplehuman.

## What It Is

Superbhuman is a Chrome extension that sits inside Gmail and adds:

- a command center
- faster keyboard-driven inbox navigation
- an `Important` / `Other` split inbox
- mass archive flows
- Gmail API-powered cleanup actions

The current product direction is:

- public Chrome extension first
- Gmail features work with no user-run backend
- Gmail auth stays fully inside the extension with `chrome.identity`
- read statuses are a separate hosted beta, not part of the default public build

See [PUBLIC_LAUNCH_CHECKLIST.md](./PUBLIC_LAUNCH_CHECKLIST.md) for the remaining operational work needed for a public launch.

## Current V1 Status

Working now:

- Gmail overlay UI and floating top bar
- command center and keyboard navigation shell
- split inbox filtering over visible Gmail thread rows
- Gmail auth and Gmail API actions directly from the extension
- bulk archive preview and command wiring

Phase 1 public-build constraints:

- Gmail API features only work after you configure a real Chrome Extension OAuth client and connect Gmail from settings
- read statuses are hidden unless the extension is built with the tracking beta flags
- the backend is no longer required for Gmail auth or Gmail actions

## Repository Layout

- `apps/extension`: Chrome MV3 extension built with WXT + React
- `apps/api`: Node API for hosted read-status tracking beta
- `packages/shared`: shared types, commands, and pure domain logic

## Prerequisites

- Node.js 24+
- `pnpm`
- Chrome or Chromium

## Quick Start

1. Install dependencies.

```bash
pnpm install
```

2. Build the workspace.

```bash
pnpm build
```

3. Build the extension with a stable ID and your Chrome Extension OAuth client.

```bash
export WXT_EXTENSION_KEY='YOUR_EXTENSION_PUBLIC_KEY'
export WXT_GOOGLE_OAUTH_CLIENT_ID='YOUR_CLIENT_ID.apps.googleusercontent.com'
pnpm --filter @superbhuman/extension build
```

4. Load the Chrome extension.

- Open `chrome://extensions`
- Turn on Developer Mode
- Click `Load unpacked`
- Select `apps/extension/.output/chrome-mv3`

If the file picker hides `.output`, use `Cmd + Shift + .` on macOS to show hidden folders.

5. Open the extension settings page from `chrome://extensions`.

6. In settings:

- click `Connect Gmail`
- approve the Gmail scopes
- once `Gmail Auth` says `Ready`, Gmail-powered features are usable

7. Refresh Gmail after connecting or reloading the extension.

The default public build does not require the API at all.

## Public Product Path

The intended public install flow is:

1. install extension
2. connect Gmail
3. use command center, split inbox, archive, and Gmail cleanup actions

Design rules for the public build:

- no local API required
- no user-provided tracking URL
- no Gmail access tokens sent to the Superbhuman backend
- backend outages must not block Gmail features

## Google OAuth Setup

Use a stable extension ID and a Chrome Extension OAuth client that matches it.

1. Create or choose a Google Cloud project.
2. Enable the Gmail API.
3. Configure Google Auth Platform branding.
4. Set Audience to `External`.
5. Add your test users while the app is still private.
6. Add only these Gmail scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
   - `https://www.googleapis.com/auth/userinfo.email`
7. Create an OAuth client of type `Chrome Extension`.
8. Paste the stable extension ID from `chrome://extensions`.

Then rebuild:

```bash
export WXT_EXTENSION_KEY='YOUR_EXTENSION_PUBLIC_KEY'
export WXT_GOOGLE_OAUTH_CLIENT_ID='YOUR_CLIENT_ID.apps.googleusercontent.com'
pnpm --filter @superbhuman/extension build
```

Reload the unpacked extension after every rebuild.

## Hosted Read Statuses

Read statuses stay out of the default Gmail-only build unless the extension is built against a fixed hosted backend and
tracking Google client.

Required extension build flags:

```bash
export WXT_PUBLIC_TRACKING_API_BASE_URL='https://track.superbhuman.example'
export WXT_PUBLIC_TRACKING_GOOGLE_CLIENT_ID='YOUR_TRACKING_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com'
```

When those flags are absent, the public extension:

- hides read-status controls
- does not ask users for a backend URL
- keeps all Gmail features usable with no backend dependency

### Hosted Backend Scope

The hosted read-status backend should stay narrow:

- `GET /healthz`
- `POST /auth/google/exchange`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /track/register`
- `GET /track/messages`
- `GET /track/status/:token`
- `GET /t/:token.gif`

Required backend env:

```bash
export DATABASE_URL='postgres://...'
export TRACKING_GOOGLE_OAUTH_CLIENT_ID='YOUR_TRACKING_GOOGLE_WEB_CLIENT_ID.apps.googleusercontent.com'
export TRACKING_GOOGLE_OAUTH_CLIENT_SECRET='YOUR_TRACKING_GOOGLE_WEB_CLIENT_SECRET'
export TRACKING_EVENT_SECRET='LONG_RANDOM_SECRET'
```

## Everyday Testing

### Command Center

- open Gmail
- press `Cmd + Shift + K` on macOS or `Ctrl + Shift + K` on Windows
- search for actions like `archive`, `reply`, `other`, `important`, or `get me to zero`

### Split Inbox

- use the floating `Important` and `Other` tabs
- counts in the top bar show how many visible Gmail rows currently fall into each split
- use command center actions like `Move to Important` or `Move to Other` on a selected thread to tune the split

### Hosted Read Statuses

Only hosted-tracking builds expose the read-status UI. In a hosted build:

- open Gmail compose
- verify the compose toolbar shows `Read Status On`
- enable read statuses from the extension options page if they are not already enabled
- send an email
- open the `Read Statuses` button in the floating bar
- your tracked send should appear there with subject, recipients, sent time, and current open count
- opens should be described and interpreted as best-effort, not guaranteed human reads

The read-status backend must be public HTTPS and continuously reachable while recipient opens are happening, but end
users should never be asked to run tunnels or paste backend URLs.

## Development Commands

Root:

```bash
pnpm build
pnpm test
pnpm typecheck
```

Extension:

```bash
pnpm --filter @superbhuman/extension build
pnpm --filter @superbhuman/extension test
pnpm --filter @superbhuman/extension typecheck
```

API:

```bash
pnpm --filter @superbhuman/api dev
pnpm --filter @superbhuman/api start
pnpm --filter @superbhuman/api test
pnpm --filter @superbhuman/api typecheck
```

## Troubleshooting

### `Connect Gmail` is disabled

- this build does not have `WXT_GOOGLE_OAUTH_CLIENT_ID` configured
- set both `WXT_EXTENSION_KEY` and `WXT_GOOGLE_OAUTH_CLIENT_ID`
- rebuild and reload the extension

### `Google OAuth is not configured for this extension ID`

- make sure the Chrome Extension OAuth client was created with the exact current extension ID
- make sure the extension was built with the same `WXT_EXTENSION_KEY`
- rebuild and reload after updating the client ID

### `This Google account is not allowed to use the OAuth client yet`

- add that account as a test user in Google Auth Platform
- wait for Google Cloud changes to propagate, then reconnect

### Read statuses show as unavailable

- this is expected in the normal public build
- read statuses only appear when the extension is built with the hosted tracking env vars

### Hosted read-status backend cannot be reached

- core Gmail features should still work
- verify the hosted backend responds to `/healthz`
- rebuild the extension with the correct hosted tracking env vars

### Read statuses panel shows sends but open count never changes

- the hosted backend must be public HTTPS
- the backend must still be up when the recipient opens the email
- Gmail often proxies images, so the pixel cannot point at localhost

## Notes

- Phase 1 is Gmail features first.
- Read statuses are phase 2 and should stay behind a fixed-origin hosted backend until auth, durable storage, monitoring, and abuse controls are in place.
- The backend should not receive Gmail access tokens.

## Official Docs

- [Chrome `chrome.identity`](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Chrome manifest `oauth2`](https://developer.chrome.com/docs/extensions/reference/manifest/oauth2)
- [Chrome permissions and host permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google Auth Platform audience and test users](https://developers.google.com/workspace/marketplace/configure-oauth-consent-screen)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
