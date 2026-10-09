// 20개 스테이지를 만든다. 사용법: node scripts/build-stages.js
// 판 템플릿 + 제약 조건 + "핵심 정답"(가장 친숙한 정답)의 경로 특징으로 단계마다 가르칠 개념을 정한다.
global.window = {};
require('../words.js');
const H = require('../engine.js');
const fs = require('fs');
const path = require('path');
const FREQ = require('./freq.json');

const fam = (w) => FREQ[w] || 0;
const FAMILIAR = 30;
const WORDS = window.WORDS;
const FAM_WORDS = WORDS.filter((w) => fam(w) >= FAMILIAR);
const LETTERS = new Map(WORDS.map((w) => [w, new Set([...w].flatMap((c) => H.abilitiesOf(c).letters))]));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, rng) => arr[Math.floor(rng() * arr.length)];
function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const CONS = H.BOARD_CONSONANTS;

// ---------- 판 템플릿 ----------
function normalize(tiles, start, goal) {
  const minX = Math.min(...tiles.map((t) => t.x)), minY = Math.min(...tiles.map((t) => t.y));
  tiles.forEach((t) => { t.x -= minX; t.y -= minY; });
  return { tiles, start: [start.x, start.y], goal: [goal.x, goal.y] };
}
// 흩어진 칸. dup 이면 자음이 겹칠 수 있고, goalC 이면 깃발 칸에도 자음이 있다.
function scatter(n, w, h, opts = {}) {
  return (rng) => {
    const cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
    const pos = shuffle(cells, rng).slice(0, n);
    const pool = opts.pool ? opts.pool : shuffle(CONS, rng).slice(0, opts.dup ? Math.max(2, n - 2) : n);
    const cons = opts.dup ? pos.map(() => pick(pool, rng)) : shuffle(pool, rng);
    const tiles = pos.map(([x, y], i) => ({ x, y, c: cons[i % cons.length] }));
    const goal = tiles[tiles.length - 1];
    if (!opts.goalC) goal.c = null;
    return normalize(tiles, tiles[0], goal);
  };
}
// 한 줄 외길: 왼쪽 끝 출발, 오른쪽 끝 깃발
function line(n) {
  return (rng) => {
    const cons = shuffle(CONS, rng).slice(0, n - 1);
    const tiles = cons.map((c, i) => ({ x: i, y: 0, c })).concat([{ x: n - 1, y: 0, c: null }]);
    return normalize(tiles, tiles[0], tiles[n - 1]);
  };
}
// 가운데가 뚫린 고리. 모든 칸이 같은 자음이고 깃발 칸에도 그 자음이 있다.
function ring(size) {
  return (rng) => {
    const c = pick(CONS, rng);
    const tiles = [];
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const inner = x > 0 && y > 0 && x < size - 1 && y < size - 1;
      if (!inner) tiles.push({ x, y, c });
    }
    // 고리에서 한 칸을 더 빼서 돌아가는 방향을 정해 준다
    const gap = Math.floor(rng() * tiles.length);
    const rest = tiles.filter((_, i) => i !== gap);
    const s = pick(rest, rng);
    let g = pick(rest, rng);
    while (g === s) g = pick(rest, rng);
    return normalize(rest, s, g);
  };
}
// 같은 자음이 여러 칸에 놓인 판 (자음 점프만 쓰는 징검돌용)
function stones(n, kinds, w, h) {
  return (rng) => {
    const cells = [];
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]);
    const pos = shuffle(cells, rng).slice(0, n);
    const pool = shuffle(CONS, rng).slice(0, kinds);
    const tiles = pos.map(([x, y], i) => ({ x, y, c: pool[i % kinds] }));
    const goal = tiles[n - 1];
    return normalize(tiles, tiles[0], goal);
  };
}

// ---------- 경로 특징 ----------
function features(p) {
  const f = new Set();
  if (p[0].index === 1) f.add('reorder');
  if (p.length > 2) f.add('reuse');
  for (const s of p) {
    if (s.type === 'consonant') f.add('consonant');
    if (s.type === 'vowel') {
      f.add('vowel');
      if (s.vector[0] && s.vector[1]) f.add('diag');
      if (Math.abs(s.vector[0]) === 2 || Math.abs(s.vector[1]) === 2) f.add('two');
    }
    const d = H.decompose(s.syllable);
    if (['ㄳ','ㄵ','ㄶ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅄ'].includes(d.jong)) f.add('compound');
  }
  return f;
}

