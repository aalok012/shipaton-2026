"""Unison scoring engine.

Compares a sung attempt against a reference melody and returns a 0-100 score
with a breakdown across four dimensions.

    build_reference(wav_path) -> list[float | None]   # frame-wise MIDI
    score_recording(audio_path, reference_midi) -> dict

Design notes
------------
The attempt is aligned to the reference with DTW rather than stretched
linearly, so singing a phrase slightly slow then catching up is not punished
as a pitch error. Rhythm is judged on the gaps between note onsets rather
than their absolute times, so a late start costs nothing. Completion is scored
separately, because an attempt that stops a third of the way through would
otherwise align almost perfectly against the part it did sing.
"""

import os
import math
import shutil
import tempfile
import subprocess

import numpy as np
import librosa

SR = 22050
HOP = 512
FMIN = librosa.note_to_hz("C2")
FMAX = librosa.note_to_hz("C7")

# A sung note counts as fully on pitch within this many semitones. A semitone
# is the smallest interval in the scale, so landing inside one is "right note".
SEMITONE_TOLERANCE = 1.0

# How far DTW may wander when aligning, as a fraction of sequence length.
# Unconstrained DTW is too generous: it warps an off-key attempt onto whichever
# reference notes happen to be nearest, which collapsed the gap between a good
# and a bad take from 40 points to 14. At 0.06 a singer gets roughly half a
# second of slack, which covers real human drift but not wholesale rewriting.
DTW_BAND_RAD = 0.06

# Pitch dominates because this is a singing game. Contour is kept small: once
# the contours are DTW-aligned it largely restates pitch accuracy.
WEIGHTS = {
    "pitch": 0.60,
    "timing": 0.12,
    "contour": 0.08,
    "completion": 0.20,
}

MIN_DURATION_SEC = 1.0
MAX_DURATION_SEC = 60.0

# Frames needed before a metric is worth reporting.
MIN_VOICED_FRAMES = 8

# Two onsets closer together than this are the same note; a little pitch
# wobble on the way into a note would otherwise register twice.
MIN_ONSET_GAP_SEC = 0.08

# DTW builds a full cost matrix; cap the sequences so a long take cannot
# blow up memory or latency.
MAX_DTW_POINTS = 400


class ScoringError(ValueError):
    """Raised when audio cannot be scored. Callers turn this into a 4xx."""


# --------------------------------------------------------------- audio input

