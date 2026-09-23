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
| **2** | **Listen** mode (Arabic audio → English), push-to-talk, `/api/listen` | ✅ Done |
| **3** | Offline phrasebook (96 phrases, IndexedDB), history, saved items | ✅ Done |

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

#### If your key starts with `AQ.` rather than `AIza`

Both are valid. Google AI Studio began issuing keys with an **`AQ.` prefix** in
mid-2026; the older `AIza` format is still what Google Cloud Console hands out.

The two are **not** interchangeable. `AQ.` keys authenticate only via the
`x-goog-api-key` **header** — anything passing the key as a `?key=` query
parameter gets a 401. That is why some third-party tools reject them.

**This app works with either**, because `lib/ai.ts` uses the official
`@google/genai` SDK, which sets the header. No configuration needed.

If an `AQ.` key is rejected anyway, generate an `AIza` one instead: Google Cloud
Console → APIs & Services → Credentials → Create credentials → API key, with the
*Generative Language API* enabled on that project.

### Optional environment variables

All have working defaults; see `.env.example`.

- `GEMINI_TEXT_MODEL` — model for Speak mode. Defaults to `gemini-2.5-flash`.
- `GEMINI_AUDIO_MODEL` — model for Listen mode. Must accept audio input.
  Defaults to `gemini-2.5-flash`, which is multimodal.
- `AI_TIMEOUT_MS` — abort a model call after this long. Default `20000`.

Both model defaults are **pinned to a GA model on purpose**. An earlier version
defaulted to the floating alias `gemini-flash-latest`, which does not resolve on
every API key and left the deployed app failing on every request. If you want a
newer model, set it explicitly.

If the app reports **"That model is not available on your API key"**, list what
your key can actually reach and pick one:

```bash
curl -s -H "x-goog-api-key: YOUR_KEY" "https://generativelanguage.googleapis.com/v1beta/models" | grep -o '"name": "[^"]*"'
```

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
  page.tsx              App shell: bottom nav, shared TTS + history, offline switch
  globals.css           Design tokens (high-contrast light theme, Arabic font stack)
  api/speak/route.ts    English → Arabic. Rate limited, validates input.
  api/listen/route.ts   Arabic audio → English. Rate limited, size + confidence guards.
lib/
  ai.ts                 ← ALL model calls. Swap providers by editing this file only.
  prompts.ts            ← ALL prompt text. Tune dialect here without touching logic.
  tts.ts                Browser speechSynthesis + Arabic voice selection
  dictation.ts          English dictation via SpeechRecognition (progressive enhancement)
  audio.ts              Push-to-talk MediaRecorder hook
  audioFormats.ts       Container negotiation + Gemini MIME normalisation (pure)
  db.ts                 Minimal IndexedDB wrapper (no dependencies)
  phrasebook.ts         Cache-first phrasebook loader + search
  history.ts            Last 50 translations, plus an exempt Saved list
  rateLimit.ts          In-memory sliding window
  errors.ts             AppError + safe error responses
  types.ts              Shared contracts
components/             UI
public/
  manifest.webmanifest  PWA manifest
  sw.js                 Hand-written service worker
  phrasebook.json       96 Riyadh phrases in 7 categories
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

## Listen mode (audio)

Hold the big button, speak (or point the phone at whoever is speaking), release.
The clip goes to `/api/listen`, which makes **one** multimodal Gemini call that
transcribes and translates in a single step — there is no separate speech-to-text
stage. English comes back first and largest, with the Arabic and transliteration
below it for checking and learning.

Recording is capped at 30 seconds and anything under 400ms is treated as an
accidental tap. If the model reports confidence below 0.4 the app says it could
not make out the audio rather than showing a confident-looking guess; between
0.4 and 0.75 the result is shown with an "audio was unclear" flag.

### The container problem

`MediaRecorder` output is platform-specific and the type is probed at runtime,
never hardcoded — Chrome and Android give WebM/Opus, iOS Safari gives MP4/AAC.

There is a second, less obvious trap. **Gemini does not accept `audio/mp4`**,
which is exactly what iOS produces. It does accept `audio/m4a`, and M4A is AAC
in an MP4 container — the same bytes with a different label. `normaliseForGemini`
in `lib/audioFormats.ts` handles the relabel (no transcoding), and it is applied
on both the client and the server so a bad label cannot reach the API either way.

## Offline phrasebook

96 everyday Riyadh phrases across seven categories — greetings, taxi, coffee and
food, shopping, numbers, emergencies, and office small talk. Searchable across
English, Arabic script and transliteration at once, with a play button on every
entry.

Search ignores apostrophes, so typing `siruh` finds `kam si'ruh?` — you do not
have to guess where the ayns go. Multiple words narrow rather than widen.

**It works with zero network.** The phrasebook is precached by the service worker
and stored in IndexedDB on first load, then read from IndexedDB *before* anything
touches the network. Going offline switches the app to phrasebook-only: a banner
appears, Listen and Speak grey out in the nav, and the phrasebook stays fully
usable. Reconnecting returns you to whichever mode you were in.

To edit the phrases, change `public/phrasebook.json` and bump its `version` —
clients refresh their cached copy when the version changes.

## History and saved

The last 50 translations are kept in IndexedDB, newest first, tagged by mode and
with a relative timestamp. Tap any row to copy the Arabic, or use the play button
to replay it.

The star pins an item to the **Saved** list. Saved items are **exempt from the
50-item cap** and survive "Clear history" — otherwise starring something would be
meaningless the moment fifty more translations pushed it out.

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

### Which voice gets picked

Devices expose wildly different voice lists, so `lib/voiceSelection.ts` ranks
them rather than looking for one name. Arabic is a hard gate — a non-Arabic
voice can never be chosen, and returning nothing is the correct answer when the
device has no Arabic voice.

Among Arabic voices, the ranking is **offline-capable first, then closest
accent**: Saudi > Gulf > unmarked `ar` > other regions. Offline capability
outranks accent deliberately, because a remote voice in a taxi with no signal
either lags badly or silently does nothing, while a local Egyptian-accented
voice still produces Arabic a Riyadh driver understands. Lower `LOCAL_BONUS`
below 100 to flip that.

Two details that matter: `lang` may arrive as `ar-SA`, `ar_SA`, `ar-EG` or bare
`ar`, all of which are handled; and a plain `startsWith("ar")` test is *wrong*,
because `arc` is Aramaic and `arn` is Mapudungun — both would otherwise be
chosen to read Arabic script.

---

## Testing the PWA locally

The service worker only registers in production builds — a caching worker in
front of the dev server fights with hot reload.

```bash
npm run build && npm start
```

Then open <http://localhost:3000>, and use DevTools → Application → Service
Workers to confirm it registered. Toggle **Offline** there to test offline
behaviour — you should get the offline banner, a greyed-out Listen and Speak,
and a fully working phrasebook.

DevTools → Application → IndexedDB → `riyadh-talk` shows the two stores: `kv`
(the cached phrasebook) and `history`.

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
