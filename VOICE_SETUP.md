# CampBuddy Voice (experimental)

Voice input is transcribed **locally** by faster-whisper (Whisper tiny.en, CPU/int8). The first recording needs the model cached: start the backend while online and make a first test recording before going offline. Later recordings run without internet if the model is cached.

## Install and run (Windows PowerShell)
```powershell
cd C:\Projects\CampBuddy\backend
python -m pip install faster-whisper
python -m uvicorn main:app --reload
```

Run Ollama as usual and start the React frontend from `frontend` with `npm install` then `npm run dev`.

## Usage
- Click the microphone in the prompt bar, allow access, speak, then click it again. CampBuddy transcribes your recording on the laptop and sends the recognized text to the existing Llama chat endpoint.
- **Voice on / Voice off** toggles spoken Llama answers. Playback uses your **browser's Web Speech synthesis and system voices**, not a cloud TTS API wired into CampBuddy. **Offline playback depends on an installed local voice and browser/OS support**.
- The existing Stop button cancels in-flight Llama requests and currently playing speech.
- Voice transcription is optimized for English; it is not real-time streaming or a wake-word assistant.
- Recording requires a secure browser context (localhost works). Audio is sent only to the local FastAPI backend.
- No medical or safety-critical information should be treated as validated based on voice output alone.
