const STORAGE_KEY = "vocaStudioWords.v1";
let words = [];
let filtered = [];
let currentIndex = 0;
let onlyLearning = false;
let quizState = { items: [], index: 0, score: 0, wrong: [] };
let matchState = { first: null, pairsLeft: 0, startedAt: null, timer: null };
let activeCollection = "전체";
let editingWordId = null;

let firestore = null;
let firebaseBookId = "im1-shared";
let unsubscribeRealtime = null;
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBjQidqO3JxfDAEI5uRxops16vzI3szmNI",
  authDomain: "wordcard-319dd.firebaseapp.com",
  projectId: "wordcard-319dd",
  storageBucket: "wordcard-319dd.firebasestorage.app",
  messagingSenderId: "77378884403",
  appId: "1:77378884403:web:c56509464ae1cd0d4ba446",
  measurementId: "G-4RP9PE5NGM"
};

let firestore = null;
let firebaseBookId = "im1-shared";
let unsubscribeRealtime = null;
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBjQidqO3JxfDAEI5uRxops16vzI3szmNI",
  authDomain: "wordcard-319dd.firebaseapp.com",
  projectId: "wordcard-319dd",
  storageBucket: "wordcard-319dd.firebasestorage.app",
  messagingSenderId: "77378884403",
  appId: "1:77378884403:web:c56509464ae1cd0d4ba446",
  measurementId: "G-4RP9PE5NGM"
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const uid = () => `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const clean = (value) => String(value ?? "").trim();
const escapeHtml = (value) => clean(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const shuffle = (arr) => [...arr].sort(() => Math.random() - 0.5);

function toast(message) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

async function init() {
  bindEvents();
  await tryInitFirebase(false);

  if (firestore) {
    await pullFromFirebase();
    refreshAll();
    return;
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    words = normalizeWords(JSON.parse(saved));
    refreshAll();
    return;
  }

  try {
    const res = await fetch("data/words.json");
    if (!res.ok) throw new Error(`sample data not found: ${res.status}`);
    words = normalizeWords(await res.json());
    save();
  } catch (err) {
    console.warn("초기 샘플 데이터를 불러오지 못했습니다.", err);
    words = [];
    toast("샘플 파일 없이 시작합니다. 바로 단어를 추가해 주세요.");
  }

  refreshAll();
}

function normalizeWords(rows) {
  return rows
    .map(row => ({
      id: row.id || uid(),
      term: clean(row.term || row["단어"] || row["표현"] || row["word"] || row["vocab"]),
      meaning: clean(row.meaning || row["뜻"] || row["의미"] || row["definition"] || row["mean"]),
      pronunciation: clean(row.pronunciation || row["발음"] || row["발음힌트"] || row["pron"]),
      example: clean(row.example || row["예문"] || row["문장"] || row["sentence"]),
      collection: clean(row.collection || row["학습세트"] || row["세트"] || row["묶음"] || "기본세트"),
      category: clean(row.category || row["카테고리"] || row["분류"] || row["deck"] || "기본"),
      audioSrc: clean(row.audioSrc || row.audio || row["오디오"] || row["음성"]),
      status: row.status === "known" || row["상태"] === "known" || row["상태"] === "알고있음" ? "known" : "learning"
    }))
    .filter(row => row.term && row.meaning);
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
  if (firestore) pushToFirebase();
}

function bindEvents() {
  $$("[data-tab]").forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));
  $("#flashcard").addEventListener("click", flipCard);
  $("#flashcard").addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") flipCard(); });
  $("#nextCard").addEventListener("click", nextCard);
  $("#prevCard").addEventListener("click", prevCard);
  $("#btnShuffle").addEventListener("click", () => { filtered = shuffle(filtered); currentIndex = 0; renderCard(); });
  $("#btnOnlyLearning").addEventListener("click", () => { onlyLearning = !onlyLearning; refreshCardFilter(); });
  $("#studyDirection").addEventListener("change", renderCard);
  $("#cardCategory").addEventListener("change", refreshCardFilter);
  $("#markKnown").addEventListener("click", () => setStatus("known"));
  $("#markLearning").addEventListener("click", () => setStatus("learning"));
  $("#btnSpeak").addEventListener("click", playCurrentAudio);
  $("#startQuiz").addEventListener("click", startQuiz);
  $("#quizCategory").addEventListener("change", () => $("#quizBox").textContent = "퀴즈 시작 버튼을 누르면 문제가 생성됩니다.");
  $("#startMatch").addEventListener("click", startMatch);
  $("#fileImport").addEventListener("change", importFile);
  $("#downloadTemplate").addEventListener("click", downloadTemplate);
  $("#loadSample").addEventListener("click", loadSample);
  $("#loadIm1Required").addEventListener("click", loadIm1Required);
  $("#clearAll").addEventListener("click", clearAll);
  $("#addWord").addEventListener("click", addWordFromForm);
  $("#importBulk").addEventListener("click", importBulk);
  $("#searchWords").addEventListener("input", renderWordList);
  $("#activeCollection").addEventListener("change", (e) => { activeCollection = e.target.value; refreshAll(); });
  $("#importGist").addEventListener("click", importFromGist);
  $("#btnExportJson").addEventListener("click", exportJson);
  $("#syncFirebase").addEventListener("click", async () => { await pullFromFirebase(); refreshAll(); toast("Firebase에서 최신 단어장을 불러왔어요."); });
  $("#closeEditModal").addEventListener("click", closeEditModal);
  $("#saveWordEdit").addEventListener("click", saveWordEdit);
  $("#copyToCategory").addEventListener("click", copyWordToCategory);
  $("#moveToCategory").addEventListener("click", moveWordToCategory);
  $("#deleteWordInModal").addEventListener("click", deleteWordInModal);
  document.addEventListener("keydown", handleShortcuts);
}

function openTab(tabName) {
  $$(".tab").forEach(btn => btn.classList.toggle("active", btn.dataset.tab === tabName));
  $$(".panel").forEach(panel => panel.classList.remove("active"));
  $(`#panel-${tabName}`).classList.add("active");
}

