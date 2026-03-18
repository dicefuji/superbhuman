# Superbhuman

Private-first Gmail power layer inspired by Superhuman and Simplehuman.

## What It Is

Superbhuman is a Chrome extension that sits inside Gmail and adds:

- a command center
- faster keyboard-driven inbox navigation
- an `Important` / `Other` split inbox
- mass archive flows
- read-status tracking for sent emails

This repository is a v1 prototype. It is optimized for local/private use and rapid iteration, not polished public distribution.

## Current V1 Status

Working now:

- Gmail overlay UI and floating top bar
- command center and keyboard navigation shell
- split inbox filtering over visible Gmail thread rows
- read-status panel with tracked sends and open counts
- local tracking API for registration, health checks, and status refresh
- bulk archive preview and command wiring

Partially implemented or still constrained:

- Gmail API-backed actions only work after you configure a real Chrome Extension OAuth client and connect Gmail from settings
- local `127.0.0.1` tracking can prove the API is alive, but it cannot produce real remote read receipts
- real read receipts require a public HTTPS API URL because Gmail’s image proxy fetches images from Google’s servers, not from your laptop

## Repository Layout

- `apps/extension`: Chrome MV3 extension built with WXT + React
- `apps/api`: Node API for session bootstrap and read-status tracking
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

3. Start the API.

```bash
pnpm --filter @superbhuman/api start
```

4. Confirm the API is alive.

```bash
curl http://127.0.0.1:8787/healthz
```

Expected response:

```json
{"ok":true}
```

5. Load the Chrome extension.

- Open `chrome://extensions`
- Turn on Developer Mode
- Click `Load unpacked`
- Select `apps/extension/.output/chrome-mv3`

If the file picker hides `.output`, use `Cmd + Shift + .` on macOS to show hidden folders.

6. Open Gmail and then open the extension settings page from `chrome://extensions`.

7. In settings:

- set the API base URL to `http://127.0.0.1:8787` for local testing
- click `Check API`
- if you have not configured Google OAuth yet, `Connect Gmail` will stay unavailable

8. Refresh Gmail after saving settings or reloading the extension.

## Private Real Integration Setup

Use this path when you want real Gmail API actions and real read receipts, but only for a private test group.

### 1. Prepare a stable extension ID

Superbhuman now reads two build-time environment variables from the extension build:

- `WXT_EXTENSION_KEY`
- `WXT_GOOGLE_OAUTH_CLIENT_ID`

Set a stable `WXT_EXTENSION_KEY` first, then build the extension once. The extension ID generated from that key is the ID you will use when creating the Chrome Extension OAuth client.

Example:

```bash
export WXT_EXTENSION_KEY='YOUR_EXTENSION_PUBLIC_KEY'
pnpm --filter @superbhuman/extension build
```

Then load the unpacked extension and copy the extension ID from `chrome://extensions`.

### 2. Configure Google Auth Platform

In Google Cloud:

1. Create or choose a project.
2. Enable the Gmail API.
3. Configure Google Auth Platform branding.
4. Set Audience to `External`.
5. Add your own account and any teammates as `Test users`.
6. Add only these Gmail scopes:
   - `https://www.googleapis.com/auth/gmail.modify`
   - `https://www.googleapis.com/auth/gmail.settings.basic`
   - `https://www.googleapis.com/auth/userinfo.email`
7. Create an OAuth client of type `Chrome Extension`.
8. Paste the stable extension ID from the previous step.

Then export the client ID and rebuild:

```bash
export WXT_EXTENSION_KEY='YOUR_EXTENSION_PUBLIC_KEY'
export WXT_GOOGLE_OAUTH_CLIENT_ID='YOUR_CLIENT_ID.apps.googleusercontent.com'
pnpm --filter @superbhuman/extension build
```

Reload the unpacked extension after every rebuild.

### 3. Bring up the tracking API

Local API for development:

```bash
pnpm --filter @superbhuman/api start
curl http://127.0.0.1:8787/healthz
```

Expected response:

```json
{"ok":true}
```

For real recipient opens, expose that API over public HTTPS with any temporary tunnel or deployment that forwards to the API process.

Example shape:

- `https://your-public-tracking-host.example.com`