// ---------- 단계 설계 ----------
// key: 가장 친숙한 정답. need: 핵심 정답 경로에 있어야 할 특징. avoid: 없어야 할 특징.
// famMax: 친숙한 정답 수 상한(보스는 작게). total: 전체 정답 수 범위.
const SPEC = [
  { n: 1, gen: scatter(3, 3, 3), keyFam: 300, need: ['consonant', 'vowel'], avoid: ['reorder', 'reuse', 'two', 'diag'], famMin: 3, len: [2, 2] },
  { n: 2, gen: scatter(3, 3, 3), keyFam: 150, need: ['two'], avoid: ['reuse', 'diag'], famMin: 2, len: [2, 2] },
  { n: 3, gen: scatter(4, 3, 3), keyFam: 150, need: ['reorder'], avoid: ['reuse'], famMin: 2, famMax: 8, len: [2, 2] },
  { n: 4, gen: scatter(4, 4, 3), keyFam: 100, need: ['reuse'], famMin: 1, famMax: 6, len: [3, 3] },
  // 방송 Round 4 판 그대로. 정답 암탉
  { n: 5, boss: true, title: '외길', tip: '방송에 나온 문제예요. 같은 글자를 여러 번 써야 해요.',
    fixed: { key: '암탉', board: { tiles: [{ x: 0, y: 0, c: 'ㅁ' }, { x: 1, y: 0, c: 'ㄹ' }, { x: 2, y: 0, c: 'ㄱ' }, { x: 3, y: 0, c: 'ㅌ' }, { x: 4, y: 0, c: 'ㅇ' }, { x: 5, y: 0, c: null }], start: [0, 0], goal: [5, 0], rules: { vowelOnly: true } } } },
  { n: 6, gen: scatter(4, 3, 3), rules: { vowelOnly: true }, keyFam: 100, famMin: 2, famMax: 8, len: [2, 3] },
  { n: 7, gen: scatter(4, 3, 3), keyFam: 80, need: ['diag'], famMin: 1, famMax: 6, len: [2, 3] },
  { n: 8, gen: scatter(5, 3, 3, { dup: true }), keyFam: 80, need: ['consonant', 'reuse'], famMin: 1, famMax: 6, len: [3, 4] },
  { n: 9, gen: scatter(5, 4, 3), keyFam: 50, need: ['reorder', 'reuse'], famMin: 2, famMax: 5, len: [3, 4] },
  { n: 10, boss: true, title: '구멍 난 고리', tip: '모든 칸이 같은 자음이에요. 가운데는 뚫려 있어요.',
    gen: ring(3), rules: { vowelOnly: true }, keyFam: 30, need: ['two'], famMax: 2, totalMax: 8, len: [2, 4], check: (b) => !adjacent(b) },
  { n: 11, gen: scatter(3, 3, 2), rules: { visitAll: true }, keyFam: 100, famMin: 2, famMax: 8, len: [2, 3] },
  { n: 12, gen: scatter(5, 3, 3), rules: { maxJumps: 2 }, keyFam: 80, famMin: 1, famMax: 4, len: [2, 2], check: hasLongOnly },
  { n: 13, gen: scatter(4, 3, 3), rules: { visitAll: true }, keyFam: 60, famMin: 2, famMax: 5, len: [3, 4] },
  { n: 14, gen: scatter(5, 4, 3, { goalC: true }), keyFam: 50, need: ['reuse'], famMin: 1, famMax: 4, len: [3, 5] },
  { n: 15, boss: true, title: '징검돌', tip: '자음 점프만 쓸 수 있어요. 같은 자음 돌이 여러 개예요.',
    gen: stones(6, 3, 4, 3), rules: { consonantOnly: true }, keyFam: 30, famMax: 2, totalMax: 6, len: [3, 6] },
  { n: 16, gen: scatter(5, 3, 3), rules: { exactJumps: 3 }, keyFam: 60, famMin: 2, famMax: 4, len: [3, 3] },
  { n: 17, gen: line(5), rules: { vowelOnly: true }, keyFam: 40, need: ['reuse'], famMin: 1, famMax: 3, len: [3, 5] },
  { n: 18, gen: scatter(5, 3, 3), rules: { visitAll: true }, keyFam: 40, famMin: 2, famMax: 3, len: [4, 5] },
  { n: 19, gen: scatter(6, 4, 3, { goalC: true, dup: true }), keyFam: 40, need: ['reorder', 'reuse'], famMin: 1, famMax: 3, len: [3, 6] },
  { n: 20, boss: true, title: '미로', tip: '모음 점프만, 그리고 모든 칸을 밟아야 해요.',
    gen: scatter(6, 3, 3, { dup: true, goalC: true }), rules: { vowelOnly: true, visitAll: true }, keyFam: 30, famMax: 2, totalMax: 4, len: [5, 8] },
];

