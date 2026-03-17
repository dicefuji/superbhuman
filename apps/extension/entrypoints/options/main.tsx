import { createRoot } from "react-dom/client";

import { OptionsApp } from "../../src/components/OptionsApp";
import "../../src/styles.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Options root element not found.");
}

createRoot(container).render(<OptionsApp />);
