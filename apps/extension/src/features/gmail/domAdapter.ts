import { extractTrackingToken, type GmailRouteState, type ThreadSummary } from "@superbhuman/shared";

import { sleep, toArray } from "../../lib/runtime";

export interface ThreadRowSnapshot extends ThreadSummary {
  element: HTMLTableRowElement;
}

type Listener = () => void;

export class GmailDomAdapter {
  private readonly listeners = new Set<Listener>();
  private observer?: MutationObserver;
  private activeThreadId?: string;

  start(): void {
    if (this.observer) {
      return;
    }

    window.addEventListener("hashchange", this.handleMutation, { passive: true });
    this.observer = new MutationObserver(this.handleMutation);
    this.observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "aria-selected"]
    });
    this.handleMutation();
  }

  stop(): void {
    window.removeEventListener("hashchange", this.handleMutation);
    this.observer?.disconnect();
    this.observer = undefined;
    this.listeners.clear();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getRouteState(): GmailRouteState {
    const hash = window.location.hash || "#inbox";
    const decodedHash = decodeURIComponent(hash.replace(/^#/, ""));
    const routePath = decodedHash.split("?")[0] ?? decodedHash;

    if (routePath.startsWith("search/")) {
      return {
        route: "search",
        hash,
        searchQuery: routePath.replace(/^search\//, "")
      };
    }

    if (routePath.startsWith("label/")) {
      return {
        route: "label",
        hash,
        label: routePath.replace(/^label\//, "")
      };
    }

    const parts = routePath.split("/");

    if (parts.length > 1 && parts[1]) {
      return {
        route: "thread",
        hash,
        label: parts[0],
        threadId: parts[1]
      };
    }

    const route = parts[0] as GmailRouteState["route"];
    return {
      route: ["inbox", "sent", "drafts", "trash", "spam", "settings"].includes(route)
        ? route
        : "unknown",
      hash
    };
  }

  getThreadRows(): ThreadRowSnapshot[] {
    const threadSelectors = [
      'tr.zA[data-legacy-thread-id]',
      'tr.zA[data-thread-id]',
      'tr[role="row"].zA'
    ];

    return toArray(document.querySelectorAll<HTMLTableRowElement>(threadSelectors.join(", ")))
      .map((element, index) => this.buildThreadSnapshot(element, index))
      .filter((value): value is ThreadRowSnapshot => Boolean(value));
  }

  getSelectedThread(): ThreadRowSnapshot | undefined {
    const rows = this.getThreadRows();

    if (this.activeThreadId) {
      return rows.find((row) => row.id === this.activeThreadId);
    }

    return rows.find((row) => row.element.classList.contains("sb-active-row")) ?? rows[0];
  }

  moveSelection(delta: 1 | -1): ThreadRowSnapshot | undefined {
    const rows = this.getThreadRows().filter((row) => !row.element.classList.contains("sb-hidden-row"));
    if (!rows.length) {
      return undefined;
    }

    const currentId = this.getSelectedThread()?.id;
    const currentIndex = Math.max(
      rows.findIndex((row) => row.id === currentId),
      0
    );
    const nextIndex = Math.min(Math.max(currentIndex + delta, 0), rows.length - 1);
    const next = rows[nextIndex];

    this.focusThread(next);
    return next;
  }

  focusThread(thread: ThreadRowSnapshot): void {
    for (const row of this.getThreadRows()) {
      row.element.classList.toggle("sb-active-row", row.id === thread.id);
    }

    this.activeThreadId = thread.id;
    thread.element.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  openSelectedThread(): void {
    const selected = this.getSelectedThread();
    if (!selected) {
      return;
    }

    const clickable = selected.element.querySelector<HTMLElement>('a, [role="link"]');
    clickable?.click();
  }

  moveThreadView(delta: 1 | -1): void {
    const labels = delta > 0 ? ["Older", "Next"] : ["Newer", "Previous"];
    this.clickByAriaFragments(labels);
  }

  goBack(): void {
    window.history.back();
  }

  reply(): void {
    this.clickByAriaFragments(["Reply"]);
  }

  forward(): void {
    this.clickByAriaFragments(["Forward"]);
  }

  archive(): void {
    this.clickByAriaFragments(["Archive"]);
  }

  delete(): void {
    this.clickByAriaFragments(["Delete", "Trash"]);
  }

  markUnread(): void {
    this.clickByAriaFragments(["Mark as unread"]);
  }

  openLabels(): void {
    this.clickByAriaFragments(["Labels"]);
  }

  switchFolder(destination: string): void {
    const normalized = destination.trim().toLowerCase();
    const routeMap: Record<string, string> = {
      inbox: "#inbox",
      sent: "#sent",
      starred: "#starred",
      draft: "#drafts",
      drafts: "#drafts",
      trash: "#trash",
      spam: "#spam"
    };

    if (routeMap[normalized]) {
      window.location.hash = routeMap[normalized];
      return;
    }

    if (normalized.startsWith("label:")) {
      window.location.hash = `#label/${encodeURIComponent(normalized.replace(/^label:/, ""))}`;
      return;
    }

    window.location.hash = `#search/${encodeURIComponent(normalized)}`;
  }

  openFirstLink(): void {
    const link = document.querySelector<HTMLAnchorElement>(".ii.gt a[href^='http'], .a3s a[href^='http']");
    if (!link) {
      return;
    }

    window.open(link.href, "_blank", "noopener,noreferrer");
  }

  openAttachment(): void {
    const attachment = document.querySelector<HTMLElement>('[download_url], [data-tooltip*="Download"], [aria-label*="attachment"]');
    attachment?.click();
  }

  unsubscribe(): void {
    this.clickByAriaFragments(["Unsubscribe"]);
  }

  getCurrentThreadTokens(): string[] {
    const htmlBlocks = toArray(document.querySelectorAll<HTMLElement>(".ii.gt, .a3s"));
    const tokens = new Set<string>();

    for (const block of htmlBlocks) {
      const token = extractTrackingToken(block.innerHTML);
      if (token) {
        tokens.add(token);
      }
    }

    return [...tokens];
  }

  getComposeWindows(): HTMLElement[] {
    return toArray(
      document.querySelectorAll<HTMLElement>('div[role="dialog"], div[gh="cm"]')
    ).filter((element) => Boolean(this.getComposeBody(element)));
  }

  getComposeBody(compose: HTMLElement): HTMLElement | null {
    return (
      compose.querySelector<HTMLElement>('div[aria-label="Message Body"][contenteditable="true"]') ??
      compose.querySelector<HTMLElement>('div[g_editable="true"][contenteditable="true"]')
    );
  }

  getComposeToolbar(compose: HTMLElement): HTMLElement | null {
    return (
      compose.querySelector<HTMLElement>('div[role="toolbar"]') ??
      compose.querySelector<HTMLElement>('td:nth-last-child(2)')
    );
  }

  getComposeSendButton(compose: HTMLElement): HTMLElement | null {
    return (
      compose.querySelector<HTMLElement>('div[role="button"][data-tooltip^="Send"]') ??
      compose.querySelector<HTMLElement>('div[role="button"][aria-label^="Send"]')
    );
  }

  getComposeRecipients(compose: HTMLElement): string[] {
    const emails = new Set<string>();
    for (const node of toArray(compose.querySelectorAll<HTMLElement>("[email]"))) {
      const value = node.getAttribute("email");
      if (value) {
        emails.add(value.toLowerCase());
      }
    }

    return [...emails];
  }

  async attemptEnableKeyboardShortcuts(): Promise<boolean> {
    const settingsButton = document.querySelector<HTMLElement>('a[aria-label*="Settings"], div[aria-label*="Settings"]');
    settingsButton?.click();
    await sleep(400);

    const seeAllSettings = toArray(document.querySelectorAll<HTMLElement>("div[role='menuitem'], button, span"))
      .find((element) => /See all settings/i.test(element.textContent ?? ""));
    seeAllSettings?.click();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const keyboardShortcutsRadio = toArray(
        document.querySelectorAll<HTMLInputElement>('input[type="radio"]')
      ).find((input) => /Keyboard shortcuts on/i.test(input.closest("tr, div")?.textContent ?? ""));

      if (keyboardShortcutsRadio) {
        keyboardShortcutsRadio.click();

        const saveButton = toArray(document.querySelectorAll<HTMLElement>('button, div[role="button"]'))
          .find((element) => /Save Changes/i.test(element.textContent ?? ""));
        saveButton?.click();
        return true;
      }

      await sleep(250);
    }

    return false;
  }

  private buildThreadSnapshot(element: HTMLTableRowElement, index: number): ThreadRowSnapshot | undefined {
    if (!element.classList.contains("zA")) {
      return undefined;
    }

    if (!element.offsetParent && !element.classList.contains("sb-active-row")) {
      return undefined;
    }

    const id =
      element.getAttribute("data-legacy-thread-id") ??
      element.getAttribute("data-thread-id") ??
      `row-${index}`;
    const senderNode =
      element.querySelector<HTMLElement>("[email]") ??
      element.querySelector<HTMLElement>(".yP, .yW span");
    const sender = senderNode?.textContent?.trim() ?? "Unknown sender";
    const senderEmail = senderNode?.getAttribute("email") ?? inferEmailAddress(senderNode?.textContent ?? sender);
    const subject =
      element.querySelector<HTMLElement>(".bog, .y6 span")?.textContent?.trim() ?? "(No subject)";
    const snippet = element.querySelector<HTMLElement>(".y2")?.textContent?.trim() ?? undefined;
    const sentAt = element.querySelector<HTMLElement>("td.xW span")?.getAttribute("title") ?? undefined;

    if (!id || subject === "(No subject)" && sender === "Unknown sender" && !snippet) {
      return undefined;
    }

    return {
      id,
      element,
      sender,
      senderEmail,
      subject,
      snippet,
      sentAt,
      isUnread: element.classList.contains("zE") || /unread/i.test(element.getAttribute("class") ?? ""),
      isImportant:
        Boolean(element.querySelector('[aria-label*="Important"]')) ||
        Boolean(element.querySelector(".a1")),
      isStarred: Boolean(element.querySelector('[aria-label*="Starred"], [aria-label*="Remove star"]')),
      hasAttachment: Boolean(element.querySelector('[aria-label*="Attachment"], img[alt*="Attachment"]'))
    };
  }

  private clickByAriaFragments(fragments: string[]): void {
    const candidate = toArray(
      document.querySelectorAll<HTMLElement>('button, div[role="button"], span[role="button"], a[role="button"]')
    ).find((element) =>
      fragments.some((fragment) =>
        (element.getAttribute("aria-label") ?? element.textContent ?? "").includes(fragment)
      )
    );
    candidate?.click();
  }

  private readonly handleMutation = () => {
    for (const listener of this.listeners) {
      listener();
    }
  };
}

function inferEmailAddress(value: string): string | undefined {
  const match = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  return match?.[0]?.toLowerCase();
}
