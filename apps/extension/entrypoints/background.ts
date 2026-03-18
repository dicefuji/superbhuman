import {
  DEFAULT_PREFERENCES,
  type ApiSession,
  type AuthDiagnostics,
  type ExtensionMessage,
  type UserPreferences
} from "@superbhuman/shared";

import { API_BASE_URL } from "../src/env";
import { getRequiredGoogleScopes, hasConfiguredGoogleOAuth, hasRequiredGoogleScopes } from "../src/lib/googleAuth";
import { assertSupportedTrackingApiBaseUrl } from "../src/lib/apiBaseUrl";
import { hasTrackingOriginPermission } from "../src/lib/trackingPermissions";

const SESSION_KEY = "apiSession";
const PREFERENCES_KEY = "preferences";
let lastAuthStage: string | undefined;
let lastAuthError: string | undefined;
let lastRawAuthError: string | undefined;
let lastAuthUpdatedAt: string | undefined;

interface GoogleAuthorization {
  grantedScopes: string[];
  token: string;
}

type ManifestWithOAuth = chrome.runtime.Manifest & {
  oauth2?: {
    client_id?: string;
    scopes?: string[];
  };
};

async function getApiBaseUrl(override?: string): Promise<string> {
  if (override?.trim()) {
    return assertSupportedTrackingApiBaseUrl(override);
  }

  const result = await chrome.storage.sync.get(PREFERENCES_KEY);
  const preferences = result[PREFERENCES_KEY] as Partial<UserPreferences> | undefined;
  return assertSupportedTrackingApiBaseUrl(preferences?.apiBaseUrl || DEFAULT_PREFERENCES.apiBaseUrl || API_BASE_URL);
}

function getManifest(): ManifestWithOAuth {
  return chrome.runtime.getManifest() as ManifestWithOAuth;
}

function getRequestedScopes(): string[] {
  return getRequiredGoogleScopes(getManifest());
}

function recordAuthStage(stage: string, error?: string, rawError?: string) {
  lastAuthStage = stage;
  lastAuthError = error;
  lastRawAuthError = rawError;
  lastAuthUpdatedAt = new Date().toISOString();

  if (error || rawError) {
    console.error("[superbhuman] auth", {
      stage,
      error,
      rawError,
      extensionId: chrome.runtime.id,
      clientId: getManifest().oauth2?.client_id
    });
    return;
  }

  console.info("[superbhuman] auth", {
    stage,
    extensionId: chrome.runtime.id,
    clientId: getManifest().oauth2?.client_id
  });
}

function buildAuthErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error);
  const normalized = raw.toLowerCase();

  if (!hasConfiguredGoogleOAuth(getManifest())) {
    return "Google OAuth is not configured in this extension build. Set WXT_GOOGLE_OAUTH_CLIENT_ID, set a stable WXT_EXTENSION_KEY, rebuild, and reload the extension.";
  }

  if (normalized.includes("not signed in")) {
    return "No Chrome profile Google account is available. Sign in to Chrome with the Gmail account you want to test, then try again.";
  }

  if (normalized.includes("did not approve") || normalized.includes("access_denied") || normalized.includes("cancel")) {
    return "Google consent was canceled. Try Connect Gmail again and approve the requested Gmail scopes.";
  }

  if (
    normalized.includes("oauth2 request failed") ||
    normalized.includes("invalid_client") ||
    normalized.includes("bad client id") ||
    normalized.includes("client_id")
  ) {
    return "Google OAuth is not configured for this extension ID. Create a Chrome Extension OAuth client for this extension, add your account as a test user, rebuild, and reload.";
  }

  if (
    normalized.includes("access blocked") ||
    normalized.includes("unauthorized_client") ||
    normalized.includes("app blocked") ||
    normalized.includes("unverified")
  ) {
    return "This Google account is not allowed to use the OAuth client yet. Add it as a test user in Google Auth Platform and try again.";
  }

  return `Google auth failed: ${raw}`;
}

async function persistSession(session: ApiSession): Promise<ApiSession> {
  await chrome.storage.local.set({ [SESSION_KEY]: session });
  return session;
}

async function buildLocalSession(
  email: string | undefined,
  accessToken: string,
  grantedScopes?: string[]
): Promise<ApiSession> {
  const source = email || accessToken;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(source));
  const userId = Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 20);

  return {
    userId,
    email,
    accessToken,
    expiresAt: new Date(Date.now() + 55 * 60 * 1000).toISOString(),
    grantedScopes,
    connectedAt: new Date().toISOString()
  };
}

async function readStoredSession(): Promise<ApiSession | null> {
  const result = await chrome.storage.local.get(SESSION_KEY);
  return (result[SESSION_KEY] as ApiSession | undefined) ?? null;
}

async function ensureTrackingPermission(apiBaseUrl: string): Promise<void> {
  const hasPermission = await hasTrackingOriginPermission(apiBaseUrl);
  if (!hasPermission) {
    throw new Error(
      `Superbhuman does not have permission to reach ${new URL(apiBaseUrl).origin}. Open settings, save or check that API URL, and approve the Chrome permission request.`
    );
  }
}

