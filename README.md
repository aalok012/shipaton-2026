# Musically

A pass-the-phone singing game for iOS and Android. Choose solo or party mode,
add names, listen to a melody guide, and sing two lyric lines. Each take earns
0–100 points; a cumulative leaderboard appears after each take and round.
Everyone sings the same song in a round. The app checks melody and timing,
not the actual lyric words.

The interesting part is that the scoring is real. It is not a random number
dressed up with an animation: pitch is extracted from the recording frame by
frame, aligned against the reference melody, and measured.

---

## Status

| | |
|---|---|
| Scoring engine | Working, 15 tests |
| HTTP API | Working — 4 endpoints |
| Song catalogue | 3 demo songs, playable now |
| Mobile app | Three screens implemented; physical-device testing pending |

The backend is complete and runs standalone. You can score a recording with
nothing but `curl`. The Expo client lives in `app/`; see the [mobile setup guide](app/README.md).

---

## Running the backend

Requires Python 3.12 and ffmpeg.

```bash
cd backend
python3.12 -m venv .venv
.venv/bin/pip install --only-binary=:all: -r requirements.txt
./start.sh
```

`start.sh` serves on `0.0.0.0:8000` and prints the LAN address to point the app
at. Phone and laptop must be on the same network — `localhost` will not resolve
from a phone.

Score a recording without the app:

```bash
curl -F "audio=@take.m4a" -F "song_id=paper-lanterns" \
     http://localhost:8000/score
```

```json
{
  "score": 97,
  "pitch_accuracy": 100.0,
  "timing_accuracy": 76.1,
  "contour_match": 99.8,
  "completion": 98.7
}
```

### Songs

The repo ships with three playable songs, so it runs immediately after
install. Their reference melodies are synthesised rather than recorded — the
titles and lyrics are invented, not real songs. They go through exactly the
same analysis path a real recording would.

```bash
.venv/bin/python seed_demo_songs.py   # rebuild the demo catalogue
.venv/bin/python prep_songs.py        # build from real audio in ./references/
```

### Tests

```bash
.venv/bin/pip install pytest httpx
.venv/bin/python -m pytest test_api.py -q      # 15 tests, ~3s
```

---

## Run backend and frontend together

From the repository root, after installing the backend and app dependencies:

```bash
npm start
```

This starts FastAPI, waits for it to become healthy, checks the song catalogue,
and starts Expo with your laptop's LAN address as `EXPO_PUBLIC_API_URL`.
Scan the QR code in Expo Go while your phone is on the same Wi-Fi.
No manual IP editing is needed; the address is detected again each time.
Ctrl+C stops the services launched by this command. An existing healthy backend
is reused and left running when you stop Expo.

If you have several network adapters, select the Wi-Fi address explicitly with
`MUSIC_HOST=<your-lan-ip> npm start`. For browser development, use
`npm start -- --web` (microphone access requires localhost or HTTPS).

### Run the app separately

Requires Node.js 22.13+ and Expo Go compatible with SDK 57.

```bash
cd app
npm install
cp .env.example .env
```

Set `EXPO_PUBLIC_API_URL` in `.env` to the LAN address printed by
`backend/start.sh`, then run `npx expo start` and scan the QR code. Keep the
backend running and both devices on the same Wi-Fi.

The three screens are **Home → Sing → Results**. Solo and 2–6 player games
support fresh songs each round, microphone recording, upload retry, score
animations, and cumulative rankings. The demo catalogue allows up to three
rounds. More rounds unlock as you add songs.

See [app/README.md](app/README.md) for controls, architecture, checks, and
physical-device verification. TypeScript checks, four game-logic tests, web/
iOS/Android bundles, and real-backend browser recording checks pass. Native
microphone and audio routing still need a real phone test.

---

## How scoring works

`pyin` gives a fundamental frequency per frame, converted to MIDI so that one
whole number is one semitone. The attempt is then **DTW-aligned** to the
reference rather than stretched to fit, so a singer who drags a note and
catches up is compared note-for-note instead of being smeared across the phrase.

Four measures, weighted:

