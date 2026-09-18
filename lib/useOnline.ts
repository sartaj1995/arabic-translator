"use client";

import { useEffect, useState } from "react";

/**
 * Tracks connectivity.
 *
 * Starts as `true` rather than reading navigator.onLine during render — the
 * server has no such value, and guessing wrong flashes an offline banner on
 * every first paint. The effect corrects it immediately on mount.
 *
 * Note that navigator.onLine only means "there is a network interface", not
 * "the internet works". It is reliable for the airplane-mode case, which is
 * the one that matters in a Riyadh basement car park; real request failures
 * are caught separately at the fetch site.
 */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  return online;
}
