"use client";

import { useState } from "react";
import PlayButton from "./PlayButton";
import { HISTORY_LIMIT, type HistoryRecord, type UseHistory } from "@/lib/history";
import type { UseTts } from "@/lib/tts";
import { useCopy } from "@/lib/useCopy";

type Tab = "recent" | "saved";

export default function HistoryMode({
  history,
  tts,
}: {
  history: UseHistory;
  tts: UseTts;
}) {
  const [tab, setTab] = useState<Tab>("recent");
  const rows = tab === "recent" ? history.items : history.saved;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 border-b-2 border-line px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-sunk p-1">
          <TabButton
            label="Recent"
            count={history.items.length}
            active={tab === "recent"}
            onClick={() => setTab("recent")}
          />
          <TabButton
            label="Saved"
            count={history.saved.length}
            active={tab === "saved"}
            onClick={() => setTab("saved")}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4">
        {!history.ready ? null : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
            <p className="text-lg font-bold text-ink">
              {tab === "recent" ? "No translations yet" : "Nothing saved yet"}
            </p>
            <p className="mt-2 text-base text-ink-soft">
              {tab === "recent"
                ? `Your last ${HISTORY_LIMIT} translations appear here.`
                : "Tap the star on any translation to keep it here permanently."}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((row) => (
              <HistoryRow
                key={row.id}
                row={row}
                tts={tts}
                onToggleSave={() => void history.toggleSave(row.id)}
              />
            ))}
          </ul>
        )}

        {tab === "recent" && history.items.length > 0 && (
          <div className="py-5">
            <button
              type="button"
              onClick={() => void history.clearUnsaved()}
              className="press w-full rounded-2xl border-2 border-line py-3 text-base font-semibold text-ink-soft active:bg-surface-sunk"
            >
              Clear history
            </button>
            <p className="mt-2 text-center text-xs text-ink-faint">
              Saved items are kept.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        "press rounded-xl px-3 py-2 text-base font-bold",
        active ? "bg-surface text-brand shadow-sm ring-2 ring-brand" : "text-ink-soft",
      ].join(" ")}
    >
      {label}
      <span className="ml-1.5 text-sm font-semibold text-ink-faint">{count}</span>
    </button>
  );
}

function HistoryRow({
  row,
  tts,
  onToggleSave,
}: {
  row: HistoryRecord;
  tts: UseTts;
  onToggleSave: () => void;
}) {
  const { copied, copy } = useCopy();
  const starred = row.saved === 1;

  return (
    <li className="flex items-center gap-2 py-3">
      <button
        type="button"
        onClick={() => copy(row.arabic)}
        aria-label={`Copy Arabic for ${row.english}`}
        className="press min-w-0 flex-1 text-left"
      >
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-surface-sunk px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-faint">
            {row.mode}
          </span>
          <span className="text-xs text-ink-faint">{relativeTime(row.createdAt)}</span>
        </div>
        <p className="mt-1 text-base font-semibold text-ink">{row.english}</p>
        {row.arabic ? (
          <p className="arabic mt-0.5 text-2xl text-ink">{row.arabic}</p>
        ) : null}
        <p className="text-sm text-ink-faint">
          {copied ? (
            <span className="font-bold text-brand">Copied</span>
          ) : (
            row.transliteration
          )}
        </p>
      </button>

      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={starred}
        aria-label={starred ? "Remove from saved" : "Save this translation"}
        className={`press grid size-11 shrink-0 place-items-center rounded-full ${
          starred ? "text-warn-line" : "text-ink-faint"
        }`}
      >
        <svg
          viewBox="0 0 24 24"
          className="size-6"
          fill={starred ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m12 3 2.9 5.9 6.5.9-4.7 4.6 1.1 6.5-5.8-3-5.8 3 1.1-6.5L2.6 9.8l6.5-.9L12 3Z" />
        </svg>
      </button>

      {row.arabic ? (
        <PlayButton
          text={row.arabic}
          tts={tts}
          size="sm"
          label={`Replay ${row.english}`}
        />
      ) : null}
    </li>
  );
}

/** Compact relative time. Good enough for a list you scan, not a log. */
function relativeTime(ts: number): string {
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}
