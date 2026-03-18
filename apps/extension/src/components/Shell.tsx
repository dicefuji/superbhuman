import {
  DEFAULT_PREFERENCES,
  type ApiSession,
  type CommandDefinition,
  type CommandContext,
  type GmailRouteState,
  type Platform,
  type SplitMode,
  type TrackedMessageRecord,
  type TrackingSession,
  type TrackerStatus,
  type UserPreferences
} from "@superbhuman/shared";
import { startTransition, useEffect, useRef, useState } from "react";

import { getPlatform } from "../env";
import { isTrackingConfigured } from "../lib/apiBaseUrl";
import { getApiSession, getTrackingSession, gmailBatchDelete, gmailCreateFilter, gmailListMessages, listTrackingMessages } from "../lib/gmailApi";
import { hasRequiredGoogleScopes } from "../lib/googleAuth";
import {
  loadPreferences,
  loadTrackedMessages,
  savePreferences,
  saveTrackedMessages,
  updatePreferences,
  upsertTrackedMessage
} from "../lib/storage";
import { previewMassArchive, runMassArchive, type ArchivePreviewOptions } from "../features/archive/archiveService";
import { executeCommand, searchCommands } from "../features/command/commandRegistry";
import { GmailDomAdapter, type ThreadRowSnapshot } from "../features/gmail/domAdapter";
import { enableKeyboardShortcuts, shouldShowOnboarding } from "../features/onboarding/onboardingService";
import { mountKeyboardController } from "../features/shortcuts/keyboard";
import { applySplitMode, buildOverrideForThread, getSplitCounts } from "../features/split/splitService";
import { ComposeTrackingController } from "../features/tracking/trackingService";
import { CommandCenter } from "./CommandCenter";
import { MassArchiveModal } from "./MassArchiveModal";
import { OnboardingBanner } from "./OnboardingBanner";
import { ReadStatusPanel } from "./ReadStatusPanel";
import { SplitEmptyState } from "./SplitEmptyState";
import { SplitTabs } from "./SplitTabs";
import { ThreadStatusCard } from "./ThreadStatusCard";
import { ToastStack } from "./ToastStack";

interface Toast {
  id: string;
  message: string;
}

const INITIAL_ROUTE: GmailRouteState = {
  route: "unknown",
  hash: window.location.hash
};

