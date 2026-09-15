"""A4 regression suite - the four upload cases plus every error path.

    .venv/bin/python -m pytest test_api.py -v

Audio fixtures are generated, so the suite is self-contained. It runs against
whatever songs.json holds; the score assertions need the synthetic placeholder
song, and are skipped automatically once real songs replace it.
"""

import io
import json
import os
import subprocess
import tempfile

import numpy as np
import pytest
import soundfile as sf
from fastapi.testclient import TestClient

import main

SR = 22050
SONG_ID = "test-song"

# Same phrase prep used to build the placeholder songs.json.
MEL = [(67, .45), (67, .45), (69, .5), (67, .5), (72, .5), (71, .9),
       (67, .45), (67, .45), (69, .5), (67, .5), (74, .5), (72, .9)]


def _tone(midi, dur):
    n = int(SR * dur)
    t = np.arange(n) / SR
    m = midi + 0.12 * np.sin(2 * np.pi * 5.5 * t)
    f = 440.0 * 2 ** ((m - 69) / 12.0)
    ph = 2 * np.pi * np.cumsum(f) / SR
    y = np.sin(ph) + 0.25 * np.sin(2 * ph) + 0.12 * np.sin(3 * ph)
    env = np.minimum(1, np.minimum(t / 0.03, (dur - t) / 0.05)).clip(0)
    return (y * env * 0.5).astype(np.float32)


def _render(mel, pitch_err, timing_jit, seed):
    r = np.random.default_rng(seed)
    out = [np.zeros(int(SR * 0.15), dtype=np.float32)]
    for m, d in mel:
        dd = max(0.12, d * (1 + r.normal(0, timing_jit)))
        out.append(_tone(m + r.normal(0, pitch_err), dd))
        out.append(np.zeros(int(SR * max(0.04, 0.09 * (1 + r.normal(0, timing_jit)))),
                           dtype=np.float32))
    return np.concatenate(out)


def _wav_bytes(y):
    buf = io.BytesIO()
    sf.write(buf, y, SR, format="WAV")
    return buf.getvalue()


@pytest.fixture(scope="session")
def client():
    with TestClient(main.app) as c:
        yield c


@pytest.fixture(scope="session")
def placeholder_song():
    """The score assertions only hold for the synthetic placeholder."""
    if not os.path.exists("songs.json"):
        pytest.skip("no songs.json")
    songs = json.load(open("songs.json"))
    song = next((s for s in songs if s["id"] == SONG_ID), None)
    if song is None:
        pytest.skip("placeholder song replaced by real data")
    return song


@pytest.fixture(scope="session")
def good_wav():
    return _wav_bytes(_render(MEL, 0.35, 0.07, seed=2))


@pytest.fixture(scope="session")
def bad_wav():
    rng = np.random.default_rng(7)
    bad = [(m + int(r), d) for (m, d), r in zip(MEL, rng.integers(-5, 6, len(MEL)))]
    return _wav_bytes(_render(bad, 1.4, 0.30, seed=3))


def _post(client, data, filename="take.wav", song_id=SONG_ID):
    files = {"audio": (filename, data, "audio/wav")}
    return client.post("/score", files=files, data={"song_id": song_id})


# ---------------------------------------------------------------- endpoints

