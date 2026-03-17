import { DEFAULT_COMMAND_CENTER_SHORTCUT } from "./defaults";
import type { CommandDefinition, CommandId, KeyboardShortcut, Platform } from "./types";

function shortcut(mac: string, windows = mac, linux = windows): KeyboardShortcut {
  return { mac, windows, linux };
}

export const COMMANDS: CommandDefinition[] = [
  {
    id: "open-command-center",
    title: "Command Center",
    description: "Search and execute any command.",
    keywords: ["command", "palette", "find action"],
    shortcuts: DEFAULT_COMMAND_CENTER_SHORTCUT
  },
  {
    id: "go-back",
    title: "Back",
    description: "Go back, close dialogs, or dismiss overlays.",
    keywords: ["escape", "close", "cancel"],
    shortcuts: shortcut("Escape", "Escape")
  },
  {
    id: "open-thread",
    title: "Open Thread",
    description: "Open the selected thread or send the active compose.",
    keywords: ["enter", "open email", "view conversation"],
    shortcuts: shortcut("Enter", "Enter")
  },
  {
    id: "next-thread",
    title: "Next Thread",
    description: "Move to the next visible thread.",
    keywords: ["down", "next email", "j"],
    shortcuts: shortcut("ArrowDown", "ArrowDown")
  },
  {
    id: "previous-thread",
    title: "Previous Thread",
    description: "Move to the previous visible thread.",
    keywords: ["up", "prev email", "k"],
    shortcuts: shortcut("ArrowUp", "ArrowUp")
  },
  {
    id: "next-message",
    title: "Next Message",
    description: "Move to the next thread while reading.",
    keywords: ["next", "right", "conversation"],
    shortcuts: shortcut("ArrowRight", "ArrowRight")
  },
  {
    id: "previous-message",
    title: "Previous Message",
    description: "Move to the previous thread while reading.",
    keywords: ["previous", "left", "conversation"],
    shortcuts: shortcut("ArrowLeft", "ArrowLeft")
  },
  {
    id: "switch-split-important",
    title: "Switch to Important",
    description: "View your Important split.",
    keywords: ["important", "split", "tab"],
    shortcuts: shortcut("1", "1")
  },
  {
    id: "switch-split-other",
    title: "Switch to Other",
    description: "View your Other split.",
    keywords: ["other", "split", "tab"],
    shortcuts: shortcut("2", "2")
  },
  {
    id: "reply",
    title: "Reply",
    description: "Reply to the current thread.",
    keywords: ["respond", "compose"],
    shortcuts: shortcut("r", "r")
  },
  {
    id: "forward",
    title: "Forward",
    description: "Forward the current thread.",
    keywords: ["share", "send"],
    shortcuts: shortcut("f", "f")
  },
  {
    id: "archive",
    title: "Archive",
    description: "Archive the current selection.",
    keywords: ["done", "remove inbox"],
    shortcuts: shortcut("e", "e")
  },
  {
    id: "delete",
    title: "Delete",
    description: "Move the current selection to trash.",
    keywords: ["trash", "remove"],
    shortcuts: shortcut("#", "#")
  },
  {
    id: "mark-unread",
    title: "Mark Unread",
    description: "Mark the current selection as unread.",
    keywords: ["later", "read later"],
    shortcuts: shortcut("Shift+U", "Shift+U")
  },
  {
    id: "label",
    title: "Add Label",
    description: "Add or remove labels on the current selection.",
    keywords: ["tag", "categorize"],
    shortcuts: shortcut("v", "v")
  },
  {
    id: "switch-folder",
    title: "Go to Folder",
    description: "Jump to any Gmail system label or category.",
    keywords: ["inbox", "sent", "trash", "spam", "label"],
    shortcuts: shortcut("g", "g")
  },
  {
    id: "mass-archive",
    title: "Get Me To Zero",
    description: "Preview and archive older messages in bulk.",
    keywords: ["zero", "bulk archive", "clean inbox"]
  },
  {
    id: "undo-mass-archive",
    title: "Undo Mass Archive",
    description: "Restore the last archived batch.",
    keywords: ["undo", "restore", "revert"]
  },
  {
    id: "move-to-important",
    title: "Move to Important",
    description: "Promote a sender or domain into Important.",
    keywords: ["split", "promote", "important"]
  },
  {
    id: "move-to-other",
    title: "Move to Other",
    description: "Demote a sender or domain into Other.",
    keywords: ["split", "demote", "other"]
  },
  {
    id: "toggle-tracking",
    title: "Toggle Read Status",
    description: "Enable or disable tracking on the active compose.",
    keywords: ["read status", "read receipt", "tracking"]
  },
  {
    id: "open-first-link",
    title: "Open Link",
    description: "Open the first meaningful link in the current email.",
    keywords: ["url", "open", "launch"],
    shortcuts: shortcut("Meta+Shift+O", "Ctrl+Shift+O")
  },
  {
    id: "open-attachment",
    title: "Open Attachment",
    description: "Open the first visible attachment.",
    keywords: ["file", "download", "preview"]
  },
  {
    id: "unsubscribe",
    title: "Unsubscribe",
    description: "Use Gmail unsubscribe affordances or headers.",
    keywords: ["promotion", "mailing list", "list-unsubscribe"]
  },
  {
    id: "nuke-sender",
    title: "Nuke Sender",
    description: "Delete all existing mail from a sender and block future messages.",
    keywords: ["block", "delete sender", "ban"]
  },
  {
    id: "nuke-company",
    title: "Nuke Company",
    description: "Delete and block mail from an entire domain.",
    keywords: ["domain", "block company", "ban domain"]
  }
];

export function getCommandDefinition(id: CommandId): CommandDefinition {
  const definition = COMMANDS.find((command) => command.id === id);
  if (!definition) {
    throw new Error(`Unknown command: ${id}`);
  }
  return definition;
}

export function getShortcutLabel(shortcut: KeyboardShortcut | undefined, platform: Platform): string | undefined {
  if (!shortcut) {
    return undefined;
  }

  if (platform === "mac") {
    return shortcut.mac;
  }

  return shortcut.windows ?? shortcut.linux ?? shortcut.mac;
}

export function isCommandId(value: string): value is CommandId {
  return COMMANDS.some((command) => command.id === value);
}
