import { describe, expect, it } from "vitest";

import { searchCommands } from "./commandRegistry";

describe("command registry search", () => {
  it("finds commands by title", () => {
    const results = searchCommands("archive");
    expect(results.some((command) => command.id === "mass-archive")).toBe(true);
    expect(results.some((command) => command.id === "archive")).toBe(true);
  });

  it("finds commands by keywords", () => {
    const results = searchCommands("mailing list");
    expect(results.some((command) => command.id === "unsubscribe")).toBe(true);
  });
});
