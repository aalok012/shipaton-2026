#  — build plan

A party game. One player hears a song reference, sings two lines from memory,
and the app scores how close they got. Everyone else guesses what the song was.

Two people build in parallel from a shared API contract:

- **Person A — backend** (`backend/`) — Python, FastAPI, librosa. **Done.**
- **Person B — app** (`app/`) — Expo, React Native, Reanimated. **Not started.**

---

## 1. Status

| Area | State |
|---|---|
| Scoring engine | Done, verified — good take 98 vs bad take 58 |
| `/health` `/songs` `/songs/{id}` `/score` | Done, all edge cases return clean JSON |
| m4a upload path | Done, verified end to end |
| Demo song data | 1 seeded song ("Baby"), playable now (`seed_demo_songs.py`) |
| Expo app | Not started |
| README | Not written (joint task, last 20 min) |
| Git | Repo initialized, one local commit, **not pushed** |

### Blocking gaps

1. **`unison-build-spec.md` is missing.** Person B needs it for the 8 screen
   names (section 3) and the exact palette hexes and motion moments
   (section 4). Nothing in this plan invents those values.
2. **Songs are demo data, by choice.** `seed_demo_songs.py` synthesises one
   song, "Baby", from a simplified approximation of the chorus hook - not the
   record. It runs through the same analysis path real audio takes. Swap in
   real recordings later with `prep_songs.py`; nothing else has to change.

   With a single song, a round can only be played once before it repeats. The
   app's "no repeats" rule needs to tolerate running out of songs, or the demo
   should be kept to one round per player.
3. **`scoring.py` was written from the prompt doc**, not supplied. If the
   original exists, dropping it in replaces that one file; the interface
   (`build_reference`, `score_recording`) is unchanged.

---

## 2. The API contract

This is the only thing both sides must agree on. It is implemented and tested.

Base URL comes from `EXPO_PUBLIC_API_URL`. Phone and laptop must share a network.
`./backend/start.sh` prints the LAN IP to use.

### `GET /health`
```json
{ "ok": true, "songs": 1 }
```

### `GET /songs`
Every song **without** the heavy `reference_midi` array. Use for song selection.
```json
[{
  "id": "baby",
  "title": "Baby",
  "artist": "Justin Bieber",
  "lyrics": ["Baby, baby, baby, ooh", "Like baby, baby, baby, no"],
  "duration_sec": 8.14,
  "decoys": ["Sorry", "One Time", "Somebody To Love"]
}]
```
The guess round shows `title` plus the three `decoys`, shuffled.

### `GET /songs/{id}`
Same object plus `reference_midi` — a flat array of MIDI numbers, one per
analysis frame, `null` where nothing was sung. This drives the pitch ribbon.
Also `reference_onsets`, the note-start times in seconds, which the app can
ignore; scoring uses it to judge rhythm.

Frames are **512 samples at 22050 Hz ≈ 23.2 ms apart**. Frame `i` sits at
`i * 512 / 22050` seconds. MIDI 60 is middle C; each whole number is a semitone.

### `POST /score`
Multipart: `audio` (the recording) + `song_id` (string).
```json
{
  "score": 97,
  "pitch_accuracy": 100.0,
  "timing_accuracy": 76.1,
  "contour_match": 99.8,
  "completion": 98.7,
  "duration_sec": 5.4,
  "voiced_ratio": 0.93,
  "confidence": { "pitch": "ok", "timing": "ok",
                  "contour": "ok", "completion": "ok" },
  "elapsed_sec": 0.18
}
```
`score` is the headline 0–100 number. The four accuracy values are each 0–100;
the Score screen shows **pitch, timing and contour** as its three bars.

`completion` is how much of the phrase was actually sung. It exists because
without it a player could sing three seconds of a ten-second song and still
score in the 90s — the attempt aligns almost perfectly against the part it did
sing. Worth surfacing in the UI when it is low, or a short take looks like an
unexplained bad score.

