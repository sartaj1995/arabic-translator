"use client";

import { useCallback, useRef, useState } from "react";
import ArabicResult from "./ArabicResult";
import ErrorBanner, { type UiError } from "./ErrorBanner";
import PlayButton from "./PlayButton";
import Spinner from "./Spinner";
import { useDictation } from "@/lib/dictation";
import { unlockSpeech, useTts } from "@/lib/tts";
import { useOnline } from "@/lib/useOnline";
import type { AppErrorCode, ApiErrorBody, SpeakResult } from "@/lib/types";

const EXAMPLES = [
  "Take me to the nearest pharmacy",
  "How much is this?",
  "Can I get the bill please",
  "I'm running ten minutes late",
];

export default function SpeakMode() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<SpeakResult | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const tts = useTts();
  const online = useOnline();

  const fail = useCallback((code: AppErrorCode, message: string) => {
    setError({ code, message });
  }, []);

  const translate = useCallback(
    async (raw: string) => {
      const value = raw.trim();
      if (!value) {
        fail("EMPTY_INPUT", "Type something to translate.");
        return;
      }
      if (!navigator.onLine) {
        fail("OFFLINE", "Translation needs a connection.");
        return;
      }

      // Spend the user's tap on unlocking iOS speech, so the Play button on
      // the result works first time instead of needing a throwaway press.
      unlockSpeech();

      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/speak", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: value }),
        });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          fail(body?.error?.code ?? "UNKNOWN", body?.error?.message ?? "Request failed.");
          return;
        }

        setResult((await res.json()) as SpeakResult);
      } catch {
        // fetch() only rejects on transport failure, so this really is the network.
        fail("OFFLINE", "Could not reach the server.");
      } finally {
        setLoading(false);
      }
    },
    [fail],
  );

  const dictation = useDictation({
    onFinal: (t) => {
      setText(t);
      void translate(t);
    },
    onError: fail,
  });

  const showExamples = !result && !loading && !text;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ---------------- Result area (scrolls) ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!online && (
          <div className="mb-4 rounded-2xl border-2 border-warn-line bg-warn-tint px-4 py-3">
            <p className="font-bold text-ink">You are offline</p>
            <p className="text-sm text-ink-soft">
              Translation needs a connection.
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {tts.ready && tts.status === "no-voice" && result && (
          <div className="mb-4 rounded-2xl border-2 border-warn-line bg-warn-tint px-4 py-3">
            <p className="font-bold text-ink">No Arabic voice on this device</p>
            <p className="text-sm text-ink-soft">
              Text still works. To hear it, install an Arabic voice: iOS
              Settings &rsaquo; Accessibility &rsaquo; Spoken Content &rsaquo;
              Voices &rsaquo; Arabic. On Android, add Arabic under
              Text-to-speech output.
            </p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-faint">
            <Spinner className="size-9" />
            <p className="text-base font-semibold">Translating…</p>
          </div>
        )}

        {!loading && result && <ArabicResult result={result} tts={tts} />}

        {showExamples && (
          <div className="py-8">
            <p className="text-center text-sm font-semibold uppercase tracking-wide text-ink-faint">
              Try one
            </p>
            <div className="mt-3 flex flex-col gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => {
                    setText(ex);
                    void translate(ex);
                  }}
                  className="press rounded-2xl border-2 border-line px-4 py-3 text-left text-base text-ink-soft active:bg-surface-sunk"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------------- Controls (thumb zone) ---------------- */}
      <div className="shrink-0 border-t-2 border-line bg-surface px-4 pt-3 pb-safe">
        {result && (
          <div className="mb-3">
            <PlayButton text={result.arabic} tts={tts} />
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={dictation.listening && dictation.interim ? dictation.interim : text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter makes a newline.
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void translate(text);
              }
            }}
            rows={1}
            enterKeyHint="send"
            placeholder={dictation.listening ? "Listening…" : "Say it in English"}
            aria-label="English text to translate"
            className="max-h-32 min-h-[3.25rem] flex-1 resize-none rounded-2xl border-2 border-line bg-surface px-4 py-3 text-lg text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
          />

          {dictation.supported && (
            <button
              type="button"
              onClick={() => (dictation.listening ? dictation.stop() : dictation.start())}
              aria-label={dictation.listening ? "Stop dictation" : "Dictate in English"}
              className={[
                "press grid size-[3.25rem] shrink-0 place-items-center rounded-2xl border-2",
                dictation.listening
                  ? "animate-pulse border-danger bg-danger text-white"
                  : "border-line text-ink-soft active:bg-surface-sunk",
              ].join(" ")}
            >
              <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
                <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
              </svg>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => void translate(text)}
          disabled={loading || !text.trim()}
          className={[
            "press mt-3 flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-xl font-bold text-white",
            loading || !text.trim()
              ? "bg-ink-faint opacity-50"
              : "bg-brand active:bg-brand-dark",
          ].join(" ")}
        >
          {loading ? (
            <>
              <Spinner className="size-6" />
              Translating…
            </>
          ) : (
            "Translate"
          )}
        </button>
      </div>
    </div>
  );
}
