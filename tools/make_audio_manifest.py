import json
import re
from pathlib import Path

ROOT = Path("audio")
OUT = Path("data/audio-topics.json")

def natural_key(text):
    return [
        int(part) if part.isdigit() else part.lower()
        for part in re.split(r"(\d+)", str(text))
    ]

topics = []

for folder in sorted([p for p in ROOT.iterdir() if p.is_dir()], key=lambda p: natural_key(p.name)):
    files = sorted(folder.glob("*.m4a"), key=lambda p: natural_key(p.name))

    if not files:
        continue

    topic_no = re.search(r"\d+", folder.name)
    topic_id = f"topic-{int(topic_no.group()):02d}" if topic_no else folder.name.lower().replace(" ", "-")

    topics.append({
        "id": topic_id,
        "title": folder.name,
        "basePath": folder.as_posix(),
        "files": [
            {
                "title": f"문제 {i + 1}",
                "src": file.name
            }
            for i, file in enumerate(files)
        ]
    })

OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(
    json.dumps({"topics": topics}, ensure_ascii=False, indent=2),
    encoding="utf-8"
)

print(f"생성 완료: {OUT} / 토픽 {len(topics)}개")