function refreshAll() {
  renderCollectionOptions();
  renderStats();
  renderCategoryOptions();
  refreshCardFilter();
  renderWordList();
}

function collections() {
  return ["전체", ...new Set(words.map(w => w.collection || "기본세트"))];
}

function currentWords() {
  return words.filter(w => activeCollection === "전체" || w.collection === activeCollection);
}

function categories() {
  return ["전체", ...new Set(currentWords().map(w => w.category || "기본"))];
}

function renderCollectionOptions() {
  const sel = $("#activeCollection");
  const opts = collections().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  sel.innerHTML = opts;
  if (!collections().includes(activeCollection)) activeCollection = "전체";
  sel.value = activeCollection;
}

function renderCategoryOptions() {
  const html = categories().map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
  ["#cardCategory", "#quizCategory", "#matchCategory"].forEach(sel => $(sel).innerHTML = html);
}

function renderStats() {
  const pool = currentWords();
  $("#statTotal").textContent = pool.length;
  $("#statKnown").textContent = pool.filter(w => w.status === "known").length;
  $("#statLearning").textContent = pool.filter(w => w.status !== "known").length;
  $("#statCategories").textContent = new Set(pool.map(w => w.category || "기본")).size;
}

function getByCategory(category) {
  return currentWords().filter(w => category === "전체" || w.category === category);
}

function refreshCardFilter() {
  const category = $("#cardCategory").value || "전체";
  filtered = getByCategory(category).filter(w => !onlyLearning || w.status !== "known");
  currentIndex = Math.min(currentIndex, Math.max(filtered.length - 1, 0));
  $("#btnOnlyLearning").textContent = onlyLearning ? "전체 보기" : "학습 중만";
  renderCard();
}

