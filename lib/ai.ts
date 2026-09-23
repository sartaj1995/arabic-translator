import { GoogleGenAI, Type, type Schema } from "@google/genai";
import { AppError } from "./errors";
import { SPEAK_SYSTEM, LISTEN_SYSTEM, JSON_REPAIR_SUFFIX } from "./prompts";
import type { SpeakResult, ListenResult, GenderVariant, Register } from "./types";

/**
 * Every model call in the app goes through this file.
 *
 * To swap providers, reimplement `generateJson` and the two exported functions
 * below. Nothing outside this file imports a provider SDK, and nothing outside
 * lib/prompts.ts contains prompt text.
 */

/**
 * Pinned to a GA model on purpose.
 *
 * These previously defaulted to the floating alias "gemini-flash-latest",
 * which appears in the SDK's typed model union but does not resolve on every
 * API key — the deployed app returned UPSTREAM_ERROR on every request. A type
 * listing known model ids is not a guarantee that a given key can reach them,
 * so the default is now a model that is broadly available, and upgrading is an
 * explicit env change rather than something that happens silently.
 *
 * gemini-2.5-flash is multimodal, so it serves both the text and audio calls.
 */
const TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const AUDIO_MODEL = process.env.GEMINI_AUDIO_MODEL || "gemini-2.5-flash";
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 20_000);

function client(): GoogleGenAI {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    throw new AppError(
      "NO_API_KEY",
      "GOOGLE_GENERATIVE_AI_API_KEY is not set. Add it to .env.local.",
      500,
    );
  }
  return new GoogleGenAI({ apiKey });
}

/* ------------------------------------------------------------------ *
 * Response schemas. These constrain the model; the validators below
 * constrain us. Both are necessary — schema-constrained decoding still
 * occasionally emits a field as the wrong shape.
 * ------------------------------------------------------------------ */

const SPEAK_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    arabic: { type: Type.STRING },
    transliteration: { type: Type.STRING },
    literal_gloss: { type: Type.STRING },
    register: { type: Type.STRING, enum: ["casual", "polite", "formal"] },
    msa_note: { type: Type.STRING, nullable: true },
    variants: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          axis: { type: Type.STRING, enum: ["speaker", "listener"] },
          gender: { type: Type.STRING, enum: ["masculine", "feminine"] },
          arabic: { type: Type.STRING },
          transliteration: { type: Type.STRING },
        },
        required: ["axis", "gender", "arabic", "transliteration"],
        propertyOrdering: ["axis", "gender", "arabic", "transliteration"],
      },
    },
  },
  required: ["arabic", "transliteration", "literal_gloss", "register", "variants"],
  // Arabic first: transliteration and gloss are derived from it, and models
  // produce better derivations when the source is already in context.
  propertyOrdering: [
    "arabic",
    "transliteration",
    "literal_gloss",
    "register",
    "msa_note",
    "variants",
  ],
};

const LISTEN_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    arabic: { type: Type.STRING },
    english: { type: Type.STRING },
    transliteration: { type: Type.STRING },
    confidence: { type: Type.NUMBER },
  },
  required: ["arabic", "english", "transliteration", "confidence"],
  propertyOrdering: ["arabic", "transliteration", "english", "confidence"],
};

/* ------------------------------------------------------------------ *
 * Parsing. Never trust the wire format.
 * ------------------------------------------------------------------ */

/** Models sometimes wrap JSON in markdown fences despite being told not to. */
function stripFences(raw: string): string {
  const t = raw.trim();
  if (!t.startsWith("```")) return t;
  return t
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
}

function parseOrNull(raw: string | undefined): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(stripFences(raw));
  } catch {
    return null;
  }
}

type Part = { text: string } | { inlineData: { mimeType: string; data: string } };

/**
 * One JSON-constrained call, with a single repair retry.
 *
 * The retry exists because schema-constrained decoding can still truncate or
 * emit a stray token. We retry exactly once with an explicit instruction and
 * temperature 0, then fail loudly rather than looping and burning quota.
 */
