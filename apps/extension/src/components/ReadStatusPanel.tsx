import type { TrackedMessageRecord } from "@superbhuman/shared";

import { cn, formatTimestamp } from "../lib/runtime";

interface ReadStatusPanelProps {
  open: boolean;
  items: TrackedMessageRecord[];
  refreshing: boolean;
  onClose(): void;
  onRefresh(): void;
}

export function ReadStatusPanel(props: ReadStatusPanelProps) {
  if (!props.open) {
    return null;
  }

  return (
    <>
      <div className="sb-modal-backdrop" onClick={props.onClose} />
      <aside className="sb-read-status-panel">
        <div className="sb-read-status-header">
          <div>
            <h2 className="sb-panel-title">Read Statuses</h2>
            <p className="sb-panel-copy">
              Best-effort opens appear here after you send tracked email from Gmail. Privacy protections and image proxies can
              distort exact timing and counts.
            </p>
          </div>
          <button className="sb-button sb-button-secondary" type="button" onClick={props.onRefresh}>
            {props.refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        <div className="sb-read-status-list">
          {props.items.length === 0 ? (
            <div className="sb-read-status-item">
              <div className="sb-command-title">No tracked sends yet</div>
              <div className="sb-command-description">
                Open compose, leave “Read Status On” enabled, send an email, then come back here for best-effort open updates.
              </div>
            </div>
          ) : (
            props.items.map((item) => (
              <div key={item.token} className="sb-read-status-item">
                <div className="sb-read-status-row">
                  <div className="sb-command-title">{item.subject || "(No subject)"}</div>
                  <span
                    className={cn(
                      "sb-status-pill",
                      item.registrationStatus === "failed" && "is-danger",
                      item.registrationStatus === "registered" && !item.openCount && "is-neutral"
                    )}
                  >
                    {item.registrationStatus === "failed"
                      ? "Registration failed"
                      : item.openCount
                        ? `${item.openCount} opens`
                        : "Registered"}
                  </span>
                </div>
                <div className="sb-command-description">{item.recipientEmails.join(", ") || "No recipients captured"}</div>
                <div className="sb-command-description">Sent: {formatTimestamp(item.sentAt)}</div>
                <div className="sb-command-description">
                  Last refresh: {item.lastStatusCheckedAt ? formatTimestamp(item.lastStatusCheckedAt) : "Not checked yet"}
                </div>
                <div className="sb-command-description">First open: {formatTimestamp(item.firstOpenedAt)}</div>
                <div className="sb-command-description">Last open: {formatTimestamp(item.lastOpenedAt)}</div>
                {item.lastSourceKind ? <div className="sb-command-description">Latest source: {item.lastSourceKind}</div> : null}
                {item.registrationError ? (
                  <div className="sb-command-description">Registration error: {item.registrationError}</div>
                ) : null}
                {item.lastStatusError ? (
                  <div className="sb-command-description">Last refresh error: {item.lastStatusError}</div>
                ) : null}
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
