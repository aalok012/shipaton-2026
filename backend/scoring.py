"""Unison scoring engine.

Compares a sung attempt against a reference melody and returns a 0-100 score
with a three-part breakdown: pitch, timing, contour.

Interface used by the rest of the backend:
    build_reference(wav_path) -> list[float | None]   # frame-wise MIDI
    score_recording(audio_path, reference_midi) -> dict
"""

import subprocess
import tempfile
import os
import math

import numpy as np
import librosa

SR = 22050
HOP = 512
FMIN = librosa.note_to_hz("C2")
FMAX = librosa.note_to_hz("C7")

# A sung note counts as "on pitch" if it lands within this many semitones.
SEMITONE_TOLERANCE = 1.5

WEIGHTS = {"pitch": 0.55, "timing": 0.20, "contour": 0.25}

MIN_DURATION_SEC = 1.0
MAX_DURATION_SEC = 60.0


class ScoringError(ValueError):
    """Raised when audio cannot be scored. Callers turn this into a 4xx."""


def _load_audio(path):
    """Load any audio file at SR mono.

    librosa 1.0 dropped the audioread fallback, so .m4a (what the phone
    records) fails to open directly. Transcode those with ffmpeg first.
    """
    if not os.path.exists(path):
        raise ScoringError("audio file not found")
    if os.path.getsize(path) == 0:
        raise ScoringError("audio file is empty")

    try:
        y, _ = librosa.load(path, sr=SR, mono=True)
    except Exception:
        tmp_wav = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                tmp_wav = f.name
            proc = subprocess.run(
                ["ffmpeg", "-hide_banner", "-loglevel", "error",
                 "-i", path, "-ac", "1", "-ar", str(SR), tmp_wav, "-y"],
                capture_output=True, timeout=30,
            )
            if proc.returncode != 0:
                raise ScoringError("could not decode audio (corrupt or unsupported)")
            y, _ = librosa.load(tmp_wav, sr=SR, mono=True)
        except subprocess.TimeoutExpired:
            raise ScoringError("audio decode timed out")
        except FileNotFoundError:
            raise ScoringError("ffmpeg not installed; cannot decode this format")
        finally:
            if tmp_wav and os.path.exists(tmp_wav):
                os.unlink(tmp_wav)

    if y.size == 0:
        raise ScoringError("audio contains no samples")

    dur = len(y) / SR
    if dur < MIN_DURATION_SEC:
        raise ScoringError(f"recording too short ({dur:.1f}s, need {MIN_DURATION_SEC}s)")
    if dur > MAX_DURATION_SEC:
        y = y[: int(MAX_DURATION_SEC * SR)]

    return y


def _extract_midi(y):
    """Frame-wise MIDI pitch. Unvoiced frames are NaN."""
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=FMIN, fmax=FMAX, sr=SR, hop_length=HOP
    )
    midi = np.full(len(f0), np.nan, dtype=float)
    ok = voiced_flag & np.isfinite(f0) & (f0 > 0)
    midi[ok] = librosa.hz_to_midi(f0[ok])
    return midi


def _resample_to(seq, n):
    """Stretch/squash a frame sequence to n frames, preserving NaN gaps."""
    seq = np.asarray(seq, dtype=float)
    if len(seq) == 0:
        return np.full(n, np.nan)
    if len(seq) == n:
        return seq.copy()
    src = np.linspace(0.0, 1.0, len(seq))
    dst = np.linspace(0.0, 1.0, n)
    voiced = np.isfinite(seq)
    out = np.full(n, np.nan)
    if voiced.sum() >= 2:
        out = np.interp(dst, src[voiced], seq[voiced])
        # Re-open the unvoiced gaps so timing isn't scored against interpolation.
        gap = np.interp(dst, src, voiced.astype(float))
        out[gap < 0.5] = np.nan
    return out


def _octave_align(att, ref):
    """Remove whole-octave differences between singer and reference.

    Someone singing the right tune an octave down is correct; someone singing
    the wrong notes is not. Only multiples of 12 semitones are forgiven.
    """
    both = np.isfinite(att) & np.isfinite(ref)
    if both.sum() == 0:
        return att
    offset = float(np.median(att[both] - ref[both]))
    shift = 12.0 * round(offset / 12.0)
    return att - shift


def _pitch_score(att, ref):
    both = np.isfinite(att) & np.isfinite(ref)
    if both.sum() == 0:
        return 0.0
    err = np.abs(att[both] - ref[both])
    # Full credit inside the tolerance, tapering to zero one tolerance beyond.
    credit = np.clip(1.0 - (err - SEMITONE_TOLERANCE) / SEMITONE_TOLERANCE, 0.0, 1.0)
    return float(np.mean(credit) * 100.0)


def _timing_score(att, ref):
    """How well the sung/silent pattern lines up, as intersection-over-union."""
    a = np.isfinite(att)
    r = np.isfinite(ref)
    union = np.logical_or(a, r).sum()
    if union == 0:
        return 0.0
    inter = np.logical_and(a, r).sum()
    return float(inter / union * 100.0)


def _contour_score(att, ref):
    """Correlation of the melodic shape - does it rise and fall together?"""
    both = np.isfinite(att) & np.isfinite(ref)
    if both.sum() < 3:
        return 0.0
    a = att[both]
    r = ref[both]
    if np.std(a) < 1e-6 or np.std(r) < 1e-6:
        # A monotone drone has no contour to match.
        return 0.0 if np.std(r) >= 1e-6 else 50.0
    corr = float(np.corrcoef(a, r)[0, 1])
    if not math.isfinite(corr):
        return 0.0
    return float(max(0.0, corr) * 100.0)


def build_reference(wav_path):
    """Build the stored reference melody for a song.

    Returns a JSON-safe list where each entry is a MIDI number or None.
    """
    y = _load_audio(wav_path)
    midi = _extract_midi(y)
    return [None if not np.isfinite(v) else round(float(v), 3) for v in midi]


def score_recording(audio_path, reference_midi):
    """Score one sung attempt against a stored reference melody."""
    if reference_midi is None or len(reference_midi) == 0:
        raise ScoringError("song has no reference melody")

    ref = np.array(
        [np.nan if v is None else float(v) for v in reference_midi], dtype=float
    )
    if not np.isfinite(ref).any():
        raise ScoringError("reference melody has no pitched frames")

    y = _load_audio(audio_path)
    att = _extract_midi(y)

    voiced_ratio = float(np.isfinite(att).mean()) if att.size else 0.0
    duration_sec = round(len(y) / SR, 2)

    if not np.isfinite(att).any():
        # Silence or noise - a real result, not an error.
        return {
            "score": 0,
            "pitch_accuracy": 0.0,
            "timing_accuracy": 0.0,
            "contour_match": 0.0,
            "duration_sec": duration_sec,
            "voiced_ratio": 0.0,
            "message": "No singing detected.",
        }

    att_r = _resample_to(att, len(ref))
    att_r = _octave_align(att_r, ref)

    pitch = _pitch_score(att_r, ref)
    timing = _timing_score(att_r, ref)
    contour = _contour_score(att_r, ref)

    total = (
        pitch * WEIGHTS["pitch"]
        + timing * WEIGHTS["timing"]
        + contour * WEIGHTS["contour"]
    )

    return {
        "score": int(round(total)),
        "pitch_accuracy": round(pitch, 1),
        "timing_accuracy": round(timing, 1),
        "contour_match": round(contour, 1),
        "duration_sec": duration_sec,
        "voiced_ratio": round(voiced_ratio, 3),
    }
