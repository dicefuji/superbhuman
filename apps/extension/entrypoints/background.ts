import { DEFAULT_PREFERENCES, type ApiSession, type ExtensionMessage, type UserPreferences } from "@superbhuman/shared";

import { API_BASE_URL } from "../src/env";

const SESSION_KEY = "apiSession";
const PREFERENCES_KEY = "preferences";

async function getApiBaseUrl(override?: string): Promise<string> {
  if (override?.trim()) {
    return override.replace(/\/$/, "");
  }

  const result = await chrome.storage.sync.get(PREFERENCES_KEY);
  const preferences = result[PREFERENCES_KEY] as Partial<UserPreferences> | undefined;
  return preferences?.apiBaseUrl?.replace(/\/$/, "") || DEFAULT_PREFERENCES.apiBaseUrl || API_BASE_URL;
}

async function fetchTrackingApi(path: string, init?: RequestInit, apiBaseUrlOverride?: string) {
  const apiBaseUrl = await getApiBaseUrl(apiBaseUrlOverride);

  try {
    const response = await fetch(`${apiBaseUrl}${path}`, init);
    return {
      apiBaseUrl,
      response
    };
  } catch (error) {
    throw new Error(
      `Could not reach tracking API at ${apiBaseUrl}. If this is local, make sure the server is running. If this is remote, use HTTPS and reload the extension after rebuilding.`
    );
  }
}

async function getGoogleToken(interactive = false): Promise<string> {
  const result = await chrome.identity.getAuthToken({
    interactive,
    scopes: [
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/gmail.settings.basic",
      "https://www.googleapis.com/auth/userinfo.email"
    ]
  });
  const token = typeof result === "string" ? result : result?.token;

  if (!token) {
    throw new Error("Google auth token unavailable.");
  }

  return token;
}

async function bootstrapSession(interactive = false): Promise<ApiSession | null> {
  const token = await getGoogleToken(interactive);
  const apiBaseUrl = await getApiBaseUrl();
  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!profileResponse.ok) {
    throw new Error("Could not load Gmail profile.");
  }

  const profile = (await profileResponse.json()) as { emailAddress?: string; messagesTotal?: number };

  const sessionResponse = await fetch(`${apiBaseUrl}/session/google`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      accessToken: token,
      email: profile.emailAddress
    })
  });

  if (!sessionResponse.ok) {
    throw new Error("Could not bootstrap API session.");
  }

  const session = (await sessionResponse.json()) as ApiSession;
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function getSession(): Promise<ApiSession | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return (result[SESSION_KEY] as ApiSession | undefined) ?? null;
}

async function gmailApi(path: string, method = "GET", body?: unknown) {
  const token = await getGoogleToken(false).catch(() => getGoogleToken(true));
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json"
    },
    body: method === "GET" ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Gmail API request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function handleMessage(message: ExtensionMessage) {
  switch (message.type) {
    case "auth:get-session":
      return getSession();
    case "auth:interactive-login":
      return bootstrapSession(true);
    case "gmail:api":
      return gmailApi(message.path, message.method, message.body);
    case "tracking:register": {
      const { apiBaseUrl, response } = await fetchTrackingApi("/track/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(message.payload)
      });

      if (!response.ok) {
        throw new Error(`Tracking registration failed at ${apiBaseUrl}: ${response.status}`);
      }

      return null;
    }
    case "tracking:health": {
      const { apiBaseUrl, response } = await fetchTrackingApi("/healthz", undefined, message.apiBaseUrl);
      if (!response.ok) {
        throw new Error(`Tracking API health check failed at ${apiBaseUrl}: ${response.status}`);
      }

      return response.json();
    }
    case "tracking:status": {
      const { apiBaseUrl, response } = await fetchTrackingApi(
        `/track/status/${encodeURIComponent(message.token)}`
      );
      if (!response.ok) {
        throw new Error(`Tracking lookup failed at ${apiBaseUrl}: ${response.status}`);
      }

      return response.json();
    }
    default:
      return null;
  }
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    void handleMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error) =>
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Unknown extension background error"
        })
      );

    return true;
  });

  chrome.commands.onCommand.addListener(async (command) => {
    if (command !== "openCommandCenter") {
      return;
    }

    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) {
      void chrome.tabs.sendMessage(tab.id, { type: "ui:open-command-center" });
    }
  });
});
