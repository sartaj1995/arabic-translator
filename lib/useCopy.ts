"use client";

import { useCallback, useState } from "react";

/**
 * Copy text to the clipboard, with a short-lived `copied` flag for feedback.
 *
 * Falls back to a temporary textarea because Safari has no async clipboard on
 * plain http:// origins — which includes testing a dev build from a phone on
 * the local network.
 */
export function useCopy(resetAfterMs = 1600) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(
    async (text: string) => {
      try {
        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.setAttribute("readonly", "");
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopied(true);
        window.setTimeout(() => setCopied(false), resetAfterMs);
      } catch {
        /* Copying is a convenience; a failure should not interrupt anything. */
      }
    },
    [resetAfterMs],
  );

  return { copied, copy };
}
