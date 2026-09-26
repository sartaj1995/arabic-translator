"use client";

import { useState } from "react";

/**
 * Explains why every play button in the app is greyed out.
 *
 * Rendered once at the app level rather than per screen. Having no Arabic voice
 * is a property of the device, not of whichever tab you happen to be on — and
 * the first version of this only appeared in Speak and Listen mode, which left
 * the phrasebook showing 96 disabled buttons with no explanation anywhere.
 *
 * Collapsed by default so it costs one line, because it is shown on every
 * screen for as long as the condition holds.
 */
export default function NoVoiceNotice() {
  const [open, setOpen] = useState(false);

  return (
    <div className="shrink-0 border-b-2 border-warn-line bg-warn-tint">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="press flex w-full items-center gap-2 px-4 py-2 text-left"
      >
        <svg
          viewBox="0 0 24 24"
          className="size-5 shrink-0 text-ink-soft"
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a1.2 1.2 0 1 1 0 2.4A1.2 1.2 0 0 1 12 7Zm1 10.5h-2v-6h2v6Z" />
        </svg>
        <span className="min-w-0 flex-1 text-sm font-bold text-ink">
          No Arabic voice on this device
          <span className="block text-xs font-semibold text-ink-soft">
            Text works. Tap for how to turn sound on.
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`size-5 shrink-0 text-ink-soft transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="currentColor"
          aria-hidden="true"
        >
          <path d="M7.4 9.3 12 13.9l4.6-4.6L18 10.7l-6 6-6-6 1.4-1.4Z" />
        </svg>
      </button>

      {open && (
        <div className="space-y-3 px-4 pb-3 text-sm text-ink-soft">
          <p>
            Arabic speech is done by your phone, not by this app — so the phone
            needs an Arabic voice installed. It is a free download.
          </p>

          <div>
            <p className="font-bold text-ink">Android (Xiaomi / Redmi)</p>
            <ol className="mt-1 list-decimal space-y-0.5 pl-5">
              <li>
                Settings &rsaquo; Additional settings &rsaquo; Accessibility
                &rsaquo; <b>Text-to-speech output</b>
              </li>
              <li>
                Set <b>Preferred engine</b> to <b>Google Text-to-speech</b>
              </li>
              <li>Tap the gear next to it &rsaquo; <b>Install voice data</b></li>
              <li>
                Choose <b>Arabic</b> and download it (Saudi Arabia if offered)
              </li>
              <li>Fully close Chrome and reopen this app</li>
            </ol>
          </div>

          <div>
            <p className="font-bold text-ink">iPhone</p>
            <p className="mt-1">
              Settings &rsaquo; Accessibility &rsaquo; Spoken Content &rsaquo;
              Voices &rsaquo; <b>Arabic</b>, then reopen the app.
            </p>
          </div>

          <p className="text-xs">
            If Google Text-to-speech is not listed, install it from the Play
            Store first.
          </p>
        </div>
      )}
    </div>
  );
}
