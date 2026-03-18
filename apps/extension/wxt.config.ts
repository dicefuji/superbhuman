import { defineConfig } from "wxt";

const googleClientId = process.env.WXT_GOOGLE_OAUTH_CLIENT_ID?.trim();
const extensionKey = process.env.WXT_EXTENSION_KEY?.trim();
const oauthScopes = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/userinfo.email"
];

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "Superbhuman",
    description: "Superhuman-style speed layer for Gmail.",
    ...(extensionKey ? { key: extensionKey } : {}),
    permissions: ["storage", "identity", "identity.email", "alarms"],
    host_permissions: [
      "https://mail.google.com/*",
      "https://gmail.googleapis.com/*",
      "https://www.googleapis.com/*",
      "http://localhost:8787/*",
      "http://127.0.0.1:8787/*"
    ],
    optional_host_permissions: ["https://*/*"],
    ...(googleClientId
      ? {
          oauth2: {
            client_id: googleClientId,
            scopes: oauthScopes
          }
        }
      : {}),
    options_page: "options.html",
    commands: {
      openCommandCenter: {
        suggested_key: {
          default: "Ctrl+Shift+K",
          mac: "Command+Shift+K"
        },
        description: "Open Superbhuman Command Center"
      }
    },
    web_accessible_resources: [
      {
        resources: ["*.css"],
        matches: ["https://mail.google.com/*"]
      }
    ]
  }
});
