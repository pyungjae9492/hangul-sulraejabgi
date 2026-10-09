// 오늘의 도전 보스 문제 풀을 미리 만든다. 사용법: node scripts/build-bosses.js [슬롯별 개수]
// 보스는 실시간 생성이 아니라 여기서 만들어 검수한 고정 문제를 날짜별로 돌려 쓴다.
global.window = {};
require('../words.js');
const H = require('../engine.js');
const G = require('../gen.js');
const fs = require('fs');
const path = require('path');
const F = require('./freq.json');
const fam = (w) => F[w] || 0;
const FAM = window.WORDS.filter((w) => fam(w) >= 15).sort((a, b) => fam(b) - fam(a));
const ALL = window.WORDS.concat(window.WORDS_EXTRA);
const LET = new Map(FAM.map((w) => [w, new Set([...w].flatMap((c) => H.abilitiesOf(c).letters))]));
const CONS = H.BOARD_CONSONANTS;
const COUNT = Number(process.argv[2] || 24);
const ONLY = process.argv[3] ? Number(process.argv[3]) : null;
const OUT = path.join(__dirname, '..', 'bosses.js');
const prev = fs.existsSync(OUT) ? (global.window = global.window || {}, require(OUT), window.BOSSES) : {};

const pick = (a, rng) => a[Math.floor(rng() * a.length)];
function shuffle(arr, rng) { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function norm(tiles, s, g) { const mx = Math.min(...tiles.map((t) => t.x)), my = Math.min(...tiles.map((t) => t.y)); tiles.forEach((t) => { t.x -= mx; t.y -= my; }); return { tiles, start: [s.x, s.y], goal: [g.x, g.y] }; }
const line = (n) => (rng) => { const c = shuffle(CONS, rng).slice(0, n - 1); const t = c.map((x, i) => ({ x: i, y: 0, c: x })).concat([{ x: n - 1, y: 0, c: null }]); return norm(t, t[0], t[n - 1]); };
const ring = () => (rng) => { const c = pick(CONS, rng); const t = []; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) if (!(x === 1 && y === 1)) t.push({ x, y, c }); const gap = Math.floor(rng() * t.length); const r = t.filter((_, i) => i !== gap); const s = pick(r, rng); let g = pick(r, rng); while (g === s) g = pick(r, rng); return norm(r, s, g); };
const stones = (n, k, w, h) => (rng) => { const cells = []; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) cells.push([x, y]); const pos = shuffle(cells, rng).slice(0, n); const pool = shuffle(CONS, rng).slice(0, k); const t = pos.map(([x, y], i) => ({ x, y, c: pool[i % k] })); return norm(t, t[0], t[n - 1]); };
const maze = (n) => (rng) => { const cells = []; for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push([x, y]); const pos = shuffle(cells, rng).slice(0, n); const pool = shuffle(CONS, rng).slice(0, n - 2); const t = pos.map(([x, y]) => ({ x, y, c: pick(pool, rng) })); return norm(t, t[0], t[n - 1]); };

// 외길은 무작위로는 거의 안 나와서, 단어를 먼저 고르고 그 단어의 자음으로 한 줄 판을 짓는다.
function* lineFromWords(rng) {
  const words = shuffle(FAM.filter((w) => fam(w) >= 15), rng);
  for (const w of words) {
    const ab = [...w].map(H.abilitiesOf);
    if (!ab.every((a) => a.vector && a.vector[1] === 0 && a.vector[0] > 0)) continue;
    const letters = [...new Set(ab.flatMap((a) => a.letters))];
    if (letters.length < 3) continue;
    for (let k = 0; k < 30; k++) {
      const order = shuffle(letters, rng);
      const extra = rng() < 0.5 ? [pick(CONS.filter((c) => !letters.includes(c)), rng)] : [];
      const cs = shuffle(order.concat(extra), rng);
      if (cs.length < 4 || cs.length > 6) continue;
      const t = cs.map((c, i) => ({ x: i, y: 0, c })).concat([{ x: cs.length, y: 0, c: null }]);
      yield norm(t, t[0], t[t.length - 1]);
    }
  }
}