function renderCard() {
  const card = $("#flashcard");
  card.classList.remove("flipped");
  if (!filtered.length) {
    $("#cardMeta").textContent = "0 / 0";
    $("#cardFront").textContent = "카드가 없습니다";
    $("#cardHint").textContent = "단어관리에서 단어를 추가하세요.";
    $("#cardBack").textContent = "-";
    $("#cardExample").textContent = "-";
    $("#cardProgress").style.width = "0%";
    return;
  }
  const item = filtered[currentIndex];
  const direction = $("#studyDirection").value;
  const front = direction === "term" ? item.term : item.meaning;
  const back = direction === "term" ? item.meaning : item.term;
  $("#cardMeta").textContent = `${currentIndex + 1} / ${filtered.length} · ${item.category || "기본"} · ${item.status === "known" ? "알고 있음" : "학습 중"}`;
  $("#cardFront").textContent = front;
  $("#cardHint").textContent = item.pronunciation ? `발음 힌트: ${item.pronunciation}` : "카드를 누르면 뒤집힙니다.";
  $("#cardBack").textContent = back;
  $("#cardExample").textContent = item.example || "예문이 없습니다.";
  $("#cardProgress").style.width = `${((currentIndex + 1) / filtered.length) * 100}%`;
}

function flipCard() { $("#flashcard").classList.toggle("flipped"); }
function nextCard() { if (filtered.length) { currentIndex = (currentIndex + 1) % filtered.length; renderCard(); } }
function prevCard() { if (filtered.length) { currentIndex = (currentIndex - 1 + filtered.length) % filtered.length; renderCard(); } }

function setStatus(status) {
  if (!filtered.length) return;
  const item = filtered[currentIndex];
  const target = words.find(w => w.id === item.id);
  if (target) target.status = status;
  save();
  refreshAll();
  toast(status === "known" ? "알고 있음으로 표시했어요" : "학습 중으로 표시했어요");
}

function playCurrentAudio() {
  if (!filtered.length) return;
  const item = filtered[currentIndex];
  if (item.audioSrc) {
    new Audio(item.audioSrc).play().catch(() => fallbackSpeak(item));
  } else {
    fallbackSpeak(item);
  }
}

function detectSpeechLang(text) {
  if (/[가-힣]/.test(text)) return "ko-KR";
  if (/[぀-ヿ]/.test(text)) return "ja-JP";
  if (/[一-鿿]/.test(text)) return "zh-CN";
  if (/[a-zA-Z]/.test(text)) return "en-US";
  return "ko-KR";
}

function fallbackSpeak(item) {
  if (!window.speechSynthesis) return toast("이 브라우저는 음성 읽기를 지원하지 않아요.");
  const utter = new SpeechSynthesisUtterance(item.term);
  utter.lang = detectSpeechLang(item.term);
  speechSynthesis.cancel();
  speechSynthesis.speak(utter);
}

function startQuiz() {
  const pool = shuffle(getByCategory($("#quizCategory").value || "전체"));
  if (pool.length < 4) return toast("퀴즈는 최소 4개 단어가 필요해요.");
  quizState = { items: pool.slice(0, Math.min(10, pool.length)), index: 0, score: 0, wrong: [] };
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const box = $("#quizBox");
  if (quizState.index >= quizState.items.length) {
    box.innerHTML = `
      <div class="quiz-question">
        <h3>퀴즈 완료 🎉</h3>
        <p>점수: <b>${quizState.score}</b> / ${quizState.items.length}</p>
        <p>오답: ${quizState.wrong.length ? quizState.wrong.map(w => escapeHtml(w.term)).join(", ") : "없음"}</p>
        <button class="primary" id="retryWrong">오답만 다시 보기</button>
      </div>`;
    $("#retryWrong").addEventListener("click", () => {
      if (!quizState.wrong.length) return toast("오답이 없어요. 깔끔합니다!");
      quizState = { items: shuffle(quizState.wrong), index: 0, score: 0, wrong: [] };
      renderQuizQuestion();
    });
    return;
  }
  const item = quizState.items[quizState.index];
  const pool = currentWords();
  const options = shuffle([item, ...shuffle(pool.filter(w => w.id !== item.id)).slice(0, 3)]);
  box.innerHTML = `
    <div class="quiz-question">
      <p class="pill">${quizState.index + 1} / ${quizState.items.length}</p>
      <h3>${escapeHtml(item.term)}</h3>
      <p>${escapeHtml(item.pronunciation || "맞는 뜻을 골라보세요.")}</p>
      <div class="answer-grid">
        ${options.map(opt => `<button class="answer-btn" data-id="${opt.id}">${escapeHtml(opt.meaning)}</button>`).join("")}
      </div>
      <div class="write-row">
        <input id="writeAnswer" placeholder="직접 뜻을 입력해도 됩니다" />
        <button id="checkWrite">입력 확인</button>
      </div>
    </div>`;
  $$(".answer-btn").forEach(btn => btn.addEventListener("click", () => gradeChoice(btn, item)));
  $("#checkWrite").addEventListener("click", () => gradeWrite(item));
  $("#writeAnswer").addEventListener("keydown", e => { if (e.key === "Enter") gradeWrite(item); });
}

