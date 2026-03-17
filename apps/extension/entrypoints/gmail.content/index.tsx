import { createRoot } from "react-dom/client";

import { Shell } from "../../src/components/Shell";
import "../../src/styles.css";

export default defineContentScript({
  matches: ["https://mail.google.com/*"],
  runAt: "document_idle",
  main() {
    const mount = document.createElement("div");
    mount.id = "superbhuman-root";
    document.documentElement.appendChild(mount);

    const root = createRoot(mount);
    root.render(<Shell />);

    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === "ui:open-command-center") {
        window.dispatchEvent(new CustomEvent("superbhuman:open-command-center"));
      }
    });
  }
});
