"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { AppErrorCode } from "./types";

/**
 * English dictation via the browser's SpeechRecognition API.
 *
 * This is a progressive enhancement, never a requirement: Firefox has no
 * implementation at all, and iOS Safari's is prefixed and occasionally
 * disabled by policy. `supported` is false in those cases and the caller
 * simply shows the keyboard instead.
 *
 * Note this is a *different* mechanism from Listen mode (Phase 2), which
 * records real audio and sends it to the model. This one never leaves the
 * device, which is why it is free and English-only.
 */

/* Minimal ambient types — the DOM lib does not ship these. */
interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  readonly length: number;
  isFinal: boolean;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: {
    readonly length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}
interface SpeechRecognitionErrorEventLike extends Event {
  error: string;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export interface UseDictation {
  /** False on Firefox and locked-down webviews; hide the mic button. */
  supported: boolean;
  listening: boolean;
  /** Live partial transcript while speaking. Empty when idle. */
  interim: string;
  start: () => void;
  stop: () => void;
}

/* Support never changes at runtime, so the subscription is a no-op; this is
 * useSyncExternalStore purely for its server/client snapshot split. Assuming
 * unsupported on the server means the mic button appears after hydration
 * rather than flickering away. */
const noopSubscribe = () => () => {};
const getSupported = () => getCtor() !== null;
const getSupportedOnServer = () => false;

export function useDictation(opts: {
  /** Called once with the final transcript. */
  onFinal: (text: string) => void;
  onError: (code: AppErrorCode, message: string) => void;
}): UseDictation {
  const supported = useSyncExternalStore(
    noopSubscribe,
    getSupported,
    getSupportedOnServer,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  // Keep the latest callbacks in a ref so `start` stays referentially stable
  // and the recognizer does not need rebuilding when the parent re-renders.
  // Written in an effect, never during render.
  const cb = useRef(opts);
  useEffect(() => {
    cb.current = opts;
  });

  useEffect(() => {
    return () => {
      recRef.current?.abort();
      recRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) {
      cb.current.onError("UNKNOWN", "Dictation is not available in this browser.");
      return;
    }

    // Always build a fresh recognizer. Reusing one across sessions is the
    // documented source of "start() called on an already-started" errors.
    recRef.current?.abort();
    const rec = new Ctor();
    recRef.current = rec;

    rec.lang = "en-US";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalText = "";

    rec.onstart = () => {
      setListening(true);
      setInterim("");
    };

    rec.onresult = (e) => {
      let partial = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i];
        const text = r[0]?.transcript ?? "";
        if (r.isFinal) finalText += text;
        else partial += text;
      }
      setInterim(partial);
    };

    rec.onerror = (e) => {
      setListening(false);
      setInterim("");
      switch (e.error) {
        case "not-allowed":
        case "service-not-allowed":
          cb.current.onError("MIC_DENIED", "Microphone access was denied.");
          break;
        case "audio-capture":
          cb.current.onError("NO_MIC", "No microphone was found.");
          break;
        case "no-speech":
          cb.current.onError("UNINTELLIGIBLE", "Did not hear anything.");
          break;
        case "network":
          cb.current.onError("OFFLINE", "Dictation needs a connection.");
          break;
        case "aborted":
          break; // User-initiated; not worth a banner.
        default:
          cb.current.onError("UNKNOWN", `Dictation failed (${e.error}).`);
      }
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      const trimmed = finalText.trim();
      if (trimmed) cb.current.onFinal(trimmed);
    };

    try {
      rec.start();
    } catch {
      setListening(false);
      cb.current.onError("UNKNOWN", "Could not start dictation.");
    }
  }, []);

  return { supported, listening, interim, start, stop };
}
