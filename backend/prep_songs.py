"""A2: build songs.json from the wav files in ./references/.

    python prep_songs.py

Prompts for title / artist / lyrics / decoys per file. Songs already in
songs.json are skipped, so you can add references and re-run.
"""

import os
import re
import json
import sys
import time

from scoring import build_reference, SR, ScoringError
import librosa

REF_DIR = "references"
OUT = "songs.json"


def slug(text):
    s = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return s or "song"


def ask(prompt, required=True, default=None):
    while True:
        suffix = f" [{default}]" if default else ""
        val = input(f"{prompt}{suffix}: ").strip()
        if not val and default is not None:
            return default
        if val or not required:
            return val
        print("  (required)")


def main():
    if not os.path.isdir(REF_DIR):
        os.makedirs(REF_DIR, exist_ok=True)
        print(f"Created ./{REF_DIR}/ - drop your reference wav files in and re-run.")
        return 1

    wavs = sorted(
        f for f in os.listdir(REF_DIR)
        if f.lower().endswith((".wav", ".m4a", ".mp3", ".aiff", ".flac"))
    )
    if not wavs:
        print(f"No audio files in ./{REF_DIR}/")
        return 1

    songs = []
    if os.path.exists(OUT):
        with open(OUT) as f:
            songs = json.load(f)
        print(f"Loaded {len(songs)} existing song(s) from {OUT}")

    done = {s.get("source_file") for s in songs}

    for name in wavs:
        if name in done:
            print(f"\n-- {name}: already in {OUT}, skipping")
            continue

        path = os.path.join(REF_DIR, name)
        print(f"\n{'=' * 50}\n{name}")
        try:
            dur = librosa.get_duration(path=path)
            print(f"  duration {dur:.1f}s")
        except Exception:
            dur = None

        title = ask("  Title")
        artist = ask("  Artist")
        print("  Lyrics - the two lines shown in the round intro:")
        line1 = ask("    line 1")
        line2 = ask("    line 2")

        print("  Decoys - 3 plausible wrong titles, same genre:")
        decoys = [ask(f"    decoy {i + 1}") for i in range(3)]

        print("  Analysing pitch ...", end=" ", flush=True)
        t = time.time()
        try:
            reference_midi = build_reference(path)
        except ScoringError as e:
            print(f"\n  SKIPPED - {e}")
            continue
        voiced = sum(1 for v in reference_midi if v is not None)
        print(f"{len(reference_midi)} frames, {voiced} voiced, {time.time() - t:.1f}s")

        if voiced < 10:
            print("  WARNING: almost no pitch detected. Is this file actually singing?")

        song_id = slug(title)
        existing = {s["id"] for s in songs}
        if song_id in existing:
            n = 2
            while f"{song_id}-{n}" in existing:
                n += 1
            song_id = f"{song_id}-{n}"

        songs.append({
            "id": song_id,
            "title": title,
            "artist": artist,
            "lyrics": [line1, line2],
            "duration_sec": round(dur, 2) if dur else round(len(reference_midi) * 512 / SR, 2),
            "reference_midi": reference_midi,
            "decoys": decoys,
            "source_file": name,
        })

        with open(OUT, "w") as f:
            json.dump(songs, f, indent=2)
        print(f"  saved -> {OUT}")

    print(f"\n{len(songs)} song(s) in {OUT}")
    for s in songs:
        print(f"  {s['id']:24} {s['title']} - {s['artist']}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nInterrupted. Songs saved so far are kept.")
        sys.exit(130)
