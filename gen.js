/*
 * 자모 점프 실시간 문제 생성기
 * 판을 무작위로 만들고, 친숙한 단어로 풀어서 난이도 조건에 맞으면 채택한다.
 * 같은 시드면 어느 기기에서나 같은 문제가 나온다 (오늘의 도전).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./engine.js'));
  else root.JamoGen = factory(root.HangulHide);
})(typeof self !== 'undefined' ? self : this, function (H) {
  const CONS = H.BOARD_CONSONANTS;

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hashSeed(str) {
    let h = 2166136261;
    for (const ch of str) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
  const between = (lo, hi, rng) => lo + Math.floor(rng() * (hi - lo + 1));
  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function normalize(tiles, start, goal) {
    const minX = Math.min(...tiles.map((t) => t.x)), minY = Math.min(...tiles.map((t) => t.y));
    tiles.forEach((t) => { t.x -= minX; t.y -= minY; });
    return { tiles, start: [start.x, start.y], goal: [goal.x, goal.y] };
  }

  // ---------- 판 모양 ----------
  function scatter(rng, n, w, h, dup, goalC) {
    const cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
    const pos = shuffle(cells, rng).slice(0, n);
    const pool = shuffle(CONS, rng).slice(0, dup ? Math.max(2, n - 2) : n);
    const tiles = pos.map(([x, y], i) => ({ x, y, c: dup ? pick(pool, rng) : pool[i] }));
    const goal = tiles[n - 1];
    if (!goalC) goal.c = null;
    return normalize(tiles, tiles[0], goal);
  }
  function line(rng, n) {
    const cons = shuffle(CONS, rng).slice(0, n - 1);
    const tiles = cons.map((c, i) => ({ x: i, y: 0, c })).concat([{ x: n - 1, y: 0, c: null }]);
    return normalize(tiles, tiles[0], tiles[n - 1]);
  }
  function ring(rng) {
    const c = pick(CONS, rng);
    const tiles = [];
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!(x === 1 && y === 1)) tiles.push({ x, y, c });
    const rest = tiles.filter((_, i) => i !== Math.floor(rng() * tiles.length));
    const s = pick(rest, rng);
    let g = pick(rest, rng);
    while (g === s) g = pick(rest, rng);
    return normalize(rest, s, g);
  }

  // ---------- 난이도 ----------
  // board(rng): 판과 규칙. keyFam: 대표 정답의 최소 빈도. fam: 친숙한 정답 수 범위. len: 대표 정답 점프 수.
  const LEVELS = {
    easy: {
      label: '쉬움', seconds: 60,
      board: (rng) => ({ ...scatter(rng, between(3, 4, rng), 3, 3, false, false), rules: {} }),
      keyFam: 150, fam: [2, 15], len: [2, 3],
    },
    normal: {
      label: '보통', seconds: 90,
      board: (rng) => {
        const r = rng();
        if (r < 0.3) return { ...scatter(rng, 4, 3, 3, false, false), rules: { vowelOnly: true } };
        if (r < 0.45) return { ...scatter(rng, 3, 3, 2, false, false), rules: { visitAll: true } };
        return { ...scatter(rng, between(4, 5, rng), 4, 3, rng() < 0.3, rng() < 0.3), rules: {} };
      },
      keyFam: 60, fam: [1, 5], len: [2, 4],
    },
    hard: {
      label: '어려움', seconds: 120,
      board: (rng) => {
        const r = rng();
        if (r < 0.12) return { ...line(rng, between(5, 6, rng)), rules: { vowelOnly: true } };
        if (r < 0.24) return { ...ring(rng), rules: { vowelOnly: true } };
        if (r < 0.4) return { ...scatter(rng, between(5, 6, rng), 4, 3, true, true), rules: { consonantOnly: true } };
        if (r < 0.55) return { ...scatter(rng, 4, 3, 3, rng() < 0.5, false), rules: { visitAll: true } };
        if (r < 0.7) return { ...scatter(rng, 5, 4, 3, false, false), rules: { vowelOnly: true } };
        return { ...scatter(rng, between(5, 6, rng), 4, 4, rng() < 0.5, rng() < 0.5), rules: {} };
      },
      keyFam: 30, fam: [1, 2], len: [3, 7],
    },
  };

  // fam: [[단어, 빈도], ...] 빈도 내림차순
  function makeContext(fam) {
    const score = new Map(fam);
    const letters = new Map(fam.map(([w]) => [w, new Set([...w].flatMap((c) => H.abilitiesOf(c).letters))]));
    const byStart = new Map();
    for (const c of CONS) byStart.set(c, fam.map(([w]) => w).filter((w) => letters.get(w).has(c)));
    return { score, byStart };
  }

  function generate(ctx, level, rng, opts = {}) {
    const L = LEVELS[level];
    const avoid = opts.avoid || new Set();
    const maxTries = opts.maxTries || 4000;
    for (let t = 0; t < maxTries; t++) {
      const b = L.board(rng);
      const idx = H.makeBoardIndex(b);
      const sc = idx.cells.get(b.start.join(',')).c;
      const answers = [];
      for (const w of ctx.byStart.get(sc) || []) {
        const p = H.findPath(b, w, idx);
        if (p) {
          answers.push({ word: w, path: p });
          if (answers.length > L.fam[1]) break;
        }
      }
      if (answers.length < L.fam[0] || answers.length > L.fam[1]) continue;
      const key = answers[0]; // byStart 가 빈도순이라 첫 번째가 가장 친숙하다
      if (ctx.score.get(key.word) < L.keyFam) continue;
      if (avoid.has(key.word)) continue;
      if (key.path.length < L.len[0] || key.path.length > L.len[1]) continue;
      return { level, board: b, answers: answers.map((a) => a.word), key: key.word, tries: t + 1 };
    }
    return null;
  }

  return { LEVELS, mulberry32, hashSeed, makeContext, generate };
});
