# 단어카드 스튜디오

Quizlet 스타일의 개인 단어 학습용 정적 웹앱입니다. GitHub Pages에 그대로 올리면 서버 없이 동작합니다.

## 주요 기능

- 카드학습: 단어 → 뜻, 뜻 → 단어 방향 선택, 카드 클릭/스페이스로 뒤집기
- 학습 상태: 알고 있음 / 학습 중 표시
- 퀴즈: 객관식 + 직접 입력, 오답만 다시 풀기
- 매칭게임: 단어와 뜻 짝 맞추기, 기록 타이머
- 단어관리: 직접 입력, 대량 붙여넣기, Excel/CSV/JSON 업로드, GitHub Gist Raw JSON 가져오기
- 학습세트 분리: 세트별로 필터링해서 누적 단어를 분리 학습
- 저장: 브라우저 localStorage 저장, JSON 백업 다운로드
- 모바일 대응: 스마트폰 카드형 UI

## GitHub Pages 배포

1. 이 폴더의 `index.html`, `style.css`, `app.js`, `data/words.json`를 저장소 루트에 업로드합니다.
2. GitHub 저장소에서 `Settings > Pages`로 이동합니다.
3. `Deploy from a branch`를 선택하고 `main / root`를 지정합니다.
4. 배포 URL에서 접속합니다.

## 엑셀 업로드 형식

첫 번째 시트의 첫 행은 최소 `term`, `meaning`만 있어도 됩니다.

- `audioSrc`가 비어 있으면 앱이 브라우저 TTS로 단어를 자동 발음합니다.
- 아래는 확장 열까지 포함한 권장 예시입니다.

| term | meaning | pronunciation | example | category | audioSrc |
|---|---|---|---|---|---|
| xin chào | 안녕하세요 | 씬 짜오 | Xin chào bạn. | 인사 | |

한글 헤더도 일부 자동 인식합니다.

- 단어 / 표현 → term
- 뜻 / 의미 → meaning
- 발음 / 발음힌트 → pronunciation
- 예문 / 문장 → example
- 카테고리 / 분류 → category
- 오디오 / 음성 → audioSrc

## 오디오 연결

`audioSrc`에 `audio/l1/word001.mp3` 또는 `.m4a` 같은 상대 경로를 넣으면 카드 화면의 `발음 듣기` 버튼에서 음성을 재생합니다. 값이 비어 있으면 브라우저 TTS로 단어를 읽습니다.

## MP3/M4A 자동 추가

문제재생 탭에서 쓰는 MP3/M4A는 GitHub Pages 안에서 직접 업로드할 수 있습니다.

1. 사이트 하단의 `음성 업로드` 또는 `admin.html`로 이동합니다.
2. GitHub fine-grained personal access token을 입력합니다.
3. 토픽 폴더명과 MP3/M4A 파일을 선택한 뒤 업로드합니다.
4. 파일은 `audio/{토픽폴더명}/{파일명}.mp3` 또는 `.m4a` 경로로 커밋됩니다.
5. GitHub Actions가 `tools/build_audio_topics.py`를 실행해 `data/audio-topics.json`을 자동 갱신합니다.

`tools/build_audio_topics.py`는 `audio/*.mp3`와 `audio/*.m4a`를 `문제 음성` 토픽으로 묶고, `audio/토픽폴더/*.mp3`와 `audio/토픽폴더/*.m4a`는 폴더별 토픽으로 묶습니다. 기존 `data/audio-topics.json`에 있는 다른 형식의 항목은 보존해 현재 문제 음성 재생 목록이 사라지지 않게 합니다. 파일 제목은 확장자와 앞 번호(`01_`, `01-`, `01.` 등)를 제거하고 `_`, `-`를 공백으로 바꿔 생성합니다.

## GitHub 토큰 권한

관리자 업로드용 토큰은 GitHub에서 fine-grained personal access token으로 만들고, 권한은 최소로 제한하세요.

- Repository access: `Only select repositories`에서 `dalmook/cardweb` 하나만 선택
- Repository permissions: `Contents`를 `Read and write`로 설정
- `Workflows: Read and write`는 API로 workflow 파일 자체를 수정할 때만 필요합니다. 일반 음성 업로드에는 필요하지 않습니다.

토큰은 절대 코드, README, 커밋, 이슈에 저장하지 마세요. `admin.html`은 토큰을 JS 코드에 넣지 않고 사용자가 직접 입력하게 하며, 브라우저 `sessionStorage`에만 임시 보관합니다.

## 주의

- 데이터는 사용자의 브라우저 localStorage에 저장됩니다. 다른 기기와 자동 동기화되지는 않습니다.
- 배포 후 데이터 백업은 `JSON 백업` 버튼으로 내려받아 보관하세요.
- Excel 업로드는 SheetJS CDN을 사용합니다. 사내망 등에서 CDN이 막히면 CSV/JSON 업로드 또는 대량 붙여넣기를 사용하세요.
