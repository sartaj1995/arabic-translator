"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  formatDuration,
  normaliseForGemini,
  pickRecordingMimeType,
} from "./audioFormats";
import type { AppErrorCode } from "./types";

// Re-exported so components have one import for everything recording-related.
export { formatDuration, normaliseForGemini, pickRecordingMimeType };

/**
 * Push-to-talk recording via MediaRecorder.
 *
 * Two things make this harder than it looks:
 *
 *  1. Container support is platform-specific. Chrome and Android give WebM/Opus;
 *     iOS Safari gives MP4/AAC. Neither is guaranteed, so the type is probed at
 *     runtime rather than hardcoded.
 *  2. What MediaRecorder *labels* the output is not always what the Gemini API
 *     *accepts*. See normaliseForGemini below — this one bites on iOS.
 */

/* ------------------------------------------------------------------ *
 * Recorder hook
 * ------------------------------------------------------------------ */

export type RecorderState =
  /** Nothing happening. */
  | "idle"
  /** getUserMedia is in flight — the permission sheet may be showing. */
  | "requesting"
  /** Actively capturing. */
  | "recording";

/** Below this, treat it as an accidental tap rather than a recording. */
export const MIN_DURATION_MS = 400;
/** Hard cap. Bounds both the request body and the API cost. */
export const MAX_DURATION_MS = 30_000;

export interface RecordedClip {
  blob: Blob;
  /** Already normalised for Gemini. */
  mimeType: string;
  durationMs: number;
}

export interface UseRecorder {
  state: RecorderState;
  /** Live elapsed milliseconds while recording; 0 otherwise. */
  durationMs: number;
  supported: boolean;
  /** Begin capture. Safe to call on pointerdown. */
  start: () => void;
  /** Stop and emit the clip via onClip. */
  stop: () => void;
}

const noopSubscribe = () => () => {};
const getSupported = () =>
  typeof window !== "undefined" &&
  typeof MediaRecorder !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia;
const getSupportedOnServer = () => false;

export function useRecorder(opts: {
  onClip: (clip: RecordedClip) => void;
  onError: (code: AppErrorCode, message: string) => void;
}): UseRecorder {
  const supported = useSyncExternalStore(
    noopSubscribe,
    getSupported,
    getSupportedOnServer,
  );

  const [state, setState] = useState<RecorderState>("idle");
  const [durationMs, setDurationMs] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const tickRef = useRef<number | null>(null);
  /**
   * Push-to-talk means the user can release the button before getUserMedia
   * resolves. This tracks whether they still want to be recording, so a late
   * stream can be torn down instead of starting a recording nobody asked for.
   */
  const wantsRecordingRef = useRef(false);

  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  /** Release the mic. Skipping this leaves the browser's recording dot lit. */
  const teardown = useCallback(() => {
    if (tickRef.current !== null) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
    chunksRef.current = [];
  }, []);

  useEffect(() => teardown, [teardown]);

  const stop = useCallback(() => {
    wantsRecordingRef.current = false;
    const rec = recorderRef.current;
    if (!rec || rec.state === "inactive") {
      // Either never started, or the stream is still pending. Either way the
      // pending path checks wantsRecordingRef and cleans up after itself.
      setState("idle");
      setDurationMs(0);
      return;
    }
    rec.stop(); // onstop does the emitting.
  }, []);

  const start = useCallback(() => {
    if (!getSupported()) {
      cb.current.onError("NO_MIC", "Recording is not supported in this browser.");
      return;
    }
    if (recorderRef.current) return; // Already going.

    wantsRecordingRef.current = true;
    setState("requesting");
    setDurationMs(0);

    navigator.mediaDevices
      .getUserMedia({
        audio: {
          // Street and café noise is the normal case here.
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })
      .then((stream) => {
        // Released during the permission prompt — drop it.
        if (!wantsRecordingRef.current) {
          stream.getTracks().forEach((t) => t.stop());
          setState("idle");
          return;
        }

        streamRef.current = stream;
        const mimeType = pickRecordingMimeType();
        const rec = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);

        recorderRef.current = rec;
        chunksRef.current = [];

        rec.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        rec.onerror = () => {
          teardown();
          setState("idle");
          setDurationMs(0);
          cb.current.onError("UNKNOWN", "Recording failed. Try again.");
        };

        rec.onstop = () => {
          const elapsed = Date.now() - startedAtRef.current;
          // Prefer the recorder's own type: it may have picked a default.
          const recordedType = rec.mimeType || mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: recordedType });

          teardown();
          setState("idle");
          setDurationMs(0);

          if (elapsed < MIN_DURATION_MS || blob.size === 0) {
            cb.current.onError(
              "UNINTELLIGIBLE",
              "Too short. Hold the button while you speak.",
            );
            return;
          }

          cb.current.onClip({
            blob,
            mimeType: normaliseForGemini(recordedType),
            durationMs: elapsed,
          });
        };

        startedAtRef.current = Date.now();
        // Timeslice keeps data flowing, so a crash mid-clip still leaves audio.
        rec.start(250);
        setState("recording");

        tickRef.current = window.setInterval(() => {
          const elapsed = Date.now() - startedAtRef.current;
          setDurationMs(elapsed);
          if (elapsed >= MAX_DURATION_MS) stop();
        }, 100);
      })
      .catch((err: unknown) => {
        wantsRecordingRef.current = false;
        teardown();
        setState("idle");
        setDurationMs(0);

        const name = (err as Error)?.name;
        if (name === "NotAllowedError" || name === "SecurityError") {
          cb.current.onError("MIC_DENIED", "Microphone access was denied.");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          cb.current.onError("NO_MIC", "No microphone was found.");
        } else {
          cb.current.onError("UNKNOWN", "Could not start the microphone.");
        }
      });
  }, [stop, teardown]);

  return { state, durationMs, supported, start, stop };
}

