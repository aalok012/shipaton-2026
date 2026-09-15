# Backend environment notes

## Python
- Uses Homebrew `python@3.12` (`/usr/local/opt/python@3.12`), NOT the default
  `python3` (3.14) — numba has no 3.14 wheels.
- Install with `--only-binary=:all:`. Without it pip tries to build llvmlite
  0.49 from source and fails; the flag backs the resolver off to
  llvmlite 0.45.1 / numba 0.62.1, which still ship Intel-Mac wheels.
- Machine is arm64 but `/usr/local` Homebrew is the Intel build, so this venv
  runs under Rosetta. Speed is fine (see below).

## m4a uploads — IMPORTANT
librosa 1.0 REMOVED the audioread fallback. `librosa.load()` on an .m4a fails
with `LibsndfileError: Format not recognised`. Do not rely on librosa to decode
m4a directly.

Transcode with ffmpeg first, then load the wav:

    subprocess.run(['ffmpeg','-hide_banner','-loglevel','error',
                    '-i', src, '-ac','1','-ar','22050', wav, '-y'], check=True)
    y, sr = librosa.load(wav, sr=22050)

Measured: transcode 0.058s; pitch read back correctly (440.0 Hz test tone).

## pyin timing (measured, 22050 Hz mono)
- First call in a fresh process: ~2.5s (numba JIT, cached to disk after)
- Warm: 3s audio 0.14s | 10s 0.37s | 15s 0.49s

Warm pyin once at FastAPI startup so the first real request doesn't pay the 2.5s.
