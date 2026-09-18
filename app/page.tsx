"use client";

import { useState } from "react";
import ModeTabs, { type Mode } from "@/components/ModeTabs";
import SpeakMode from "@/components/SpeakMode";

export default function Home() {
  // Listen mode arrives in Phase 2; its tab is rendered but disabled.
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

      {mode === "speak" ? <SpeakMode /> : null}
    </main>
  );
}