function gradeChoice(btn, item) {
  const correct = btn.dataset.id === item.id;
  $$(".answer-btn").forEach(b => {
    b.disabled = true;
    if (b.dataset.id === item.id) b.classList.add("correct");
  });
  if (!correct) {
    btn.classList.add("wrong");
    quizState.wrong.push(item);
  } else {
    quizState.score++;
  }
  setTimeout(() => { quizState.index++; renderQuizQuestion(); }, 850);
}

function gradeWrite(item) {
  const answer = clean($("#writeAnswer").value).toLowerCase();
  if (!answer) return;
  const accepted = item.meaning.toLowerCase().includes(answer) || answer.includes(item.meaning.toLowerCase());
  if (accepted) quizState.score++; else quizState.wrong.push(item);
  toast(accepted ? "정답에 가까워요" : `정답: ${item.meaning}`);
  setTimeout(() => { quizState.index++; renderQuizQuestion(); }, 700);
}

function startMatch() {
  const pool = shuffle(getByCategory($("#matchCategory").value || "전체")).slice(0, 6);
  if (pool.length < 3) return toast("매칭게임은 최소 3개 단어가 필요해요.");
  clearInterval(matchState.timer);
  matchState = { first: null, pairsLeft: pool.length, startedAt: Date.now(), timer: null };
  const cards = shuffle(pool.flatMap(item => [
    { id: `${item.id}-t`, pair: item.id, type: "term", text: item.term },
    { id: `${item.id}-m`, pair: item.id, type: "meaning", text: item.meaning }
  ]));
  $("#matchGrid").innerHTML = cards.map(card => `<button class="match-card" data-pair="${card.pair}" data-type="${card.type}">${escapeHtml(card.text)}</button>`).join("");
  $$(".match-card").forEach(card => card.addEventListener("click", () => selectMatch(card)));
  $("#matchResult").textContent = "짝을 찾아보세요.";
  tickMatchTimer();
  matchState.timer = setInterval(tickMatchTimer, 1000);
}

function selectMatch(card) {
  if (card.classList.contains("matched")) return;
  card.classList.add("selected");
  if (!matchState.first) {
    matchState.first = card;
    return;
  }
  const first = matchState.first;
  if (first === card) return;
  const isPair = first.dataset.pair === card.dataset.pair && first.dataset.type !== card.dataset.type;
  if (isPair) {
    first.classList.add("matched");
    card.classList.add("matched");
    matchState.pairsLeft--;
    matchState.first = null;
    if (matchState.pairsLeft === 0) {
      clearInterval(matchState.timer);
      $("#matchResult").textContent = `완료! 기록 ${$("#matchTimer").textContent}`;
    }
  } else {
    setTimeout(() => {
      first.classList.remove("selected");
      card.classList.remove("selected");
      matchState.first = null;
    }, 450);
  }
}

function tickMatchTimer() {
  const elapsed = Math.floor((Date.now() - matchState.startedAt) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const s = String(elapsed % 60).padStart(2, "0");
  $("#matchTimer").textContent = `${m}:${s}`;
}

async function importFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  const ext = file.name.split(".").pop().toLowerCase();
  try {
    let rows = [];
    if (ext === "json") rows = JSON.parse(await file.text());
    else if (ext === "csv") rows = parseCsv(await file.text());
    else rows = await parseExcel(file);
    mergeWords(normalizeWords(rows));
    event.target.value = "";
  } catch (err) {
    console.error(err);
    toast("파일을 읽지 못했어요. 헤더/형식을 확인해 주세요.");
  }
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headers = lines.shift().split(",").map(clean);
  return lines.map(line => {
    const cols = line.split(",");
    return Object.fromEntries(headers.map((h, i) => [h, cols[i] || ""]));
  });
}

function parseExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: "array" });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(XLSX.utils.sheet_to_json(sheet, { defval: "" }));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function mergeWords(newRows) {
  if (!newRows.length) return toast("가져올 단어가 없습니다.");
  const key = row => `${row.term}|||${row.meaning}`.toLowerCase();
  const existing = new Set(words.map(key));
  const unique = newRows
    .filter(row => !existing.has(key(row)))
    .map(row => ({ ...row, collection: row.collection || (activeCollection === "전체" ? "기본세트" : activeCollection) }));
  words = [...words, ...unique];
  save();
  refreshAll();
  toast(`${unique.length}개 단어를 추가했어요.`);
}

function downloadTemplate() {
  const rows = [
    { term: "xin chào", meaning: "안녕하세요", pronunciation: "씬 짜오", example: "Xin chào bạn.", category: "인사", audioSrc: "" },
    { term: "cảm ơn", meaning: "감사합니다", pronunciation: "깜 언", example: "Cảm ơn anh.", category: "인사", audioSrc: "" }
  ];
  if (window.XLSX) {
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "words");
    XLSX.writeFile(wb, "voca_template.xlsx");
  } else {
    downloadBlob("term,meaning,pronunciation,example,category,audioSrc\n", "voca_template.csv", "text/csv");
  }
}

function loadSample() {
  fetch("data/words.json")
    .then(r => { if (!r.ok) throw new Error("sample data missing"); return r.json(); })
    .then(rows => mergeWords(normalizeWords(rows)))
    .catch(() => toast("예시 데이터를 찾지 못했어요. 파일 경로를 확인해 주세요."));
}

function clearAll() {
  if (!confirm("정말 전체 단어를 삭제할까요? JSON 백업을 먼저 권장합니다.")) return;
  words = [];
  save();
  refreshAll();
}

function addWordFromForm() {
  const row = normalizeWords([{
    term: $("#inpTerm").value,
    meaning: $("#inpMeaning").value,
    pronunciation: $("#inpPron").value,
    collection: $("#inpCollection").value || activeCollection || "기본세트",
    category: $("#inpCategory").value || "직접입력",
    example: $("#inpExample").value,
    audioSrc: $("#inpAudio").value
  }])[0];
  if (!row) return toast("단어와 뜻은 꼭 입력해야 해요.");
  mergeWords([row]);
  ["#inpTerm", "#inpMeaning", "#inpPron", "#inpCollection", "#inpCategory", "#inpExample", "#inpAudio"].forEach(sel => $(sel).value = "");
}

function importBulk() {
  const text = $("#bulkText").value.trim();
  if (!text) return;
  const rows = text.split(/\r?\n/).map(line => {
    const [term, meaning, pronunciation, example, category, audioSrc, collection] = line.split("\t");
    return { term, meaning, pronunciation, example, category, audioSrc, collection };
  });
  mergeWords(normalizeWords(rows));
  $("#bulkText").value = "";
}

function renderWordList() {
  const q = clean($("#searchWords")?.value).toLowerCase();
  const rows = currentWords().filter(w => !q || [w.term, w.meaning, w.category, w.collection, w.example].join(" ").toLowerCase().includes(q));
  const list = $("#wordList");
  list.innerHTML = "";
  if (!rows.length) {
    list.innerHTML = `<div class="empty-state">표시할 단어가 없습니다.</div>`;
    return;
  }
  const tpl = $("#wordRowTemplate");
  rows.forEach(w => {
    const node = tpl.content.cloneNode(true);
    node.querySelector(".word-term").textContent = w.term;
    node.querySelector(".word-meaning").textContent = w.meaning;
    node.querySelector(".word-extra").textContent = `${w.collection || "기본세트"} / ${w.category || "기본"}${w.pronunciation ? " · " + w.pronunciation : ""}${w.example ? " · " + w.example : ""}`;
    node.querySelector(".edit-word").addEventListener("click", () => editWord(w.id));
    const toggle = node.querySelector(".toggle-status");
    toggle.textContent = w.status === "known" ? "알고 있음" : "학습 중";
    toggle.addEventListener("click", () => {
      w.status = w.status === "known" ? "learning" : "known";
      save(); refreshAll();
    });
    node.querySelector(".delete-word").addEventListener("click", () => {
      words = words.filter(item => item.id !== w.id);
      save(); refreshAll();
    });
    list.appendChild(node);
  });
}


