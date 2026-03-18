import type {
  ApiSession,
  AuthDiagnostics,
  ExtensionMessage,
  GmailApiListResponse,
  TrackRegisterRequest,
  TrackerStatus
} from "@superbhuman/shared";

interface RuntimeEnvelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

async function sendMessage<T>(message: ExtensionMessage): Promise<T> {
  const response = (await chrome.runtime.sendMessage(message)) as RuntimeEnvelope<T>;

  if (!response?.ok) {
    throw new Error(response?.error ?? "Unknown extension runtime error");
  }

  return response.data as T;
}

export function getApiSession(): Promise<ApiSession | null> {
  return sendMessage<ApiSession | null>({ type: "auth:get-session" });
}

export function signInWithGoogle(): Promise<ApiSession | null> {
  return sendMessage<ApiSession | null>({ type: "auth:interactive-login" });
}

export function getAuthDiagnostics(): Promise<AuthDiagnostics> {
  return sendMessage<AuthDiagnostics>({ type: "auth:get-diagnostics" });
}

export function gmailApiRequest<T>(
  path: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  return sendMessage<T>({ type: "gmail:api", path, method, body });
}

export function gmailListMessages<T = { id: string; threadId: string }>(
  query: string,
  pageToken?: string,
  maxResults = 100
): Promise<GmailApiListResponse<T>> {
  const searchParams = new URLSearchParams({
    q: query,
    maxResults: String(maxResults)
  });

  if (pageToken) {
    searchParams.set("pageToken", pageToken);
  }

  return gmailApiRequest<GmailApiListResponse<T>>(`messages?${searchParams.toString()}`);
}

export function gmailBatchModify(messageIds: string[], addLabelIds: string[] = [], removeLabelIds: string[] = []) {
  return gmailApiRequest("messages/batchModify", "POST", {
    ids: messageIds,
    addLabelIds,
    removeLabelIds
  });
}

export function gmailBatchDelete(messageIds: string[]) {
  return gmailApiRequest("messages/batchDelete", "POST", { ids: messageIds });
}

export function gmailCreateFilter(body: unknown) {
  return gmailApiRequest("settings/filters", "POST", body);
}

export function registerTracking(payload: TrackRegisterRequest) {
  return sendMessage<void>({ type: "tracking:register", payload });
}

export function fetchTrackingStatus(token: string) {
  return sendMessage<TrackerStatus>({ type: "tracking:status", token });
}

export function checkTrackingApiHealth(apiBaseUrl?: string) {
  return sendMessage<{ ok: boolean }>({ type: "tracking:health", apiBaseUrl });
}
