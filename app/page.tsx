"use client";

import { useState } from "react";
import ListenMode from "@/components/ListenMode";
import ModeTabs, { type Mode } from "@/components/ModeTabs";
import SpeakMode from "@/components/SpeakMode";

export default function Home() {
  const [mode, setMode] = useState<Mode>("speak");

  return (
    // h-dvh (not min-h) so the controls pin to the bottom and only the result
    // area scrolls — the layout must not shift when the keyboard opens.
    <main className="flex h-dvh flex-col">
      <header className="shrink-0 px-4 pt-safe">
        <div className="pt-3">
          <ModeTabs mode={mode} onChange={setMode} />
        </div>
      </header>

      {/* Both modes stay mounted so switching tabs does not discard a result
          or tear down the resolved TTS voice list. */}
      <div className={mode === "listen" ? "flex min-h-0 flex-1" : "hidden"}>
        <ListenMode />
      </div>
      <div className={mode === "speak" ? "flex min-h-0 flex-1" : "hidden"}>
        <SpeakMode />
      </div>
    </main>
  );
}