`confidence` marks any dimension that could not be measured (`"unavailable"`,
`"low_voiced_audio"`). Its weight is redistributed rather than scored as zero.

**Silence or speech returns 200, not an error** — score 0 plus a `message`
field ("No singing detected."). Show that message instead of a bare zero.

### Errors

Every failure returns the same shape. There is no other error format:
```json
{ "error": "human-readable sentence" }
```
The app can always do `if (json.error) showToast(json.error)`.

| Code | When |
|---|---|
| 400 | Empty recording |
| 404 | Unknown `song_id` (adds `available: [...]`) |
| 413 | Upload over 25 MB |
| 422 | Under 1s, corrupt audio, or a missing form field |
| 504 | Scoring exceeded 30s |

---

## 3. Backend

### Files
| | |
|---|---|
| `scoring.py` | Engine. `build_reference()`, `score_recording()` |
| `prep_songs.py` | Builds `songs.json` from `./references/`, resumable |
| `main.py` | The service |
| `test_scoring.py` | A1 harness — prints the dict and the good/bad gap |
| `test_api.py` | 15 API tests, ~3s |
| `seed_demo_songs.py` | Builds a playable songs.json with no recordings |
| `start.sh` | Runs on `0.0.0.0:8000`, prints the LAN IP |
| `NOTES.md` | Environment gotchas, measured timings |

### How scoring works
`pyin` extracts a pitch per frame, converted to MIDI. The attempt is
**DTW-aligned** to the reference rather than stretched linearly, so dragging a
note and catching up is not punished as a pitch error. Then four measures:

- **pitch** (weight 0.60) — per-frame credit, full inside
  `SEMITONE_TOLERANCE` (1.0) and fading to zero one tolerance beyond.
- **timing** (0.12) — onsets normalised to their own span, so rhythm is judged
  as proportion, not absolute seconds. A late start costs nothing; rushing does.
- **contour** (0.08) — correlation of the melodic shape. Small weight, because
  once contours are DTW-aligned it largely restates pitch.
- **completion** (0.20) — how much of the phrase was sung. Stopping short is
  charged in proportion; overrunning is treated far more leniently.

Three deliberate decisions:

- **Octaves are forgiven, wrong notes are not.** Only exact multiples of 12
  semitones are removed, so singing in your own range scores full marks while
  off-key singing still scores badly.
- **DTW is band-limited** (`DTW_BAND_RAD = 0.06`, roughly half a second of
  slack). Unconstrained DTW warps an off-key attempt onto whichever reference
  notes are nearest, which collapsed the good-vs-bad gap from 40 points to 14.
- **A metric that cannot be measured is dropped**, not scored zero, and its
  weight is shared among the rest.

Measured on synthetic takes: good **97**, off-key **66** (gap 31), a take that
stops 40% in **48**, silence **0**.

### Measured performance
Scoring runs in **0.15–0.18s**, far inside the 30s timeout. The first `pyin`
call in a process costs ~2.5s of numba JIT, so it is warmed at startup and no
user request pays it.

### Environment constraints
- Python **3.12**, not the system 3.14 — numba has no 3.14 wheels.
- Install with `--only-binary=:all:` or llvmlite tries a source build and fails.
- **librosa 1.0 removed the audioread fallback.** `librosa.load()` on an `.m4a`
  fails outright, so uploads are transcoded with ffmpeg first (58ms). This is
  the single most breakable thing in the stack — it is handled, but any change
  to audio loading should re-test an m4a.

### Remaining work
Nothing blocking for a demo — the catalogue is seeded and the API is live.

To move to real songs later:
1. Record reference audio into `backend/references/`.
2. Delete `songs.json`, run `prep_songs.py`, answer the prompts.
3. Re-run `test_scoring.py` with a real voice and confirm good/bad still
   separate by 30+. Tune `SEMITONE_TOLERANCE` / `WEIGHTS` if not.

