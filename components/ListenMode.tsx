"use client";

import { useCallback, useState } from "react";
import EnglishResult from "./EnglishResult";
import ErrorBanner, { type UiError } from "./ErrorBanner";
import Spinner from "./Spinner";
import {
  formatDuration,
  MAX_DURATION_MS,
  useRecorder,
  type RecordedClip,
} from "@/lib/audio";
import { unlockSpeech, useTts } from "@/lib/tts";
import { useOnline } from "@/lib/useOnline";
import type { AppErrorCode, ApiErrorBody, ListenResult } from "@/lib/types";

export default function ListenMode() {
  const [result, setResult] = useState<ListenResult | null>(null);
  const [error, setError] = useState<UiError | null>(null);
  const [sending, setSending] = useState(false);

  const tts = useTts();
  const online = useOnline();

  const fail = useCallback((code: AppErrorCode, message: string) => {
    setError({ code, message });
  }, []);

  const send = useCallback(
    async (clip: RecordedClip) => {
      if (!navigator.onLine) {
        fail("OFFLINE", "Translation needs a connection.");
        return;
      }

      setSending(true);
      setError(null);
      try {
        const form = new FormData();
        // The filename is required by some servers; the extension is cosmetic.
        form.append("audio", clip.blob, "clip");
        form.append("mimeType", clip.mimeType);

        // No Content-Type header on purpose — the browser must set the
        // multipart boundary itself.
        const res = await fetch("/api/listen", { method: "POST", body: form });

        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as ApiErrorBody | null;
          fail(
            body?.error?.code ?? "UNKNOWN",
            body?.error?.message ?? "Request failed.",
          );
          return;
        }

        setResult((await res.json()) as ListenResult);
      } catch {
        fail("OFFLINE", "Could not reach the server.");
      } finally {
        setSending(false);
      }
    },
    [fail],
  );

  const recorder = useRecorder({
    onClip: (clip) => void send(clip),
    onError: fail,
  });

  const recording = recorder.state === "recording";
  const requesting = recorder.state === "requesting";
  const busy = sending || requesting;

  // The button must never be ambiguous — every state has its own label.
  const label = sending
    ? "Translating…"
    : requesting
      ? "Starting mic…"
      : recording
        ? `Listening  ${formatDuration(recorder.durationMs)}`
        : "Hold to speak Arabic";

  const nearCap = recording && recorder.durationMs > MAX_DURATION_MS - 5_000;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ---------------- Result area (scrolls) ---------------- */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {!online && (
          <div className="mb-4 rounded-2xl border-2 border-warn-line bg-warn-tint px-4 py-3">
            <p className="font-bold text-ink">You are offline</p>
            <p className="text-sm text-ink-soft">Translation needs a connection.</p>
          </div>
        )}

        {error && (
          <div className="mb-4">
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
          </div>
        )}

        {tts.ready && tts.status === "no-voice" && result?.arabic && (
          <div className="mb-4 rounded-2xl border-2 border-warn-line bg-warn-tint px-4 py-3">
            <p className="font-bold text-ink">No Arabic voice on this device</p>
            <p className="text-sm text-ink-soft">
              Text still works. To replay the Arabic, install an Arabic voice:
              iOS Settings &rsaquo; Accessibility &rsaquo; Spoken Content &rsaquo;
              Voices &rsaquo; Arabic. On Android, add Arabic under Text-to-speech
              output.
            </p>
          </div>
        )}

        {sending && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-ink-faint">
            <Spinner className="size-9" />
            <p className="text-base font-semibold">Translating…</p>
          </div>
        )}

        {!sending && result && <EnglishResult result={result} tts={tts} />}

        {!sending && !result && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <svg
              viewBox="0 0 24 24"
              className="size-12 text-line"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
            </svg>
            <p className="max-w-[16rem] text-base text-ink-faint">
              Hold the button and point your phone at whoever is speaking.
              Release when they stop.
            </p>
          </div>
        )}
      </div>

      {/* ---------------- Push to talk (thumb zone) ---------------- */}
      <div className="shrink-0 border-t-2 border-line bg-surface px-4 pt-3 pb-safe">
        {recording && (
          <div className="mb-2 flex items-center justify-center gap-2">
            <span className="size-3 animate-pulse rounded-full bg-danger" />
            <span className="font-mono text-lg font-bold tabular-nums text-danger">
              {formatDuration(recorder.durationMs)}
            </span>
            {nearCap && (
              <span className="text-xs font-semibold text-ink-faint">
                / {formatDuration(MAX_DURATION_MS)} max
              </span>
            )}
          </div>
        )}

        <button
          type="button"
          disabled={busy || !recorder.supported}
          // Pointer events rather than mouse/touch: one code path for finger,
          // stylus and mouse, and pointer capture keeps the release event even
          // if the thumb slides off the button.
          onPointerDown={(e) => {
            if (busy) return;
            e.preventDefault();
            // setPointerCapture throws on an unknown pointer id. Capture is a
            // nicety — it keeps the release event if the thumb slides off — so
            // never let it abort the handler and lose the recording entirely.
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* Without capture, pointerup still fires on the button itself. */
            }
            unlockSpeech(); // Spend this gesture unlocking iOS TTS too.
            recorder.start();
          }}
          onPointerUp={(e) => {
            try {
              e.currentTarget.releasePointerCapture(e.pointerId);
            } catch {
              /* Already released, or was never captured. */
            }
            recorder.stop();
          }}
          onPointerCancel={() => recorder.stop()}
          // Long-press on iOS otherwise raises the selection callout.
          onContextMenu={(e) => e.preventDefault()}
          className={[
            "press flex w-full touch-none select-none items-center justify-center gap-3 rounded-2xl px-5 py-6 text-xl font-bold text-white",
            recording
              ? "bg-danger ring-4 ring-danger/30"
              : busy
                ? "bg-ink-faint opacity-60"
                : recorder.supported
                  ? "bg-brand active:bg-brand-dark"
                  : "bg-ink-faint opacity-50",
          ].join(" ")}
        >
          {sending ? (
            <Spinner className="size-7" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              className={`size-8 ${recording ? "animate-pulse" : ""}`}
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.93V21a1 1 0 1 1-2 0v-3.07A7 7 0 0 1 5 11a1 1 0 1 1 2 0 5 5 0 0 0 10 0Z" />
            </svg>
          )}
          {recorder.supported ? label : "Recording not supported"}
        </button>

        {!recording && !busy && recorder.supported && (
          <p className="mt-2 text-center text-xs text-ink-faint">
            Arabic in, English out
          </p>
        )}
      </div>
    </div>
  );
}
