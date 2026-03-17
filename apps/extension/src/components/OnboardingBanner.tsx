interface OnboardingBannerProps {
  onEnable(): void;
  onDismiss(): void;
}

export function OnboardingBanner(props: OnboardingBannerProps) {
  return (
    <aside className="sb-onboarding">
      <h2 className="sb-panel-title">Turn on Gmail shortcuts</h2>
      <p className="sb-panel-copy">
        Superbhuman can navigate your inbox instantly once Gmail keyboard shortcuts are enabled. Try the automatic setup first.
      </p>
      <div className="sb-button-row">
        <button className="sb-button sb-button-primary" type="button" onClick={props.onEnable}>
          Enable for me
        </button>
        <button className="sb-button sb-button-secondary" type="button" onClick={props.onDismiss}>
          Dismiss
        </button>
      </div>
    </aside>
  );
}
