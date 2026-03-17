import type { SplitMode } from "@superbhuman/shared";

interface SplitEmptyStateProps {
  visible: boolean;
  mode: SplitMode;
}

export function SplitEmptyState(props: SplitEmptyStateProps) {
  if (!props.visible) {
    return null;
  }

  return (
    <aside className="sb-split-empty">
      <h2 className="sb-panel-title">{props.mode === "important" ? "Important is clear" : "Other is clear"}</h2>
      <p className="sb-panel-copy">
        {props.mode === "important"
          ? "No visible threads match Important right now. Promote a sender from the command center to tune the split."
          : "No visible threads match Other right now. Move a sender to Other or switch back to Important."}
      </p>
    </aside>
  );
}