async function fetchTrackingApi(path: string, init?: RequestInit, apiBaseUrlOverride?: string) {
  const apiBaseUrl = await getApiBaseUrl(apiBaseUrlOverride);
  await ensureTrackingPermission(apiBaseUrl);

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

async function getGoogleAuthorization(interactive = false): Promise<GoogleAuthorization> {
  if (!hasConfiguredGoogleOAuth(getManifest())) {
    const friendly = buildAuthErrorMessage("oauth2_missing");
    recordAuthStage("OAuth client missing from manifest", friendly, "oauth2_missing");
    throw new Error(friendly);
  }

  try {
    recordAuthStage(interactive ? "Requesting interactive OAuth token" : "Requesting cached OAuth token");
    const result = await chrome.identity.getAuthToken({
      interactive,
      scopes: getRequestedScopes()
    }) as chrome.identity.GetAuthTokenResult | string;
    const token = typeof result === "string" ? result : result?.token;
    const grantedScopes = typeof result === "string" ? getRequestedScopes() : (result?.grantedScopes ?? getRequestedScopes());

    if (!token) {
      throw new Error("Google auth token unavailable.");
    }

    recordAuthStage("OAuth token granted");

    return {
      token,
      grantedScopes
    };
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const friendly = buildAuthErrorMessage(error);
    recordAuthStage("OAuth token request failed", friendly, raw);
    throw new Error(friendly);
  }
}

async function bootstrapSession(interactive = false): Promise<ApiSession | null> {
  const authorization = await getGoogleAuthorization(interactive);
  recordAuthStage("Loading Gmail profile");
  const profileResponse = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${authorization.token}`
    }
  });

  if (!profileResponse.ok) {
    recordAuthStage("Failed to load Gmail profile", "Could not load Gmail profile.", `gmail_profile_status_${profileResponse.status}`);
    throw new Error("Could not load Gmail profile.");
  }

  const profile = (await profileResponse.json()) as { emailAddress?: string; messagesTotal?: number };
  recordAuthStage("Bootstrapping Superbhuman API session");
  let sessionResponse: Response;

  try {
    ({ response: sessionResponse } = await fetchTrackingApi("/session/google", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accessToken: authorization.token,
        email: profile.emailAddress,
        grantedScopes: authorization.grantedScopes
      })
    }));
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    console.warn("[superbhuman] tracking API unavailable during auth bootstrap, using local session fallback", {
      error: raw
    });
    const localSession = await buildLocalSession(profile.emailAddress, authorization.token, authorization.grantedScopes);
    recordAuthStage("Session ready with local fallback", undefined, raw);
    return persistSession(localSession);
  }

  if (!sessionResponse.ok) {
    const raw = `api_session_status_${sessionResponse.status}`;
    console.warn("[superbhuman] tracking API returned an error during auth bootstrap, using local session fallback", {
      status: sessionResponse.status
    });
    const localSession = await buildLocalSession(profile.emailAddress, authorization.token, authorization.grantedScopes);
    recordAuthStage("Session ready with local fallback", undefined, raw);
    return persistSession(localSession);
  }

  const session = (await sessionResponse.json()) as ApiSession;
  recordAuthStage("Session ready");
  return persistSession(session);
}

async function getSession(): Promise<ApiSession | null> {
  const session = await readStoredSession();

  if (!session) {
    return bootstrapSession(false).catch(() => null);
  }

  if (!session.grantedScopes?.length && hasConfiguredGoogleOAuth(getManifest())) {
    return bootstrapSession(false).catch(() => session);
  }

  return session;
}

async function getAuthDiagnostics(): Promise<AuthDiagnostics> {
  const manifest = getManifest();
  const session = await readStoredSession();

  return {
    extensionId: chrome.runtime.id,
    clientId: manifest.oauth2?.client_id,
    hasOAuthClient: hasConfiguredGoogleOAuth(manifest),
    requestedScopes: getRequestedScopes(),
    sessionEmail: session?.email ?? session?.userId,
    lastStage: lastAuthStage,
    lastError: lastAuthError,
    lastRawError: lastRawAuthError,
    updatedAt: lastAuthUpdatedAt
  };
}

async function gmailApi(path: string, method = "GET", body?: unknown) {
  const session = await getSession();
  if (!session) {
    throw new Error("Connect Gmail in Superbhuman settings before using Gmail API features.");
  }

  if (!hasRequiredGoogleScopes(session, getRequestedScopes())) {
    throw new Error("Reconnect Gmail in Superbhuman settings and approve the required Gmail scopes before using Gmail API features.");
  }

  const authorization = await getGoogleAuthorization(false).catch((error) => {
    throw new Error(
      error instanceof Error
        ? `${error.message} Reconnect Gmail in Superbhuman settings before using Gmail API features.`
        : "Reconnect Gmail in Superbhuman settings before using Gmail API features."
    );
  });

  let response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${authorization.token}`,
      "Content-Type": "application/json"
    },
    body: method === "GET" ? undefined : JSON.stringify(body)
  });

  if (response.status === 401) {
    await chrome.identity.removeCachedAuthToken({ token: authorization.token }).catch(() => undefined);
    throw new Error("Your Gmail authorization expired. Reconnect Gmail in Superbhuman settings and approve access again.");
  }

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
    case "auth:get-diagnostics":
      return getAuthDiagnostics();
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
