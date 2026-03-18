import { DEFAULT_COMMAND_CENTER_SHORTCUT, type SplitMode } from "@superbhuman/shared";

import type { Platform } from "@superbhuman/shared";

interface SplitTabsProps {
  platform: Platform;
  mode: SplitMode;
  visibleCount: number;
  importantCount: number;
  otherCount: number;
  showReadStatuses: boolean;
  trackedCount: number;
  openedCount: number;
  onModeChange(mode: SplitMode): void;
  onOpenCommandCenter(): void;
  onOpenReadStatuses(): void;
}

export function SplitTabs(props: SplitTabsProps) {
  const commandCenterShortcut =
    props.platform === "mac"
      ? DEFAULT_COMMAND_CENTER_SHORTCUT.mac
      : DEFAULT_COMMAND_CENTER_SHORTCUT.windows;

  return (
    <div className="sb-topbar">
      <button className="sb-tab" data-active={props.mode === "important"} onClick={() => props.onModeChange("important")}>
        Important {props.importantCount}
      </button>
      <button className="sb-tab" data-active={props.mode === "other"} onClick={() => props.onModeChange("other")}>
        Other {props.otherCount}
      </button>
      <span className="sb-kbd">{props.visibleCount} visible</span>
      {props.showReadStatuses ? (
        <button className="sb-tab" data-active="false" onClick={props.onOpenReadStatuses}>
          Read Statuses {props.openedCount}/{props.trackedCount}
        </button>
      ) : null}
      <button className="sb-tab" data-active="false" onClick={props.onOpenCommandCenter}>
        Command Center
      </button>
      <span className="sb-kbd">{commandCenterShortcut}</span>
    </div>
  );
}
