import type { ApiSession } from "@superbhuman/shared";
import { useEffect, useState } from "react";

import { checkTrackingApiHealth, getApiSession, signInWithGoogle } from "../lib/gmailApi";
import { isLocalApiBaseUrl, normalizeApiBaseUrl } from "../lib/apiBaseUrl";
import { loadPreferences, savePreferences } from "../lib/storage";

export function OptionsApp() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [trackingEnabled, setTrackingEnabled] = useState(true);
  const [chromeSafeShortcuts, setChromeSafeShortcuts] = useState(true);
  const [archiveKeepUnread, setArchiveKeepUnread] = useState(true);
  const [archiveKeepStarred, setArchiveKeepStarred] = useState(true);
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [checkingApi, setCheckingApi] = useState(false);
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    void Promise.all([loadPreferences(), getApiSession().catch(() => null)]).then(([preferences, apiSession]) => {
      setTrackingEnabled(preferences.trackingEnabledByDefault);
      setChromeSafeShortcuts(preferences.chromeSafeShortcuts);
      setArchiveKeepUnread(preferences.archiveKeepUnread);
      setArchiveKeepStarred(preferences.archiveKeepStarred);
      setApiBaseUrl(preferences.apiBaseUrl);
      setSession(apiSession);
      setLoading(false);
    });
  }, []);

  async function save() {
    setSaving(true);
    const preferences = await loadPreferences();
    await savePreferences({
      ...preferences,
      apiBaseUrl: normalizeApiBaseUrl(apiBaseUrl),
      trackingEnabledByDefault: trackingEnabled,
      chromeSafeShortcuts,
      archiveKeepUnread,
      archiveKeepStarred
    });
    setStatus("Saved.");
    setSaving(false);
  }

  async function connect() {
    setStatus("Connecting to Google...");
    const nextSession = await signInWithGoogle().catch(() => null);
    setSession(nextSession);
    setStatus(nextSession ? "Connected." : "Connection failed.");
  }

  async function checkApi() {
    setCheckingApi(true);
    try {
      const normalizedUrl = normalizeApiBaseUrl(apiBaseUrl);
      await checkTrackingApiHealth(normalizedUrl);
      setStatus(`Tracking API reachable at ${normalizedUrl}.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Tracking API unreachable.");
    } finally {
      setCheckingApi(false);
    }
  }

  if (loading) {
    return <main className="sb-options">Loading…</main>;
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
          <p className="sb-muted">{session ? `Connected as ${session.email ?? session.userId}` : "Not connected yet."}</p>
          <button className="sb-button sb-button-primary" type="button" onClick={() => void connect()}>
            Connect Gmail
          </button>
        </div>

        <div className="sb-field">
          <label>
            <input type="checkbox" checked={trackingEnabled} onChange={(event) => setTrackingEnabled(event.target.checked)} /> Enable
            read statuses by default
          </label>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={chromeSafeShortcuts}
              onChange={(event) => setChromeSafeShortcuts(event.target.checked)}
            />{" "}
            Prefer Chrome-safe shortcut remaps
          </label>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={archiveKeepUnread}
              onChange={(event) => setArchiveKeepUnread(event.target.checked)}
            />{" "}
            Keep unread when running Get Me To Zero
          </label>
        </div>

        <div className="sb-field">
          <label>
            <input
              type="checkbox"
              checked={archiveKeepStarred}
              onChange={(event) => setArchiveKeepStarred(event.target.checked)}
            />{" "}
            Keep starred when running Get Me To Zero
          </label>
        </div>

        <div className="sb-field">
          <strong>API base URL</strong>
          <input type="text" value={apiBaseUrl} onChange={(event) => setApiBaseUrl(event.target.value)} />
          <p className="sb-muted">
            For real read receipts, this must be a public URL that Gmail or the recipient’s mail client can reach.
          </p>
          {isLocalApiBaseUrl(normalizeApiBaseUrl(apiBaseUrl)) ? (
            <p className="sb-muted">
              `localhost` and `127.0.0.1` are only useful for local API testing. They will not produce real remote opens.
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
