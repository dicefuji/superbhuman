import type { TrackerStatus } from "@superbhuman/shared";

import { formatTimestamp } from "../lib/runtime";

interface ThreadStatusCardProps {
  status?: TrackerStatus;
}

export function ThreadStatusCard(props: ThreadStatusCardProps) {
  if (!props.status) {
    return null;
  }

  return (
    <aside className="sb-thread-status">
      <span className="sb-status-pill">Best-effort Opens</span>
      <p className="sb-panel-copy">Opens: {props.status.openCount}</p>
      <p className="sb-panel-copy">Timing and counts may be distorted by image proxies and privacy protections.</p>
      <p className="sb-panel-copy">First open: {formatTimestamp(props.status.firstOpenedAt)}</p>
      <p className="sb-panel-copy">Last open: {formatTimestamp(props.status.lastOpenedAt)}</p>
    </aside>
  );
}
