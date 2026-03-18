import type { ApiSession, AuthDiagnostics, UserPreferences } from "@superbhuman/shared";
import { useEffect, useMemo, useState } from "react";

import { checkTrackingApiHealth, getApiSession, getAuthDiagnostics, signInWithGoogle } from "../lib/gmailApi";
import { formatTimestamp } from "../lib/runtime";
import {
  assertSupportedTrackingApiBaseUrl,
  getTrackingOrigin,
  isLocalApiBaseUrl,
  isPublicHttpsApiBaseUrl,
  normalizeApiBaseUrl
} from "../lib/apiBaseUrl";
import {
  getMissingGoogleScopes,
  getRequiredGoogleScopes,
  hasConfiguredGoogleOAuth,
  hasRequiredGoogleScopes
} from "../lib/googleAuth";
import { loadPreferences, savePreferences } from "../lib/storage";
import { ensureTrackingOriginPermission, hasTrackingOriginPermission } from "../lib/trackingPermissions";

type ManifestWithOAuth = chrome.runtime.Manifest & {
  oauth2?: {
    client_id?: string;
    scopes?: string[];
  };
};

function formatScopeLabel(scope: string): string {
  return scope.replace("https://www.googleapis.com/auth/", "").replace("https://www.googleapis.com/", "");
}

