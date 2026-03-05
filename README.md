# Whisper AI — Speech to Text

Local speech-to-text transcription powered by OpenAI Whisper with GPU acceleration.

## Quick Start

```bash
# 1. Create & activate virtual environment
cd /home/system04/.gemini/antigravity/scratch/whisper-ai
python3 -m venv venv
source venv/bin/activate

# 2. Install dependencies
pip install -r backend/requirements.txt

# 3. Run the server
python backend/app.py
```

Open **http://localhost:5000** in your browser.

## Features

- 🎤 Upload audio files or record from microphone
- 🌐 99+ language support with auto-detection
- 🔄 Translate any language to English
- ⚡ GPU-accelerated (CUDA) transcription
- 📝 Timestamp segments + SRT export
- ⚙️ Switch models (tiny → large) on the fly

## System Requirements

- Python 3.10+
- FFmpeg
- NVIDIA GPU (optional, for CUDA acceleration)

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/transcribe` | Upload audio for transcription |
| GET | `/api/models` | List available models |
| POST | `/api/config` | Load/switch model |
| GET | `/api/status` | System & model status |
