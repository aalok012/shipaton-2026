# Musically

A party game about singing from memory.

One player is shown an artist and two lines of lyrics, then has to sing them —
no backing track, no melody to copy, just what they remember. The app listens,
compares the pitch of what they sang against a reference, and scores it. While
they sing, everyone else is guessing which song it was.

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
| Mobile app | In progress |

The backend is complete and runs standalone. You can score a recording with
nothing but `curl`. The React Native client is the remaining work.

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

## Running the app

Not built yet. When it is:

```bash
cd app
EXPO_PUBLIC_API_URL=http://<lan-ip>:8000 npx expo start
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
**App** — Expo, React Native, Reanimated 3, expo-router, expo-audio
**Tests** — pytest, httpx

---

## Repo layout

```
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

The implementation was written by [Claude Code](https://claude.com/claude-code)
from a specification and prompt plan I wrote. I set the scoring model, the API
contract, the screen flow and the build order; Claude Code wrote the code
against them, and the engine was tuned empirically against recorded takes —
several of the decisions documented above came out of measuring what actually
separated a good performance from a bad one, rather than from the original
design.
