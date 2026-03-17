import { defineConfig } from "wxt";

export default defineConfig({
  srcDir: ".",
  manifest: {
    name: "Superbhuman",
    description: "Superhuman-style speed layer for Gmail.",
    permissions: ["storage", "identity", "identity.email", "alarms"],
    host_permissions: [
      "https://mail.google.com/*",
      "https://gmail.googleapis.com/*",
      "https://www.googleapis.com/*",
      "https://*/*",
      "http://localhost:8787/*",
      "http://127.0.0.1:8787/*"
    ],
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
