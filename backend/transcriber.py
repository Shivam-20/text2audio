"""Whisper transcription engine wrapper."""

import time
import torch
import whisper
from deep_translator import GoogleTranslator


class WhisperTranscriber:
    """Wraps OpenAI Whisper model for transcription and translation."""

    AVAILABLE_MODELS = {
        "tiny":   {"params": "39M",  "vram": "~1 GB",  "relative_speed": "~32x"},
        "base":   {"params": "74M",  "vram": "~1 GB",  "relative_speed": "~16x"},
        "small":  {"params": "244M", "vram": "~2 GB",  "relative_speed": "~6x"},
        "medium": {"params": "769M", "vram": "~5 GB",  "relative_speed": "~2x"},
        "large":  {"params": "1550M","vram": "~10 GB", "relative_speed": "~1x"},
    }

    def __init__(self):
        self.model = None
        self.model_name = None
        self.device = None

    def get_device_info(self):
        """Return info about available compute devices."""
        cuda_available = torch.cuda.is_available()
        info = {
            "cuda_available": cuda_available,
            "device_in_use": str(self.device) if self.device else None,
        }
        if cuda_available:
            info["gpu_name"] = torch.cuda.get_device_name(0)
            info["gpu_memory_total_mb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e6)
            info["gpu_memory_allocated_mb"] = round(torch.cuda.memory_allocated(0) / 1e6)
            info["gpu_memory_reserved_mb"] = round(torch.cuda.memory_reserved(0) / 1e6)
        return info

    def load_model(self, model_name: str = "base", device: str = "auto"):
        """Load a Whisper model onto the specified device.

        Args:
            model_name: One of tiny, base, small, medium, large.
            device: 'cuda', 'cpu', or 'auto' (GPU if available).
        """
        if device == "auto":
            device = "cuda" if torch.cuda.is_available() else "cpu"

        # Skip reload if same model/device
        if self.model and self.model_name == model_name and str(self.device) == device:
            return {"status": "already_loaded", "model": model_name, "device": device}

        # Free previous model
        if self.model is not None:
            del self.model
            self.model = None
            if torch.cuda.is_available():
                torch.cuda.empty_cache()

        start = time.time()
        self.model = whisper.load_model(model_name, device=device)
        self.model_name = model_name
        self.device = device
        load_time = round(time.time() - start, 2)

        return {
            "status": "loaded",
            "model": model_name,
            "device": device,
            "load_time_seconds": load_time,
        }

    def transcribe(self, audio_path: str, language: str = None, task: str = "transcribe", target_language: str = None):
        """Transcribe or translate an audio file.

        Args:
            audio_path: Path to the audio file.
            language: ISO language code or None for auto-detection.
            task: 'transcribe', 'translate' (Whisper to English), or 'translate-other' (Deep Translator).
            target_language: ISO code for deep-translator.

        Returns:
            dict with text, segments, language, and timing info.
        """
        if self.model is None:
            raise RuntimeError("No model loaded. Call load_model() first.")

        options = {"task": task}
        if language:
            options["language"] = language

        # Fix for GTX 16xx series GPUs (NaN errors during FP16 inference)
        options["fp16"] = False

        start = time.time()
        result = self.model.transcribe(audio_path, **options)
        
        # Translate to other languages using deep-translator if requested
        if task == "translate-other" and target_language:
            translator = GoogleTranslator(source='auto', target=target_language)
            result["text"] = translator.translate(result["text"])
            for seg in result.get("segments", []):
                seg["text"] = translator.translate(seg["text"])

        elapsed = round(time.time() - start, 2)

        segments = []
        for seg in result.get("segments", []):
            segments.append({
                "id": seg["id"],
                "start": round(seg["start"], 2),
                "end": round(seg["end"], 2),
                "text": seg["text"].strip(),
            })

        return {
            "text": result["text"].strip(),
            "language": target_language if task == "translate-other" else result.get("language", "unknown"),
            "segments": segments,
            "processing_time_seconds": elapsed,
            "model": self.model_name,
            "device": str(self.device),
        }

    def get_status(self):
        """Return current model status."""
        status = {
            "model_loaded": self.model is not None,
            "model_name": self.model_name,
            "device": str(self.device) if self.device else None,
        }
        status.update(self.get_device_info())
        return status
