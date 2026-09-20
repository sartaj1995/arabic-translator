/**
 * Audio container negotiation. Pure functions, no React, no DOM requirement —
 * so both the browser recorder and the API route can use them, and so they can
 * be exercised directly in Node.
 */

/**
 * Probed in order of preference. Opus first (best quality per byte for speech),
 * then the MP4/AAC family that iOS actually produces.
 */
export const RECORDING_CANDIDATES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/ogg;codecs=opus",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
  "audio/aac",
] as const;

/**
 * The type to hand MediaRecorder on this device.
 * Returns "" when nothing matches, which tells MediaRecorder to pick its own
 * default — better than throwing, since the result is usually still usable.
 */
export function pickRecordingMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const type of RECORDING_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

/** Everything the Gemini API will accept as inline audio. */
const GEMINI_AUDIO_TYPES = new Set([
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "audio/mpeg",
  "audio/m4a",
  "audio/l16",
  "audio/opus",
  "audio/alaw",
  "audio/mulaw",
  "audio/webm",
]);

/**
 * Translate a recorded container type into one the Gemini API will accept.
 *
 * The important case is iOS. Safari labels its recordings `audio/mp4`, which is
 * NOT on Gemini's accepted list — but `audio/m4a` is, and M4A *is* AAC-in-MP4.
 * The bytes are identical; only the label differs. So this is a relabel, not a
 * transcode: zero cost, no dependencies, and it is the difference between
 * Listen mode working on an iPhone and failing with an opaque 400.
 *
 * Applied on both ends. The client normalises before upload; the route
 * normalises again rather than trusting a value that arrived over the wire.
 */
export function normaliseForGemini(recorded: string): string {
  // Strip any ";codecs=..." parameter — Gemini wants the bare type.
  const base = recorded.split(";")[0].trim().toLowerCase();

  switch (base) {
    case "audio/mp4":
    case "audio/x-m4a":
      return "audio/m4a";
    case "audio/wave":
    case "audio/x-wav":
      return "audio/wav";
    case "video/webm":
      // Some browsers label an audio-only MediaRecorder stream as video/webm.
      return "audio/webm";
    default:
      // Pass through anything Gemini already accepts. Otherwise fall back to
      // WebM, the most likely thing a browser produced; a wrong guess fails
      // loudly at the API rather than silently here.
      return GEMINI_AUDIO_TYPES.has(base) ? base : "audio/webm";
  }
}

/** mm:ss for the live recording counter. */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
