# Riyadh Talk

A two-way English ↔ **Saudi Najdi Arabic** translator, built as a mobile-first
PWA for daily life in Riyadh. Installs to your phone's home screen and runs
standalone.

Not MSA. Not Egyptian. The prompts target the spoken register you actually hear
in a Riyadh taxi, café or office.

---

## Status

| Phase | Scope | State |
| --- | --- | --- |
| **1** | Project setup, PWA shell, **Speak** mode (English → Arabic) end to end | ✅ Done |
| 2 | **Listen** mode (Arabic audio → English), push-to-talk, `/api/listen` | Not started |
| 3 | Offline phrasebook (~80 phrases, IndexedDB), history, saved items | Not started |

---

## Setup

Requires Node 20 or newer (built on Node 24).

```bash
npm install
cp .env.example .env.local
```

Then put your Gemini key in `.env.local` and start the dev server:

```bash
npm run dev
```

Open <http://localhost:3000>.

### The one API key you need

| Key | Required | Where to get it |
| --- | --- | --- |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Yes | [Google AI Studio → Get API key](https://aistudio.google.com/apikey) |

Sign in with a Google account, click **Get API key → Create API key**, and paste
the result into `.env.local`. The free tier is far more generous than personal
use requires — no billing setup needed.

**Restart `npm run dev` after editing `.env.local`.** Next.js only reads
environment variables at boot.

### Optional environment variables

All have working defaults; see `.env.example`.

- `GEMINI_TEXT_MODEL` — model for Speak mode. Defaults to `gemini-flash-latest`,
  a floating alias that tracks the current Flash release. **If you get a
  `UPSTREAM_ERROR` mentioning the model name, pin it instead** —
  `GEMINI_TEXT_MODEL=gemini-2.5-flash` is the safe fallback.
- `GEMINI_AUDIO_MODEL` — model for Listen mode (Phase 2). Must accept audio input.
- `AI_TIMEOUT_MS` — abort a model call after this long. Default `20000`.

### Verifying the key works

```bash
curl -s -X POST http://localhost:3000/api/speak -H "Content-Type: application/json" -d '{"text":"how much is this"}'
```

A working key returns JSON with `arabic`, `transliteration`, `literal_gloss`,
`register`, `msa_note` and `variants`. A missing key returns
`{"error":{"code":"NO_API_KEY",...}}`.

---

## Where things live

```
app/
  layout.tsx            PWA metadata, manifest link, viewport/safe-area setup
  page.tsx              Mode tab shell
  globals.css           Design tokens (high-contrast light theme, Arabic font stack)
  api/speak/route.ts    English → Arabic. Rate limited, validates input.
lib/
  ai.ts                 ← ALL model calls. Swap providers by editing this file only.
  prompts.ts            ← ALL prompt text. Tune dialect here without touching logic.
  tts.ts                Browser speechSynthesis + Arabic voice selection
  dictation.ts          English dictation via SpeechRecognition (progressive enhancement)
  rateLimit.ts          In-memory sliding window
  errors.ts             AppError + safe error responses
  types.ts              Shared contracts
components/             UI
public/
  manifest.webmanifest  PWA manifest
  sw.js                 Hand-written service worker
  icons/                Generated PNG icon set
```

**Two files carry the design intent:**

- **`lib/prompts.ts`** — dialect rules, transliteration scheme, gender handling.
  Edit here to change how the Arabic sounds. Nothing in this file affects logic.
- **`lib/ai.ts`** — the provider seam. `englishToArabic(text)` and
  `listenToEnglish(audio)` are the only two functions the routes call. Nothing
  outside this file imports a provider SDK.

### Design decisions baked in

- **Najdi, not MSA.** ق is transliterated `g` (`agrab`, `gahwa`), negation is
  `mo`, "I want" is `abgha`. When the Najdi diverges meaningfully from MSA, the
  UI shows a note.
- **Both gender forms, always.** Arabic conjugates on two axes — who is speaking
  and who is being addressed. The `variants` array carries every form the phrase
  can take; the top-level `arabic` is the masculine/masculine default so there is
  one unambiguous line to read aloud.
- **Plain phonetic transliteration.** No Arabizi numerals, no academic diacritics
  — just Latin letters you can read cold under pressure.
- **High-contrast light theme.** Dark themes wash out in Riyadh daylight.
  Controls sit in the bottom third for one-handed use.

---

## Text to speech

Uses the browser's built-in `speechSynthesis` — no paid TTS API. Three known
problems are handled explicitly in `lib/tts.ts`:

1. **Voices load asynchronously.** `getVoices()` is empty on first call. The app
   listens for `voiceschanged` and also polls for ~3.5s, because Safari
   sometimes never fires that event.
2. **iOS needs a user gesture.** A silent utterance is spoken on your first tap
   to unlock the engine for the session.
3. **No Arabic voice installed.** The app refuses to speak rather than reading
   Arabic script in an English voice. It tells you how to install one:
   - **iOS:** Settings → Accessibility → Spoken Content → Voices → Arabic
   - **Android:** Settings → System → Languages & input → Text-to-speech output → install Arabic

---

## Testing the PWA locally

The service worker only registers in production builds — a caching worker in
front of the dev server fights with hot reload.

```bash
npm run build && npm start
```

Then open <http://localhost:3000>, and use DevTools → Application → Service
Workers to confirm it registered. Toggle **Offline** there to test offline
behaviour.

---

## Deploying to Vercel

1. Push this repo to GitHub.
2. Go to [vercel.com/new](https://vercel.com/new), import the repo. Vercel
   detects Next.js automatically — no build settings to change.
3. Before the first deploy, add the environment variable:
   - **Key:** `GOOGLE_GENERATIVE_AI_API_KEY`
   - **Value:** your key
   - **Environments:** Production, Preview, Development
4. Deploy. You get a `https://<project>.vercel.app` URL.

Subsequent pushes to `main` deploy automatically.

> **Note on rate limiting.** The limiter is in-memory, so each serverless
> instance keeps its own counter and a cold start resets it. That is a
> deliberate trade for a personal app with no extra accounts. If you ever share
> the URL publicly, swap the body of `hit()` in `lib/rateLimit.ts` for Upstash
> Redis — the call sites do not change.

---

## Installing to your iPhone home screen

The app must be served over HTTPS, so use the deployed Vercel URL (not
`localhost`).

1. Open the Vercel URL in **Safari** (this does not work in Chrome on iOS).
2. Tap the **Share** button (the square with an arrow, in the bottom bar).
3. Scroll down and tap **Add to Home Screen**.
4. Name it and tap **Add**.

Launch it from the home screen and it opens standalone — no Safari chrome, no
address bar.

**On Android:** open the URL in Chrome, tap the ⋮ menu, then **Install app** or
**Add to Home screen**.

### First launch checklist

- Tap **Play Arabic** once to unlock iOS speech for the session.
- If it says *No Arabic voice on this device*, install one using the steps in
  the Text to speech section above, then fully quit and reopen the app.
- Microphone and dictation require HTTPS, which the Vercel URL provides.

---

## Scripts

```bash
npm run dev      # dev server
npm run build    # production build
npm start        # serve the production build
npm run lint     # eslint
```
