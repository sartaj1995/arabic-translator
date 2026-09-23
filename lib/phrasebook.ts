"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { kvGet, kvSet } from "./db";
import type { Phrase } from "./types";

/**
 * The offline phrasebook.
 *
 * Cache-first, deliberately: the whole point is that it works in a basement car
 * park with no signal. IndexedDB is read before anything touches the network,
 * and the network fetch afterwards is a background refresh that only replaces
 * the cache when the version actually changed.
 */

const CACHE_KEY = "phrasebook";

export interface PhrasebookCategory {
  id: string;
  label: string;
}

interface PhrasebookFile {
  version: number;
  categories: PhrasebookCategory[];
  phrases: Phrase[];
}

/** Where the data currently on screen came from. Surfaced for the UI. */
export type PhrasebookSource = "loading" | "cache" | "network" | "unavailable";

function isValid(data: unknown): data is PhrasebookFile {
  if (!data || typeof data !== "object") return false;
  const f = data as Partial<PhrasebookFile>;
  return (
    typeof f.version === "number" &&
    Array.isArray(f.categories) &&
    Array.isArray(f.phrases) &&
    f.phrases.length > 0
  );
}

export interface UsePhrasebook {
  categories: PhrasebookCategory[];
  phrases: Phrase[];
  source: PhrasebookSource;
  /** Case- and accent-tolerant search across English, Arabic and translit. */
  search: (query: string) => Phrase[];
}

export function usePhrasebook(): UsePhrasebook {
  const [file, setFile] = useState<PhrasebookFile | null>(null);
  const [source, setSource] = useState<PhrasebookSource>("loading");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // 1. Cache first. This is the path that must work offline.
      const cached = await kvGet<PhrasebookFile>(CACHE_KEY);
      if (!cancelled && isValid(cached)) {
        setFile(cached);
        setSource("cache");
      }

      // 2. Background refresh. Failure here is normal and not an error —
      //    being offline is the expected case for this screen.
      try {
        const res = await fetch("/phrasebook.json", { cache: "no-cache" });
        if (!res.ok) throw new Error(String(res.status));
        const fresh: unknown = await res.json();
        if (!isValid(fresh)) throw new Error("malformed");

        if (!cancelled) {
          setFile(fresh);
          setSource("network");
        }
        // Only write when the version moved, to avoid pointless disk churn
        // on every single app open.
        if (!isValid(cached) || cached.version !== fresh.version) {
          await kvSet(CACHE_KEY, fresh);
        }
      } catch {
        if (!cancelled && !isValid(cached)) {
          // No cache and no network: the phrasebook has never been loaded.
          setSource("unavailable");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const phrases = useMemo(() => file?.phrases ?? [], [file]);
  const categories = useMemo(() => file?.categories ?? [], [file]);

  /**
   * Pre-computed lowercase haystack per phrase. Built once per data load
   * rather than per keystroke — search runs on every character typed.
   */
  const index = useMemo(
    () =>
      phrases.map((p) => ({
        phrase: p,
        haystack: `${p.english} ${p.transliteration} ${p.arabic}`.toLowerCase(),
      })),
    [phrases],
  );

  const search = useCallback(
    (query: string): Phrase[] => {
      const q = query.trim().toLowerCase();
      if (!q) return phrases;

      // Every term must match somewhere, so "coffee sugar" narrows rather
      // than widening. Apostrophes are optional: typing "sar" finds "si'r".
      const terms = q.split(/\s+/).map((t) => t.replace(/['`]/g, ""));
      return index
        .filter(({ haystack }) => {
          const flat = haystack.replace(/['`]/g, "");
          return terms.every((t) => flat.includes(t));
        })
        .map(({ phrase }) => phrase);
    },
    [index, phrases],
  );

  return { categories, phrases, source, search };
}