export function OptionsApp() {
  const manifest = useMemo(() => chrome.runtime.getManifest() as ManifestWithOAuth, []);
  const requiredScopes = useMemo(() => getRequiredGoogleScopes(manifest), [manifest]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checkingApi, setCheckingApi] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [trackingPermissionGranted, setTrackingPermissionGranted] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void Promise.all([loadPreferences(), getApiSession().catch(() => null)]).then(async ([loadedPreferences, apiSession]) => {
      const diagnostics = await getAuthDiagnostics().catch(() => null);
      setPreferences(loadedPreferences);
      setSession(apiSession);
      setAuthDiagnostics(diagnostics);
      setTrackingPermissionGranted(await hasTrackingOriginPermission(loadedPreferences.apiBaseUrl).catch(() => false));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!connecting) {
      return;
    }

    const refreshDiagnostics = () => {
      void getAuthDiagnostics()
        .then(setAuthDiagnostics)
        .catch(() => setAuthDiagnostics(null));
    };

    refreshDiagnostics();
    const pollId = window.setInterval(refreshDiagnostics, 1000);
    const waitingId = window.setTimeout(() => {
      setStatus("Still waiting for Chrome to open the Google auth dialog. Check Auth Diagnostics below if nothing appears.");
      refreshDiagnostics();
    }, 2500);

    return () => {
      window.clearInterval(pollId);
      window.clearTimeout(waitingId);
    };
  }, [connecting]);

  useEffect(() => {
    if (!preferences) {
      return;
    }

    void hasTrackingOriginPermission(preferences.apiBaseUrl)
      .then(setTrackingPermissionGranted)
      .catch(() => setTrackingPermissionGranted(false));
  }, [preferences?.apiBaseUrl]);

  if (loading || !preferences) {
    return <main className="sb-options">Loading…</main>;
  }

  const normalizedApiBaseUrl = (() => {
    try {
      return normalizeApiBaseUrl(preferences.apiBaseUrl);
    } catch {
      return undefined;
    }
  })();
  const apiUrlError = (() => {
    try {
      normalizeApiBaseUrl(preferences.apiBaseUrl);
      return undefined;
    } catch (error) {
      return error instanceof Error ? error.message : "Tracking API URL is invalid.";
    }
  })();
  const oauthConfigured = hasConfiguredGoogleOAuth(manifest);
  const missingScopes = getMissingGoogleScopes(session?.grantedScopes, requiredScopes);
  const authReady = Boolean(session && hasRequiredGoogleScopes(session, requiredScopes));
  const apiIsLocal = normalizedApiBaseUrl ? isLocalApiBaseUrl(normalizedApiBaseUrl) : false;
  const apiIsPublicHttps = normalizedApiBaseUrl ? isPublicHttpsApiBaseUrl(normalizedApiBaseUrl) : false;
  const apiNeedsPermission = apiIsPublicHttps && !trackingPermissionGranted;

  async function refreshAuthDiagnostics() {
    try {
      setAuthDiagnostics(await getAuthDiagnostics());
    } catch {
      setAuthDiagnostics(null);
    }
  }

  async function save() {
    const currentPreferences = preferences;
    if (!currentPreferences) {
      return;
    }

    setSaving(true);
    try {
      const normalizedUrl = assertSupportedTrackingApiBaseUrl(currentPreferences.apiBaseUrl);
      let approvedTrackingOrigin = currentPreferences.approvedTrackingOrigin;

      if (!isLocalApiBaseUrl(normalizedUrl)) {
        const permission = await ensureTrackingOriginPermission(normalizedUrl);
        approvedTrackingOrigin = permission.origin;
        setTrackingPermissionGranted(permission.granted);
      } else {
        approvedTrackingOrigin = undefined;
        setTrackingPermissionGranted(true);
      }

      const nextPreferences: UserPreferences = {
        ...currentPreferences,
        apiBaseUrl: normalizedUrl,
        approvedTrackingOrigin
      };

      await savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setStatus(
        approvedTrackingOrigin || isLocalApiBaseUrl(normalizedUrl)
          ? "Saved."
          : `Saved, but Chrome permission for ${getTrackingOrigin(normalizedUrl)} is still missing.`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function connect() {
    console.info("[superbhuman] Connect Gmail clicked", {
      extensionId: chrome.runtime.id,
      clientId: manifest.oauth2?.client_id
    });
    setConnecting(true);
    setStatus("Opening Google account chooser...");
    try {
      const nextSession = await signInWithGoogle();
      setSession(nextSession);
      setStatus(nextSession ? "Connected to Gmail." : "Connection failed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed.");
    } finally {
      setConnecting(false);
      await refreshAuthDiagnostics();
    }
  }

  async function checkApi() {
    const currentPreferences = preferences;
    if (!currentPreferences) {
      return;
    }

    setCheckingApi(true);
    try {
      const normalizedUrl = assertSupportedTrackingApiBaseUrl(currentPreferences.apiBaseUrl);

      let approvedTrackingOrigin = currentPreferences.approvedTrackingOrigin;
      if (!isLocalApiBaseUrl(normalizedUrl)) {
        const permission = await ensureTrackingOriginPermission(normalizedUrl);
        setTrackingPermissionGranted(permission.granted);
        approvedTrackingOrigin = permission.origin;

        if (!permission.granted) {
          const nextPreferences: UserPreferences = {
            ...currentPreferences,
            apiBaseUrl: normalizedUrl,
            approvedTrackingOrigin: undefined,
            lastApiHealthCheckAt: new Date().toISOString(),
            lastApiHealthStatus: "error" as const
          };
          await savePreferences(nextPreferences);
          setPreferences(nextPreferences);
          setStatus(`Chrome permission for ${getTrackingOrigin(normalizedUrl)} was not granted.`);
          return;
        }
      }

      await checkTrackingApiHealth(normalizedUrl);
      const nextPreferences: UserPreferences = {
        ...currentPreferences,
        apiBaseUrl: normalizedUrl,
        approvedTrackingOrigin,
        lastApiHealthCheckAt: new Date().toISOString(),
        lastApiHealthStatus: "ok" as const
      };
      await savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setStatus(`Tracking API reachable at ${normalizedUrl}.`);
    } catch (error) {
      const nextPreferences: UserPreferences = {
        ...currentPreferences,
        lastApiHealthCheckAt: new Date().toISOString(),
        lastApiHealthStatus: "error" as const
      };
      await savePreferences(nextPreferences);
      setPreferences(nextPreferences);
      setStatus(error instanceof Error ? error.message : "Tracking API unreachable.");
    } finally {
      setCheckingApi(false);
    }
  }

  return (
    <main className="sb-options">
      <section className="sb-options-card">
        <h1 className="sb-panel-title">Superbhuman</h1>
        <p className="sb-panel-copy">
          Private-first Gmail acceleration with a command center, split inbox, mass archive, and read status tracking.
        </p>

        <div className="sb-field">
          <strong>Google connection</strong>
          <p className="sb-muted">
            Extension ID: <code>{chrome.runtime.id}</code>
          </p>
          <p className="sb-muted">
            {oauthConfigured
              ? session
                ? `Connected as ${session.email ?? session.userId}.`
                : "OAuth is configured in this build, but Gmail is not connected yet."
              : "OAuth is not configured in this build yet. Set WXT_GOOGLE_OAUTH_CLIENT_ID and WXT_EXTENSION_KEY, then rebuild and reload."}
          </p>
          <button
            className="sb-button sb-button-primary"
            type="button"
            onClick={() => void connect()}
            disabled={!oauthConfigured || connecting}
          >
            {connecting ? "Connecting..." : "Connect Gmail"}
          </button>
        </div>

        <div className="sb-status-grid">
          <section className="sb-status-card">
            <div className="sb-read-status-row">
              <strong>Gmail Auth</strong>
              <span className={`sb-status-pill ${authReady ? "" : oauthConfigured ? "is-warning" : "is-danger"}`}>
                {authReady ? "Ready" : oauthConfigured ? "Needs consent" : "Not configured"}
              </span>
            </div>
            <p className="sb-muted">
              {authReady
                ? "Gmail API features are unlocked."
                : oauthConfigured
                  ? "Connect Gmail and approve the required scopes before using mass archive or sender/company nuke."
                  : "This extension build does not yet have a Google OAuth client in the manifest."}
            </p>
            <p className="sb-muted">Required scopes: {requiredScopes.map(formatScopeLabel).join(", ")}</p>
            {session?.grantedScopes?.length ? (
              <p className="sb-muted">Granted scopes: {session.grantedScopes.map(formatScopeLabel).join(", ")}</p>
            ) : null}
            {missingScopes.length && oauthConfigured ? (
              <p className="sb-muted">Missing scopes: {missingScopes.map(formatScopeLabel).join(", ")}</p>
            ) : null}
          </section>

          <section className="sb-status-card">
            <div className="sb-read-status-row">
              <strong>Tracking API</strong>
              <span
                className={`sb-status-pill ${
                  preferences.lastApiHealthStatus === "ok"
                    ? ""
                    : preferences.lastApiHealthStatus === "error"
                      ? "is-danger"
                      : "is-neutral"
                }`}
              >
                {preferences.lastApiHealthStatus === "ok"
                  ? "Reachable"
                  : preferences.lastApiHealthStatus === "error"
                    ? "Needs attention"
                    : "Unchecked"}
              </span>
            </div>
            <p className="sb-muted">
              {preferences.lastApiHealthCheckAt
                ? `Last checked ${formatTimestamp(preferences.lastApiHealthCheckAt)}.`
                : "Check the configured tracking API before testing read receipts."}
            </p>
            {apiUrlError ? <p className="sb-muted">{apiUrlError}</p> : null}
          </section>

          <section className="sb-status-card">
            <div className="sb-read-status-row">
              <strong>Tracking Reachability</strong>
              <span
                className={`sb-status-pill ${
                  apiIsPublicHttps && trackingPermissionGranted
                    ? ""
                    : apiIsLocal
                      ? "is-warning"
                      : apiNeedsPermission
                        ? "is-danger"
                        : normalizedApiBaseUrl
                          ? "is-danger"
                          : "is-neutral"
                }`}
              >
                {apiIsPublicHttps && trackingPermissionGranted
                  ? "Public HTTPS"
                  : apiIsLocal
                    ? "Local only"
                    : apiNeedsPermission
                      ? "Permission required"
                      : normalizedApiBaseUrl
                        ? "Unsupported"
                        : "Invalid"}
              </span>
            </div>
            <p className="sb-muted">
              {apiIsPublicHttps && trackingPermissionGranted
                ? "Recipient opens can be recorded from Gmail's image proxy."
                : apiIsLocal
                  ? "Local URLs can prove the API is alive, but they cannot record real remote opens."
                  : apiNeedsPermission
                    ? "Save or check this URL and approve the Chrome permission request before using read statuses."
                    : normalizedApiBaseUrl
                      ? "Non-local tracking URLs must use HTTPS."
                      : "Enter a valid http:// or https:// URL."}
            </p>
            {preferences.approvedTrackingOrigin ? (
              <p className="sb-muted">Approved origin: {preferences.approvedTrackingOrigin}</p>
            ) : null}
          </section>

          <section className="sb-status-card sb-status-card-wide">
            <div className="sb-read-status-row">
              <strong>Auth Diagnostics</strong>
              <span
                className={`sb-status-pill ${
                  authDiagnostics?.lastError
                    ? "is-danger"
                    : authDiagnostics?.lastStage
                      ? "is-warning"
                      : "is-neutral"
                }`}
              >
                {authDiagnostics?.lastError ? "Error" : authDiagnostics?.lastStage ? "Tracing" : "Idle"}
              </span>
            </div>
            <p className="sb-muted">
              These values come from the extension background worker and should tell us whether the click reached
              Chrome's OAuth flow.
            </p>
            <p className="sb-muted">
              Extension ID: <code className="sb-diagnostics-value">{authDiagnostics?.extensionId ?? chrome.runtime.id}</code>
            </p>
            <p className="sb-muted">
              Manifest client ID:{" "}
              <code className="sb-diagnostics-value">
                {authDiagnostics?.clientId ?? manifest.oauth2?.client_id ?? "Missing from manifest"}
              </code>
            </p>
            <p className="sb-muted">
              Requested scopes:{" "}
              <code className="sb-diagnostics-value">
                {(authDiagnostics?.requestedScopes ?? requiredScopes).map(formatScopeLabel).join(", ")}
              </code>
            </p>
            <p className="sb-muted">
              Stored session:{" "}
              <code className="sb-diagnostics-value">{authDiagnostics?.sessionEmail ?? "No saved Gmail session"}</code>
            </p>
            <p className="sb-muted">
              Last stage: <code className="sb-diagnostics-value">{authDiagnostics?.lastStage ?? "No auth attempt yet"}</code>
            </p>
            <p className="sb-muted">
              Last error: <code className="sb-diagnostics-value">{authDiagnostics?.lastError ?? "None"}</code>
            </p>
            <p className="sb-muted">
              Last raw error: <code className="sb-diagnostics-value">{authDiagnostics?.lastRawError ?? "None"}</code>
            </p>
            <p className="sb-muted">
              Updated:{" "}
              <code className="sb-diagnostics-value">
                {authDiagnostics?.updatedAt ? formatTimestamp(authDiagnostics.updatedAt) : "Never"}
              </code>
            </p>
            <div className="sb-diagnostics-actions">
              <button className="sb-button sb-button-secondary" type="button" onClick={() => void refreshAuthDiagnostics()}>
                Refresh diagnostics
              </button>
            </div>
          </section>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={preferences.trackingEnabledByDefault}
              onChange={(event) =>
                setPreferences((current) =>
                  current
                    ? {
                        ...current,
                        trackingEnabledByDefault: event.target.checked
                      }
                    : current
                )
              }
            />{" "}
            Enable read statuses by default
          </label>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={preferences.chromeSafeShortcuts}
              onChange={(event) =>
                setPreferences((current) =>
                  current
                    ? {
                        ...current,
                        chromeSafeShortcuts: event.target.checked
                      }
                    : current
                )
              }
            />{" "}
            Prefer Chrome-safe shortcut remaps
          </label>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={preferences.archiveKeepUnread}
              onChange={(event) =>
                setPreferences((current) =>
                  current
                    ? {
                        ...current,
                        archiveKeepUnread: event.target.checked
                      }
                    : current
                )
              }
            />{" "}
            Keep unread when running Get Me To Zero
          </label>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={preferences.archiveKeepStarred}
              onChange={(event) =>
                setPreferences((current) =>
                  current
                    ? {
                        ...current,
                        archiveKeepStarred: event.target.checked
                      }
                    : current
                )
              }
            />{" "}
            Keep starred when running Get Me To Zero
          </label>
        </div>

        <div className="sb-field">
          <strong>API base URL</strong>
          <input
            type="text"
            value={preferences.apiBaseUrl}
            onChange={(event) =>
              setPreferences((current) =>
                current
                  ? {
                      ...current,
                      apiBaseUrl: event.target.value
                    }
                  : current
              )
            }
          />
          <p className="sb-muted">
            Use `http://127.0.0.1:8787` for local health checks. Use a public HTTPS URL for real read receipts.
          </p>
          {apiIsLocal ? (
            <p className="sb-muted">
              `localhost`, `127.0.0.1`, and `0.0.0.0` are local-only. Gmail's image proxy cannot call back into your laptop.
            </p>
          ) : null}
        </div>

        <div className="sb-button-row">
          <button className="sb-button sb-button-primary" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save preferences"}
          </button>
          <button className="sb-button sb-button-secondary" type="button" onClick={() => void checkApi()} disabled={checkingApi}>
            {checkingApi ? "Checking..." : "Check API"}
          </button>
          {status ? <span className="sb-muted">{status}</span> : null}
        </div>
      </section>
    </main>
  );
}
