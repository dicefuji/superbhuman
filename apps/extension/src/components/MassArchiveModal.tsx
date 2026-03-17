import { ARCHIVE_THRESHOLDS, type ArchivePreview, type ArchiveThreshold } from "@superbhuman/shared";

import type { ArchivePreviewOptions } from "../features/archive/archiveService";

interface MassArchiveModalProps {
  open: boolean;
  loading: boolean;
  options: ArchivePreviewOptions;
  preview?: ArchivePreview;
  onClose(): void;
  onPreview(options: ArchivePreviewOptions): void;
  onRun(): void;
  onChange(options: ArchivePreviewOptions): void;
}

export function MassArchiveModal(props: MassArchiveModalProps) {
  if (!props.open) {
    return null;
  }

  return (
    <>
      <div className="sb-modal-backdrop" onClick={props.onClose} />
      <aside className="sb-archive-modal">
        <h2 className="sb-panel-title">Get Me To Zero</h2>
        <p className="sb-panel-copy">Preview older messages, keep what matters, and archive the rest in one pass.</p>

        <div className="sb-threshold-grid">
          {(Object.keys(ARCHIVE_THRESHOLDS) as ArchiveThreshold[]).map((threshold) => (
            <button
              key={threshold}
              className="sb-choice"
              data-active={props.options.threshold === threshold}
              type="button"
              onClick={() => props.onChange({ ...props.options, threshold })}
            >
              {ARCHIVE_THRESHOLDS[threshold].label}
            </button>
          ))}
        </div>

        <div className="sb-switch">
          <span>Keep unread</span>
          <input
            type="checkbox"
            checked={props.options.keepUnread}
            onChange={(event) => props.onChange({ ...props.options, keepUnread: event.target.checked })}
          />
        </div>

        <div className="sb-switch">
          <span>Keep starred</span>
          <input
            type="checkbox"
            checked={props.options.keepStarred}
            onChange={(event) => props.onChange({ ...props.options, keepStarred: event.target.checked })}
          />
        </div>

        {props.preview ? (
          <div className="sb-switch">
            <div>
              <strong>{props.preview.total.toLocaleString()} messages matched</strong>
              <div className="sb-muted">{props.preview.query}</div>
            </div>
          </div>
        ) : null}

        <div className="sb-button-row">
          <button className="sb-button sb-button-secondary" type="button" onClick={() => props.onPreview(props.options)}>
            {props.loading ? "Loading..." : "Preview"}
          </button>
          <button className="sb-button sb-button-primary" type="button" onClick={props.onRun} disabled={!props.preview || props.loading}>
            Archive
          </button>
        </div>
      </aside>
    </>
  );
}