For a quick local-to-public tunnel on macOS:

```bash
brew install cloudflared
cloudflared tunnel --url http://127.0.0.1:8787
```

Then put that public HTTPS URL into the extension settings and click `Check API`.

### 4. Connect Gmail and verify

In the extension settings page:

1. Confirm `Gmail Auth` says `Ready`.
2. Confirm `Tracking API` says `Reachable`.
3. Confirm `Tracking Reachability` says `Public HTTPS` if you want real read receipts.
4. Click `Connect Gmail`.
5. Approve the Gmail scopes with a configured test user account.

After that:

- `Get Me To Zero` preview/run should work
- sender/company nuke should work
- tracked emails should register in the `Read Statuses` panel
- recipient opens should increment `openCount` if the API URL is public HTTPS

If the tracking API is offline during `Connect Gmail`, the extension now keeps a local Gmail session fallback so Gmail auth can still become `Ready`. Read receipts remain unavailable until the tracking API is reachable again.

## Everyday Testing

### Command Center

- open Gmail
- press `Cmd + Shift + K` on macOS or `Ctrl + Shift + K` on Windows
- search for actions like `archive`, `reply`, `other`, `important`, or `get me to zero`

### Split Inbox

- use the floating `Important` and `Other` tabs
- counts in the top bar show how many visible Gmail rows currently fall into each split
- use command center actions like `Move to Important` or `Move to Other` on a selected thread to tune the split

### Read Statuses

- open Gmail compose
- verify the compose toolbar shows `Read Status On`
- send an email
- open the `Read Statuses` button in the floating bar
- your tracked send should appear there with subject, recipients, sent time, and current open count

### Local Read-Status Testing

Local API mode is useful for confirming:

- the extension can register a tracked send
- the settings health check works
- the read-status panel stores and refreshes tracked messages

Local API mode is not enough for real recipient opens from Gmail or other mail clients. For real read receipts, the API URL must be publicly reachable over HTTPS.

Why:

- the extension can call `127.0.0.1` from your browser
- the recipient’s mail client cannot
- Gmail usually proxies images through Google’s servers, so the tracking pixel must be reachable from the public internet

## Public Read Receipts

To get actual opens recorded:

1. run or deploy the API somewhere public
2. expose it over HTTPS
3. set the extension API base URL to that public HTTPS origin
4. save or check that URL in settings and approve the Chrome permission request
5. rebuild and reload the extension if your OAuth config changed

Example shape:

- `https://your-tracking-api.example.com`

The API must expose:

- `GET /healthz`
- `POST /track/register`
- `GET /track/status/:token`
- `GET /t/:token.gif`

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

### `Check API` says `Could not reach tracking API`

- make sure the API process is running
- run `curl http://127.0.0.1:8787/healthz`
- confirm the settings page is pointing at the same origin
- reload the extension after rebuilding
- if the URL is public HTTPS, save or check it in settings and approve the Chrome permission request

### `Auth Diagnostics` says `Session ready with local fallback`

- Google auth succeeded, but the tracking API was unavailable during session bootstrap
- Gmail API features should still work
- start the API, then click `Check API`
- switch the API base URL to a public HTTPS origin if you want real remote opens

### `Read status registration failed`

- this usually means the extension could not reach the tracking API or does not have permission to reach its origin
- fix the API URL or start the API process first
- if the URL is public HTTPS, approve the permission prompt from settings first

### Read statuses panel shows sends but open count never changes

- if the API URL is local, this is expected
- use a public HTTPS API endpoint for real remote opens

## Notes

- Postgres is optional in v1. If `DATABASE_URL` is unset, the API falls back to in-memory tracking storage.
- In-memory mode resets tracked messages when the API process restarts.

## Official Docs

- [Chrome `chrome.identity`](https://developer.chrome.com/docs/extensions/reference/api/identity)
- [Chrome manifest `oauth2`](https://developer.chrome.com/docs/extensions/reference/manifest/oauth2)
- [Chrome permissions and host permissions](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions)
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
- [Google Auth Platform audience and test users](https://developers.google.com/workspace/marketplace/configure-oauth-consent-screen)
- [Sensitive scope verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/sensitive-scope-verification)