---

## 4. App

Not started. Build order below; each step should run before the next begins.

### B1 — scaffold
Expo managed workflow, TypeScript, named `unison`. expo-router with the 8
screens from **spec section 3** as empty placeholders. Bricolage Grotesque
loaded at startup. `theme.ts` exporting the exact palette from **spec
section 4** — no hex value anywhere else in the app. expo-audio and
react-native-reanimated installed. `api.ts` reading `EXPO_PUBLIC_API_URL`.

Also `mock-server.js` — express on port 8000 returning hardcoded data in the
shapes above, so the app is unblocked if the backend is down.

**Gate: confirm it runs in Expo Go on a real phone before writing any feature.**

### B2 — record and score
Sing screen: 3-2-1 countdown, record with expo-audio, elapsed time, big Done
button. On stop, upload the m4a to `POST /score`.

Scoring returns in well under a second, so a spinner is enough — the "2-4
seconds" in the original prompt doc was pessimistic. Still handle the slow
case; a phone on bad wifi is slower than the scoring itself.

Score screen: the number, the three breakdown values, Continue.

### B3 — game loop
React context, no database.

State: `players[]`, `currentRound`, `currentPlayerIndex`, `totals{}`, `roundCount`.

Flow: Lobby → per round { Round intro → per player { Guess → Sing → Score } }
→ Standings → Winner.

- **Lobby** — add/remove 2–6 players, pick 3/5/7 rounds.
- **Round intro** — artist plus the two lyric lines, "X, you're up".
- **Guess** — 4 buttons (`title` + 3 `decoys`, shuffled), 10s timer,
  **+15** if correct.
- **Standings** — ranked by total. **Winner** — final ranking, Play again resets.

Songs are picked randomly without repeats. Guard the case where rounds × players
exceeds the song count.

### B4 — motion
Reanimated 3, only these three. Nothing else animates.

1. **Pitch ribbon** (Sing screen) — a lane ~180px tall. Reference melody as
   bone-colored horizontal bars from `reference_midi`; a pink dot driven by
   expo-audio metering with a fading trail; playhead sweeps left to right.
   To place the bars: map frame index to x by `i * 23.2ms`, and MIDI to y by
   fitting the song's min/max MIDI into the lane height.
2. **Score screen** — number counts 0 → final over 900ms,
   `Easing.out(Easing.cubic)`. Breakdown bars fill 80ms apart.
3. **Standings** — rows reorder with `LinearTransition.springify()`.

The pink `--signal` color is **only** the live pitch dot. Nowhere else.
Check `AccessibilityInfo.isReduceMotionEnabled` and skip the count-up if set.

### B5 — real API
Point `EXPO_PUBLIC_API_URL` at the LAN IP from `start.sh`, test end to end,
fix response-shape mismatches, delete `mock-server.js`.

---

## 5. Running it

**Backend**
```
cd backend
./start.sh                      # prints the LAN IP for the app
```

**App**
```
cd app
EXPO_PUBLIC_API_URL=http://<LAN-IP>:8000 npx expo start
```

Both devices on the same wifi. `localhost` will not work from a phone.

---

## 6. If you fall behind

Cut in this order. Each buys back 20–30 minutes:

1. **Pitch ribbon** (B4.1) — the Score screen alone still demos well.
2. **Guess round** (B3) — go straight from Round intro to Sing.
3. **Contour overlay** on the Score screen.
4. **Two songs** instead of three.

**Never cut:** recording, upload, scoring, leaderboard. That is the product.

---

## 7. Before shipping

- `README.md` — what it does, how to run it, frameworks used (Expo, React
  Native, Reanimated, librosa, FastAPI, numpy), and a section stating Claude
  Code wrote the implementation from a spec we wrote.
- No API keys or IP addresses committed. `.gitignore` already excludes audio,
  `.venv`, and `.env`; the LAN IP must stay out of any committed app config.
