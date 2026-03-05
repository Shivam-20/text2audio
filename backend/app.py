"""Flask API server for Whisper transcription."""

import os
import uuid
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from transcriber import WhisperTranscriber

app = Flask(__name__)
CORS(app)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
os.makedirs(UPLOAD_DIR, exist_ok=True)

MAX_FILE_SIZE = 25 * 1024 * 1024  # 25 MB
ALLOWED_EXTENSIONS = {
    "wav", "mp3", "m4a", "flac", "ogg", "webm", "mp4", "mpeg", "mpga", "oga", "wma", "aac"
}

# Global transcriber instance
transcriber = WhisperTranscriber()


def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ── Serve Frontend ──────────────────────────────────────────────────────────

@app.route("/")
def serve_index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(FRONTEND_DIR, path)


# ── API Routes ──────────────────────────────────────────────────────────────

@app.route("/api/models", methods=["GET"])
def list_models():
    """List available Whisper models with their specs."""
    return jsonify({
        "models": transcriber.AVAILABLE_MODELS,
        "current_model": transcriber.model_name,
    })


@app.route("/api/status", methods=["GET"])
def status():
    """Get current system and model status."""
    return jsonify(transcriber.get_status())


@app.route("/api/config", methods=["POST"])
def configure():
    """Load or switch the active Whisper model.

    JSON body:
        model: str — model name (tiny, base, small, medium, large)
        device: str — 'cuda', 'cpu', or 'auto'
    """
    data = request.get_json(force=True)
    model_name = data.get("model", "base")
    device = data.get("device", "auto")

    if model_name not in transcriber.AVAILABLE_MODELS:
        return jsonify({"error": f"Unknown model: {model_name}"}), 400

    try:
        result = transcriber.load_model(model_name, device)
        return jsonify(result)
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/transcribe", methods=["POST"])
def transcribe():
    """Transcribe an uploaded audio file.

    Form data:
        file: audio file
        language: (optional) ISO language code
        task: (optional) 'transcribe' or 'translate'
    """
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files["file"]
    if file.filename == "":
        return jsonify({"error": "Empty filename"}), 400

    if not allowed_file(file.filename):
        return jsonify({"error": f"Unsupported format. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}"}), 400

    # Check file size
    file.seek(0, 2)
    size = file.tell()
    file.seek(0)
    if size > MAX_FILE_SIZE:
        return jsonify({"error": f"File too large. Max {MAX_FILE_SIZE // (1024*1024)} MB"}), 400

    # Auto-load default model if none loaded
    if transcriber.model is None:
        try:
            transcriber.load_model("base", "auto")
        except Exception as e:
            return jsonify({"error": f"Failed to load model: {e}"}), 500

    # Save file
    ext = file.filename.rsplit(".", 1)[1].lower()
    save_name = f"{uuid.uuid4().hex}.{ext}"
    save_path = os.path.join(UPLOAD_DIR, save_name)

    try:
        file.save(save_path)

        language = request.form.get("language", None)
        task = request.form.get("task", "transcribe")
        target_language = request.form.get("target_language", None)

        if language == "" or language == "auto":
            language = None

        result = transcriber.transcribe(
            save_path, 
            language=language, 
            task=task,
            target_language=target_language
        )
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

    finally:
        # Cleanup uploaded file
        if os.path.exists(save_path):
            os.remove(save_path)


if __name__ == "__main__":
    print("🎙️  Whisper AI Server starting...")
    print("🔗  Open http://localhost:5000 in your browser")
    app.run(host="0.0.0.0", port=5000, debug=False)