const SLOTS = [
  { n: 5, title: '외길', tip: '칸이 한 줄뿐이에요. 같은 글자를 여러 번 써야 해요.', iter: lineFromWords, rules: { vowelOnly: true }, keyFam: 15, len: [3, 6], need: 'reuse' },
  { n: 10, title: '구멍 난 고리', tip: '모든 칸이 같은 자음이에요. 가운데는 뚫려 있어요.', gen: ring(), rules: { vowelOnly: true }, keyFam: 30, len: [2, 5] },
  { n: 15, title: '징검돌', tip: '자음 점프만 쓸 수 있어요. 같은 자음 돌이 여러 개예요.', gen: stones(6, 3, 4, 3), rules: { consonantOnly: true }, keyFam: 30, len: [3, 6] },
  { n: 20, title: '미로', tip: '모음 점프만, 그리고 모든 칸을 밟아야 해요.', gen: maze(5), rules: { vowelOnly: true, visitAll: true }, keyFam: 30, len: [4, 8] },
];
const out = Object.assign({}, prev);
for (const slot of SLOTS) {
  if (ONLY && slot.n !== ONLY) continue;
  const rng = G.mulberry32(slot.n * 104729 + 7);
  const list = [];
  const keys = new Set();
  // 방송 문제(암탉 외길)는 외길 풀의 첫 문제로 고정
  if (slot.n === 5) {
    const b = { tiles: [{ x: 0, y: 0, c: 'ㅁ' }, { x: 1, y: 0, c: 'ㄹ' }, { x: 2, y: 0, c: 'ㄱ' }, { x: 3, y: 0, c: 'ㅌ' }, { x: 4, y: 0, c: 'ㅇ' }, { x: 5, y: 0, c: null }], start: [0, 0], goal: [5, 0], rules: { vowelOnly: true } };
    list.push({ board: b, answers: ['암탉'], key: '암탉' });
    keys.add('암탉');
  }
  const t0 = Date.now();
  const it = slot.iter ? slot.iter(rng) : null;
  let lastLog = Date.now();
  for (let a = 0; list.length < COUNT && Date.now() - t0 < 90000; a++) {
    if (Date.now() - lastLog > 5000) { lastLog = Date.now(); console.log('  slot', slot.n, 'tries', a, 'found', list.length); }
    let b;
    if (it) { const nx = it.next(); if (nx.done) break; b = nx.value; } else b = slot.gen(rng);
    b.rules = slot.rules;
    const idx = H.makeBoardIndex(b);
    const sc = idx.cells.get(b.start.join(',')).c;
    const ans = [];
    for (const w of FAM) {
      if (!LET.get(w).has(sc)) continue;
      const p = H.findPath(b, w, idx);
      if (p) { ans.push({ w, p }); if (ans.length > 2) break; }
    }
    if (!ans.length || ans.length > 2) continue;
    const key = ans[0];
    if (fam(key.w) < slot.keyFam || keys.has(key.w)) continue;
    if (key.p.length < slot.len[0] || key.p.length > slot.len[1]) continue;
    if (slot.need === 'reuse' && key.p.length <= 2) continue;
    const all = H.solveAll(b, ALL).map((x) => x.word);
    if (all.length > 8) continue;
    keys.add(key.w);
    list.push({ board: b, answers: ans.map((x) => x.w), key: key.w });
  }
  out[slot.n] = { title: slot.title, tip: slot.tip, pool: list };
  console.log(slot.n, slot.title, list.length, list.map((x) => x.key).join(' '));
}
fs.writeFileSync(OUT, '// scripts/build-bosses.js 로 만든 오늘의 도전 보스 풀\nwindow.BOSSES = ' + JSON.stringify(out) + ';\n');
console.log('written');
