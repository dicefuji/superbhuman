export function cn(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function sleep(timeoutMs: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, timeoutMs));
}

export function formatTimestamp(value?: string): string {
  if (!value) {
    return "Not opened yet";
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function toArray<T>(value: ArrayLike<T>): T[] {
  return Array.from(value);
}
