"""Build a playable songs.json without needing real recordings.

    .venv/bin/python seed_demo_songs.py

Synthesises a reference vocal for each demo song, then runs it through the
same build_reference path real audio would take - so the API, the scoring and
the app all behave exactly as they will with real songs. Replace this with
prep_songs.py once you have actual recordings.

The reference audio is synthesized locally; no original recordings are used.
"""

import json
import os

import numpy as np
import soundfile as sf

from scoring import SR, build_reference, build_reference_onsets

REF_DIR = "references"
OUT = "songs.json"

# (MIDI note, beats); None represents an explicit rest.
SONGS = [
    {
        "id": "baby-justin-bieber",
        "title": "Baby",
        "artist": "Justin Bieber",
        "lyrics": ["Baby, baby, baby, oh",
                   "Like baby, baby, baby, no"],
        "decoys": ["One Time", "Boyfriend", "Sorry"],
        # First two phrases of the supplied justin_bieber_baby_chorus.mid:
        # ticks 0–444, 96 ticks/beat, tempo 461602 microseconds/beat.
        "seconds_per_beat": 0.461602,
        "melody": [(67, .25), (65, .25), (67, .25), (65, .25),
                   (67, .25), (65, .25), (70, .5), (None, .5),
                   (67, .125), (67, .25), (65, .25), (67, .25),
                   (65, .25), (67, .25), (65, .25), (72, .5)],
    },
]

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


def _render(melody, seconds_per_beat):
    # Round cumulative boundaries to avoid accumulating per-note timing error.
    total_beats = sum(beats for _, beats in melody)
    audio = np.zeros(round(SR * total_beats * seconds_per_beat), dtype=np.float32)
    elapsed_beats = 0.0
    for midi, beats in melody:
        start = round(SR * elapsed_beats * seconds_per_beat)
        elapsed_beats += beats
        end = round(SR * elapsed_beats * seconds_per_beat)
        if midi is not None:
            tone = _note(midi, (end - start + 0.01) / SR)
            audio[start:end] = tone[:end - start]
    return audio


def main():
    os.makedirs(REF_DIR, exist_ok=True)
    songs = []
    for spec in SONGS:
        path = os.path.join(REF_DIR, f"{spec['id']}.wav")
        audio = _render(spec["melody"], spec["seconds_per_beat"])
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
