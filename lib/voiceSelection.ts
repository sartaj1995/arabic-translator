/**
 * Choosing which installed voice speaks the Arabic.
 *
 * Pure functions, no React and no DOM requirement, so the policy can be
 * exercised directly in Node against synthetic device voice lists — the real
 * ones differ per platform and cannot be reproduced on a dev machine.
 */

/**
 * ISO-639 primary subtags that actually mean Arabic.
 *
 * A naive `lang.startsWith("ar")` is wrong: "arc" is Aramaic and "arn" is
 * Mapudungun. Both would sail through and get Arabic script read aloud in
 * entirely the wrong language.
 */
const ARABIC_PRIMARY = new Set([
  "ar", // Arabic (macrolanguage) — what browsers almost always report
  "arb", // Standard Arabic
  "ars", // Najdi Arabic — exactly the target dialect
  "ary", // Moroccan
  "arz", // Egyptian
  "acm", // Mesopotamian
  "afb", // Gulf
  "apc", // Levantine
]);

/** Accents closest to Najdi after Saudi itself. */
const GULF_REGIONS = new Set(["AE", "BH", "KW", "QA", "OM", "YE"]);

/**
 * Voices known to be Saudi whose `lang` may only say "ar".
 * Majed is the iOS ar-SA voice; Naayf, Hamed and Zariyah are Microsoft's.
 */
const SAUDI_NAME_HINT = /\b(majed|naayf|nayf|hamed|zariyah|saudi|najdi)\b/i;

/**
 * How much preferring an offline-capable voice is worth.
 *
 * Deliberately larger than the entire region spread, so ANY local voice beats
 * ANY remote one. The reasoning is situational: this app gets used in taxis and
 * basement car parks, and a remote voice with no signal either lags badly or
 * silently does nothing — the exact failure the TTS layer exists to prevent. A
 * local Egyptian-accented voice still produces intelligible Arabic that a
 * Riyadh driver understands, whereas a correct-accent voice that never plays is
 * worth nothing.
 *
 * Lower this below 100 to let a remote Saudi voice outrank a local foreign one.
 */
const LOCAL_BONUS = 200;

/** Small tiebreaker; never enough to promote a non-Saudi region on its own. */
const NAME_HINT_BONUS = 15;

/** Split a BCP-47 tag into primary subtag and region. */
function parseLang(lang: string | undefined): { primary: string; region: string } {
  // Some platforms report "ar_SA" with an underscore rather than a hyphen.
  const parts = (lang ?? "").replace(/_/g, "-").split("-");
  return {
    primary: (parts[0] ?? "").toLowerCase(),
    region: (parts[1] ?? "").toUpperCase(),
  };
}

/**
 * Rank one voice. Returns -1 for anything that is not Arabic, which is what
 * keeps an English voice from ever being chosen.
 */
export function scoreArabicVoice(voice: SpeechSynthesisVoice): number {
  const { primary, region } = parseLang(voice.lang);
  if (!ARABIC_PRIMARY.has(primary)) return -1;

  let score: number;
  if (region === "SA" || primary === "ars") {
    score = 100; // Saudi — the dialect the whole app targets.
  } else if (GULF_REGIONS.has(region)) {
    score = 40; // Neighbouring accents, closest to Najdi.
  } else if (!region) {
    score = 30; // Unmarked "ar" — usually a neutral MSA voice.
  } else {
    score = 10; // Arabic, but a distinctly different accent.
  }

  if (voice.localService) score += LOCAL_BONUS;
  if (SAUDI_NAME_HINT.test(voice.name ?? "")) score += NAME_HINT_BONUS;

  return score;
}

/**
 * Choose the best Arabic voice on this device, or null if it has none.
 *
 * Returning null is a correct and important outcome: the caller surfaces "No
 * Arabic voice on this device" and stays silent, rather than letting the
 * browser read Arabic script in an English voice and produce confident
 * gibberish.
 */
export function pickArabicVoice(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null {
  let best: SpeechSynthesisVoice | null = null;
  let bestScore = -1;

  for (const voice of voices) {
    const score = scoreArabicVoice(voice);
    // Strictly greater, so ties keep the browser's own ordering, which puts
    // the platform's preferred voice first.
    if (score > bestScore) {
      bestScore = score;
      best = voice;
    }
  }

  return bestScore < 0 ? null : best;
}
