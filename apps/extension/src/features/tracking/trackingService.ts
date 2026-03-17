import {
  buildTrackingPixelUrl,
  injectTrackingPixel,
  mergeTrackerStatus,
  type TrackedMessageRecord,
  type TrackerStatus,
  type UserPreferences
} from "@superbhuman/shared";

import { fetchTrackingStatus, registerTracking } from "../../lib/gmailApi";
import { resolveApiBaseUrl } from "../../lib/apiBaseUrl";
import { cn } from "../../lib/runtime";
import type { GmailDomAdapter } from "../gmail/domAdapter";

interface ComposeState {
  enabled: boolean;
  token?: string;
  button: HTMLButtonElement;
}

interface ComposeTrackingCallbacks {
  onRegistered?(record: TrackedMessageRecord, apiBaseUrl: string): void;
  onError?(message: string): void;
}

export class ComposeTrackingController {
  private readonly composeStates = new WeakMap<HTMLElement, ComposeState>();
  private observer?: MutationObserver;

  constructor(
    private readonly adapter: GmailDomAdapter,
    private preferences: UserPreferences,
    private readonly callbacks: ComposeTrackingCallbacks = {}
  ) {}

  start(): void {
    if (this.observer) {
      return;
    }

    this.scanComposeWindows();
    this.observer = new MutationObserver(() => this.scanComposeWindows());
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  stop(): void {
    this.observer?.disconnect();
    this.observer = undefined;
  }

  setPreferences(preferences: UserPreferences): void {
    this.preferences = preferences;
    this.scanComposeWindows();
  }

  toggleActiveCompose(): boolean | undefined {
    const compose = this.adapter.getComposeWindows().at(-1);
    if (!compose) {
      return undefined;
    }

    const state = this.composeStates.get(compose);
    if (!state) {
      return undefined;
    }

    state.enabled = !state.enabled;
    this.syncButtonState(state.button, state.enabled);
    return state.enabled;
  }

  async resolveCurrentThreadStatus(): Promise<TrackerStatus | undefined> {
    const tokens = this.adapter.getCurrentThreadTokens();
    const statuses = await Promise.all(tokens.map((token) => fetchTrackingStatus(token).catch(() => undefined)));
    return mergeTrackerStatus(statuses.filter((status): status is TrackerStatus => Boolean(status)));
  }

  private scanComposeWindows(): void {
    for (const compose of this.adapter.getComposeWindows()) {
      if (this.composeStates.has(compose)) {
        continue;
      }

      const toolbar = this.adapter.getComposeToolbar(compose);
      const sendButton = this.adapter.getComposeSendButton(compose);

      if (!toolbar || !sendButton) {
        continue;
      }

      const button = document.createElement("button");
      button.type = "button";
      button.className = "sb-compose-toggle";
      toolbar.appendChild(button);

      const state: ComposeState = {
        enabled: this.preferences.trackingEnabledByDefault,
        button
      };
      this.composeStates.set(compose, state);
      this.syncButtonState(button, state.enabled);

      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        state.enabled = !state.enabled;
        this.syncButtonState(button, state.enabled);
      });

      sendButton.addEventListener(
        "click",
        () => {
          void this.injectTracking(compose, state);
        },
        true
      );

      compose.addEventListener(
        "keydown",
        (event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            void this.injectTracking(compose, state);
          }
        },
        true
      );
    }
  }

  private syncButtonState(button: HTMLButtonElement, enabled: boolean) {
    button.textContent = enabled ? "Read Status On" : "Read Status Off";
    button.className = cn("sb-compose-toggle", enabled && "is-enabled");
  }

  private async injectTracking(compose: HTMLElement, state: ComposeState): Promise<void> {
    if (!state.enabled) {
      return;
    }

    const body = this.adapter.getComposeBody(compose);
    if (!body) {
      return;
    }

    state.token = crypto.randomUUID();
    const apiBaseUrl = resolveApiBaseUrl(this.preferences);
    const pixelUrl = buildTrackingPixelUrl(apiBaseUrl, state.token);
    body.innerHTML = injectTrackingPixel(body.innerHTML, pixelUrl, state.token);

    const record: TrackedMessageRecord = {
      token: state.token,
      recipientEmails: this.adapter.getComposeRecipients(compose),
      sentAt: new Date().toISOString(),
      subject: compose.querySelector<HTMLInputElement>('input[name="subjectbox"]')?.value ?? undefined,
      openCount: 0
    };

    await registerTracking({
      token: record.token,
      recipientEmails: record.recipientEmails,
      sentAt: record.sentAt,
      subject: record.subject
    })
      .then(() => this.callbacks.onRegistered?.(record, apiBaseUrl))
      .catch((error) =>
        this.callbacks.onError?.(
          error instanceof Error ? error.message : "Read status registration failed."
        )
      );
  }
}
