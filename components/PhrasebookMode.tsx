"use client";

import { useMemo, useState } from "react";
import PlayButton from "./PlayButton";
import Spinner from "./Spinner";
import { usePhrasebook } from "@/lib/phrasebook";
import type { UseTts } from "@/lib/tts";
import { useCopy } from "@/lib/useCopy";
import type { Phrase } from "@/lib/types";

/** "All" plus one chip per category. */
const ALL = "__all__";

export default function PhrasebookMode({ tts }: { tts: UseTts }) {
  const { categories, phrases, source, search } = usePhrasebook();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>(ALL);

  const results = useMemo(() => {
    const matched = search(query);
    return category === ALL ? matched : matched.filter((p) => p.category === category);
  }, [search, query, category]);

  // Group for display, preserving the file's ordering within each category.
  const grouped = useMemo(() => {
    const byCat = new Map<string, Phrase[]>();
    for (const p of results) {
      const list = byCat.get(p.category);
      if (list) list.push(p);
      else byCat.set(p.category, [p]);
    }
    return categories
      .filter((c) => byCat.has(c.id))
      .map((c) => ({ category: c, items: byCat.get(c.id)! }));
  }, [results, categories]);

  if (source === "loading") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 text-ink-faint">
        <Spinner className="size-9" />
        <p className="text-base font-semibold">Loading phrases…</p>
      </div>
    );
  }

  if (source === "unavailable") {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="text-lg font-bold text-ink">Phrasebook not downloaded yet</p>
        <p className="mt-2 text-base text-ink-soft">
          Open this screen once while you have a connection and it will be saved
          to your phone for offline use.
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Search and filters stay pinned; only the list scrolls. */}
      <div className="shrink-0 space-y-2 border-b-2 border-line px-4 pt-3 pb-2">
        <div className="relative">
          <svg
            viewBox="0 0 24 24"
            className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-ink-faint"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M10 2a8 8 0 1 0 4.9 14.3l5.4 5.4 1.4-1.4-5.4-5.4A8 8 0 0 0 10 2Zm0 2a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search English or Arabic"
            aria-label="Search phrases"
            className="w-full rounded-2xl border-2 border-line bg-surface py-2.5 pr-3 pl-10 text-base text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />
        </div>

        <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
          <Chip
            label="All"
            active={category === ALL}
            onClick={() => setCategory(ALL)}
          />
          {categories.map((c) => (
            <Chip
              key={c.id}
              label={c.label}
              active={category === c.id}
              onClick={() => setCategory(c.id)}
            />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {results.length === 0 ? (
          <p className="py-16 text-center text-base text-ink-faint">
            Nothing matches “{query}”.
          </p>
        ) : (
          grouped.map(({ category: cat, items }) => (
            <section key={cat.id} className="pt-4">
              <h2 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
                {cat.label}
              </h2>
              <ul className="mt-1.5 divide-y divide-line">
                {items.map((p) => (
                  <PhraseRow key={p.id} phrase={p} tts={tts} />
                ))}
              </ul>
            </section>
          ))
        )}

        <p className="pt-6 pb-2 text-center text-xs text-ink-faint">
          {phrases.length} phrases
          {source === "cache" ? " · saved on this device" : ""}
        </p>
      </div>
    </div>
  );
}

function Chip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "press shrink-0 rounded-full border-2 px-3 py-1.5 text-sm font-semibold whitespace-nowrap",
        active
          ? "border-brand bg-brand text-white"
          : "border-line text-ink-soft active:bg-surface-sunk",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function PhraseRow({ phrase, tts }: { phrase: Phrase; tts: UseTts }) {
  const { copied, copy } = useCopy();

  return (
    <li className="flex items-center gap-3 py-3">
      <button
        type="button"
        onClick={() => copy(phrase.arabic)}
        aria-label={`Copy Arabic for ${phrase.english}`}
        className="press min-w-0 flex-1 text-left"
      >
        <p className="text-base font-semibold text-ink">{phrase.english}</p>
        <p className="arabic mt-0.5 text-2xl text-ink">{phrase.arabic}</p>
        <p className="text-sm text-ink-faint">
          {copied ? (
            <span className="font-bold text-brand">Copied</span>
          ) : (
            phrase.transliteration
          )}
        </p>
      </button>
      <PlayButton
        text={phrase.arabic}
        tts={tts}
        size="sm"
        label={`Play ${phrase.english}`}
      />
    </li>
  );
}