export function Shell() {
  const platform = useRef<Platform>(getPlatform()).current;
  const trackingConfigured = useRef<boolean>(isTrackingConfigured()).current;
  const adapterRef = useRef<GmailDomAdapter | null>(null);
  const trackingRef = useRef<ComposeTrackingController | null>(null);
  const preferencesRef = useRef<UserPreferences>(DEFAULT_PREFERENCES);
  const splitModeRef = useRef<SplitMode>(DEFAULT_PREFERENCES.preferredSplitMode);
  const trackedMessagesRef = useRef<TrackedMessageRecord[]>([]);

  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_PREFERENCES);
  const [session, setSession] = useState<ApiSession | null>(null);
  const [trackingSession, setTrackingSession] = useState<TrackingSession | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);
  const [route, setRoute] = useState<GmailRouteState>(INITIAL_ROUTE);
  const [selectedThread, setSelectedThread] = useState<ThreadRowSnapshot | undefined>();
  const [visibleCount, setVisibleCount] = useState(0);
  const [splitCounts, setSplitCounts] = useState<Record<SplitMode, number>>({ important: 0, other: 0 });
  const [splitMode, setSplitModeState] = useState<SplitMode>(DEFAULT_PREFERENCES.preferredSplitMode);
  const [commandOpen, setCommandOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archivePreviewState, setArchivePreviewState] = useState<Awaited<ReturnType<typeof previewMassArchive>>>();
  const [archiveOptions, setArchiveOptions] = useState<ArchivePreviewOptions>({
    threshold: "1w",
    keepUnread: true,
    keepStarred: true,
    splitMode: DEFAULT_PREFERENCES.preferredSplitMode
  });
  const [threadStatus, setThreadStatus] = useState<TrackerStatus | undefined>();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [trackedMessages, setTrackedMessages] = useState<TrackedMessageRecord[]>([]);
  const [readStatusOpen, setReadStatusOpen] = useState(false);
  const [readStatusRefreshing, setReadStatusRefreshing] = useState(false);
  const trackingEnabled = trackingConfigured && Boolean(trackingSession);

  const commands = searchCommands(commandQuery).filter((command: CommandDefinition) =>
    trackingEnabled ? true : command.id !== "toggle-tracking"
  );

  const pushToast = (message: string) => {
    const id = crypto.randomUUID();
    setToasts((current) => [...current, { id, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 3500);
  };

  const syncDomStateRef = useRef<() => void>(() => undefined);
  syncDomStateRef.current = () => {
    const adapter = adapterRef.current;
    if (!adapter) {
      return;
    }

    const nextRoute = adapter.getRouteState();
    const allThreads = adapter.getThreadRows();
    const nextSplitCounts = getSplitCounts(allThreads, preferencesRef.current.splitOverrides);
    let visibleThreads = allThreads;

    if (["inbox", "search", "label"].includes(nextRoute.route)) {
      visibleThreads = applySplitMode(adapter, splitModeRef.current, preferencesRef.current.splitOverrides);
      if (visibleThreads.length && !visibleThreads.some((row) => row.id === adapter.getSelectedThread()?.id)) {
        adapter.focusThread(visibleThreads[0]);
      }
    }

    const nextSelected = adapter.getSelectedThread() ?? visibleThreads[0];

    startTransition(() => {
      setRoute(nextRoute);
      setSelectedThread(nextSelected);
      setVisibleCount(visibleThreads.length);
      setSplitCounts(nextSplitCounts);
    });

    if (trackingEnabled && trackingRef.current && nextRoute.route === "thread") {
      void trackingRef.current.resolveCurrentThreadStatus().then(setThreadStatus).catch(() => setThreadStatus(undefined));
    } else {
      setThreadStatus(undefined);
    }
  };

  useEffect(() => {
    void Promise.all([
      loadPreferences(),
      loadTrackedMessages(),
      getApiSession().catch(() => null),
      getTrackingSession().catch(() => null)
    ]).then(([loaded, tracked, apiSession, nextTrackingSession]) => {
      preferencesRef.current = loaded;
      splitModeRef.current = loaded.preferredSplitMode;
      setPreferences(loaded);
      setSession(apiSession);
      setTrackingSession(nextTrackingSession);
      setAuthLoaded(true);
      setSplitModeState(loaded.preferredSplitMode);
      setArchiveOptions((current) => ({
        ...current,
        keepUnread: loaded.archiveKeepUnread,
        keepStarred: loaded.archiveKeepStarred,
        splitMode: loaded.preferredSplitMode
      }));
      setOnboardingVisible(shouldShowOnboarding(loaded));
      setTrackedMessages(tracked);
    });
  }, []);

  useEffect(() => {
    const handleStorageChange: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
      if (areaName !== "local") {
        return;
      }

      if (changes.apiSession) {
        void getApiSession()
          .then(setSession)
          .catch(() => setSession(null));
      }

      if (changes.trackingSession) {
        void getTrackingSession()
          .then(setTrackingSession)
          .catch(() => setTrackingSession(null));
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  useEffect(() => {
    const adapter = new GmailDomAdapter();
    adapter.start();
    adapterRef.current = adapter;

    const unsubscribe = adapter.subscribe(() => syncDomStateRef.current());

    if (trackingEnabled) {
      const tracking = new ComposeTrackingController(adapter, preferencesRef.current, {
        onRegistered: (record) => {
          setReadStatusOpen(true);
          pushToast(`Best-effort opens armed for ${record.subject || "your email"}. Open Read Statuses to monitor activity.`);
          void upsertTrackedMessage(record).then(setTrackedMessages);
        },
        onRegistrationFailed: (record) => {
          setReadStatusOpen(true);
          void upsertTrackedMessage(record).then(setTrackedMessages);
        },
        onError: (message) => {
          pushToast(message);
        }
      });
      tracking.start();
      trackingRef.current = tracking;
    }
    syncDomStateRef.current();

    return () => {
      unsubscribe();
      trackingRef.current?.stop();
      trackingRef.current = null;
      adapter.stop();
    };
  }, [trackingEnabled]);

  useEffect(() => {
    const handler = () => {
      setCommandQuery("");
      setCommandOpen(true);
    };

    window.addEventListener("superbhuman:open-command-center", handler as EventListener);
    return () => window.removeEventListener("superbhuman:open-command-center", handler as EventListener);
  }, []);

  useEffect(() => {
    preferencesRef.current = preferences;
    if (trackingEnabled) {
      trackingRef.current?.setPreferences(preferences);
    }
    syncDomStateRef.current();
  }, [preferences, trackingEnabled]);

  useEffect(() => {
    trackedMessagesRef.current = trackedMessages;
  }, [trackedMessages]);

  useEffect(() => {
    splitModeRef.current = splitMode;
    setArchiveOptions((current) => ({ ...current, splitMode }));
    syncDomStateRef.current();
  }, [splitMode]);

  useEffect(() => {
    if (!trackingEnabled) {
      setReadStatusOpen(false);
      setReadStatusRefreshing(false);
      setThreadStatus(undefined);
      return;
    }

    void refreshTrackedMessages({ silent: true });

    const intervalId = window.setInterval(() => {
      void refreshTrackedMessages({ silent: true });
    }, 30000);

    return () => window.clearInterval(intervalId);
  }, [trackingEnabled, trackingSession?.userId]);

  useEffect(() => {
    return mountKeyboardController({
      platform,
      isEnabled: () => true,
      onCommand: (id) => {
        void runCommand(id);
      }
    });
  }, [platform, selectedThread, route, commandOpen, archiveOpen, preferences, splitMode]);

  async function persistPreferences(next: UserPreferences) {
    preferencesRef.current = next;
    setPreferences(next);
    await savePreferences(next);
  }

  function assertGmailApiReady(actionDescription: string) {
    if (!authLoaded || !session) {
      throw new Error(`Connect Gmail in Superbhuman settings before trying to ${actionDescription}.`);
    }

    if (!hasRequiredGoogleScopes(session)) {
      throw new Error(
        `Reconnect Gmail in Superbhuman settings and approve the required Gmail scopes before trying to ${actionDescription}.`
      );
    }
  }

  async function runCommand(id: Parameters<typeof executeCommand>[0]) {
    const adapter = adapterRef.current;
    if (!adapter) {
      return;
    }

    try {
      await executeCommand(id, {
        getContext: (): CommandContext => ({
          route,
          selectedThread,
          selectionCount: selectedThread ? 1 : 0,
          splitMode,
          hasCompose: adapter.getComposeWindows().length > 0,
          platform
        }),
        openCommandCenter: () => {
          setCommandQuery("");
          setCommandOpen(true);
        },
        closeOverlays: () => {
          if (commandOpen) {
            setCommandOpen(false);
            return true;
          }

          if (archiveOpen) {
            setArchiveOpen(false);
            return true;
          }

          if (readStatusOpen) {
            setReadStatusOpen(false);
            return true;
          }

          return false;
        },
        openMassArchive: () => setArchiveOpen(true),
        setSplitMode: (mode) => {
          setSplitModeState(mode);
          void updatePreferences((current) => ({ ...current, preferredSplitMode: mode })).then(setPreferences);
        },
        promptForFolder: () => {
          const destination = window.prompt("Folder, label, or Gmail search", route.searchQuery ?? "");
          if (destination) {
            adapter.switchFolder(destination);
          }
        },
        toggleTracking: () => {
          if (!trackingConfigured) {
            return Promise.reject(new Error("Read statuses are not available in this build."));
          }

          if (!trackingSession) {
            return Promise.reject(new Error("Enable Read Statuses in Superbhuman settings first."));
          }

          return Promise.resolve(trackingRef.current?.toggleActiveCompose());
        },
        showToast: pushToast,
        moveThreadToSplit: async (target) => {
          if (!selectedThread) {
            pushToast("No thread selected.");
            return;
          }

          const override = buildOverrideForThread(selectedThread, target);
          if (!override) {
            pushToast("Could not infer a sender or domain.");
            return;
          }

          const next = await updatePreferences((current) => ({
            ...current,
            splitOverrides: current.splitOverrides
              .filter((entry) => entry.sender !== override.sender && entry.domain !== override.domain)
              .concat(override)
          }));
          setPreferences(next);
          pushToast(target === "important" ? "Promoted sender into Important." : "Moved sender into Other.");
        },
        nukeSender: async () => {
          const sender = selectedThread?.senderEmail;
          if (!sender) {
            pushToast("No sender email found.");
            return;
          }

          await nukeByQuery(`from:${sender}`, { from: sender }, `Nuked ${sender}.`);
        },
        nukeCompany: async () => {
          const domain = selectedThread?.senderEmail?.split("@")[1];
          if (!domain) {
            pushToast("No sender domain found.");
            return;
          }

          await nukeByQuery(`from:(*@${domain})`, { from: `*@${domain}` }, `Nuked ${domain}.`);
        },
        adapter
      });
      setCommandOpen(false);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Command failed.");
    }
  }

  async function nukeByQuery(query: string, criteria: Record<string, string>, successMessage: string) {
    assertGmailApiReady("nuke emails");
    const messageIds = await listAllMessageIds(query);
    if (messageIds.length) {
      await gmailBatchDelete(messageIds);
    }

    await gmailCreateFilter({
      criteria,
      action: {
        addLabelIds: ["TRASH"],
        removeLabelIds: ["INBOX"]
      }
    }).catch(() => undefined);

    pushToast(successMessage);
    syncDomStateRef.current();
  }

  async function listAllMessageIds(query: string): Promise<string[]> {
    const ids: string[] = [];
    let pageToken: string | undefined;

    do {
      const response = await gmailListMessages<{ id: string; threadId: string }>(query, pageToken, 500);
      response.messages?.forEach((message) => ids.push(message.id));
      pageToken = response.nextPageToken;
    } while (pageToken);

    return ids;
  }

  async function handleArchivePreview(nextOptions = archiveOptions) {
    setArchiveLoading(true);
    try {
      assertGmailApiReady("preview Get Me To Zero");
      const preview = await previewMassArchive(nextOptions);
      setArchivePreviewState(preview);
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Could not build archive preview.");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleArchiveRun() {
    if (!archivePreviewState) {
      return;
    }

    setArchiveLoading(true);
    try {
      assertGmailApiReady("run Get Me To Zero");
      const result = await runMassArchive(archivePreviewState);
      pushToast(result.archivedCount ? `Archived ${result.archivedCount} messages.` : "Nothing matched your archive query.");
      setArchiveOpen(false);
      syncDomStateRef.current();
    } catch (error) {
      pushToast(error instanceof Error ? error.message : "Archive failed.");
    } finally {
      setArchiveLoading(false);
    }
  }

  async function handleOnboardingEnable() {
    const adapter = adapterRef.current;
    if (!adapter) {
      return;
    }

    const success = await enableKeyboardShortcuts(adapter);
    if (success) {
      const next = { ...preferencesRef.current, onboardingCompleted: true };
      await persistPreferences(next);
      setOnboardingVisible(false);
      pushToast("Gmail keyboard shortcuts enabled.");
      return;
    }

    pushToast("Automatic setup failed. Open Gmail settings and turn on Keyboard shortcuts manually.");
  }

  async function handleDismissOnboarding() {
    const next = { ...preferencesRef.current, onboardingCompleted: true };
    await persistPreferences(next);
    setOnboardingVisible(false);
  }

  async function refreshTrackedMessages(options: { silent?: boolean } = {}) {
    if (!trackingEnabled) {
      return;
    }

    const currentMessages = trackedMessagesRef.current;
    setReadStatusRefreshing(true);
    try {
      const checkedAt = new Date().toISOString();
      const remotePage = await listTrackingMessages(20);
      const remoteMessages: TrackedMessageRecord[] = remotePage.items.map((message) => ({
        ...message,
        lastStatusCheckedAt: checkedAt,
        lastStatusError: undefined
      }));
      const remoteByToken = new Map(remoteMessages.map((message) => [message.token, message]));
      const failedLocalOnly = currentMessages.filter(
        (message) => message.registrationStatus === "failed" && !remoteByToken.has(message.token)
      );
      const merged: TrackedMessageRecord[] = Array.from(remoteByToken.values())
        .concat(
          failedLocalOnly.map((message) => ({
            ...message,
            lastStatusCheckedAt: checkedAt
          }))
        )
        .sort((left, right) => new Date(right.sentAt).getTime() - new Date(left.sentAt).getTime());
      const saved = await saveTrackedMessages(merged);
      setTrackedMessages(saved);

      const currentThreadTokens = adapterRef.current?.getCurrentThreadTokens() ?? [];
      const current = saved.find((message) => currentThreadTokens.includes(message.token));
      if (current) {
        setThreadStatus({
          token: current.token,
          firstOpenedAt: current.firstOpenedAt,
          lastOpenedAt: current.lastOpenedAt,
          openCount: current.openCount
        });
      } else {
        setThreadStatus(undefined);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not refresh read statuses.";
      if (message.includes("Enable Read Statuses again")) {
        setTrackingSession(null);
      }

      if (!options.silent || message.includes("Enable Read Statuses again")) {
        pushToast(message);
      }
    } finally {
      setReadStatusRefreshing(false);
    }
  }

  return (
    <div className="sb-shell">
      <SplitTabs
        platform={platform}
        mode={splitMode}
        visibleCount={visibleCount}
        importantCount={splitCounts.important}
        otherCount={splitCounts.other}
        showReadStatuses={trackingEnabled}
        trackedCount={trackedMessages.length}
        openedCount={trackedMessages.filter((message) => message.openCount > 0).length}
        onModeChange={(mode) => {
          setSplitModeState(mode);
          void updatePreferences((current) => ({ ...current, preferredSplitMode: mode })).then(setPreferences);
        }}
        onOpenReadStatuses={() => {
          if (!trackingEnabled) {
            return;
          }

          setReadStatusOpen(true);
          void refreshTrackedMessages();
        }}
        onOpenCommandCenter={() => {
          setCommandQuery("");
          setCommandOpen(true);
        }}
      />

      <CommandCenter
        open={commandOpen}
        query={commandQuery}
        commands={commands}
        platform={platform}
        onQueryChange={setCommandQuery}
        onExecute={(id) => void runCommand(id)}
        onClose={() => setCommandOpen(false)}
      />

      <MassArchiveModal
        open={archiveOpen}
        loading={archiveLoading}
        options={archiveOptions}
        preview={archivePreviewState}
        onChange={(nextOptions) => {
          setArchiveOptions(nextOptions);
          setArchivePreviewState(undefined);
        }}
        onPreview={handleArchivePreview}
        onRun={handleArchiveRun}
        onClose={() => setArchiveOpen(false)}
      />

      {trackingEnabled ? <ThreadStatusCard status={threadStatus} /> : null}
      {trackingEnabled ? (
        <ReadStatusPanel
          open={readStatusOpen}
          items={trackedMessages}
          refreshing={readStatusRefreshing}
          onRefresh={() => void refreshTrackedMessages()}
          onClose={() => setReadStatusOpen(false)}
        />
      ) : null}
      <SplitEmptyState visible={route.route === "inbox" && visibleCount === 0 && (splitCounts.important + splitCounts.other) > 0} mode={splitMode} />
      <ToastStack toasts={toasts} />

      {onboardingVisible ? (
        <OnboardingBanner onEnable={() => void handleOnboardingEnable()} onDismiss={() => void handleDismissOnboarding()} />
      ) : null}
    </div>
  );
}
