import { NextResponse } from "next/server";
import { englishToArabic } from "@/lib/ai";
import { AppError, toErrorResponse } from "@/lib/errors";
import { clientKey, hit, SPEAK_LIMIT } from "@/lib/rateLimit";
import type { SpeakResult } from "@/lib/types";

// Node runtime: the Gemini SDK is not edge-safe.
export const runtime = "nodejs";
// Never cache a translation.
export const dynamic = "force-dynamic";

/** Long enough to be a real sentence, short enough to bound cost. */
const MAX_CHARS = 500;

export async function POST(req: Request): Promise<NextResponse<SpeakResult | unknown>> {
  try {
    hit(clientKey(req), SPEAK_LIMIT);

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === "string" ? body.text.trim() : "";

    if (!text) {
      throw new AppError("EMPTY_INPUT", "Type something to translate.", 400);
    }
    if (text.length > MAX_CHARS) {
      throw new AppError(
        "TOO_LONG",
        `Keep it under ${MAX_CHARS} characters.`,
        400,
      );
    }

    const result = await englishToArabic(text);
    return NextResponse.json(result);
  } catch (err) {
    return toErrorResponse(err);
  }
}
