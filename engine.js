/*
 * 자모 점프 규칙 엔진 (원작: 네 가지 소원 EP.2 3회전 데스매치)
 *
 * - 단어의 두 글자를 몇 번이든 다시 쓸 수 있고, 점프 횟수에도 제한이 없다.
 * - 글자는 지금 밟고 있는 칸의 자음이 그 글자에 들어 있을 때만 쓸 수 있다.
 *   · 자음 점프: 같은 글자의 다른 자음 칸으로 이동 (초성 <-> 받침, 겹받침은 구성 자음 모두)
 *   · 모음 점프: 모음에서 튀어나온 획의 방향으로, 획 수만큼 이동
 * - 깃발 칸에 닿으면 끝난다. 그때까지 두 글자를 모두 한 번 이상 썼어야 한다.
 * - 같은 자음이 여러 칸에 있을 수 있고, 깃발 칸에도 자음이 있을 수 있다.
 * - 규칙(rules): vowelOnly(모음 점프만), consonantOnly(자음 점프만), visitAll(모든 칸 밟기),
 *   maxJumps(N번 안에), exactJumps(딱 N번)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HangulHide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const BASE = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
  const COMPOUND = {
    'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'],
    'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
  };
  const BOARD_CONSONANTS = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  // [dx, dy]: 오른쪽 +x, 아래쪽 +y. 복합모음은 두 방향을 합친 대각선 1칸.
  const VOWEL_MOVES = {
    'ㅏ': [1, 0], 'ㅐ': [1, 0], 'ㅑ': [2, 0], 'ㅒ': [2, 0],
    'ㅓ': [-1, 0], 'ㅔ': [-1, 0], 'ㅕ': [-2, 0], 'ㅖ': [-2, 0],
    'ㅗ': [0, -1], 'ㅚ': [0, -1], 'ㅛ': [0, -2],
    'ㅜ': [0, 1], 'ㅟ': [0, 1], 'ㅠ': [0, 2],
    'ㅘ': [1, -1], 'ㅙ': [1, -1],
    'ㅝ': [-1, 1], 'ㅞ': [-1, 1],
    'ㅡ': null, 'ㅢ': null, 'ㅣ': null,
  };
  const MAX_JUMPS = 12;

  const isSyllable = (ch) => !!ch && ch.length === 1 && ch >= '가' && ch <= '힣';
  const isHangulWord = (w) => typeof w === 'string' && w.length > 0 && [...w].every(isSyllable);

  function decompose(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    return { cho: CHO[Math.floor(code / 588)], jung: JUNG[Math.floor((code % 588) / 28)], jong: JONG[code % 28] };
  }
  const baseOf = (c) => BASE[c] || c;

  function abilitiesOf(ch) {
    const { cho, jung, jong } = decompose(ch);
    const set = [baseOf(cho)];
    if (jong) for (const c of COMPOUND[jong] || [baseOf(jong)]) if (!set.includes(c)) set.push(c);
    return { letters: set, consonants: set.length >= 2 ? set : null, vector: VOWEL_MOVES[jung] || null };
  }

  const key = (x, y) => x + ',' + y;
  const same = (a, b) => a[0] === b[0] && a[1] === b[1];

  function rulesOf(board) {
    const r = Object.assign({}, board.rules || {});
    if (board.cond === 'vowel') r.vowelOnly = true;
    if (board.cond === 'all') r.visitAll = true;
    return r;
  }

  function makeBoardIndex(board) {
    const cells = new Map();
    const byConsonant = new Map();
    const order = new Map();
    board.tiles.forEach((t, i) => {
      cells.set(key(t.x, t.y), t);
      order.set(key(t.x, t.y), i);
      if (t.c) {
        if (!byConsonant.has(t.c)) byConsonant.set(t.c, []);
        byConsonant.get(t.c).push(t);
      }
    });
    return { cells, byConsonant, order };
  }

  // rules 는 객체. 예전 호출과의 호환을 위해 true 는 vowelOnly 로 본다.
  function movesFrom(idx, pos, ability, rules) {
    const r = rules === true ? { vowelOnly: true } : rules || {};
    const out = [];
    const here = idx.cells.get(key(pos[0], pos[1]));
    if (!here || !here.c || !ability.letters.includes(here.c)) return out;
    if (ability.vector && !r.consonantOnly) {
      const nx = pos[0] + ability.vector[0];
      const ny = pos[1] + ability.vector[1];
      if (idx.cells.has(key(nx, ny))) out.push({ type: 'vowel', to: [nx, ny], vector: ability.vector });
    }
    if (ability.consonants && !r.vowelOnly) {
      for (const c of ability.consonants) {
        if (c === here.c) continue;
        for (const t of idx.byConsonant.get(c) || []) out.push({ type: 'consonant', to: [t.x, t.y], fromC: here.c, target: c });
      }
    }
    return out;
  }

  // 너비 우선 탐색. relax 로 일부 조건을 풀어서 "어떤 조건 때문에 실패했는지"도 알아낼 수 있다.
  function search(board, word, idx, relax) {
    relax = relax || {};
    const rules = rulesOf(board);
    const syl = [...word];
    const abil = syl.map(abilitiesOf);
    const n = board.tiles.length;
    const full = n >= 31 ? -1 : (1 << n) - 1;
    const bit = (p) => 1 << idx.order.get(key(p[0], p[1]));
    const needVisit = rules.visitAll && !relax.visit;
    const exact = !relax.jumps && rules.exactJumps;
    const limit = (!relax.jumps && (rules.exactJumps || rules.maxJumps)) || MAX_JUMPS;
    const start = { pos: board.start, used: 0, vis: bit(board.start), depth: 0, prev: null, step: null };
    const seen = new Set();
    const queue = [start];
    const all = [start];
    for (let qi = 0; qi < queue.length; qi++) {
      const s = queue[qi];
      if (s.depth >= limit) continue;
      for (let si = 0; si < 2; si++) {
        for (const m of movesFrom(idx, s.pos, abil[si], rules)) {
          const ns = {
            pos: m.to, used: s.used | (1 << si), vis: s.vis | bit(m.to), depth: s.depth + 1, prev: s,
            step: Object.assign({ syllable: syl[si], index: si, from: s.pos }, m),
          };
          if (same(m.to, board.goal)) {
            const ok = (relax.used || ns.used === 3) && (!needVisit || ns.vis === full) && (!exact || ns.depth === exact);
            if (ok) return { path: trace(ns), all };
            continue; // 깃발에 닿으면 거기서 끝난다
          }
          const k = m.to[0] + ',' + m.to[1] + '|' + ns.used + '|' + (needVisit ? ns.vis : 0) + '|' + (exact ? ns.depth : 0);
          if (seen.has(k)) continue;
          seen.add(k);
          queue.push(ns);
          all.push(ns);
        }
      }
    }
    return { path: null, all };
  }

  function trace(s) {
    const steps = [];
    for (let c = s; c.step; c = c.prev) steps.push(c.step);
    return steps.reverse();
  }

  function findPath(board, word, idxArg) {
    if (!isHangulWord(word) || [...word].length !== 2) return null;
    return search(board, word, idxArg || makeBoardIndex(board)).path;
  }

  // 오답일 때 왜 안 되는지와, 보여줄 만한 부분 경로를 돌려준다.
  function diagnose(board, word, idxArg) {
    const idx = idxArg || makeBoardIndex(board);
    const r = search(board, word, idx);
    if (r.path) return { ok: true, path: r.path };
    const loose = search(board, word, idx, { used: true, visit: true, jumps: true });
    if (!loose.path) {
      if (loose.all.length === 1) return { ok: false, reason: 'start', path: [] };
      let best = loose.all[0];
      const d = (s) => Math.max(Math.abs(s.pos[0] - board.goal[0]), Math.abs(s.pos[1] - board.goal[1]));
      for (const s of loose.all) if (d(s) < d(best) || (d(s) === d(best) && s.depth < best.depth)) best = s;
      return { ok: false, reason: 'stuck', path: trace(best) };
    }
    if (!search(board, word, idx, { visit: true, jumps: true }).path) return { ok: false, reason: 'used', path: loose.path };
    const p2 = search(board, word, idx, { jumps: true }).path;
    if (!p2) return { ok: false, reason: 'visit', path: loose.path };
    return { ok: false, reason: 'jumps', path: p2 };
  }

  function solveAll(board, words) {
    const idx = makeBoardIndex(board);
    const out = [];
    for (const w of words) {
      const p = findPath(board, w, idx);
      if (p) out.push({ word: w, path: p });
    }
    return out;
  }

  return {
    CHO, JUNG, JONG, VOWEL_MOVES, BOARD_CONSONANTS, MAX_JUMPS,
    decompose, abilitiesOf, isHangulWord, makeBoardIndex, movesFrom, findPath, diagnose, solveAll, rulesOf,
  };
});
