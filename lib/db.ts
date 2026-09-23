"use client";

/**
 * A very small IndexedDB wrapper. No dependencies on purpose — the app needs
 * two stores and about six operations, which is less code than a library
 * wrapper would add.
 *
 * Every operation degrades to a safe default rather than throwing. Storage can
 * be unavailable for reasons the user cannot fix and should not have to care
 * about (Safari private browsing, a full disk, blocked site data), and none of
 * those should take the translator down — it still works, it just forgets.
 */

const DB_NAME = "riyadh-talk";
const DB_VERSION = 1;

export const STORE_KV = "kv";
export const STORE_HISTORY = "history";

let dbPromise: Promise<IDBDatabase | null> | null = null;

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve) => {
    if (typeof indexedDB === "undefined") {
      resolve(null);
      return;
    }

    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch {
      resolve(null);
      return;
    }

    req.onupgradeneeded = () => {
      const db = req.result;

      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }

      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        const store = db.createObjectStore(STORE_HISTORY, { keyPath: "id" });
        store.createIndex("createdAt", "createdAt");
        // Indexed as 0/1 rather than boolean: IDB key paths cannot index
        // booleans, and a silently unindexed field is a nasty bug to find.
        store.createIndex("saved", "saved");
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    // Another tab is holding an old version open. Give up rather than hang.
    req.onblocked = () => resolve(null);
  });

  return dbPromise;
}

/** Wrap one transaction, resolving to `fallback` on any failure. */
async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fallback: T,
  run: (store: IDBObjectStore, resolve: (v: T) => void) => void,
): Promise<T> {
  const db = await openDb();
  if (!db) return fallback;

  return new Promise<T>((resolve) => {
    let settled = false;
    const done = (v: T) => {
      if (!settled) {
        settled = true;
        resolve(v);
      }
    };

    try {
      const transaction = db.transaction(storeName, mode);
      transaction.onerror = () => done(fallback);
      transaction.onabort = () => done(fallback);
      run(transaction.objectStore(storeName), done);
    } catch {
      done(fallback);
    }
  });
}

/* ------------------------------------------------------------------ *
 * Key/value — used to cache the phrasebook
 * ------------------------------------------------------------------ */

export function kvGet<T>(key: string): Promise<T | null> {
  return withStore<T | null>(STORE_KV, "readonly", null, (store, done) => {
    const req = store.get(key);
    req.onsuccess = () => done((req.result as T) ?? null);
    req.onerror = () => done(null);
  });
}

export function kvSet(key: string, value: unknown): Promise<boolean> {
  return withStore(STORE_KV, "readwrite", false, (store, done) => {
    const req = store.put(value, key);
    req.onsuccess = () => done(true);
    req.onerror = () => done(false);
  });
}

/* ------------------------------------------------------------------ *
 * History
 * ------------------------------------------------------------------ */

export interface HistoryRecord {
  id: string;
  createdAt: number;
  mode: "speak" | "listen";
  /** 0 or 1, not boolean — see the index note above. */
  saved: 0 | 1;
  english: string;
  arabic: string;
  transliteration: string;
}

/** Everything, newest first. */
export function historyAll(): Promise<HistoryRecord[]> {
  return withStore<HistoryRecord[]>(STORE_HISTORY, "readonly", [], (store, done) => {
    const req = store.index("createdAt").getAll();
    req.onsuccess = () => {
      const rows = (req.result as HistoryRecord[]) ?? [];
      done(rows.reverse()); // getAll on an index is ascending.
    };
    req.onerror = () => done([]);
  });
}

export function historyPut(record: HistoryRecord): Promise<boolean> {
  return withStore(STORE_HISTORY, "readwrite", false, (store, done) => {
    const req = store.put(record);
    req.onsuccess = () => done(true);
    req.onerror = () => done(false);
  });
}

export function historyDelete(ids: string[]): Promise<boolean> {
  if (ids.length === 0) return Promise.resolve(true);
  return withStore(STORE_HISTORY, "readwrite", false, (store, done) => {
    for (const id of ids) store.delete(id);
    // Resolve on transaction completion, not per-delete.
    store.transaction.oncomplete = () => done(true);
  });
}

export function historyClearUnsaved(): Promise<boolean> {
  return withStore(STORE_HISTORY, "readwrite", false, (store, done) => {
    const req = store.openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) return;
      if ((cursor.value as HistoryRecord).saved !== 1) cursor.delete();
      cursor.continue();
    };
    store.transaction.oncomplete = () => done(true);
    req.onerror = () => done(false);
  });
}