def _ffmpeg_binary():
    found = shutil.which("ffmpeg")
    if found:
        return found
    try:  # pip-installed fallback, so a missing system ffmpeg is not fatal
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return None


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
        ffmpeg = _ffmpeg_binary()
        if ffmpeg is None:
            raise ScoringError("ffmpeg not installed; cannot decode this format")
        tmp_wav = None
        try:
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
                tmp_wav = f.name
            proc = subprocess.run(
                [ffmpeg, "-hide_banner", "-loglevel", "error",
                 "-i", path, "-ac", "1", "-ar", str(SR), tmp_wav, "-y"],
                capture_output=True, timeout=30,
            )
            if proc.returncode != 0:
                raise ScoringError("could not decode audio (corrupt or unsupported)")
            y, _ = librosa.load(tmp_wav, sr=SR, mono=True)
        except subprocess.TimeoutExpired:
            raise ScoringError("audio decode timed out")
        finally:
            if tmp_wav and os.path.exists(tmp_wav):
                os.unlink(tmp_wav)

    y = np.nan_to_num(y.astype(np.float32), copy=False)
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
    if float(np.max(np.abs(y))) < 1e-4:
        return np.full(max(1, len(y) // HOP), np.nan)
    f0, voiced_flag, _ = librosa.pyin(
        y, fmin=FMIN, fmax=FMAX, sr=SR, hop_length=HOP
    )
    midi = np.full(len(f0), np.nan, dtype=float)
    ok = voiced_flag & np.isfinite(f0) & (f0 > 0)
    midi[ok] = librosa.hz_to_midi(f0[ok])
    return midi


# ------------------------------------------------------------------ analysis

def _voiced(midi):
    return midi[np.isfinite(midi)]


def _thin(seq, limit=MAX_DTW_POINTS):
    """Evenly reduce a sequence so the DTW cost matrix stays bounded."""
    if len(seq) <= limit:
        return seq
    idx = np.linspace(0, len(seq) - 1, limit).round().astype(int)
    return seq[idx]


def _align(ref, att):
    """DTW-align two contours; returns the matched value pairs.

    Aligning rather than stretching means a singer who drags a note and then
    catches up is compared note-for-note instead of being smeared across the
    whole phrase.
    """
    r = _thin(ref)
    a = _thin(att)
    cost = np.abs(r[:, None] - a[None, :])
    try:
        _, path = librosa.sequence.dtw(
            C=cost, backtrack=True,
            global_constraints=True, band_rad=DTW_BAND_RAD,
        )
    except Exception:
        # A band that cannot span very lopsided lengths; fall back to free DTW.
        _, path = librosa.sequence.dtw(C=cost, backtrack=True)
    return r[path[:, 0]], a[path[:, 1]]


def _octave_shift(att, ref):
    """Whole-octave differences only.

    Someone singing the right tune in their own register is correct; someone
    singing the wrong notes is not, so nothing but multiples of 12 is removed.
    """
    return 12.0 * round(float(np.median(att) - np.median(ref)) / 12.0)


def _note_onsets(midi):
    """Onset time of each note, derived from the pitch track.

    Taken from the pitch series rather than the audio so the reference needs
    no stored waveform, and so both sides are measured the same way.
    """
    frame_sec = HOP / SR
    gap_frames = MIN_ONSET_GAP_SEC / frame_sec
    times = []
    held = None
    for i, v in enumerate(midi):
        if not np.isfinite(v):
            held = None
            continue
        if held is None or abs(v - held) > 1.0:
            if not times or (i - times[-1]) >= gap_frames:
                times.append(i)
            held = v
        else:
            held = 0.7 * held + 0.3 * v
    return np.array(times, dtype=float) * frame_sec


def _pitch_score(ref_pairs, att_pairs):
    err = np.abs(att_pairs - ref_pairs)
    # Full credit inside the tolerance, fading to zero one tolerance beyond.
    credit = np.clip(1.0 - (err - SEMITONE_TOLERANCE) / SEMITONE_TOLERANCE, 0.0, 1.0)
    return float(np.mean(credit) * 100.0)


def _contour_score(ref_pairs, att_pairs):
    """Does the melody rise and fall with the reference?"""
    if len(ref_pairs) < 3:
        return None
    if np.std(ref_pairs) < 1e-6:
        return None  # a monotone reference has no shape to match
    if np.std(att_pairs) < 1e-6:
        return 0.0
    corr = float(np.corrcoef(ref_pairs, att_pairs)[0, 1])
    if not math.isfinite(corr):
        return 0.0
    return max(0.0, corr) * 100.0


def _rhythm_score(ref_onsets, att_onsets):
    """Compare the gaps between notes, not their absolute times.

    Using gaps means a late start or device latency costs nothing, while
    genuinely rushing or dragging still does.
    """
    if len(ref_onsets) < 2:
        return None
    if len(att_onsets) < 2:
        return 0.0
    r = np.diff(ref_onsets)
    a = np.diff(att_onsets)
    cost = np.abs(r[:, None] - a[None, :])
    _, path = librosa.sequence.dtw(C=cost, backtrack=True)
    mean_err = float(np.mean(cost[path[:, 0], path[:, 1]]))
    # Half credit at ~280ms of average drift.
    accuracy = math.exp(-mean_err / 0.4)
    # Singing far fewer notes than the reference should not look like good time.
    coverage = min(len(r), len(a)) / max(len(r), len(a))
    return float(np.clip(100.0 * accuracy * coverage, 0.0, 100.0))


def _completion_score(ref_voiced_sec, att_voiced_sec):
    """How much of the phrase was actually sung.

    Symmetric, so stopping early and rambling on both cost. Without this an
    attempt that covers a third of the phrase still aligns near-perfectly
    against the third it sang.
    """
    if ref_voiced_sec <= 0:
        return None
    ratio = att_voiced_sec / ref_voiced_sec
    if ratio <= 0:
        return 0.0
    return float(np.clip(100.0 * min(ratio, 1.0 / ratio), 0.0, 100.0))


# -------------------------------------------------------------------- public

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

    ref_frames = np.array(
        [np.nan if v is None else float(v) for v in reference_midi], dtype=float
    )
    ref_voiced = _voiced(ref_frames)
    if ref_voiced.size < MIN_VOICED_FRAMES:
        raise ScoringError("reference melody has no pitched frames")

    y = _load_audio(audio_path)
    att_frames = _extract_midi(y)
    att_voiced = _voiced(att_frames)

    duration_sec = round(len(y) / SR, 2)
    voiced_ratio = float(np.isfinite(att_frames).mean()) if att_frames.size else 0.0

    if att_voiced.size < MIN_VOICED_FRAMES:
        # Silence or speech: a real result, not an error.
        return {
            "score": 0,
            "pitch_accuracy": 0.0,
            "timing_accuracy": 0.0,
            "contour_match": 0.0,
            "completion": 0.0,
            "duration_sec": duration_sec,
            "voiced_ratio": round(voiced_ratio, 3),
            "confidence": {k: "no_singing_detected" for k in WEIGHTS},
            "message": "No singing detected.",
        }

    att_voiced = att_voiced - _octave_shift(att_voiced, ref_voiced)
    ref_pairs, att_pairs = _align(ref_voiced, att_voiced)

    frame_sec = HOP / SR
    parts = {
        "pitch": _pitch_score(ref_pairs, att_pairs),
        "timing": _rhythm_score(_note_onsets(ref_frames), _note_onsets(att_frames)),
        "contour": _contour_score(ref_pairs, att_pairs),
        "completion": _completion_score(
            ref_voiced.size * frame_sec, att_voiced.size * frame_sec
        ),
    }

    # A metric that could not be measured is dropped and its weight shared out,
    # rather than silently scoring zero.
    usable = {k: v for k, v in parts.items() if v is not None}
    total_weight = sum(WEIGHTS[k] for k in usable)
    total = (
        sum(WEIGHTS[k] * v for k, v in usable.items()) / total_weight
        if total_weight else 0.0
    )

    confidence = {
        k: ("ok" if parts[k] is not None else "unavailable") for k in WEIGHTS
    }
    if att_voiced.size < 20:
        confidence["pitch"] = "low_voiced_audio"

    return {
        "score": int(round(total)),
        "pitch_accuracy": round(parts["pitch"], 1),
        "timing_accuracy": round(parts["timing"], 1) if parts["timing"] is not None else 0.0,
        "contour_match": round(parts["contour"], 1) if parts["contour"] is not None else 0.0,
        "completion": round(parts["completion"], 1) if parts["completion"] is not None else 0.0,
        "duration_sec": duration_sec,
        "voiced_ratio": round(voiced_ratio, 3),
        "confidence": confidence,
    }
