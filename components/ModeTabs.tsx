"use client";

export type Mode = "listen" | "speak";

const TABS: { id: Mode; label: string; sub: string; enabled: boolean }[] = [
  { id: "listen", label: "Listen", sub: "Arabic → English", enabled: true },
  { id: "speak", label: "Speak", sub: "English → Arabic", enabled: true },
];

export default function ModeTabs({
  mode,
  onChange,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Translation direction"
      className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-sunk p-1"
    >
      {TABS.map((t) => {
        const active = mode === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={active}
            disabled={!t.enabled}
            onClick={() => t.enabled && onChange(t.id)}
            className={[
              "press rounded-xl px-3 py-2.5 text-center",
              active
                ? "bg-surface shadow-sm ring-2 ring-brand"
                : "bg-transparent",
              t.enabled ? "" : "opacity-45",
            ].join(" ")}
          >
            <span className="flex items-center justify-center gap-1.5">
              <span
                className={`text-lg font-bold ${active ? "text-brand" : "text-ink"}`}
              >
                {t.label}
              </span>
              {!t.enabled && (
                <span className="rounded-full bg-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-ink-soft">
                  soon
                </span>
              )}
            </span>
            <span className="mt-0.5 block text-xs text-ink-faint">{t.sub}</span>
          </button>
        );
      })}
    </div>
  );
}
