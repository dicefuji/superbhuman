interface ImportMetaEnv {
  readonly WXT_PUBLIC_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare function defineBackground(callback: () => void): unknown;

declare function defineContentScript(options: {
  matches: string[];
  runAt?: "document_start" | "document_end" | "document_idle";
  main(): void | Promise<void>;
}): unknown;
