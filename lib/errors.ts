import { NextResponse } from "next/server";
import type { AppErrorCode, ApiErrorBody } from "./types";

/**
 * An error we are willing to show the user. Anything thrown that is NOT an
 * AppError gets flattened to UNKNOWN at the route boundary, so upstream
 * stack traces and key material never reach the client.
 */
export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
    readonly status: number = 500,
    readonly retryAfter?: number,
  ) {
    super(message);
    this.name = "AppError";
  }
}

const STATUS: Record<AppErrorCode, number> = {
  RATE_LIMITED: 429,
  NO_API_KEY: 500,
  UPSTREAM_ERROR: 502,
  MODEL_NOT_FOUND: 502,
  TIMEOUT: 504,
  BAD_MODEL_JSON: 502,
  EMPTY_INPUT: 400,
  TOO_LONG: 400,
  UNINTELLIGIBLE: 422,
  OFFLINE: 503,
  MIC_DENIED: 403,
  NO_MIC: 400,
  UNKNOWN: 500,
};

/** Turn anything thrown inside a route into a safe JSON response. */
export function toErrorResponse(err: unknown): NextResponse<ApiErrorBody> {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: { code: err.code, message: err.message, retryAfter: err.retryAfter },
    };
    return NextResponse.json(body, {
      status: err.status || STATUS[err.code],
      headers: err.retryAfter ? { "Retry-After": String(err.retryAfter) } : undefined,
    });
  }

  // Log the real thing server-side; hand the client something generic.
  console.error("[unhandled]", err);
  return NextResponse.json(
    { error: { code: "UNKNOWN" as const, message: "Something went wrong. Try again." } },
    { status: 500 },
  );
}
