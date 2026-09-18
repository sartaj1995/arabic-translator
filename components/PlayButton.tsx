"use client";

import type { UseTts } from "@/lib/tts";

/**
 * Speaks Arabic text. Two sizes: `lg` is the primary thumb-zone control,
 * `sm` sits inline next to a variant line.
 *
 * The button never lies about its state — when the device has no Arabic voice
 * it renders visibly disabled, and the caller shows the explanation.
 */
export default function PlayButton({
  text,
  tts,
  size = "lg",
  label = "Play Arabic",
}: {
  text: string;
  tts: UseTts;
  size?: "lg" | "sm";
  label?: string;
}) {
  const unavailable = tts.status === "no-voice" || tts.status === "unsupported";
  const speaking = tts.status === "speaking";

  const onClick = () => {
    if (speaking) tts.cancel();
    else tts.speak(text);
  };

  if (size === "sm") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={unavailable}
        aria-label={speaking ? "Stop" : label}
        className={[
          "press grid size-11 shrink-0 place-items-center rounded-full border-2",
          unavailable
            ? "border-line text-ink-faint opacity-50"
            : "border-brand text-brand active:bg-brand-tint",
        ].join(" ")}
      >
        <Icon speaking={speaking} className="size-5" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={unavailable}
      className={[
        "press flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-xl font-bold text-white",
        unavailable ? "bg-ink-faint opacity-50" : "bg-brand active:bg-brand-dark",
      ].join(" ")}
    >
      <Icon speaking={speaking} className="size-7" />
      {speaking ? "Stop" : unavailable ? "No Arabic voice" : "Play Arabic"}
    </button>
  );
}

function Icon({ speaking, className }: { speaking: boolean; className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      {speaking ? (
        <path d="M7 6h3.5v12H7V6Zm6.5 0H17v12h-3.5V6Z" />
      ) : (
        <path d="M4 9.5h3.2L12 5.2c.65-.58 1.7-.12 1.7.76v12.08c0 .88-1.05 1.34-1.7.76L7.2 14.5H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Zm12.9-2.2a1 1 0 0 1 1.4.13A7.46 7.46 0 0 1 20 12a7.46 7.46 0 0 1-1.7 4.57 1 1 0 1 1-1.54-1.28A5.47 5.47 0 0 0 18 12a5.47 5.47 0 0 0-1.24-3.29 1 1 0 0 1 .14-1.41Z" />
      )}
    </svg>
  );
}
