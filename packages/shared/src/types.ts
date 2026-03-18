export type Platform = "mac" | "windows" | "linux";

export type GmailRoute =
  | "inbox"
  | "thread"
  | "search"
  | "label"
  | "settings"
  | "sent"
  | "drafts"
  | "trash"
  | "spam"
  | "unknown";

export interface GmailRouteState {
  route: GmailRoute;
  hash: string;
  threadId?: string;
  searchQuery?: string;
  label?: string;
}

export interface ThreadSummary {
  id: string;
  subject: string;
  sender: string;
  senderEmail?: string;
  snippet?: string;
  isUnread: boolean;
  isImportant: boolean;
  isStarred: boolean;
  hasAttachment: boolean;
  sentAt?: string;
}

export type SplitMode = "important" | "other";

export interface SplitOverride {
  sender?: string;
  domain?: string;
  target: SplitMode;
  createdAt: string;
}

export interface SplitRule {
  id: "important" | "other";
  title: string;
  description: string;
  gmailQuery: string;
}

export type ArchiveThreshold =
  | "1d"
  | "3d"
  | "1w"
  | "2w"
  | "1m";

export interface ArchivePreview {
  query: string;
  total: number;
  sampleThreadIds: string[];
  threshold: ArchiveThreshold;
  keepUnread: boolean;
  keepStarred: boolean;
  generatedAt: string;
}

export interface ArchiveRunSnapshot {
  id: string;
  query: string;
  messageIds: string[];
  createdAt: string;
  expiresAt: string;
}

export interface TrackerStatus {
  token: string;
  firstOpenedAt?: string;
  lastOpenedAt?: string;
  openCount: number;
}

export type TrackingSourceKind = "gmail_proxy" | "apple_privacy" | "mail_client" | "unknown";

export type TrackingRegistrationStatus = "registered" | "failed";

export interface TrackedMessageRecord extends TrackerStatus {
  threadId?: string;
  messageId?: string;
  subject?: string;
  recipientEmails: string[];
  sentAt: string;
  registrationStatus: TrackingRegistrationStatus;
  registrationError?: string;
  lastStatusCheckedAt?: string;
  lastStatusError?: string;
  lastSourceKind?: TrackingSourceKind;
}

export interface ComposeTrackingState {
  enabled: boolean;
  token?: string;
  registeredAt?: string;
  status?: TrackerStatus;
}

export interface KeyboardShortcut {
  mac: string;
  windows: string;
  linux?: string;
}

export type CommandId =
  | "open-command-center"
  | "go-back"
  | "open-thread"
  | "next-thread"
  | "previous-thread"
  | "next-message"
  | "previous-message"
  | "switch-split-important"
  | "switch-split-other"
  | "reply"
  | "forward"
  | "archive"
  | "delete"
  | "mark-unread"
  | "label"
  | "switch-folder"
  | "mass-archive"
  | "undo-mass-archive"
  | "move-to-important"
  | "move-to-other"
  | "toggle-tracking"
  | "open-first-link"
  | "open-attachment"
  | "unsubscribe"
  | "nuke-sender"
  | "nuke-company";

export interface CommandContext {
  route: GmailRouteState;
  selectedThread?: ThreadSummary | null;
  selectionCount: number;
  splitMode: SplitMode;
  hasCompose: boolean;
  platform: Platform;
}

export interface CommandDefinition {
  id: CommandId;
  title: string;
  description: string;
  keywords: string[];
  shortcuts?: KeyboardShortcut;
}

export interface UserPreferences {
  commandCenterShortcut: KeyboardShortcut;
  trackingEnabledByDefault: boolean;
  splitOverrides: SplitOverride[];
  preferredSplitMode: SplitMode;
  archiveKeepUnread: boolean;
  archiveKeepStarred: boolean;
  onboardingCompleted: boolean;
  chromeSafeShortcuts: boolean;
}

export interface ApiSession {
  userId: string;
  email?: string;
  accessToken: string;
  expiresAt: string;
  grantedScopes?: string[];
  connectedAt?: string;
}

export interface TrackingSession {
  userId: string;
  email: string;
  expiresAt: string;
  connectedAt: string;
}

export interface TrackingMessagesPage {
  items: TrackedMessageRecord[];
  nextCursor?: string;
}

export interface AuthDiagnostics {
  extensionId: string;
  clientId?: string;
  hasOAuthClient: boolean;
  requestedScopes: string[];
  sessionEmail?: string;
  lastStage?: string;
  lastError?: string;
  lastRawError?: string;
  updatedAt?: string;
}

export type ExtensionMessage =
  | { type: "auth:get-session" }
  | { type: "auth:get-diagnostics" }
  | { type: "auth:interactive-login" }
  | { type: "gmail:api"; path: string; method?: string; body?: unknown }
  | { type: "tracking:auth-start" }
  | { type: "tracking:get-session" }
  | { type: "tracking:logout" }
  | { type: "tracking:health" }
  | { type: "tracking:list-messages"; limit?: number; cursor?: string }
  | { type: "tracking:status"; token: string }
  | { type: "tracking:register"; payload: TrackRegisterRequest };

export interface TrackRegisterRequest {
  token: string;
  threadId?: string;
  messageId?: string;
  recipientEmails: string[];
  subject?: string;
  sentAt: string;
}

export interface TrackOpenEvent {
  token: string;
  openedAt: string;
  normalizedUserAgent?: string;
  ipFingerprint?: string;
  sourceKind: TrackingSourceKind;
}

export interface GmailApiListResponse<T> {
  messages?: T[];
  nextPageToken?: string;
  resultSizeEstimate?: number;
}