function editWord(id) {
  const target = words.find(w => w.id === id);
  if (!target) return;
  editingWordId = id;
  $("#editTerm").value = target.term;
  $("#editMeaning").value = target.meaning;
  $("#editPron").value = target.pronunciation || "";
  $("#editExample").value = target.example || "";
  $("#editCollection").value = target.collection || "기본세트";
  $("#editCategory").value = target.category || "기본";
  ["#chkTerm", "#chkMeaning", "#chkPron", "#chkExample", "#chkCollection", "#chkCategory"].forEach(sel => $(sel).checked = false);
  $("#editModal").classList.add("open");
  $("#editModal").setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  editingWordId = null;
  $("#editModal").classList.remove("open");
  $("#editModal").setAttribute("aria-hidden", "true");
}

function getEditingWord() {
  return words.find(w => w.id === editingWordId);
}

function saveWordEdit() {
  const target = getEditingWord();
  if (!target) return;
  if ($("#chkTerm").checked) target.term = clean($("#editTerm").value);
  if ($("#chkMeaning").checked) target.meaning = clean($("#editMeaning").value);
  if ($("#chkPron").checked) target.pronunciation = clean($("#editPron").value);
  if ($("#chkExample").checked) target.example = clean($("#editExample").value);
  if ($("#chkCollection").checked) target.collection = clean($("#editCollection").value) || "기본세트";
  if ($("#chkCategory").checked) target.category = clean($("#editCategory").value) || "기본";
  if (!target.term || !target.meaning) return toast("단어와 뜻은 비워둘 수 없어요.");
  save(); refreshAll(); toast("선택 항목만 수정했어요.");
}

function copyWordToCategory() {
  const target = getEditingWord();
  if (!target) return;
  const category = clean($("#editCategory").value);
  if (!category) return toast("복사할 카테고리를 입력해 주세요.");
  const copied = { ...target, id: uid(), category, status: "learning" };
  words.push(copied);
  save(); refreshAll(); toast(`${target.term} 단어를 ${category} 카테고리로 복사했어요.`);
}

function moveWordToCategory() {
  const target = getEditingWord();
  if (!target) return;
  const category = clean($("#editCategory").value);
  if (!category) return toast("이동할 카테고리를 입력해 주세요.");
  target.category = category;
  save(); refreshAll(); toast(`${target.term} 단어를 ${category}로 이동했어요.`);
}

function deleteWordInModal() {
  const target = getEditingWord();
  if (!target) return;
  if (!confirm(`'${target.term}' 단어를 삭제할까요?`)) return;
  words = words.filter(w => w.id !== target.id);
  save(); refreshAll(); closeEditModal(); toast("단어를 삭제했어요.");
}

function exportJson() {
  downloadBlob(JSON.stringify(words, null, 2), `voca-backup-${new Date().toISOString().slice(0,10)}.json`, "application/json");
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function importFromGist() {
  const url = clean($("#gistUrl").value);
  if (!url) return toast("Gist Raw URL을 입력해 주세요.");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("failed");
    const rows = normalizeWords(JSON.parse(await res.text()));
    mergeWords(rows);
    toast("Gist 데이터를 가져왔어요.");
  } catch (e) {
    toast("Gist JSON을 읽지 못했어요. Raw URL인지 확인해 주세요.");
  }
}

function handleShortcuts(e) {
  if (!$("#panel-cards").classList.contains("active")) return;
  if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) return;
  if (e.key === "ArrowRight") nextCard();
  if (e.key === "ArrowLeft") prevCard();
  if (e.key === " ") { e.preventDefault(); flipCard(); }
}



