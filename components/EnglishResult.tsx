"use client";

import PlayButton from "./PlayButton";
import type { UseTts } from "@/lib/tts";
import { useCopy } from "@/lib/useCopy";
import { LOW_CONFIDENCE, type ListenResult } from "@/lib/types";

/**
 * Result of a Listen capture.
 *
 * Reading order is deliberate and inverted from Speak mode: English is the
 * thing you urgently need, so it comes first and largest. The Arabic below it
 * is for checking what was actually said, and the transliteration under that
 * is for learning to recognise it next time.
 */
export default function EnglishResult({
  result,
  tts,
}: {
  result: ListenResult;
  tts: UseTts;
}) {
  const { copied, copy } = useCopy();
  const unsure = result.confidence < LOW_CONFIDENCE;

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border-2 border-line bg-surface p-5">
        {/* What they need, first and biggest. */}
        <p className="text-3xl font-bold leading-snug text-ink">{result.english}</p>

        {unsure && (
          <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-warn-tint px-3 py-1 text-xs font-bold text-ink-soft">
            <svg
              viewBox="0 0 24 24"
              className="size-4"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 10.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
            </svg>
            Audio was unclear — double check this
          </p>
        )}

        {result.arabic ? (
          <div className="mt-5 border-t-2 border-line pt-4">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => copy(result.arabic)}
                aria-label="Copy Arabic to clipboard"
                className="press min-w-0 flex-1 text-right"
              >
                <p className="arabic text-3xl font-semibold text-ink">
                  {result.arabic}
                </p>
              </button>
              <PlayButton
                text={result.arabic}
                tts={tts}
                size="sm"
                label="Replay the Arabic"
              />
            </div>

            {result.transliteration ? (
              <p className="mt-2 text-right text-lg text-ink-faint">
                {result.transliteration}
              </p>
            ) : null}

            <p className="mt-3 text-center text-xs text-ink-faint">
              {copied ? (
                <span className="font-bold text-brand">Copied</span>
              ) : (
                "Tap the Arabic to copy"
              )}
            </p>
          </div>
        ) : null}
      </section>
    </div>
  );
}
