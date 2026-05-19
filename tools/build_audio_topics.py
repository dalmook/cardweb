import json
import re
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[1]
AUDIO_DIR = BASE_DIR / "audio"
OUT_FILE = BASE_DIR / "data" / "audio-topics.json"
SUPPORTED_AUDIO_EXTENSIONS = {".mp3", ".m4a"}


def natural_key(value):
    return [
        int(part) if part.isdigit() else part.casefold()
        for part in re.split(r"(\d+)", str(value))
    ]


def is_supported_audio(path):
    return path.is_file() and path.suffix.casefold() in SUPPORTED_AUDIO_EXTENSIONS


def clean_title(path):
    title = path.stem
    title = re.sub(r"^\s*\d+\s*[\._-]\s*", "", title)
    title = title.replace("_", " ").replace("-", " ")
    title = re.sub(r"\s+", " ", title).strip()
    return title or path.stem


def build_topic(topic_id, title, base_path, files):
    return {
        "id": topic_id,
        "title": title,
        "basePath": base_path,
        "files": [
            {
                "title": clean_title(file),
                "src": file.name,
            }
            for file in sorted(files, key=lambda file: natural_key(file.name))
        ],
    }


def load_existing_topics():
    if not OUT_FILE.exists():
        return []

    try:
        data = json.loads(OUT_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []

    if isinstance(data, list):
        return data

    topics = data.get("topics", []) if isinstance(data, dict) else []
    return topics if isinstance(topics, list) else []


def get_base_path(topic):
    if not isinstance(topic, dict):
        return ""

    return str(topic.get("basePath") or topic.get("path") or "").replace("\\", "/").strip("/")


def get_file_src(file_item):
    if isinstance(file_item, str):
        return file_item

    if isinstance(file_item, dict):
        return str(file_item.get("src") or file_item.get("path") or file_item.get("url") or "")

    return ""


def is_supported_audio_src(file_item):
    src = get_file_src(file_item).split("?", 1)[0].split("#", 1)[0]
    return Path(src).suffix.casefold() in SUPPORTED_AUDIO_EXTENSIONS


def merge_with_existing_topics(audio_topics):
    existing_topics = load_existing_topics()
    if not existing_topics:
        return audio_topics

    audio_by_base_path = {
        topic["basePath"].strip("/"): topic
        for topic in audio_topics
    }
    used_base_paths = set()
    merged_topics = []

    for existing_topic in existing_topics:
        if not isinstance(existing_topic, dict):
            continue

        base_path = get_base_path(existing_topic)
        files = existing_topic.get("files") or existing_topic.get("items") or []
        if not isinstance(files, list):
            files = []

        preserved_files = [file_item for file_item in files if not is_supported_audio_src(file_item)]
        generated_topic = audio_by_base_path.get(base_path)

        if generated_topic:
            used_base_paths.add(base_path)
            merged_files = preserved_files + generated_topic["files"]
            if merged_files:
                topic = dict(existing_topic)
                topic["id"] = str(topic.get("id") or generated_topic["id"])
                topic["title"] = str(topic.get("title") or topic.get("name") or generated_topic["title"])
                topic["basePath"] = base_path or generated_topic["basePath"]
                topic["files"] = merged_files
                topic.pop("items", None)
                merged_topics.append(topic)
            continue

        if preserved_files:
            topic = dict(existing_topic)
            topic["files"] = preserved_files
            topic.pop("items", None)
            merged_topics.append(topic)

    for topic in audio_topics:
        base_path = topic["basePath"].strip("/")
        if base_path not in used_base_paths:
            merged_topics.append(topic)

    return merged_topics


def display_path(path):
    try:
        return path.relative_to(BASE_DIR)
    except ValueError:
        return path


def collect_topics():
    if not AUDIO_DIR.exists():
        return []

    topics = []

    root_files = [path for path in AUDIO_DIR.iterdir() if is_supported_audio(path)]
    if root_files:
        topics.append(build_topic("problem-audio", "문제 음성", "audio", root_files))

    folders = [
        path
        for path in AUDIO_DIR.iterdir()
        if path.is_dir() and any(is_supported_audio(child) for child in path.iterdir())
    ]

    for folder in sorted(folders, key=lambda path: natural_key(path.name)):
        files = [path for path in folder.iterdir() if is_supported_audio(path)]
        topics.append(
            build_topic(
                folder.name,
                folder.name,
                f"audio/{folder.name}",
                files,
            )
        )

    return topics


def main():
    audio_topics = collect_topics()

    if not audio_topics and OUT_FILE.exists():
        print(f"No supported audio files found. Keeping existing {display_path(OUT_FILE)}")
        return

    topics = merge_with_existing_topics(audio_topics)

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(
        json.dumps({"topics": topics}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    file_count = sum(len(topic["files"]) for topic in topics)
    audio_count = sum(
        1
        for topic in topics
        for file_item in topic["files"]
        if is_supported_audio_src(file_item)
    )
    print(f"Generated {display_path(OUT_FILE)}: {len(topics)} topics, {file_count} files ({audio_count} audio)")


if __name__ == "__main__":
    main()
