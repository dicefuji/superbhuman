interface ImportMetaEnv {
  readonly WXT_PUBLIC_TRACKING_API_BASE_URL?: string;
  readonly WXT_PUBLIC_TRACKING_GOOGLE_CLIENT_ID?: string;
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
