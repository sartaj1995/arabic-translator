/**
 * Shared types for both translation directions.
 *
 * These mirror the JSON contract the model is asked to return. Keep them in
 * sync with the response schemas in lib/ai.ts — those schemas are what
 * actually constrain the model, this is what constrains our own code.
 */

/** Which grammatical axis a gendered variant applies to. */
export type GenderAxis = "speaker" | "listener";

/**
 * Arabic conjugates by both who is talking and who is being talked to.
 * "I'm tired" changes with the speaker's gender; "how are you?" changes with
 * the listener's. A phrase can be gendered on both axes, neither, or one.
 */
export interface GenderVariant {
  axis: GenderAxis;
  gender: "masculine" | "feminine";
  arabic: string;
  transliteration: string;
}

/** Conversational register the phrase lands in. */
export type Register = "casual" | "polite" | "formal";

/** Response from /api/speak — English in, Riyadh Arabic out. */
export interface SpeakResult {
  /** Arabic script, Najdi dialect. Default rendering (masculine where forced). */
  arabic: string;
  /** Plain phonetic Latin, Najdi pronunciation. No numerals, no diacritics. */
  transliteration: string;
  /** Word-by-word gloss so you learn the pieces, not just the phrase. */
  literal_gloss: string;
  register: Register;
  /**
   * Set only when the Najdi differs from MSA in a way worth knowing about
   * (different word, not just pronunciation). Null when they broadly agree.
   */
  msa_note: string | null;
  /** Empty when the phrase carries no gender marking. */
  variants: GenderVariant[];
}

/** Response from /api/listen — Arabic audio in, English out. (Phase 2.) */
export interface ListenResult {
  arabic: string;
  english: string;
  transliteration: string;
  /** 0-1. Low values mean the audio was unclear, not that the speaker was. */
  confidence: number;
}

/**
 * Machine-readable error codes. The UI maps these to messages, so adding a
 * case here means adding a case in components/ErrorBanner.tsx.
 */
export type AppErrorCode =
  | "RATE_LIMITED"
  | "NO_API_KEY"
  | "UPSTREAM_ERROR"
  | "TIMEOUT"
  | "BAD_MODEL_JSON"
  | "EMPTY_INPUT"
  | "TOO_LONG"
  | "UNINTELLIGIBLE"
  | "OFFLINE"
  | "MIC_DENIED"
  | "NO_MIC"
  | "UNKNOWN";

export interface ApiErrorBody {
  error: { code: AppErrorCode; message: string; retryAfter?: number };
}

/** An entry in the offline phrasebook. (Phase 3.) */
export interface Phrase {
  id: string;
  category: string;
  english: string;
  arabic: string;
  transliteration: string;
}
