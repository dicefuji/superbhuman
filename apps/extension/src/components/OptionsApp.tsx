import type { ApiSession, AuthDiagnostics, TrackingSession, UserPreferences } from "@superbhuman/shared";
import { useEffect, useMemo, useState } from "react";

import {
  checkTrackingApiHealth,
  getApiSession,
  getAuthDiagnostics,
  getTrackingSession,
  logoutTrackingSession,
  signInWithGoogle,
  startTrackingAuth
} from "../lib/gmailApi";
import { TRACKING_API_BASE_URL } from "../env";
import { isTrackingConfigured, resolveApiBaseUrl } from "../lib/apiBaseUrl";
import { getMissingGoogleScopes, getRequiredGoogleScopes, hasConfiguredGoogleOAuth, hasRequiredGoogleScopes } from "../lib/googleAuth";
import { formatTimestamp } from "../lib/runtime";
import { loadPreferences, savePreferences } from "../lib/storage";

type ManifestWithOAuth = chrome.runtime.Manifest & {
  oauth2?: {
    client_id?: string;
    scopes?: string[];
  };
};

type TrackingHealthStatus = "disabled" | "checking" | "reachable" | "error";

function formatScopeLabel(scope: string): string {
  return scope.replace("https://www.googleapis.com/auth/", "").replace("https://www.googleapis.com/", "");
}