async function loadIm1Required() {
  try {
    const res = await fetch("data/im1-required.json");
    if (!res.ok) throw new Error(String(res.status));
    const required = normalizeWords(await res.json());
    if (!required.length) return toast("IM1 필수 단어 JSON이 비어 있어요.");

    const existingTerms = new Set(words.map(w => clean(w.term).toLowerCase()));
    const missing = required.filter(w => !existingTerms.has(clean(w.term).toLowerCase()));

    words = [...words, ...missing];
    save();
    refreshAll();

    if (!missing.length) {
      renderIm1Missing([]);
      return toast("이미 IM1 필수 단어가 모두 등록되어 있어요.");
    }

    renderIm1Missing(missing);
    toast(`IM1 필수 ${missing.length}개를 추가했어요. 빈 뜻은 바로 입력해 주세요.`);
  } catch (err) {
    console.error(err);
    toast("IM1 필수 JSON을 불러오지 못했어요.");
  }
}

function renderIm1Missing(items) {
  const box = $("#im1MissingBox");
  if (!items.length) {
    box.style.display = "none";
    box.innerHTML = "";
    return;
  }

  box.style.display = "block";
  box.innerHTML = `
    <h3 style="margin:0 0 8px;">IM1 추가 단어 빠른 보정</h3>
    <p style="margin:0 0 8px;">뜻이 비어 있거나 수정이 필요한 단어는 아래에서 바로 입력하세요.</p>
    <div class="form-grid">
      ${items.map(item => `
        <div>
          <label>${escapeHtml(item.term)}</label>
          <input data-im1-id="${item.id}" class="im1-meaning" placeholder="뜻 직접 입력" value="${escapeHtml(item.meaning)}" />
        </div>
      `).join("")}
    </div>
    <button id="saveIm1Meanings" class="primary">IM1 뜻 저장</button>
  `;

  $("#saveIm1Meanings").addEventListener("click", () => {
    $$(".im1-meaning").forEach(inp => {
      const target = words.find(w => w.id === inp.dataset.im1Id);
      if (target) target.meaning = clean(inp.value);
    });
    words = words.filter(w => w.term && w.meaning);
    save();
    refreshAll();
    renderIm1Missing([]);
    toast("IM1 단어 뜻을 저장했어요.");
  });
}






async function tryInitFirebase(showToast = true) {
  if (!window.firebase) {
    if (showToast) toast("Firebase SDK를 불러오지 못했어요.");
    return false;
  }
  if (!FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === "YOUR_API_KEY") {
    $("#firebaseState").textContent = "apiKey 필요";
    if (showToast) toast("app.js의 FIREBASE_CONFIG.apiKey를 입력해 주세요.");
    return false;
  }
  const appName = `voca-${FIREBASE_CONFIG.projectId}`;
  const app = firebase.apps.find(a => a.name === appName) || firebase.initializeApp(FIREBASE_CONFIG, appName);
  firestore = firebase.firestore(app);
  $("#firebaseState").textContent = "실시간 연결됨";
  bindRealtimeSync();
  if (showToast) toast("Firebase 자동 연결 완료");
  return true;
}

function bindRealtimeSync() {
  if (!firestore || unsubscribeRealtime) return;
  unsubscribeRealtime = firestore.collection("wordbooks").doc(firebaseBookId).collection("words")
    .onSnapshot((snap) => {
      words = normalizeWords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      refreshAll();
    }, () => toast("Firebase 실시간 수신에 실패했어요."));
}


async function pullFromFirebase() {
  if (!firestore || !firebaseBookId) return;
  const snap = await firestore.collection("wordbooks").doc(firebaseBookId).collection("words").get();
  words = normalizeWords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
}

async function pushToFirebase() {
  if (!firestore || !firebaseBookId) return;
  const colRef = firestore.collection("wordbooks").doc(firebaseBookId).collection("words");
  const existing = await colRef.get();
  const existingIds = new Set(existing.docs.map(d => d.id));
  const currentIds = new Set(words.map(w => w.id));
  const batch = firestore.batch();
  words.forEach(w => batch.set(colRef.doc(w.id), w));
  existingIds.forEach(id => { if (!currentIds.has(id)) batch.delete(colRef.doc(id)); });
  await batch.commit();
}

init();