async function generateJson<T>(opts: {
  model: string;
  system: string;
  schema: Schema;
  parts: Part[];
  validate: (v: unknown) => T | null;
}): Promise<T> {
  const ai = client();

  for (let attempt = 0; attempt < 2; attempt++) {
    const parts: Part[] =
      attempt === 0 ? opts.parts : [...opts.parts, { text: JSON_REPAIR_SUFFIX }];

    let raw: string | undefined;
    try {
      const res = await ai.models.generateContent({
        model: opts.model,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: opts.system,
          responseMimeType: "application/json",
          responseSchema: opts.schema,
          temperature: attempt === 0 ? 0.3 : 0,
          abortSignal: AbortSignal.timeout(TIMEOUT_MS),
        },
      });
      raw = res.text;
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new AppError("TIMEOUT", "The model took too long. Try again.", 504);
      }
      const msg = (err as Error)?.message ?? "";
      if (/api[_ ]?key|permission|unauthenticated|401|403/i.test(msg)) {
        throw new AppError("NO_API_KEY", "Gemini rejected the API key.", 500);
      }
      console.error("[ai] upstream failure:", msg);

      // A model this key cannot reach is the single most likely misconfig, and
      // it is indistinguishable from a real outage unless we say so. Give it
      // its own code so the UI can name the env var to change.
      if (/404|not[ _]?found|does not exist|is not supported/i.test(msg)) {
        throw new AppError(
          "MODEL_NOT_FOUND",
          `Your API key cannot use "${opts.model}".`,
          502,
        );
      }

      // Surface the model name regardless — it is the variable most likely
      // to be at fault.
      throw new AppError(
        "UPSTREAM_ERROR",
        `Gemini call failed (model: ${opts.model}).`,
        502,
      );
    }

    const validated = opts.validate(parseOrNull(raw));
    if (validated) return validated;

    console.warn(`[ai] unusable JSON on attempt ${attempt + 1}:`, raw?.slice(0, 400));
  }

  throw new AppError(
    "BAD_MODEL_JSON",
    "The model returned something unreadable twice. Try rephrasing.",
    502,
  );
}

/* ------------------------------------------------------------------ *
 * Validators
 * ------------------------------------------------------------------ */

const isStr = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function validateSpeak(v: unknown): SpeakResult | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.arabic) || !isStr(o.transliteration)) return null;

  const register: Register =
    o.register === "casual" || o.register === "formal" ? o.register : "polite";

  const variants: GenderVariant[] = Array.isArray(o.variants)
    ? o.variants.flatMap((raw): GenderVariant[] => {
        if (!raw || typeof raw !== "object") return [];
        const r = raw as Record<string, unknown>;
        const axis = r.axis === "speaker" || r.axis === "listener" ? r.axis : null;
        const gender =
          r.gender === "masculine" || r.gender === "feminine" ? r.gender : null;
        if (!axis || !gender || !isStr(r.arabic) || !isStr(r.transliteration)) return [];
        return [{ axis, gender, arabic: r.arabic, transliteration: r.transliteration }];
      })
    : [];

  return {
    arabic: o.arabic,
    transliteration: o.transliteration,
    literal_gloss: isStr(o.literal_gloss) ? o.literal_gloss : "",
    register,
    msa_note: isStr(o.msa_note) ? o.msa_note : null,
    variants,
  };
}

function validateListen(v: unknown): ListenResult | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isStr(o.english)) return null;
  const confidence =
    typeof o.confidence === "number" && Number.isFinite(o.confidence)
      ? Math.min(1, Math.max(0, o.confidence))
      : 0.5;
  return {
    arabic: isStr(o.arabic) ? o.arabic : "",
    english: o.english,
    transliteration: isStr(o.transliteration) ? o.transliteration : "",
    confidence,
  };
}

/* ------------------------------------------------------------------ *
 * Public API — the only two functions the routes may call.
 * ------------------------------------------------------------------ */

/** English text in, Riyadh Najdi Arabic out. */
export async function englishToArabic(text: string): Promise<SpeakResult> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new AppError("EMPTY_INPUT", "Type something to translate.", 400);
  }
  return generateJson<SpeakResult>({
    model: TEXT_MODEL,
    system: SPEAK_SYSTEM,
    schema: SPEAK_SCHEMA,
    parts: [{ text: trimmed }],
    validate: validateSpeak,
  });
}

/**
 * Arabic audio in, English out — one multimodal call, no separate transcribe
 * step. Wired up to /api/listen in Phase 2.
 */
export async function listenToEnglish(audio: {
  data: string;
  mimeType: string;
}): Promise<ListenResult> {
  return generateJson<ListenResult>({
    model: AUDIO_MODEL,
    system: LISTEN_SYSTEM,
    schema: LISTEN_SCHEMA,
    parts: [
      { inlineData: { mimeType: audio.mimeType, data: audio.data } },
      { text: "Transcribe and translate this clip." },
    ],
    validate: validateListen,
  });
}
