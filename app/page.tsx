"use client";

import { useCallback, useState } from "react";
import BottomNav, { ONLINE_ONLY, type Mode } from "@/components/BottomNav";
import HistoryMode from "@/components/HistoryMode";
import ListenMode from "@/components/ListenMode";
import PhrasebookMode from "@/components/PhrasebookMode";
import SpeakMode from "@/components/SpeakMode";
import { useHistory, type NewEntry } from "@/lib/history";
import { useTts } from "@/lib/tts";
import { useOnline } from "@/lib/useOnline";

export default function Home() {
  const [requestedMode, setMode] = useState<Mode>("speak");
  const online = useOnline();

  /**
   * Offline forces the phrasebook, since it is the only thing that works
   * without a connection.
   *
   * Derived during render rather than pushed through an effect: the user's
   * choice is preserved untouched in `requestedMode`, so reconnecting returns
   * them to where they were with no bookkeeping and no cascading render.
   */
  const mode: Mode =
    !online && ONLINE_ONLY.includes(requestedMode) ? "phrases" : requestedMode;

  // Owned here so all four screens share one voice list and one history,
  // rather than each mounting its own copy.
  const tts = useTts();
  const history = useHistory();

  const onRecord = useCallback(
    (entry: NewEntry) => void history.add(entry),
    [history],
  );

  return (
    <main className="flex h-dvh flex-col">
      {!online && (
        <div
          role="status"
          className="shrink-0 bg-warn-tint px-4 py-2.5 pt-safe text-center"
        >
          <p className="text-sm font-bold text-ink">
            Offline — phrasebook only
          </p>
          <p className="text-xs text-ink-soft">
            Translation needs a connection. These phrases are saved on your phone.
          </p>
        </div>
      )}

      {/* Screens stay mounted and are hidden with CSS. Unmounting would drop a
          result, a half-typed sentence, or the resolved TTS voice list on every
          tab switch. */}
      <div className={`min-h-0 flex-1 ${online ? "pt-safe" : ""}`}>
        <Screen active={mode === "listen"}>
          <ListenMode tts={tts} onRecord={onRecord} />
        </Screen>
        <Screen active={mode === "speak"}>
          <SpeakMode tts={tts} onRecord={onRecord} />
        </Screen>
        <Screen active={mode === "phrases"}>
          <PhrasebookMode tts={tts} />
        </Screen>
        <Screen active={mode === "history"}>
          <HistoryMode history={history} tts={tts} />
        </Screen>
      </div>

      <BottomNav mode={mode} onChange={setMode} offline={!online} />
    </main>
  );
}

function Screen({ active, children }: { active: boolean; children: React.ReactNode }) {
  return (
    <div className={active ? "flex h-full min-h-0 flex-col" : "hidden"}>
      {children}
    </div>
  );
}