function adjacent(b) {
  return Math.max(Math.abs(b.start[0] - b.goal[0]), Math.abs(b.start[1] - b.goal[1])) <= 1;
}
// 점프 제한이 없으면 되는 친숙한 단어가 여럿 있어야 "N번 안에"가 의미 있다
function hasLongOnly(b) {
  const free = Object.assign({}, b, { rules: {} });
  const idx = H.makeBoardIndex(free);
  let long = 0;
  for (const w of FAM_WORDS) {
    if (!LETTERS.get(w).has(idx.cells.get(b.start.join(',')).c)) continue;
    const p = H.findPath(free, w, idx);
    if (p && p.length > 2) long++;
  }
  return long >= 2;
}

const SKIP = JSON.parse(process.env.SKIP || '{}');
const out = [];
const usedKeys = new Set();
for (const spec of SPEC) {
  if (spec.fixed) {
    const b = spec.fixed.board;
    const all = H.solveAll(b, window.WORDS.concat(window.WORDS_EXTRA)).map((x) => x.word);
    const answers = [spec.fixed.key].concat(all.filter((w) => w !== spec.fixed.key && WORDS.includes(w)));
    out.push({ n: spec.n, boss: !!spec.boss, title: spec.title, tip: spec.tip, board: b, answers, key: spec.fixed.key });
    usedKeys.add(spec.fixed.key);
    console.log(String(spec.n).padStart(2), 'BOSS fixed', JSON.stringify(b.rules), 'answers', answers.join(' '), '| all incl. extra', all.length);
    continue;
  }
  const rng = mulberry32(spec.n * 7919 + 17);
  let found = null;
  let hits = 0;
  for (let a = 0; a < 60000 && !found; a++) {
    const b = spec.gen(rng);
    b.rules = spec.rules || {};
    if (spec.check && !spec.check(b)) continue;
    const idx = H.makeBoardIndex(b);
    const sc = idx.cells.get(b.start.join(',')).c;
    // 1차: 친숙한 단어만으로 빠르게 거른다
    const famAns = [];
    for (const w of FAM_WORDS) {
      if (!LETTERS.get(w).has(sc)) continue;
      const p = H.findPath(b, w, idx);
      if (p) famAns.push({ word: w, path: p });
    }
    famAns.sort((x, y) => fam(y.word) - fam(x.word));
    if (!famAns.length) continue;
    const key = famAns[0];
    if (usedKeys.has(key.word)) continue;
    if (fam(key.word) < spec.keyFam) continue;
    if (spec.famMin && famAns.length < spec.famMin) continue;
    if (spec.famMax && famAns.length > spec.famMax) continue;
    if (key.path.length < spec.len[0] || key.path.length > spec.len[1]) continue;
    const f = features(key.path);
    if ((spec.need || []).some((x) => !f.has(x))) continue;
    if ((spec.avoid || []).some((x) => f.has(x))) continue;
    // 2차: 전체 단어로 정답 목록을 만든다
    const all = H.solveAll(b, WORDS.filter((w) => LETTERS.get(w).has(sc)));
    if (spec.totalMax && all.length > spec.totalMax) continue;
    if (hits++ < (SKIP[spec.n] || 0)) continue;
    const answers = all.map((x) => x.word).sort((x, y) => fam(y) - fam(x));
    found = { n: spec.n, boss: !!spec.boss, title: spec.title || null, tip: spec.tip || null, board: b, answers, key: key.word };
    console.log(String(spec.n).padStart(2), spec.boss ? 'BOSS' : '    ', JSON.stringify(b.rules).padEnd(34), 'tiles', b.tiles.length,
      'key', key.word, fam(key.word), 'len', key.path.length, [...f].join(','), '| fam', famAns.length, 'all', answers.length, answers.slice(0, 8).join(' '));
  }
  if (!found) { console.log(String(spec.n).padStart(2), 'NOT FOUND'); continue; }
  out.push(found);
  usedKeys.add(found.key);
}
if (out.length === SPEC.length) {
  fs.writeFileSync(path.join(__dirname, '..', 'stages.js'), '// scripts/build-stages.js 로 생성한 20개 스테이지\nwindow.STAGES = ' + JSON.stringify(out) + ';\n');
  console.log('written');
}
