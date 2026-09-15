"""Build a playable songs.json without needing real recordings.

    .venv/bin/python seed_demo_songs.py

Synthesises a reference vocal for each demo song, then runs it through the
same build_reference path real audio would take - so the API, the scoring and
the app all behave exactly as they will with real songs. Replace this with
prep_songs.py once you have actual recordings.

Titles and lyrics here are invented, not real songs.
"""

import json
import os

import numpy as np
import soundfile as sf

from scoring import SR, build_reference, build_reference_onsets

REF_DIR = "references"
OUT = "songs.json"

# (midi note, beats) - each phrase is a different shape so the demo does not
# look like the same song three times.
SONGS = [
    {
        "id": "paper-lanterns",
        "title": "Paper Lanterns",
        "artist": "The Quiet Hours",
        "lyrics": ["We hung the lanterns out on Rowan Street",
                   "and waited for the summer to catch up"],
        "decoys": ["Glass Harbour", "Æther & Ash", "Long Way From Tuesday"],
        "melody": [(67, .5), (67, .5), (69, .5), (67, .5), (72, .5), (71, 1.0),
                   (67, .5), (67, .5), (69, .5), (67, .5), (74, .5), (72, 1.0)],
    },
    {
        "id": "slow-weather",
        "title": "Slow Weather",
        "artist": "Marguerite Vale",
        "lyrics": ["There's a slow weather moving through the kitchen",
                   "and I can't tell if it's leaving or arriving"],
        "decoys": ["Cold Front", "Handwriting", "The Undertow Waltz"],
        "melody": [(64, .75), (67, .25), (69, .5), (71, .5), (69, .5), (67, 1.0),
                   (64, .75), (67, .25), (71, .5), (72, .5), (71, .5), (69, 1.0)],
    },
    {
        "id": "corner-store-gospel",
        "title": "Corner Store Gospel",
        "artist": "Eli Brooks Trio",
        "lyrics": ["Sing me something cheap and holy",
                   "under the fluorescent light"],
        "decoys": ["Sunday Change", "Neon Choir", "Two Dollar Hymn"],
        "melody": [(72, .5), (71, .5), (69, .5), (67, .5), (69, .5), (71, .5),
                   (72, 1.0), (69, .5), (67, .5), (65, .5), (67, 1.5)],
    },
]

BPM = 96
BEAT = 60.0 / BPM


def _note(midi, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    # A little vibrato and drift so pyin sees something voice-like.
    m = midi + 0.12 * np.sin(2 * np.pi * 5.5 * t) + 0.04 * t
    freq = 440.0 * 2 ** ((m - 69) / 12.0)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    wave = np.sin(phase) + 0.25 * np.sin(2 * phase) + 0.12 * np.sin(3 * phase)
    env = np.minimum(1, np.minimum(t / 0.03, (dur - t) / 0.06)).clip(0)
    return (wave * env * 0.5).astype(np.float32)


def _render(melody):
    parts = [np.zeros(int(SR * 0.15), dtype=np.float32)]
    for midi, beats in melody:
        parts.append(_note(midi, beats * BEAT))
        parts.append(np.zeros(int(SR * 0.08), dtype=np.float32))
    return np.concatenate(parts)


def main():
    os.makedirs(REF_DIR, exist_ok=True)
    songs = []
    for spec in SONGS:
        path = os.path.join(REF_DIR, f"{spec['id']}.wav")
        audio = _render(spec["melody"])
        sf.write(path, audio, SR)

        midi = build_reference(path)
        onsets = build_reference_onsets(path)
        voiced = sum(1 for v in midi if v is not None)
        print(f"{spec['title']:24} {len(audio) / SR:5.1f}s  "
              f"{voiced:4d} voiced frames  {len(onsets):3d} onsets")

        songs.append({
            "id": spec["id"],
            "title": spec["title"],
            "artist": spec["artist"],
            "lyrics": spec["lyrics"],
            "duration_sec": round(len(audio) / SR, 2),
            "reference_midi": midi,
            "reference_onsets": onsets,
            "decoys": spec["decoys"],
            "source_file": f"{spec['id']}.wav",
        })

    with open(OUT, "w") as f:
        json.dump(songs, f, indent=2)
    print(f"\nwrote {OUT} with {len(songs)} songs "
          f"({os.path.getsize(OUT) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
