import type { SplitRule, UserPreferences } from "./types";

export const DEFAULT_COMMAND_CENTER_SHORTCUT = {
  mac: "Meta+Shift+K",
  windows: "Ctrl+Shift+K",
  linux: "Ctrl+Shift+K"
} as const;

export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.settings.basic",
  "https://www.googleapis.com/auth/userinfo.email"
] as const;

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
  commandCenterShortcut: DEFAULT_COMMAND_CENTER_SHORTCUT,
  trackingEnabledByDefault: true,
  splitOverrides: [],
  preferredSplitMode: "important",
  archiveKeepUnread: true,
  archiveKeepStarred: true,
  onboardingCompleted: false,
  chromeSafeShortcuts: true
};
