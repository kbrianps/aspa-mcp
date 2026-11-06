import json
import os
import sys

from faster_whisper import WhisperModel


def main():
    model_name = os.environ.get("ASPA_WHISPER_MODEL", "small")
    device = os.environ.get("ASPA_WHISPER_DEVICE", "cpu")
    compute_type = "int8" if device == "cpu" else "float16"
    model = WhisperModel(model_name, device=device, compute_type=compute_type, download_root=os.environ.get("ASPA_WHISPER_MODELS"))
    if sys.argv[1:] == ["--download-only"]:
        print(json.dumps({"ready": True, "model": model_name}))
        return
    results = []
    for path in sys.argv[1:]:
        segments, info = model.transcribe(path, language=os.environ.get("ASPA_WHISPER_LANGUAGE", "pt"), vad_filter=True)
        text = " ".join(segment.text.strip() for segment in segments).strip()
        results.append({"path": path, "language": info.language, "duration": round(info.duration, 1), "text": text})
    print(json.dumps(results, ensure_ascii=False))


if __name__ == "__main__":
    main()