| | Weight | |
|---|---|---|
| **pitch** | 0.60 | Per-frame credit, full inside one semitone, fading to zero at two |
| **completion** | 0.20 | How much of the phrase was actually sung |
| **timing** | 0.12 | Onsets normalised to their own span — proportion, not seconds |
| **contour** | 0.08 | Correlation of the melodic shape |

Three decisions worth explaining:

**Octaves are forgiven; wrong notes are not.** Only exact multiples of twelve
semitones are removed before comparison, so singing in your own register scores
full marks while singing in the wrong key still scores badly.

**The DTW is band-limited.** Left unconstrained it warps an off-key attempt
onto whichever reference notes happen to be nearest — which in testing
collapsed the gap between a good take and a deliberately awful one from 40
points to 14. Limiting the warp to roughly half a second of slack restored it
to 35.

**Completion is scored separately.** Without it, an attempt that stopped 40% of
the way through scored 76 — better than singing the whole thing off-key. It
aligned near-perfectly against the part it did sing. Stopping short now costs
what it should: the same take scores 61 against 97 for a complete one.

Measured on synthetic takes: a good take scores **97**, a deliberately off-key
one **62**, a take that stops 40% in **61**, and silence **0**. Scoring takes
roughly 0.2 seconds.

A dimension that cannot be measured — silence has no contour — is dropped and
its weight shared among the others, rather than being scored as zero.

---

## API

| | |
|---|---|
| `GET /health` | `{"ok": true, "songs": 3}` |
| `GET /songs` | Catalogue, without the heavy melody arrays |
| `GET /songs/{id}` | One song, including `reference_midi` for the pitch display |
| `POST /score` | multipart `audio` + `song_id` → the score object above |

Every failure returns the same shape, `{"error": "..."}`, so the client never
parses a second error format. Silence and speech are not errors: they return a
score of zero with a message, because "you didn't sing" is a result.

Uploads are capped at 25 MB and scoring at 30 seconds. `pyin` is warmed at
startup so the first request does not pay the JIT cost.

---

## Built with

**Backend** — Python 3.12, FastAPI, uvicorn, librosa, numpy, soundfile, ffmpeg
**App** — Expo SDK 57, React Native, TypeScript, Reanimated 4, expo-audio, SVG
**Tests** — pytest, httpx, Node test runner, browser integration checks

---

## Repo layout

```
app/
  App.tsx               three-screen navigation and session state
  src/screens/          Home, Sing, Results
  src/components/       shared UI and music graphics
  src/lib/              API client, game logic, melody preview
  src/theme.ts          palette and typography
  README.md             mobile setup and verification
backend/
  scoring.py            pitch extraction, alignment, the four measures
  main.py               FastAPI service
  prep_songs.py         build songs.json from real recordings
  seed_demo_songs.py    build songs.json with no recordings
  test_api.py           15 API tests
  test_scoring.py       score real takes and print the breakdown
  NOTES.md              environment gotchas worth knowing
plan.md                 API contract and remaining work
```

---

## A note on how this was built

The backend implementation was written by [Claude Code](https://claude.com/claude-code)
from a specification and prompt plan I wrote. I set the scoring model, the API
contract, the screen flow and the build order; Claude Code wrote the code
against them, and the engine was tuned empirically against recorded takes —
several of the decisions documented above came out of measuring what actually
separated a good performance from a bad one, rather than from the original
design.

The frontend was implemented with OpenAI Codex from the updated three-screen
brief and the shared API contract.

### Local browser and phone connections

The combined launcher sets `EXPO_PUBLIC_API_URL` to the laptop's LAN address
for Expo Go and `EXPO_PUBLIC_WEB_API_URL` to localhost for desktop browser
use. Start both services with `npm start`; press `w` for the browser. These
addresses are passed at launch, so no LAN address is committed.

If songs load in the browser but not on the phone, check that both devices are
on the same Wi-Fi and that your operating system permits local-network access
for the terminal/Node/Python processes. The backend must listen on `0.0.0.0`,
which the combined launcher configures. A frontend tunnel alone does not
expose the scoring API.
