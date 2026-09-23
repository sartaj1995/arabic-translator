"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  historyAll,
  historyClearUnsaved,
  historyDelete,
  historyPut,
  type HistoryRecord,
} from "./db";

/**
 * Translation history, newest first, backed by IndexedDB.
 *
 * The cap applies to UNSAVED entries only. Starring an item that then gets
 * evicted by the next fifty translations would make the star meaningless, so
 * saved items are exempt from trimming and live until explicitly unstarred.
 */

export const HISTORY_LIMIT = 50;

export type { HistoryRecord };

export interface NewEntry {
  mode: "speak" | "listen";
  english: string;
  arabic: string;
  transliteration: string;
}

export interface UseHistory {
  /** Everything, newest first, saved and unsaved together. */
  items: HistoryRecord[];
  /** Just the starred ones, newest first. */
  saved: HistoryRecord[];
  ready: boolean;
  add: (entry: NewEntry) => Promise<void>;
  toggleSave: (id: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  /** Clears unsaved entries; starred ones survive. */
  clearUnsaved: () => Promise<void>;
}

function newId(): string {
  // crypto.randomUUID needs a secure context; fall back for http:// dev hosts.
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function useHistory(): UseHistory {
  const [items, setItems] = useState<HistoryRecord[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    historyAll().then((rows) => {
      if (cancelled) return;
      setItems(rows);
      setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const add = useCallback(async (entry: NewEntry) => {
    // Nothing to replay and nothing to read — not worth a history row.
    if (!entry.arabic && !entry.english) return;

    const record: HistoryRecord = {
      id: newId(),
      createdAt: Date.now(),
      saved: 0,
      ...entry,
    };

    await historyPut(record);

    // Work out the eviction against fresh state rather than a stale closure.
    let toEvict: string[] = [];
    setItems((prev) => {
      const next = [record, ...prev];
      const unsaved = next.filter((r) => r.saved !== 1);
      if (unsaved.length > HISTORY_LIMIT) {
        const evictIds = new Set(unsaved.slice(HISTORY_LIMIT).map((r) => r.id));
        toEvict = [...evictIds];
        return next.filter((r) => !evictIds.has(r.id));
      }
      return next;
    });

    if (toEvict.length) await historyDelete(toEvict);
  }, []);

  const toggleSave = useCallback(async (id: string) => {
    let updated: HistoryRecord | null = null;
    setItems((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        updated = { ...r, saved: r.saved === 1 ? 0 : 1 };
        return updated;
      }),
    );
    if (updated) await historyPut(updated);
  }, []);

  const remove = useCallback(async (id: string) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
    await historyDelete([id]);
  }, []);

  const clearUnsaved = useCallback(async () => {
    setItems((prev) => prev.filter((r) => r.saved === 1));
    await historyClearUnsaved();
  }, []);

  const saved = useMemo(() => items.filter((r) => r.saved === 1), [items]);

  return { items, saved, ready, add, toggleSave, remove, clearUnsaved };
}
