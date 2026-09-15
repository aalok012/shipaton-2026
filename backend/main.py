"""Unison backend.

    GET  /health       -> {"ok": true}
    GET  /songs        -> songs without the heavy reference_midi arrays
    GET  /songs/{id}   -> one song, including reference_midi
    POST /score        -> multipart (audio, song_id) -> score dict
"""

import os
import json
import time
import asyncio
import logging
import tempfile
import contextlib
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from scoring import score_recording, ScoringError, SR, MIN_DURATION_SEC

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("unison")

SONGS_FILE = "songs.json"
SCORE_TIMEOUT_SEC = 30
MAX_UPLOAD_BYTES = 25 * 1024 * 1024

def _warm_pyin():
    """First pyin call in a process pays ~2.5s of numba JIT. Spend it at boot
    so the first real upload doesn't."""
    t = time.time()
    import librosa
    y = np.sin(2 * np.pi * 440 * np.arange(SR) / SR).astype(np.float32)
    librosa.pyin(y, fmin=librosa.note_to_hz("C2"),
                 fmax=librosa.note_to_hz("C7"), sr=SR, hop_length=512)
    log.info("pyin warmed in %.2fs", time.time() - t)


@asynccontextmanager
async def lifespan(app: FastAPI):
    _load_songs()
    asyncio.get_running_loop().run_in_executor(_pool, _warm_pyin)
    yield
    _pool.shutdown(wait=False)


app = FastAPI(title="Unison API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

_pool = ThreadPoolExecutor(max_workers=2)
_songs: list = []


def _load_songs():
    global _songs
    if not os.path.exists(SONGS_FILE):
        log.warning("%s not found - /songs will be empty. Run prep_songs.py.", SONGS_FILE)
        _songs = []
        return
    try:
        with open(SONGS_FILE) as f:
            _songs = json.load(f)
        log.info("loaded %d song(s) from %s", len(_songs), SONGS_FILE)
    except Exception as e:
        log.error("could not read %s: %s", SONGS_FILE, e)
        _songs = []


def _find(song_id):
    return next((s for s in _songs if s.get("id") == song_id), None)


def _summary(song):
    return {k: v for k, v in song.items() if k not in ("reference_midi", "source_file")}


def _err(status, message, **extra):
    """Every failure leaves through here, so the app always gets JSON."""
    return JSONResponse(status_code=status, content={"error": message, **extra})


@app.exception_handler(RequestValidationError)
async def _validation(request: Request, exc: RequestValidationError):
    """Keep the app's error parsing to a single shape: {"error": ...}."""
    missing = [
        ".".join(str(p) for p in e.get("loc", [])[1:])
        for e in exc.errors() if e.get("type") == "missing"
    ]
    if missing:
        return _err(422, f"Missing required field: {', '.join(missing)}")
    return _err(422, "That request wasn't valid.")


@app.exception_handler(Exception)
async def _unhandled(request: Request, exc: Exception):
    log.exception("unhandled error on %s", request.url.path)
    return _err(500, "Something went wrong scoring that take. Try again.")


@app.get("/health")
async def health():
    return {"ok": True, "songs": len(_songs)}


@app.get("/songs")
async def list_songs():
    return [_summary(s) for s in _songs]


@app.get("/songs/{song_id}")
async def get_song(song_id: str):
    song = _find(song_id)
    if song is None:
        return _err(404, f"Unknown song '{song_id}'",
                    available=[s.get("id") for s in _songs])
    return {k: v for k, v in song.items() if k != "source_file"}


@app.post("/score")
async def score(audio: UploadFile = File(...), song_id: str = Form(...)):
    song = _find(song_id)
    if song is None:
        return _err(404, f"Unknown song '{song_id}'",
                    available=[s.get("id") for s in _songs])

    reference_midi = song.get("reference_midi")
    if not reference_midi:
        return _err(422, "That song has no reference melody yet.")

    try:
        data = await audio.read()
    except Exception:
        return _err(400, "Could not read the uploaded file.")

    if not data:
        return _err(400, "The recording was empty. Try singing again.")
    if len(data) > MAX_UPLOAD_BYTES:
        return _err(413, "That recording is too large.")

    suffix = os.path.splitext(audio.filename or "")[1] or ".m4a"
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
            f.write(data)
            tmp = f.name

        log.info("scoring song=%s file=%s bytes=%d", song_id, audio.filename, len(data))
        started = time.time()
        try:
            result = await asyncio.wait_for(
                asyncio.get_event_loop().run_in_executor(
                    _pool, score_recording, tmp, reference_midi
                ),
                timeout=SCORE_TIMEOUT_SEC,
            )
        except asyncio.TimeoutError:
            log.error("scoring timed out after %ds (song=%s)", SCORE_TIMEOUT_SEC, song_id)
            return _err(504, "Scoring took too long. Try a shorter recording.")
        except ScoringError as e:
            log.info("rejected: %s", e)
            return _err(422, str(e))
        except Exception as e:
            log.exception("scoring failed")
            return _err(422, "Could not read that audio. Try recording again.")

        elapsed = time.time() - started
        log.info("scored song=%s score=%s in %.2fs", song_id, result.get("score"), elapsed)
        result["elapsed_sec"] = round(elapsed, 2)
        return result

    finally:
        if tmp and os.path.exists(tmp):
            with contextlib.suppress(OSError):
                os.unlink(tmp)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