def test_health(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json()["ok"] is True


def test_songs_list_omits_reference_midi(client):
    r = client.get("/songs")
    assert r.status_code == 200
    for song in r.json():
        assert "reference_midi" not in song, "heavy array must not ship in the list"
        assert {"id", "title", "artist", "lyrics", "decoys"} <= set(song)
        assert len(song["lyrics"]) == 2
        assert len(song["decoys"]) == 3


def test_song_detail_includes_reference_midi(client, placeholder_song):
    r = client.get(f"/songs/{SONG_ID}")
    assert r.status_code == 200
    midi = r.json()["reference_midi"]
    assert len(midi) > 0
    assert any(v is not None for v in midi), "reference must have pitched frames"


def test_unknown_song_detail_404(client):
    r = client.get("/songs/does-not-exist")
    assert r.status_code == 404
    assert "error" in r.json()


# ------------------------------------------------------- the four A4 uploads

def test_real_take_scores_well(client, placeholder_song, good_wav):
    r = _post(client, good_wav)
    assert r.status_code == 200
    body = r.json()
    assert body["score"] > 70, body
    for k in ("pitch_accuracy", "timing_accuracy", "contour_match"):
        assert 0 <= body[k] <= 100


def test_off_key_take_scores_far_lower(client, placeholder_song, good_wav, bad_wav):
    good = _post(client, good_wav).json()["score"]
    bad = _post(client, bad_wav).json()["score"]
    assert good - bad >= 30, f"takes too close: good={good} bad={bad}"


def test_silence_returns_zero_not_an_error(client, placeholder_song):
    r = _post(client, _wav_bytes(np.zeros(int(SR * 5), dtype=np.float32)))
    assert r.status_code == 200, "silence is a result, not a failure"
    body = r.json()
    assert body["score"] == 0
    assert "message" in body


def test_speech_returns_zero_not_an_error(client, placeholder_song):
    rng = np.random.default_rng(3)
    n = int(SR * 4)
    env = np.zeros(n)
    for s in range(0, n, int(SR * 0.35)):
        w = np.hanning(min(int(SR * 0.22), n - s))
        env[s:s + len(w)] = w
    r = _post(client, _wav_bytes((rng.normal(0, 1, n) * env * 0.3).astype(np.float32)))
    assert r.status_code == 200
    assert r.json()["score"] == 0


def test_clip_under_one_second_rejected(client, placeholder_song):
    tiny = _wav_bytes(_tone(69, 0.6))
    r = _post(client, tiny)
    assert r.status_code == 422
    assert "short" in r.json()["error"].lower()


# --------------------------------------------------------------- error paths

def test_empty_file(client, placeholder_song):
    r = _post(client, b"")
    assert r.status_code == 400
    assert "error" in r.json()


def test_corrupt_audio(client, placeholder_song):
    r = _post(client, b"\x00\x01not audio" * 200, filename="take.m4a")
    assert r.status_code == 422
    assert "error" in r.json()


def test_unknown_song_id_on_score(client, good_wav):
    r = _post(client, good_wav, song_id="nope")
    assert r.status_code == 404
    body = r.json()
    assert "error" in body and "available" in body


def test_missing_field_uses_the_same_error_shape(client, good_wav):
    """The app must never have to parse a second error format."""
    r = client.post("/score", files={"audio": ("t.wav", good_wav, "audio/wav")})
    assert r.status_code == 422
    assert "error" in r.json(), "must be {'error': ...}, not FastAPI's {'detail': ...}"


def test_no_response_ever_leaks_a_stack_trace(client, placeholder_song, good_wav):
    for data, name in ((b"", "e.wav"), (b"junk" * 50, "c.m4a"), (good_wav, "g.wav")):
        body = client.post("/score", files={"audio": (name, data, "audio/wav")},
                           data={"song_id": SONG_ID}).text
        assert "Traceback" not in body
        assert "File \"" not in body


# ------------------------------------------------------------ m4a from phone

@pytest.mark.skipif(
    subprocess.run(["which", "ffmpeg"], capture_output=True).returncode != 0,
    reason="ffmpeg not installed",
)
def test_m4a_upload_decodes(client, placeholder_song, good_wav):
    """librosa 1.0 cannot open m4a directly; this covers the ffmpeg path."""
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        f.write(good_wav)
        wav_path = f.name
    m4a_path = wav_path.replace(".wav", ".m4a")
    try:
        subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error",
                        "-i", wav_path, "-c:a", "aac", m4a_path, "-y"], check=True)
        r = _post(client, open(m4a_path, "rb").read(), filename="take.m4a")
        assert r.status_code == 200, r.text
        assert r.json()["score"] > 70
    finally:
        for p in (wav_path, m4a_path):
            if os.path.exists(p):
                os.unlink(p)
