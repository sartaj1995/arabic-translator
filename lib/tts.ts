"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";

/**
 * Browser speechSynthesis, wrapped to survive the three things that reliably
 * break Arabic TTS on real phones:
 *
 *  1. getVoices() is empty on first call. Chrome populates it asynchronously
 *     and fires `voiceschanged`; Safari sometimes never fires it at all, so we
 *     also poll briefly as a backstop.
 *  2. iOS refuses to speak until speechSynthesis has been touched inside a real
 *     user gesture. We burn one silent utterance on the first tap to unlock it.
 *  3. Plenty of devices have no Arabic voice installed. Left alone the browser
 *     will happily read Arabic script in an English voice, producing confident
 *     gibberish. We detect that and say so instead.
 *
 * The voice list is modelled as an external store rather than effect-driven
 * state: it lives outside React, changes on its own schedule, and differs
 * between server and client. useSyncExternalStore is exactly that shape, and
 * it keeps the derived status a render-time computation instead of a
 * cascading setState.
 */

export type TtsStatus =
  /** Ready, or finished speaking. */
  | "idle"
  /** Currently speaking. */
  | "speaking"
  /** Engine works, but this device has no Arabic voice installed. */
  | "no-voice"
  /** No speechSynthesis at all (old browser, or a locked-down webview). */
  | "unsupported";

/**
 * Choose the best Arabic voice from the device's installed voices.
 *
 * TODO(human): implement the selection strategy.
 *
 * Context on what you are picking from — `voices` is whatever the device has,
 * and the shape varies a lot:
 *   iPhone   -> [{ name: "Majed",  lang: "ar-SA", localService: true }, ...]
 *   Android  -> [{ name: "Arabic Male", lang: "ar", localService: true }, ...]
 *   Chrome   -> [{ name: "Google العربية", lang: "ar", localService: false }, ...]
 *   Windows  -> [{ name: "Microsoft Naayf - Arabic (Saudi)", lang: "ar-SA" }, ...]
 *
 * Return the voice to use, or null if this device has none (which surfaces the
 * "no Arabic voice" message rather than reading Arabic in an English accent).
 *
 * Things worth weighing:
 *   - `lang` is the reliable signal; it may be "ar-SA", "ar_SA", "ar-EG", or
 *     bare "ar". A Saudi voice is ideal, any Arabic voice beats none.
 *   - `localService: true` voices work offline and start instantly; remote
 *     ones need network and lag. This app is used in taxis with bad signal.
 *   - Never fall through to a non-Arabic voice. Returning null is the correct
 *     answer when there is no Arabic voice — that is the whole point of this
 *     function.
 */
export function pickArabicVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  // Placeholder so the app compiles and runs. Until this returns a voice, the
  // UI correctly reports "No Arabic voice on this device". Delete both lines.
  void voices;
  return null;
}

/* ------------------------------------------------------------------ *
 * Voice store. Module-scoped so every component shares one subscription
 * and one resolved voice list.
 * ------------------------------------------------------------------ */

const EMPTY: SpeechSynthesisVoice[] = [];

interface VoiceSnapshot {
  voices: SpeechSynthesisVoice[];
  /** True once the list has resolved, or we have stopped waiting for it. */
  settled: boolean;
  supported: boolean;
}

/** Optimistic until proven otherwise, so the UI does not flash an error. */
const INITIAL: VoiceSnapshot = { voices: EMPTY, settled: false, supported: true };

let snapshot: VoiceSnapshot = INITIAL;
let voiceKey = "";
let bootstrapped = false;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

