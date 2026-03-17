import type { SplitRule, UserPreferences } from "./types";

export const DEFAULT_COMMAND_CENTER_SHORTCUT = {
  mac: "Meta+Shift+K",
  windows: "Ctrl+Shift+K",
  linux: "Ctrl+Shift+K"
} as const;

export const DEFAULT_SPLIT_RULES: SplitRule[] = [
  {
    id: "important",
    title: "Important",
    description: "Pinned to starred, important, and manually promoted senders.",
    gmailQuery: "in:inbox (is:important OR is:starred)"
  },
  {
    id: "other",
    title: "Other",
    description: "Everything else in the inbox after promotions and demotions.",
    gmailQuery: "in:inbox -is:important -is:starred"
  }
];

export const DEFAULT_PREFERENCES: UserPreferences = {
  apiBaseUrl: "http://127.0.0.1:8787",
  commandCenterShortcut: DEFAULT_COMMAND_CENTER_SHORTCUT,
  trackingEnabledByDefault: true,
  splitOverrides: [],
  preferredSplitMode: "important",
  archiveKeepUnread: true,
  archiveKeepStarred: true,
  onboardingCompleted: false,
  chromeSafeShortcuts: true
};