export function OptionsApp() {
  const manifest = useMemo(() => chrome.runtime.getManifest() as ManifestWithOAuth, []);
  const requiredScopes = useMemo(() => getRequiredGoogleScopes(manifest), [manifest]);
  const trackingConfigured = useMemo(() => isTrackingConfigured(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [trackingConnecting, setTrackingConnecting] = useState(false);
  const [trackingLoggingOut, setTrackingLoggingOut] = useState(false);
  const [checkingTracking, setCheckingTracking] = useState(false);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [trackingSession, setTrackingSession] = useState<TrackingSession | null>(null);
  const [authDiagnostics, setAuthDiagnostics] = useState<AuthDiagnostics | null>(null);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [trackingHealth, setTrackingHealth] = useState<TrackingHealthStatus>(trackingConfigured ? "checking" : "disabled");
  const [trackingHealthMessage, setTrackingHealthMessage] = useState<string>("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void Promise.all([
      loadPreferences(),
      getApiSession().catch(() => null),
      getTrackingSession().catch(() => null)
    ]).then(async ([loadedPreferences, apiSession, hostedTrackingSession]) => {
      const diagnostics = await getAuthDiagnostics().catch(() => null);
      setPreferences(loadedPreferences);
      setSession(apiSession);
      setTrackingSession(hostedTrackingSession);
      setAuthDiagnostics(diagnostics);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!trackingConfigured) {
      setTrackingHealth("disabled");
      setTrackingHealthMessage("Read statuses are not configured in this build.");
      return;
    }

    const refresh = async () => {
      setCheckingTracking(true);
      setTrackingHealth("checking");
      try {
        const apiBaseUrl = resolveApiBaseUrl();
        await checkTrackingApiHealth();
        setTrackingHealth("reachable");
        setTrackingHealthMessage(`Hosted backend reachable at ${new URL(apiBaseUrl).origin}.`);
      } catch (error) {
        setTrackingHealth("error");
        setTrackingHealthMessage(error instanceof Error ? error.message : "Could not reach the hosted tracking backend.");
      } finally {
        setCheckingTracking(false);
      }
    };

    void refresh();
  }, [trackingConfigured]);

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

  if (loading || !preferences) {
    return <main className="sb-options">Loading…</main>;
  }

  const oauthConfigured = hasConfiguredGoogleOAuth(manifest);
  const missingScopes = getMissingGoogleScopes(session?.grantedScopes, requiredScopes);
  const gmailAuthReady = Boolean(session && hasRequiredGoogleScopes(session, requiredScopes));
  const trackingApiOrigin = trackingConfigured && TRACKING_API_BASE_URL ? new URL(resolveApiBaseUrl()).origin : undefined;

  async function refreshAuthDiagnostics() {
    try {
      setAuthDiagnostics(await getAuthDiagnostics());
    } catch {
      setAuthDiagnostics(null);
    }
  }

  async function refreshTrackingHealth() {
    if (!trackingConfigured) {
      setTrackingHealth("disabled");
      setTrackingHealthMessage("Read statuses are not configured in this build.");
      return;
    }

    setCheckingTracking(true);
    setTrackingHealth("checking");
    try {
      await checkTrackingApiHealth();
      setTrackingHealth("reachable");
      setTrackingHealthMessage(`Hosted backend reachable at ${trackingApiOrigin}.`);
    } catch (error) {
      setTrackingHealth("error");
      setTrackingHealthMessage(error instanceof Error ? error.message : "Could not reach the hosted tracking backend.");
    } finally {
      setCheckingTracking(false);
    }
  }

  async function save() {
    if (!preferences) {
      return;
    }

    setSaving(true);
    try {
      await savePreferences(preferences);
      setStatus("Saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save preferences.");
    } finally {
      setSaving(false);
    }
  }

  async function connectGmail() {
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

  async function enableTracking() {
    setTrackingConnecting(true);
    setStatus("Opening Google sign-in for hosted read statuses...");
    try {
      const nextSession = await startTrackingAuth();
      setTrackingSession(nextSession);
      setStatus(nextSession ? `Read statuses enabled for ${nextSession.email}.` : "Read status sign-in failed.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Read status sign-in failed.");
    } finally {
      setTrackingConnecting(false);
      await refreshTrackingHealth();
    }
  }

  async function disableTracking() {
    setTrackingLoggingOut(true);
    try {
      await logoutTrackingSession();
      setTrackingSession(null);
      setStatus("Read statuses disabled.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not disable read statuses.");
    } finally {
      setTrackingLoggingOut(false);
    }
  }

  return (
    <main className="sb-options">
      <section className="sb-options-card">
        <h1 className="sb-panel-title">Superbhuman</h1>
        <p className="sb-panel-copy">
          Gmail power layer for keyboard-driven triage, split inboxes, fast bulk actions, and best-effort read statuses.
        </p>

        <div className="sb-status-grid">
          <section className="sb-status-card">
            <div className="sb-read-status-row">
              <strong>Gmail Auth</strong>
              <span className={`sb-status-pill ${gmailAuthReady ? "" : oauthConfigured ? "is-warning" : "is-danger"}`}>
                {gmailAuthReady ? "Ready" : oauthConfigured ? "Needs consent" : "Not configured"}
              </span>
            </div>
            <p className="sb-muted">
              {gmailAuthReady
                ? "Gmail API features are unlocked and do not require any Superbhuman backend."
                : oauthConfigured
                  ? "Connect Gmail and approve the required scopes before using Gmail-powered actions."
                  : "This extension build does not yet include a Google OAuth client."}
            </p>
            <p className="sb-muted">Required scopes: {requiredScopes.map(formatScopeLabel).join(", ")}</p>
            {session?.grantedScopes?.length ? (
              <p className="sb-muted">Granted scopes: {session.grantedScopes.map(formatScopeLabel).join(", ")}</p>
            ) : null}
            {missingScopes.length && oauthConfigured ? (
              <p className="sb-muted">Missing scopes: {missingScopes.map(formatScopeLabel).join(", ")}</p>
            ) : null}
            <button
              className="sb-button sb-button-primary"
              type="button"
              onClick={() => void connectGmail()}
              disabled={!oauthConfigured || connecting}
            >
              {connecting ? "Connecting..." : "Connect Gmail"}
            </button>
          </section>

          <section className="sb-status-card">
            <div className="sb-read-status-row">
              <strong>Read Statuses</strong>
              <span
                className={`sb-status-pill ${
                  !trackingConfigured
                    ? "is-neutral"
                    : trackingSession
                      ? ""
                      : trackingHealth === "error"
                        ? "is-danger"
                        : "is-warning"
                }`}
              >
                {!trackingConfigured ? "Not configured" : trackingSession ? "Enabled" : "Needs setup"}
              </span>
            </div>
            <p className="sb-muted">
              Best-effort opens for sent emails. Gmail image proxying and privacy protections can distort exact read timing and counts.
            </p>
            <p className="sb-muted">{trackingHealthMessage}</p>
            {trackingConfigured && trackingApiOrigin ? (
              <p className="sb-muted">
                Hosted backend origin: <code className="sb-diagnostics-value">{trackingApiOrigin}</code>
              </p>
            ) : null}
            {trackingSession ? (
              <p className="sb-muted">
                Enabled as <code className="sb-diagnostics-value">{trackingSession.email}</code>
              </p>
            ) : null}
            <div className="sb-diagnostics-actions">
              {trackingConfigured ? (
                trackingSession ? (
                  <button className="sb-button sb-button-secondary" type="button" onClick={() => void disableTracking()}>
                    {trackingLoggingOut ? "Disabling..." : "Disable Read Statuses"}
                  </button>
                ) : (
                  <button className="sb-button sb-button-primary" type="button" onClick={() => void enableTracking()}>
                    {trackingConnecting ? "Enabling..." : "Enable Read Statuses"}
                  </button>
                )
              ) : null}
              {trackingConfigured ? (
                <button className="sb-button sb-button-secondary" type="button" onClick={() => void refreshTrackingHealth()}>
                  {checkingTracking ? "Checking..." : "Check backend"}
                </button>
              ) : null}
            </div>
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
            <p className="sb-muted">These values come from the extension background worker and help debug Gmail auth issues.</p>
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
            Use Chrome-safe shortcuts
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
            Keep unread emails out of Get Me To Zero
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
            Keep starred emails out of Get Me To Zero
          </label>
        </div>

        <div className="sb-button-row">
          <button className="sb-button sb-button-primary" type="button" onClick={() => void save()} disabled={saving}>
            {saving ? "Saving..." : "Save preferences"}
          </button>
          {status ? <span className="sb-muted">{status}</span> : null}
        </div>
      </section>
    </main>
  );
}
