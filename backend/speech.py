"""Offline speech recognition with faster-whisper.
Install: pip install faster-whisper
First use downloads model; thereafter cached inference runs locally.
"""
from functools import lru_cache
from faster_whisper import WhisperModel

@lru_cache(maxsize=1)
def _model():
    return WhisperModel("tiny.en", device="cpu", compute_type="int8")

def transcribe_file(path: str) -> str:
    segments, _ = _model().transcribe(path, beam_size=3, vad_filter=True)
    return " ".join(segment.text.strip() for segment in segments).strip()
