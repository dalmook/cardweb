// 단어 순서 보정: 업로드/대량붙여넣기/Firebase 후 입력한 순서대로 유지
(function () {
  const toNum = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const getOrder = (word, fallbackIndex = 0) =>
    toNum(word?.order) ?? toNum(word?._order) ?? toNum(word?.createdOrder) ?? fallbackIndex;

  const normalizeOrder = () => {
    if (!Array.isArray(words)) return;
    words.forEach((word, index) => {
      if (!word) return;
      const order = getOrder(word, index);
      word.order = order;
      word._order = order;
    });
    words.sort((a, b) => getOrder(a, 0) - getOrder(b, 0));
  };

  const assignIncomingOrder = (items) => {
    const base = Array.isArray(words) && words.length
      ? Math.max(...words.map((word, index) => getOrder(word, index))) + 1
      : 0;
    (items || []).forEach((word, index) => {
      if (!word) return;
      const order = toNum(word.order) ?? toNum(word._order) ?? toNum(word.createdOrder) ?? base + index;
      word.order = order;
      word._order = order;
    });
    return items;
  };

  if (typeof normalizeWords === "function") {
    const originalNormalizeWords = normalizeWords;
    normalizeWords = function (rows) {
      return assignIncomingOrder(originalNormalizeWords(rows));
    };
  }

  if (typeof save === "function") {
    const originalSave = save;
    save = function (...args) {
      normalizeOrder();
      return originalSave.apply(this, args);
    };
  }

  if (typeof currentWords === "function") {
    currentWords = function () {
      normalizeOrder();
      return words.filter(w => activeCollection === "전체" || w.collection === activeCollection);
    };
  }

  if (typeof getByCategory === "function") {
    getByCategory = function (category) {
      return currentWords().filter(w => category === "전체" || w.category === category);
    };
  }

  if (typeof getCategoryRows === "function") {
    getCategoryRows = function (categoryName) {
      return currentWords().filter(w => {
        const cat = w.category || "기본";
        return categoryName === "전체" || cat === categoryName;
      });
    };
  }

  if (typeof mergeWords === "function") {
    const originalMergeWords = mergeWords;
    mergeWords = function (newWords) {
      assignIncomingOrder(newWords);
      const result = originalMergeWords.call(this, newWords);
      normalizeOrder();
      return result;
    };
  }

  if (typeof pullFromFirebase === "function") {
    const originalPullFromFirebase = pullFromFirebase;
    pullFromFirebase = async function (...args) {
      const result = await originalPullFromFirebase.apply(this, args);
      normalizeOrder();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(words));
      return result;
    };
  }

  if (typeof pushToFirebase === "function") {
    const originalPushToFirebase = pushToFirebase;
    pushToFirebase = function (...args) {
      normalizeOrder();
      return originalPushToFirebase.apply(this, args);
    };
  }

  if (typeof refreshAll === "function") {
    const originalRefreshAll = refreshAll;
    refreshAll = function (...args) {
      normalizeOrder();
      return originalRefreshAll.apply(this, args);
    };
  }

  normalizeOrder();
})();
