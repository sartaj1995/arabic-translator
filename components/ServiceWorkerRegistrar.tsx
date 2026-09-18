"use client";

import { useEffect } from "react";

/**
 * Registers the service worker.
 *
 * Production only, on purpose: a caching SW in front of the dev server fights
 * with hot reload and produces stale-bundle bugs that look like your code is
 * broken. To exercise offline behaviour locally, run a production build:
 *
 *   npm run build && npm start
 */
export default function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch((err) => console.warn("[sw] registration failed", err));
    };

    // Wait for load so the SW install does not compete with first paint.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}
