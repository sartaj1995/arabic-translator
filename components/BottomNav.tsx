"use client";

export type Mode = "listen" | "speak" | "phrases" | "history";

/** The two destinations that need a network connection. */
export const ONLINE_ONLY: Mode[] = ["listen", "speak"];

const ITEMS: { id: Mode; label: string; path: string }[] = [
  {
    id: "listen",
    label: "Listen",
    // Headphones
    path: "M12 3a9 9 0 0 0-9 9v5a3 3 0 0 0 3 3h1a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H5v-.2A7 7 0 0 1 19 12v.8h-2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1a3 3 0 0 0 3-3v-5a9 9 0 0 0-9-9Z",
  },
  {
    id: "speak",
    label: "Speak",
    // Chat bubble
    path: "M20 2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3v4l5-4h8a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2ZM7 8h10v2H7V8Zm0 4h7v2H7v-2Z",
  },
  {
    id: "phrases",
    label: "Phrases",
    // Open book
    path: "M12 6.5C10.5 5 8 4.5 5 4.5A1.5 1.5 0 0 0 3.5 6v11A1.5 1.5 0 0 0 5 18.5c3 0 5.5.5 7 2 1.5-1.5 4-2 7-2a1.5 1.5 0 0 0 1.5-1.5V6A1.5 1.5 0 0 0 19 4.5c-3 0-5.5.5-7 2Zm0 2.2c1.4-1 3.4-1.5 5.5-1.6v9.2c-2.1.1-4.1.6-5.5 1.5V8.7Z",
  },
  {
    id: "history",
    label: "History",
    // Clock
    path: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 5v5.4l4.2 2.5-1 1.7-5.2-3.1V7h2Z",
  },
];

export default function BottomNav({
  mode,
  onChange,
  offline,
}: {
  mode: Mode;
  onChange: (m: Mode) => void;
  offline: boolean;
}) {
  return (
    <nav
      aria-label="Sections"
      className="shrink-0 border-t-2 border-line bg-surface pb-safe"
    >
      <ul className="grid grid-cols-4">
        {ITEMS.map((item) => {
          const active = mode === item.id;
          const blocked = offline && ONLINE_ONLY.includes(item.id);

          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => !blocked && onChange(item.id)}
                disabled={blocked}
                aria-current={active ? "page" : undefined}
                className={[
                  "press flex w-full flex-col items-center gap-0.5 px-1 pt-2 pb-1",
                  active ? "text-brand" : "text-ink-faint",
                  blocked ? "opacity-35" : "",
                ].join(" ")}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="size-7"
                  fill="currentColor"
                  aria-hidden="true"
                >
                  <path d={item.path} />
                </svg>
                <span
                  className={`text-[11px] leading-none ${
                    active ? "font-bold" : "font-semibold"
                  }`}
                >
                  {item.label}
                </span>
                {/* Underline rather than a background pill: reads clearly in
                    bright sun where subtle fills wash out. */}
                <span
                  aria-hidden="true"
                  className={`mt-0.5 h-0.5 w-6 rounded-full ${
                    active ? "bg-brand" : "bg-transparent"
                  }`}
                />
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
