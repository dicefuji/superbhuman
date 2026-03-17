import type { TrackedMessageRecord } from "@superbhuman/shared";

import { formatTimestamp } from "../lib/runtime";

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
            <p className="sb-panel-copy">Tracked messages appear here after you send them from Gmail with tracking enabled.</p>
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
                Open compose, leave “Read Status On” enabled, send an email, then come back here.
              </div>
            </div>
          ) : (
            props.items.map((item) => (
              <div key={item.token} className="sb-read-status-item">
                <div className="sb-read-status-row">
                  <div className="sb-command-title">{item.subject || "(No subject)"}</div>
                  <span className="sb-status-pill">{item.openCount ? `${item.openCount} opens` : "Unopened"}</span>
                </div>
                <div className="sb-command-description">{item.recipientEmails.join(", ") || "No recipients captured"}</div>
                <div className="sb-command-description">Sent: {formatTimestamp(item.sentAt)}</div>
                <div className="sb-command-description">First open: {formatTimestamp(item.firstOpenedAt)}</div>
                <div className="sb-command-description">Last open: {formatTimestamp(item.lastOpenedAt)}</div>
              </div>
            ))
          )}
        </div>
      </aside>
    </>
  );
}
