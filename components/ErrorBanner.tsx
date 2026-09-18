"use client";

import type { AppErrorCode } from "@/lib/types";

export interface UiError {
  code: AppErrorCode;
  message: string;
}

/**
 * Every error the user can hit gets a plain-language line and, where one
 * exists, something they can actually do about it. The server message is used
 * as a fallback so a new code never renders blank.
 */
const COPY: Partial<Record<AppErrorCode, { title: string; hint?: string }>> = {
  RATE_LIMITED: {
    title: "Slow down a moment",
    hint: "Too many translations in a row. Wait a few seconds and try again.",
  },
  NO_API_KEY: {
    title: "Server is missing its API key",
    hint: "Add GOOGLE_GENERATIVE_AI_API_KEY to .env.local and restart the server.",
  },
  UPSTREAM_ERROR: {
    title: "The translation service failed",
    hint: "Usually temporary. Try again in a moment.",
  },
  TIMEOUT: {
    title: "That took too long",
    hint: "Check your signal and try again.",
  },
  BAD_MODEL_JSON: {
    title: "Got a garbled response",
    hint: "Already retried once. Try rephrasing it more simply.",
  },
  EMPTY_INPUT: { title: "Nothing to translate" },
  TOO_LONG: {
    title: "That is too long",
    hint: "Break it into shorter sentences — they translate better anyway.",
  },
  UNINTELLIGIBLE: {
    title: "Could not make that out",
    hint: "Try again somewhere quieter, closer to the mic.",
  },
  OFFLINE: {
    title: "You are offline",
    hint: "Translation needs a connection. The phrasebook still works.",
  },
  MIC_DENIED: {
    title: "Microphone blocked",
    hint: "Allow microphone access for this site in your browser settings.",
  },
  NO_MIC: { title: "No microphone found" },
  UNKNOWN: { title: "Something went wrong", hint: "Try again." },
};

export default function ErrorBanner({
  error,
  onDismiss,
}: {
  error: UiError;
  onDismiss?: () => void;
}) {
  const copy = COPY[error.code];
  const title = copy?.title ?? "Something went wrong";
  const hint = copy?.hint ?? error.message;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border-2 border-danger bg-danger-tint px-4 py-3"
    >
      <svg
        viewBox="0 0 24 24"
        className="mt-0.5 size-6 shrink-0 text-danger"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M12 2 1 21h22L12 2Zm0 6a1 1 0 0 1 1 1v5a1 1 0 1 1-2 0V9a1 1 0 0 1 1-1Zm0 10.5a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5Z" />
      </svg>
      <div className="min-w-0 flex-1">
        <p className="font-bold text-danger">{title}</p>
        {hint ? <p className="mt-0.5 text-sm text-ink-soft">{hint}</p> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className="press -mr-1 -mt-1 rounded-full p-2 text-danger"
        >
          <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden="true">
            <path d="M6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12 19 6.4 17.6 5 12 10.6 6.4 5Z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
