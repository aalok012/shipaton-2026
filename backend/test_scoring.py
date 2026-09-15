"""A1 checkpoint: run the scoring engine against real recordings.

    python test_scoring.py                        # reference.wav vs good/bad/attempt
    python test_scoring.py ref.wav take1.wav ...  # explicit files

Good takes should score well above bad ones. If they don't, the engine needs
tuning before any API work starts.
"""

import sys
import os
import time
import json

from scoring import score_recording, build_reference, SEMITONE_TOLERANCE, WEIGHTS


def main():
    args = sys.argv[1:]
    if args:
        ref_path, attempts = args[0], args[1:]
    else:
        ref_path = "reference.wav"
        attempts = [p for p in ("good.wav", "bad.wav", "attempt.wav")
                    if os.path.exists(p)]

    if not os.path.exists(ref_path):
        print(f"Missing reference file: {ref_path}")
        print("Record two lines of a song and save it as reference.wav")
        return 1
    if not attempts:
        print("No attempt files found. Expected good.wav / bad.wav / attempt.wav")
        return 1

    print(f"SEMITONE_TOLERANCE = {SEMITONE_TOLERANCE}")
    print(f"WEIGHTS = {WEIGHTS}\n")

    print(f"Building reference from {ref_path} ...")
    t = time.time()
    reference_midi = build_reference(ref_path)
    voiced = sum(1 for v in reference_midi if v is not None)
    print(f"  {len(reference_midi)} frames, {voiced} voiced "
          f"({voiced / len(reference_midi) * 100:.0f}%), {time.time() - t:.2f}s\n")

    results = {}
    for path in attempts:
        if not os.path.exists(path):
            print(f"-- {path}: not found, skipping\n")
            continue
        print(f"-- {path}")
        t = time.time()
        try:
            result = score_recording(path, reference_midi)
        except Exception as e:
            print(f"   ERROR {type(e).__name__}: {e}\n")
            continue
        elapsed = time.time() - t
        print(json.dumps(result, indent=2))
        print(f"   scored in {elapsed:.2f}s\n")
        results[os.path.basename(path)] = result["score"]

    if "good.wav" in results and "bad.wav" in results:
        gap = results["good.wav"] - results["bad.wav"]
        print("=" * 46)
        print(f"good {results['good.wav']}  vs  bad {results['bad.wav']}"
              f"   gap = {gap}")
        if gap >= 30:
            print("PASS - takes separate clearly. Safe to build the API.")
        else:
            print("TOO CLOSE - tune SEMITONE_TOLERANCE / WEIGHTS before the API.")
        print("=" * 46)
    return 0


if __name__ == "__main__":
    sys.exit(main())
