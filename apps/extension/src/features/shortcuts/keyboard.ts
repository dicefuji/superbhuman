import { COMMANDS, getShortcutLabel, type CommandId, type Platform } from "@superbhuman/shared";

export interface KeyboardControllerOptions {
  platform: Platform;
  isEnabled(): boolean;
  onCommand(id: CommandId): void;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.closest('[contenteditable="true"]') !== null
  );
}

function normalizeKeyboardEvent(event: KeyboardEvent): string {
  const parts: string[] = [];

  if (event.metaKey) {
    parts.push("Meta");
  }
  if (event.ctrlKey) {
    parts.push("Ctrl");
  }
  if (event.altKey) {
    parts.push("Alt");
  }
  if (event.shiftKey) {
    parts.push("Shift");
  }

  const key =
    event.key.length === 1
      ? event.key.toUpperCase()
      : event.key === " "
        ? "Space"
        : event.key;
  parts.push(key);
  return parts.join("+");
}

function buildShortcutMap(platform: Platform): Map<string, CommandId> {
  const map = new Map<string, CommandId>();

  for (const command of COMMANDS) {
    const shortcut = getShortcutLabel(command.shortcuts, platform);
    if (shortcut) {
      map.set(shortcut.toUpperCase(), command.id);
    }
  }

  return map;
}

export function mountKeyboardController(options: KeyboardControllerOptions): () => void {
  const shortcutMap = buildShortcutMap(options.platform);

  const handler = (event: KeyboardEvent) => {
    if (!options.isEnabled()) {
      return;
    }

    if (isEditableTarget(event.target) && event.key !== "Escape") {
      return;
    }

    const normalized = normalizeKeyboardEvent(event).toUpperCase();
    const commandId = shortcutMap.get(normalized);

    if (!commandId) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    options.onCommand(commandId);
  };

  window.addEventListener("keydown", handler, true);
  return () => window.removeEventListener("keydown", handler, true);
}
