"use client";

import { useCallback, useState } from "react";
import PlayButton from "./PlayButton";
import type { UseTts } from "@/lib/tts";
import type { GenderAxis, SpeakResult } from "@/lib/types";

const AXIS_LABEL: Record<GenderAxis, string> = {
  speaker: "If you are…",
  listener: "Talking to…",
};

const GENDER_MARK = { masculine: "♂", feminine: "♀" } as const;

export default function ArabicResult({
  result,
  tts,
}: {
  result: SpeakResult;
  tts: UseTts;
}) {
  const { copied, copy } = useCopy();

  // Preserve the model's ordering within each axis; only group, never sort.
  const axes: GenderAxis[] = ["speaker", "listener"];
  const grouped = axes
    .map((axis) => ({ axis, items: result.variants.filter((v) => v.axis === axis) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <section className="rounded-3xl border-2 border-line bg-surface p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full bg-brand-tint px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-brand-dark">
            {result.register}
          </span>
          <span
            aria-live="polite"
            className={`text-xs font-bold text-brand transition-opacity ${
              copied ? "opacity-100" : "opacity-0"
            }`}
          >
            Copied
          </span>
        </div>

        {/* The whole block is the copy target — a big tap area beats a tiny icon. */}
        <button
          type="button"
          onClick={() => copy(result.arabic)}
          aria-label="Copy Arabic to clipboard"
          className="press mt-3 block w-full text-center"
        >
          <p className="arabic text-[2.6rem] font-semibold leading-tight text-ink">
            {result.arabic}
          </p>
        </button>

        <p className="mt-3 text-center text-2xl font-semibold text-ink-soft">
          {result.transliteration}
        </p>

        {result.literal_gloss ? (
          <p className="mt-2 text-center text-sm leading-relaxed text-ink-faint">
            {result.literal_gloss}
          </p>
        ) : null}

        <p className="mt-3 text-center text-xs text-ink-faint">
          Tap the Arabic to copy
        </p>
      </section>

      {result.msa_note ? (
        <div className="flex items-start gap-2.5 rounded-2xl border-2 border-warn-line bg-warn-tint px-4 py-3">
          <svg
            viewBox="0 0 24 24"
            className="mt-0.5 size-5 shrink-0 text-ink-soft"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 12 7Zm1 10.5h-2v-6h2v6Z" />
          </svg>
          <p className="text-sm leading-snug text-ink-soft">
            <span className="font-bold text-ink">Differs from MSA. </span>
            {result.msa_note}
          </p>
        </div>
      ) : null}

      {grouped.map(({ axis, items }) => (
        <section key={axis} className="rounded-2xl border-2 border-line p-4">
          <h2 className="text-xs font-bold uppercase tracking-wide text-ink-faint">
            {AXIS_LABEL[axis]}
          </h2>
          <ul className="mt-2 divide-y divide-line">
            {items.map((v) => (
              <li
                key={`${v.axis}-${v.gender}`}
                className="flex items-center gap-3 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className="w-5 shrink-0 text-center text-lg text-ink-faint"
                >
                  {GENDER_MARK[v.gender]}
                </span>
                <span className="sr-only">{v.gender}</span>
                <div className="min-w-0 flex-1">
                  <p className="arabic truncate text-2xl font-semibold text-ink">
                    {v.arabic}
                  </p>
                  <p className="truncate text-base text-ink-soft">
                    {v.transliteration}
                  </p>
                </div>
                <PlayButton
                  text={v.arabic}
                  tts={tts}
                  size="sm"
                  label={`Play ${v.gender} form`}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Clipboard with a graceful path for non-secure contexts and old webviews. */
function useCopy() {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        // Safari on http:// has no async clipboard; fall back to a temp node.
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
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* Copying is a convenience; a failure should not interrupt anything. */
    }
  }, []);

  return { copied, copy };
}
