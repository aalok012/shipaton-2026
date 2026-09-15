# Musically

A pass-the-phone singing game for iOS and Android. Choose solo or party mode,
add names, listen to a melody guide, and sing two lyric lines. Each take earns
0–100 points; a cumulative leaderboard appears after each take and round.
Everyone sings the same song in a round. The app checks melody and timing,
not the actual lyric words.

Scoring extracts pitch from the uploaded recording frame by frame, aligns it
against the selected song's reference melody, and measures the difference.

---

## Status

| | |
|---|---|
| Scoring engine | Live API pitch comparison verified; 15 backend tests pass |
| HTTP API | Working — 4 endpoints |
| Song catalogue | 3 demo songs, playable now |
| Mobile app | Four screens implemented; iPhone song loading confirmed; phone recording upload still unverified |

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
  "score": 98,
  "pitch_accuracy": 99.7,
  "timing_accuracy": 85.6,
  "contour_match": 99.1,
  "completion": 100.0
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

The four screens are **Home → Sing → Results → Leaderboard**. Solo and 2–6 player games
support fresh songs each round, microphone recording, upload retry, score
animations, and cumulative rankings. The demo catalogue allows up to three
rounds. More rounds unlock as you add songs.

See [app/README.md](app/README.md) for controls, architecture, checks, and
physical-device verification. TypeScript checks, seven game-logic tests, web/
iOS/Android bundles, and real-backend browser recording checks pass. Native
microphone and audio routing still need a real phone test.

---

## Party night with friends

Play together on one shared phone. Party mode supports 2–6 friends; solo mode
is still available for practice.

- **Pass-the-phone handoffs:** each singer confirms they have the phone before
  seeing their song. The lineup shows who has sung and who is next.
- **A score to chase:** later singers see the score needed to take the round
  lead. If someone scores 100, the challenge is to tie them.
- **Round atmosphere:** warm-up, friendly-rivalry, and encore prompts give the
  audience introductions, stage poses, and applause to join in with. These
  are optional social prompts and do not change the scoring rules.
- **Winner reveals and reactions:** see round leaders and final champions,
  including ties, and tap applause, fire, or star reactions. Reactions are
  local visual feedback, not per-person votes or bonus points.
- **Rematch with this crew:** retain player names and the session's selected
  songs, reset all scores, shuffle song order, and rotate the opening singer.
  Choose **Start with a new group** to return to setup instead.

The flow uses four screens: Home, Sing (including its handoff state),
Results, and Leaderboard. There are no online rooms or separate-device multiplayer yet.

## Recording and scoring on your phone

1. Open the app in Expo Go on the same Wi-Fi as your laptop.
2. Choose players and rounds, then tap **Let's play**.
3. Tap **Hear the melody** to learn the selected demo song's instrumental guide.
4. Tap **Take the mic**, allow microphone access, and wait for the countdown.
5. Sing both lyric lines, then tap **Finish my take**. Takes also stop at 30 seconds.
6. The app uploads the recording and selected `song_id` to `POST /score`, then
   shows the score, pitch/timing/contour breakdown, and cumulative leaderboard.

The microphone meter shows **volume during recording**. It does not display
live pitch accuracy. Pitch comparison happens on the backend **after upload**.
The lyrics are a prompt; the score checks melody and timing, not the words.
The guide is synthesized from the stored reference pitches, not a vocalist's
recording.

### If you can record but do not get a score

- Tap **Finish my take** and keep the app open while it uploads.
- If an upload fails, use **Try again** to resend the saved take, or record a
  fresh take. The displayed error explains the failure.
- Check the backend terminal for `POST /score`. A `200 OK` response means the
  scoring request completed. `GET /songs` only confirms catalogue access.
- If no upload arrives, check the app's error message, microphone permission,
  and network connection. On your phone, open `http://<your-lan-ip>:8000/health`
  using the address printed by the launcher. Expect `{"ok":true,"songs":3}`
  with the seeded catalogue.

## Verified checks

The live API audit on **September 14, 2026** used controlled synthetic recordings
against **Paper Lanterns** from the demo catalogue:

| Recording | Score / 100 | Pitch accuracy |
|---|---:|---:|
| Matching melody | **98** | 99.7% |
| Off-key melody | **61** | 42.8% |
| Silence | **0** | Not measurable |
| Incomplete phrase (about 40%) | **62** | 73.1% |
| Matching melody one octave higher | **97** | 100.0% |
| Matching melody encoded as `.m4a` | **98** | 99.7% |

The matching/off-key score gap was **37 points**. These are measured fixture
results, not promised scores for human performances. Non-silent requests in
this audit completed scoring in approximately **0.07–0.19 seconds** on the
local backend; phone upload time is additional. The `.m4a` check verifies
phone-format decoding using an encoded test fixture, not a phone microphone.

Also verified:

- All **15 backend API tests** passed, including invalid uploads and `.m4a` decoding.
- All **7 frontend game-logic tests** and TypeScript checks passed.
- Web, iOS, and Android JavaScript bundles built successfully.
- Browser recordings using a synthetic microphone reached the real backend
  and produced scores and leaderboard updates.
- An iPhone successfully loaded the catalogue and song details over Wi-Fi.

**Still unverified at the time of the audit:** an actual recording upload from
that iPhone. No phone-originated `POST /score` had appeared in the inspected
logs. Successful song loading confirms connectivity, but does not by itself
confirm microphone capture, upload, or scoring of that player's voice.

To rerun the automated checks:

```bash
# From the repository root
npm run typecheck
npm test
cd backend
.venv/bin/python -m pytest test_api.py -q
```

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
what it should: in the latest live API audit, the incomplete take scored 62
against 98 for the complete matching take. See **Verified checks** for the
full results and their limits.

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
parses a second error format. Audio with too few detectable pitched frames,
including silence, returns HTTP 200 with a score of zero and the message
`"No singing detected."`. This is a pitch detector, not a speech recognizer;
pitched speech or humming can still produce a score.

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
  App.tsx               four-screen navigation and session state
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
scripts/dev.mjs         combined backend/Expo launcher
package.json            root startup and frontend check commands
plan.md                 original build plan and API contract
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

## Dedicated leaderboard

After the last singer in each round, tap **See the round leaderboard** (or
**Reveal the final leaderboard** at the end of the game). A separate page
shows a top-three podium, shaded character portraits, wreath badges, diamond
point icons, and a scrollable full ranking. The cream, purple, orange, and
lime palette matches the game; translucent panels and soft gradients add depth.

Rankings use actual cumulative scores. Ties share a rank, and solo/two-player
games show only the players who exist. **Local** shows this shared-phone game.
**Team** and **Global** are selectable information views; team scoring and
online rankings are not implemented. Diamond icons represent score points,
not an additional currency.

Go back to review the last take, continue to the next round, or use rematch/
new-group actions after the final round. Score-saving is not repeated when
navigating between Results and Leaderboard.