/** Re-read the device voice list; only publishes when something changed. */
function refresh(markSettled = false) {
  const synth = window.speechSynthesis;
  const next = synth ? synth.getVoices() : EMPTY;
  const nextKey = next.map((v) => `${v.name}|${v.lang}`).join(",");

  const voicesChanged = nextKey !== voiceKey;
  const settledChanged = markSettled && !snapshot.settled;
  if (!voicesChanged && !settledChanged) return;

  voiceKey = nextKey;
  snapshot = {
    voices: voicesChanged ? (next.length ? next : EMPTY) : snapshot.voices,
    settled: snapshot.settled || markSettled,
    supported: snapshot.supported,
  };
  emit();
}

function bootstrap() {
  if (bootstrapped || typeof window === "undefined") return;
  bootstrapped = true;

  const synth = window.speechSynthesis;
  if (!synth) {
    snapshot = { voices: EMPTY, settled: true, supported: false };
    emit();
    return;
  }

  refresh();
  synth.addEventListener("voiceschanged", () => refresh());

  // Safari backstop: poll for ~3.5s in case voiceschanged never fires, then
  // commit to whatever we have so the UI stops waiting.
  let tries = 0;
  const timer = window.setInterval(() => {
    refresh();
    if (snapshot.voices.length || ++tries > 14) {
      window.clearInterval(timer);
      refresh(true);
    }
  }, 250);
}

function subscribe(onChange: () => void): () => void {
  bootstrap();
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

const getSnapshot = () => snapshot;
const getServerSnapshot = () => INITIAL;

/* ------------------------------------------------------------------ *
 * iOS gesture unlock
 * ------------------------------------------------------------------ */

let unlocked = false;

/**
 * iOS gates speechSynthesis behind a user gesture. Speaking a single silent
 * utterance inside the first real tap satisfies it for the rest of the session.
 * Safe and cheap to call on every tap; it no-ops after the first.
 */
export function unlockSpeech(): void {
  if (unlocked || typeof window === "undefined" || !window.speechSynthesis) return;
  unlocked = true;
  try {
    const u = new SpeechSynthesisUtterance("");
    u.volume = 0;
    window.speechSynthesis.speak(u);
  } catch {
    /* Nothing to do — the real speak() call will surface any failure. */
  }
}

/* ------------------------------------------------------------------ *
 * Hook
 * ------------------------------------------------------------------ */

export interface UseTts {
  /** Speak Arabic text. Cancels anything already queued. */
  speak: (text: string) => void;
  cancel: () => void;
  status: TtsStatus;
  /** Name of the chosen voice, for display. Null when none was found. */
  voiceName: string | null;
  /** False until the voice list has resolved; keeps the UI from flashing. */
  ready: boolean;
}

export function useTts(): UseTts {
  const { voices, settled, supported } = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Speaking is the only genuinely local state; it is driven by utterance
  // events, which are callbacks rather than effects.
  const [speaking, setSpeaking] = useState(false);

  const voice = useMemo(
    () => (voices.length ? pickArabicVoice(voices) : null),
    [voices],
  );

  // Stop any queued speech when the component goes away.
  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const status: TtsStatus = speaking
    ? "speaking"
    : !supported
      ? "unsupported"
      : settled && !voice
        ? "no-voice"
        : "idle";

  const cancel = useCallback(() => {
    window.speechSynthesis?.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback(
    (text: string) => {
      const synth = typeof window !== "undefined" ? window.speechSynthesis : null;
      if (!synth) return;

      unlockSpeech();

      // Refuse rather than let an English voice mangle Arabic script. The
      // derived status already reports "no-voice", so the UI is consistent.
      if (!voice) return;

      // A wedged queue is the most common cause of silent failure on Android.
      synth.cancel();

      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice;
      u.lang = voice.lang || "ar-SA";
      u.rate = 0.9; // Slightly slow — this is being repeated by a learner.
      u.pitch = 1;

      u.onstart = () => setSpeaking(true);
      u.onend = () => setSpeaking(false);
      u.onerror = () => setSpeaking(false);

      synth.speak(u);
    },
    [voice],
  );

  return { speak, cancel, status, voiceName: voice?.name ?? null, ready: settled };
}
