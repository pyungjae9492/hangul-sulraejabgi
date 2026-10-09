/*
 * 한글 술래잡기 (네 가지 소원 EP.2, 미니 숨바꼭질) 규칙 엔진
 *
 * 영상에서 확인한 규칙
 * - 글자 하나마다 능력 두 개 중 하나를 고른다.
 *   · 자음 능력: 글자를 이루는 서로 다른 자음 칸으로 이동 (초성 <-> 받침, 양방향)
 *   · 모음 능력: 모음에서 튀어나온 획의 방향으로, 획 수만큼 이동
 * - 모음이 ㅡ, ㅣ, ㅢ 이면 모음 능력 없음. 받침이 없거나 자음이 한 종류뿐이면 자음 능력 없음.
 * - 이동할 방향에 칸이 없으면 이동할 수 없다.
 * - 코드네임의 각 글자는 한 번씩, 순서 상관없이 사용한다.
 * - 추가 조건: "모든 칸을 거쳐야 한다", "모음 능력만 사용해야 한다"
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.HangulHide = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
  const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
  const JONG = ['','ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  // 쌍자음은 기본 자음 칸으로 취급한다.
  const BASE = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
  // 겹받침은 구성 자음을 모두 사용할 수 있다.
  const COMPOUND = {
    'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'],
    'ㄼ': ['ㄹ', 'ㅂ'], 'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'],
  };
  const BOARD_CONSONANTS = ['ㄱ','ㄴ','ㄷ','ㄹ','ㅁ','ㅂ','ㅅ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];

  // 모음별 이동 [dx, dy]. dx: 오른쪽 +, dy: 아래쪽 +.
  // 튀어나온 획의 방향과 획 수로 계산한다. 복합모음은 두 방향을 합친 대각선 한 칸.
  const VOWEL_MOVES = {
    'ㅏ': [1, 0], 'ㅐ': [1, 0], 'ㅑ': [2, 0], 'ㅒ': [2, 0],
    'ㅓ': [-1, 0], 'ㅔ': [-1, 0], 'ㅕ': [-2, 0], 'ㅖ': [-2, 0],
    'ㅗ': [0, -1], 'ㅚ': [0, -1], 'ㅛ': [0, -2],
    'ㅜ': [0, 1], 'ㅟ': [0, 1], 'ㅠ': [0, 2],
    'ㅘ': [1, -1], 'ㅙ': [1, -1],
    'ㅝ': [-1, 1], 'ㅞ': [-1, 1],
    'ㅡ': null, 'ㅢ': null, 'ㅣ': null,
  };

  const isSyllable = (ch) => !!ch && ch.length === 1 && ch >= '가' && ch <= '힣';
  const isHangulWord = (w) => typeof w === 'string' && w.length > 0 && [...w].every(isSyllable);

  function decompose(ch) {
    const code = ch.charCodeAt(0) - 0xac00;
    return { cho: CHO[Math.floor(code / 588)], jung: JUNG[Math.floor((code % 588) / 28)], jong: JONG[code % 28] };
  }

  const baseOf = (c) => BASE[c] || c;

  // 한 글자가 가진 능력: { consonants: [...] (2개 이상일 때만 사용 가능), vector: [dx,dy] | null }
  function abilitiesOf(ch) {
    const { cho, jung, jong } = decompose(ch);
    const set = [baseOf(cho)];
    if (jong) for (const c of COMPOUND[jong] || [baseOf(jong)]) if (!set.includes(c)) set.push(c);
    return { consonants: set.length >= 2 ? set : null, vector: VOWEL_MOVES[jung] || null };
  }

  const key = (x, y) => x + ',' + y;

  // 보드: { tiles: [{x,y,c}], start: [x,y], goal: [x,y], cond: 'none'|'all'|'vowel' }
  // goal 칸은 자음이 없는 빈 칸이다 (자음 능력으로는 도착할 수 없다).
  function makeBoardIndex(board) {
    const cells = new Map();
    const byConsonant = new Map();
    for (const t of board.tiles) {
      cells.set(key(t.x, t.y), t);
      if (t.c) byConsonant.set(t.c, t);
    }
    return { cells, byConsonant };
  }

  function movesFrom(idx, pos, ability, onlyVowel) {
    const out = [];
    const here = idx.cells.get(key(pos[0], pos[1]));
    if (ability.vector) {
      const nx = pos[0] + ability.vector[0];
      const ny = pos[1] + ability.vector[1];
      if (idx.cells.has(key(nx, ny))) out.push({ type: 'vowel', to: [nx, ny], vector: ability.vector });
    }
    if (!onlyVowel && ability.consonants && here && here.c && ability.consonants.includes(here.c)) {
      for (const c of ability.consonants) {
        if (c === here.c) continue;
        const t = idx.byConsonant.get(c);
        if (t) out.push({ type: 'consonant', to: [t.x, t.y], fromC: here.c, target: c });
      }
    }
    return out;
  }

  // 코드네임이 시작 칸에서 도착 칸까지 갈 수 있으면 이동 경로를 돌려준다.
  function findPath(board, word, idxArg) {
    if (!isHangulWord(word) || [...word].length !== 2) return null;
    const idx = idxArg || makeBoardIndex(board);
    const syl = [...word];
    const abil = syl.map(abilitiesOf);
    const onlyVowel = board.cond === 'vowel';
    const total = board.tiles.length;
    for (const order of [[0, 1], [1, 0]]) {
      const walk = (step, pos, visited, path) => {
        if (step === 2) {
          if (pos[0] !== board.goal[0] || pos[1] !== board.goal[1]) return null;
          if (board.cond === 'all' && visited.size !== total) return null;
          return path;
        }
        const si = order[step];
        for (const m of movesFrom(idx, pos, abil[si], onlyVowel)) {
          const nv = new Set(visited);
          nv.add(key(m.to[0], m.to[1]));
          const r = walk(step + 1, m.to, nv, path.concat([{ syllable: syl[si], index: si, from: pos, ...m }]));
          if (r) return r;
        }
        return null;
      };
      const r = walk(0, board.start, new Set([key(board.start[0], board.start[1])]), []);
      if (r) return r;
    }
    return null;
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

  function shuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const DIFFICULTY = {
    easy: { tiles: [4, 5], answers: [6, 40] },
    normal: { tiles: [4, 5], answers: [2, 12] },
    hard: { tiles: [5, 6], answers: [1, 3] },
  };

  function randomBoard(tileCount, cond, rng) {
    // 타일 수에 맞춰 촘촘한 영역 안에 배치한다.
    const region = tileCount <= 4 ? [3, 3] : tileCount === 5 ? (rng() < 0.5 ? [3, 4] : [4, 3]) : [4, 4];
    const all = [];
    for (let y = 0; y < region[1]; y++) for (let x = 0; x < region[0]; x++) all.push([x, y]);
    const pick = shuffle(all, rng).slice(0, tileCount);
    const cons = shuffle(BOARD_CONSONANTS, rng);
    const tiles = pick.map(([x, y], i) => ({ x, y, c: cons[i] }));
    const goal = tiles[tiles.length - 1];
    goal.c = null;
    const start = tiles[0];
    // 좌표를 좌상단 기준으로 정규화
    const minX = Math.min(...tiles.map((t) => t.x));
    const minY = Math.min(...tiles.map((t) => t.y));
    tiles.forEach((t) => { t.x -= minX; t.y -= minY; });
    return {
      tiles,
      start: [start.x, start.y],
      goal: [goal.x, goal.y],
      cond,
      cols: Math.max(...tiles.map((t) => t.x)) + 1,
      rows: Math.max(...tiles.map((t) => t.y)) + 1,
    };
  }

  // 정답이 반드시 존재하는 문제를 만든다.
  function generatePuzzle(words, opts = {}) {
    const rng = opts.rng || Math.random;
    const level = DIFFICULTY[opts.difficulty || 'normal'];
    const [minA, maxA] = level.answers;
    let best = null;
    for (let i = 0; i < (opts.maxTries || 400); i++) {
      const r = rng();
      const cond = opts.cond || (r < 0.12 ? 'all' : r < 0.32 ? 'vowel' : 'none');
      const count = cond === 'all' ? 3 : level.tiles[0] + Math.floor(rng() * (level.tiles[1] - level.tiles[0] + 1));
      const board = randomBoard(count, cond, rng);
      const answers = solveAll(board, words);
      if (answers.length >= minA && answers.length <= maxA) return { board, answers };
      if (answers.length > 0 && (!best || Math.abs(answers.length - minA) < Math.abs(best.answers.length - minA))) best = { board, answers };
    }
    return best;
  }

  return {
    CHO, JUNG, JONG, VOWEL_MOVES, BOARD_CONSONANTS, DIFFICULTY,
    decompose, abilitiesOf, isHangulWord, makeBoardIndex, movesFrom, findPath, solveAll, generatePuzzle, randomBoard,
  };
});
