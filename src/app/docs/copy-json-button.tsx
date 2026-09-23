"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { JSON_SNIPPET } from "./docs-data";

/** "Copy JSON" action for the BYOD dataset example. */
export function CopyJsonButton() {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(JSON_SNIPPET);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be unavailable (insecure context / denied permission); leave the button state unchanged.
    }
  };

  return (
    <button
      type="button"
      onClick={copyToClipboard}
      className="inline-flex items-center gap-1 text-brand hover:underline"
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      <span>{copied ? "Copied" : "Copy JSON"}</span>
    </button>
  );
}
