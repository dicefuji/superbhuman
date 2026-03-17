import { getShortcutLabel, type CommandDefinition, type Platform } from "@superbhuman/shared";
import { useEffect, useMemo, useRef, useState } from "react";

interface CommandCenterProps {
  open: boolean;
  query: string;
  commands: CommandDefinition[];
  platform: Platform;
  onQueryChange(value: string): void;
  onExecute(id: CommandDefinition["id"]): void;
  onClose(): void;
}

export function CommandCenter(props: CommandCenterProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (!props.open) {
      return;
    }

    inputRef.current?.focus();
    setActiveIndex(0);
  }, [props.open, props.query]);

  const activeCommand = props.commands[activeIndex];
  const empty = props.commands.length === 0;

  const commandList = useMemo(() => props.commands.slice(0, 12), [props.commands]);

  if (!props.open) {
    return null;
  }

  return (
    <>
      <div className="sb-modal-backdrop" onClick={props.onClose} />
      <div className="sb-command-center">
        <input
          ref={inputRef}
          className="sb-command-input"
          placeholder="Reply, archive, switch to Sent, get me to zero..."
          value={props.query}
          onChange={(event) => props.onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => Math.min(current + 1, Math.max(commandList.length - 1, 0)));
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }

            if (event.key === "Enter" && activeCommand) {
              event.preventDefault();
              props.onExecute(activeCommand.id);
            }

            if (event.key === "Escape") {
              event.preventDefault();
              props.onClose();
            }
          }}
        />
        <div className="sb-command-list">
          {empty ? (
            <button className="sb-command-item" data-active="true" type="button" onClick={props.onClose}>
              <div>
                <div className="sb-command-title">No command matched</div>
                <div className="sb-command-description">Try “archive”, “important”, “unsubscribe”, or “zero”.</div>
              </div>
            </button>
          ) : (
            commandList.map((command, index) => (
              <button
                key={command.id}
                className="sb-command-item"
                data-active={index === activeIndex}
                type="button"
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => props.onExecute(command.id)}
              >
                <div>
                  <div className="sb-command-title">{command.title}</div>
                  <div className="sb-command-description">{command.description}</div>
                </div>
                {getShortcutLabel(command.shortcuts, props.platform) ? (
                  <span className="sb-kbd">{getShortcutLabel(command.shortcuts, props.platform)}</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      </div>
    </>
  );
}
