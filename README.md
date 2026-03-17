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

- Gmail API-backed actions need a real Google OAuth setup to be fully usable end to end
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
- optionally connect Gmail with Google auth

8. Refresh Gmail after saving settings or reloading the extension.

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

## Public Read Receipts

To get actual opens recorded:

1. deploy the API somewhere public
2. expose it over HTTPS
3. set the extension API base URL to that public HTTPS origin
4. rebuild and reload the extension if permissions changed

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

### `Check API` says `Could not reach tracking API`

- make sure the API process is running
- run `curl http://127.0.0.1:8787/healthz`
- confirm the settings page is pointing at the same origin
- reload the extension after rebuilding

### `Read status registration failed`

- this usually means the extension could not reach the tracking API
- fix the API URL or start the API process first

### Read statuses panel shows sends but open count never changes

- if the API URL is local, this is expected
- use a public HTTPS API endpoint for real remote opens

## Notes

- Postgres is optional in v1. If `DATABASE_URL` is unset, the API falls back to in-memory tracking storage.
- In-memory mode resets tracked messages when the API process restarts.
