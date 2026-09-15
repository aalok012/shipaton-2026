# Musically

A pass-the-phone singing game for iOS and Android. Choose solo or party mode, add names, listen to a melody, sing two lyric lines, and earn a score out of 100. The leaderboard adds up points after each take and round.

## Start both services together

From the repository root, run `npm start`. The launcher starts the backend,
checks health and songs, detects the LAN address, and configures Expo automatically.
Scan its QR code in Expo Go on the same Wi-Fi. Ctrl+C stops the services it started.
Use `MUSIC_HOST=<your-lan-ip> npm start` to choose a specific network adapter.

## Start the app separately

Requires Node.js 22.13+ and Expo Go compatible with SDK 57. The project uses Expo SDK 57, React Native, TypeScript, Reanimated 4, expo-audio, SVG, and bundled Bricolage Grotesque fonts. Dependencies are pinned by `app/package-lock.json`.

**Terminal 1 — backend**

```sh
cd backend
./start.sh
```

Keep the terminal open. The script prints the LAN address for the phone.

**Terminal 2 — app**

```sh
cd app
npm install
cp .env.example .env
```

Edit `app/.env` and replace `YOUR_LAPTOP_LAN_IP` with the address from the backend terminal. Then:

```sh
npx expo start
```

Scan the QR code with Expo Go (Android) or Camera (iOS). Allow microphone and local-network access. Phone and laptop must share Wi-Fi; `localhost` on a phone points to the phone itself. Restart Expo after changing `.env`. The backend address is public app configuration, not a secret; don't put API keys in `EXPO_PUBLIC_*` variables.

For desktop UI development, run `npm run web`. Browser recording needs localhost or HTTPS; test the actual mobile microphone path in Expo Go.

### First-time backend setup

The existing backend requires Python 3.12 and ffmpeg available on PATH:

```sh
cd backend
python3.12 -m venv .venv
.venv/bin/python -m pip install --only-binary=:all: -r requirements.txt
.venv/bin/python seed_demo_songs.py
./start.sh
```

The backend uses FastAPI, librosa, numpy, and ffmpeg. See [backend notes](../backend/NOTES.md) for the scoring environment.

## Three screens

1. **Home:** solo or 2–6 players, editable names, 1/3/5/7 rounds, and Start. Choices beyond the current catalogue size are disabled; a two-song catalogue also offers two rounds. Blank and duplicate names are rejected.
2. **Sing:** randomly selected song, lyrics, an instrumental melody preview, player handoff, microphone permission, 3–2–1 countdown, elapsed time, reference melody map, and live microphone level. Finish uploads the recording to `/score`. Takes stop at 30 seconds. Failed uploads can be retried without re-recording.
3. **Results:** animated score ring, pitch/timing/contour bars, short-take feedback, cumulative leaderboard, next player/round, final winner (including ties), and Play again.

Each player sings the **same song in a round**. Songs do not repeat within a game. Three seeded songs therefore support three full rounds for any number of players. State lives in memory and resets when the app closes or the game ends.

### What the score means

The existing backend compares **melody, rhythm, contour, and completion**. It does **not** transcribe or check lyric words. The app states this on the results screen. Unmeasurable metrics are labelled; silence/no-singing messages are shown. Each take earns 0–100; the leaderboard is the sum across rounds.

The selected catalogue contains invented demo songs. No AI song-generation service or API key is used. Because the API has pitch frames but no playable audio URL, the app synthesizes a quiet **instrumental guide** from `reference_midi`. It is not a recording of a vocalist. The microphone meter shows loudness, not detected live pitch.

## Project map

- `app/App.tsx` — typed navigation between exactly three screens, session state, exit confirmation.
- `app/src/screens/` — Home, Sing, and Results.
- `app/src/components/` — reusable controls, record-player artwork, reference melody map.
- `app/src/theme.ts` — shared palette and typography.
- `app/src/lib/api.ts` — environment-based API client, multipart upload, readable failures, timeout.
- `app/src/lib/game.ts` — turns, scores, rankings, repeat prevention.
- `app/src/lib/melody.ts` — MIDI-frame-to-WAV preview.
- `app/app.config.ts` — Expo app identity and microphone permissions.

Reanimated handles score bars and leaderboard motion; the 900ms score count-up and transitions respect the system's Reduce Motion setting at launch. Graphics are built with React Native views and SVG, with no remote image dependencies.

## Checks

```sh
cd app
npm run typecheck
npm test
npx expo install --check
npx expo export --platform web
npx expo export --platform ios --platform android --output-dir dist-native
```

Game tests cover multiplayer turns, shared songs, catalogue exhaustion, duplicate score protection, cumulative totals, ties, and solo reset. The backend's 15 API tests also pass. Browser integration was tested at a 390px phone viewport using Chrome's synthetic microphone and the real FastAPI backend, including melody preview and multipart scoring. Additional browser checks cover simulated upload timeouts, retrying saved takes, silence feedback, unavailable metrics, microphone denial, and reduced motion. Native JavaScript bundles build for iOS and Android.

**Physical-device verification is still required:** scan the QR code, play a guide, record a sung take, verify upload and scores, deny/re-enable microphone access, background the app during a take, and try an upload with the backend offline. Browser tests do not verify native m4a capture, device audio routing, or local-network permissions. No app-store build or deployment has been performed.

Official references: [Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/) and [expo-audio](https://docs.expo.dev/versions/v57.0.0/sdk/audio/).

## Implementation credit

The frontend was implemented with OpenAI Codex from the user's three-screen brief and shared backend contract. The existing build plan attributes the earlier backend implementation to Claude Code.

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
