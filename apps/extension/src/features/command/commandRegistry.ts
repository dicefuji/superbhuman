import { COMMANDS, type CommandContext, type CommandDefinition, type CommandId, type SplitMode } from "@superbhuman/shared";

import { undoLatestMassArchive } from "../archive/archiveService";

export interface CommandRuntime {
  getContext(): CommandContext;
  openCommandCenter(): void;
  closeOverlays(): boolean;
  openMassArchive(): void;
  setSplitMode(mode: SplitMode): void;
  promptForFolder(): void;
  toggleTracking(): Promise<boolean | undefined>;
  showToast(message: string): void;
  moveThreadToSplit(target: SplitMode): Promise<void>;
  nukeSender(): Promise<void>;
  nukeCompany(): Promise<void>;
  adapter: {
    goBack(): void;
    openSelectedThread(): void;
    moveSelection(delta: 1 | -1): void;
    moveThreadView(delta: 1 | -1): void;
    reply(): void;
    forward(): void;
    archive(): void;
    delete(): void;
    markUnread(): void;
    openLabels(): void;
    switchFolder(folder: string): void;
    openFirstLink(): void;
    openAttachment(): void;
    unsubscribe(): void;
  };
}

export function searchCommands(query: string): CommandDefinition[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return COMMANDS;
  }

  return COMMANDS.filter((command) => {
    const haystack = `${command.title} ${command.description} ${command.keywords.join(" ")}`.toLowerCase();
    return haystack.includes(normalized);
  });
}

export async function executeCommand(id: CommandId, runtime: CommandRuntime): Promise<void> {
  switch (id) {
    case "open-command-center":
      runtime.openCommandCenter();
      return;
    case "go-back":
      if (!runtime.closeOverlays()) {
        runtime.adapter.goBack();
      }
      return;
    case "open-thread":
      runtime.adapter.openSelectedThread();
      return;
    case "next-thread":
      runtime.adapter.moveSelection(1);
      return;
    case "previous-thread":
      runtime.adapter.moveSelection(-1);
      return;
    case "next-message":
      runtime.adapter.moveThreadView(1);
      return;
    case "previous-message":
      runtime.adapter.moveThreadView(-1);
      return;
    case "switch-split-important":
      runtime.setSplitMode("important");
      return;
    case "switch-split-other":
      runtime.setSplitMode("other");
      return;
    case "reply":
      runtime.adapter.reply();
      return;
    case "forward":
      runtime.adapter.forward();
      return;
    case "archive":
      runtime.adapter.archive();
      return;
    case "delete":
      runtime.adapter.delete();
      return;
    case "mark-unread":
      runtime.adapter.markUnread();
      return;
    case "label":
      runtime.adapter.openLabels();
      return;
    case "switch-folder":
      runtime.promptForFolder();
      return;
    case "mass-archive":
      runtime.openMassArchive();
      return;
    case "undo-mass-archive": {
      const result = await undoLatestMassArchive();
      runtime.showToast(result.restoredCount ? `Restored ${result.restoredCount} messages.` : "No archive snapshot to restore.");
      return;
    }
    case "move-to-important":
      await runtime.moveThreadToSplit("important");
      return;
    case "move-to-other":
      await runtime.moveThreadToSplit("other");
      return;
    case "toggle-tracking": {
      const value = await runtime.toggleTracking();
      runtime.showToast(value === undefined ? "No active compose window." : value ? "Read status enabled." : "Read status disabled.");
      return;
    }
    case "open-first-link":
      runtime.adapter.openFirstLink();
      return;
    case "open-attachment":
      runtime.adapter.openAttachment();
      return;
    case "unsubscribe":
      runtime.adapter.unsubscribe();
      return;
    case "nuke-sender":
      await runtime.nukeSender();
      return;
    case "nuke-company": {
      await runtime.nukeCompany();
      return;
    }
    default:
      return;
  }
}
