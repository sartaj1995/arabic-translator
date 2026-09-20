import { NextResponse } from "next/server";
import { listenToEnglish } from "@/lib/ai";
import { normaliseForGemini } from "@/lib/audioFormats";
import { AppError, toErrorResponse } from "@/lib/errors";
import { clientKey, hit, LISTEN_LIMIT } from "@/lib/rateLimit";
import { MIN_CONFIDENCE } from "@/lib/types";

// Node runtime: the Gemini SDK is not edge-safe.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Vercel caps serverless request bodies at 4.5 MB, well below Gemini's 20 MB
 * inline limit — so this is the binding constraint. A 30s Opus clip is ~90 KB
 * and iOS AAC ~240 KB, so a real recording is nowhere near it.
 */
const MAX_BYTES = 4 * 1024 * 1024;

/** Smaller than this is a container header with no meaningful audio in it. */
const MIN_BYTES = 1024;

export async function POST(req: Request) {
  try {
    hit(clientKey(req), LISTEN_LIMIT);

    const form = await req.formData().catch(() => null);
    const audio = form?.get("audio");

    if (!(audio instanceof Blob)) {
      throw new AppError("EMPTY_INPUT", "No audio was received.", 400);
    }
    if (audio.size > MAX_BYTES) {
      throw new AppError("TOO_LONG", "That recording is too long.", 400);
    }
    if (audio.size < MIN_BYTES) {
      throw new AppError(
        "UNINTELLIGIBLE",
        "That recording was empty. Hold the button while you speak.",
        422,
      );
    }

    // The client sends the already-normalised type; fall back to the blob's own.
    // Normalise again rather than trusting a label that arrived over the wire.
    const declared = form?.get("mimeType");
    const mimeType = normaliseForGemini(
      typeof declared === "string" && declared ? declared : audio.type || "audio/webm",
    );

    const data = Buffer.from(await audio.arrayBuffer()).toString("base64");
    const result = await listenToEnglish({ data, mimeType });

    if (result.confidence < MIN_CONFIDENCE) {
      throw new AppError(
        "UNINTELLIGIBLE",
        result.english || "Could not make out any speech.",
        422,
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
