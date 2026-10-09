const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../engine.js');

const t = (x, y, c) => ({ x, y, c });

// 규칙 설명 예시: 출발 ㅊ, 정답 규칙
const EXAMPLE = { tiles: [t(0, 0, 'ㅊ'), t(1, 1, 'ㄱ'), t(0, 2, 'ㅇ'), t(1, 3, null)], start: [0, 0], goal: [1, 3] };

// 방송 Round 3: ㅇ 고리, 가운데 구멍, 깃발 칸에도 ㅇ, 모음 점프만. 정답 유광
const ROUND3 = {
  tiles: [t(0, 0, 'ㅇ'), t(1, 0, 'ㅇ'), t(0, 1, 'ㅇ'), t(2, 1, 'ㅇ'), t(0, 2, 'ㅇ'), t(1, 2, 'ㅇ'), t(2, 2, 'ㅇ')],
  start: [1, 0], goal: [2, 1], rules: { vowelOnly: true },
};

// 방송 Round 4: ㅁ ㄹ ㄱ ㅌ ㅇ 한 줄, 모음 점프만. 정답 암탉 (점프 5번, 글자 다시 쓰기)
const ROUND4 = {
  tiles: [t(0, 0, 'ㅁ'), t(1, 0, 'ㄹ'), t(2, 0, 'ㄱ'), t(3, 0, 'ㅌ'), t(4, 0, 'ㅇ'), t(5, 0, null)],
  start: [0, 0], goal: [5, 0], rules: { vowelOnly: true },
};

test('규칙 설명 예시: 규칙은 칙(자음) 다음 규(모음 아래 2칸)', () => {
  const path = H.findPath(EXAMPLE, '규칙');
  assert.deepEqual(path.map((s) => [s.syllable, s.type]), [['칙', 'consonant'], ['규', 'vowel']]);
  assert.equal(H.findPath(EXAMPLE, '경축'), null);
});

test('방송 Round 3: 유광 (ㅠ 아래 2칸 → ㅘ 오른쪽 위)', () => {
  const path = H.findPath(ROUND3, '유광');
  assert.ok(path);
  assert.deepEqual(path.map((s) => s.syllable), ['유', '광']);
  assert.deepEqual(path[1].to, [2, 1]);
});

test('방송 Round 4: 암탉 (글자를 다시 써서 점프 5번)', () => {
  const path = H.findPath(ROUND4, '암탉');
  assert.ok(path);
  assert.equal(path.length, 5);
  assert.deepEqual(path.map((s) => s.syllable), ['암', '탉', '탉', '탉', '암']);
});

test('두 글자를 모두 한 번 이상 써야 한다', () => {
  // ㄱ ㄴ 깃발 한 줄: 가(→1) 나(→1). 가가는 ㄴ 칸에서 쓸 글자가 없다.
  const b = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, 'ㄴ'), t(2, 0, null)], start: [0, 0], goal: [2, 0] };
  assert.ok(H.findPath(b, '가나'));
  assert.equal(H.findPath(b, '가가'), null);
  // 갈래: 갈(ㄱ→ㄹ 자음) 래(→1). 갈만으로 깃발에 닿는 판에서 래를 안 쓰면 실패
  const b2 = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, 'ㄴ')], start: [0, 0], goal: [1, 0] };
  assert.equal(H.findPath(b2, '가지'), null);
});

test('밟고 있는 자음이 없는 글자는 쓸 수 없다 (부엌 회귀)', () => {
  const b = { tiles: [t(0, 0, 'ㅇ'), t(1, 0, 'ㅌ'), t(2, 1, 'ㅋ'), t(2, 2, null)], start: [0, 0], goal: [2, 2] };
  assert.equal(H.findPath(b, '부엌'), null);
  assert.ok(H.findPath(b, '쿠엌'));
});

test('글자별 점프: 숨/연/질/꼭/바, 복합모음, 겹받침', () => {
  assert.deepEqual(H.abilitiesOf('숨'), { letters: ['ㅅ', 'ㅁ'], consonants: ['ㅅ', 'ㅁ'], vector: [0, 1] });
  assert.deepEqual(H.abilitiesOf('연'), { letters: ['ㅇ', 'ㄴ'], consonants: ['ㅇ', 'ㄴ'], vector: [-2, 0] });
  assert.deepEqual(H.abilitiesOf('질').vector, null);
  assert.deepEqual(H.abilitiesOf('꼭').consonants, null);
  assert.deepEqual(H.abilitiesOf('와').vector, [1, -1]);
  assert.deepEqual(H.abilitiesOf('탉').letters, ['ㅌ', 'ㄹ', 'ㄱ']);
});

test('제약 조건: 모음만, 모든 칸, 점프 횟수', () => {
  const r4free = { ...ROUND4, rules: {} };
  // 모음 제약이 없으면 탉의 ㄹ→ㅌ 자음 점프로 지름길이 생겨 점프 4번이면 된다
  assert.equal(H.findPath(r4free, '암탉').length, 4);
  assert.equal(H.findPath({ ...ROUND4, rules: { vowelOnly: true, maxJumps: 4 } }, '암탉'), null);
  assert.ok(H.findPath({ ...ROUND4, rules: { vowelOnly: true, exactJumps: 5 } }, '암탉'));
  const all = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, 'ㅁ'), t(2, 0, null)], start: [0, 0], goal: [2, 0], rules: { visitAll: true } };
  assert.ok(H.findPath(all, '가마'));
  assert.equal(H.findPath({ ...all, tiles: [...all.tiles, t(0, 1, 'ㅅ')] }, '가마'), null);
});

test('diagnose: 실패 이유를 구분한다', () => {
  assert.equal(H.diagnose(EXAMPLE, '가나').reason, 'start');
  assert.equal(H.diagnose({ ...ROUND4, rules: { vowelOnly: true, maxJumps: 4 } }, '암탉').reason, 'jumps');
  assert.ok(H.diagnose(EXAMPLE, '규칙').ok);
});

test('20개 스테이지: 모든 정답이 통하고, 5스테이지마다 보스', () => {
  global.window = global.window || {};
  require('../stages.js');
  const stages = window.STAGES;
  assert.equal(stages.length, 20);
  stages.forEach((st, i) => {
    assert.equal(st.n, i + 1);
    assert.equal(st.boss, (i + 1) % 5 === 0);
    assert.ok(st.answers.length >= 1, 'stage ' + st.n);
    for (const w of st.answers) assert.ok(H.findPath(st.board, w), st.n + ' ' + w);
  });
});

test('모든 경로 단계가 규칙대로 성립한다 (엔진과 독립 검증)', () => {
  global.window = global.window || {};
  require('../stages.js');
  const base = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
  const split = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  for (const st of window.STAGES) {
    const b = st.board;
    const r = H.rulesOf(b);
    const at = (p) => b.tiles.find((x) => x.x === p[0] && x.y === p[1]);
    for (const w of st.answers) {
      const path = H.findPath(b, w);
      let pos = b.start;
      const used = new Set();
      const seen = new Set([pos.join()]);
      path.forEach((s, i) => {
        const ch = w[s.index];
        const d = H.decompose(ch);
        const parts = [d.cho, ...[...(split[d.jong] || d.jong)]].map((c) => base[c] || c);
        assert.ok(parts.includes(at(pos).c), st.n + ' ' + w + ': ' + at(pos).c + ' 칸에서 ' + ch);
        if (s.type === 'vowel') {
          assert.ok(!r.consonantOnly);
          assert.deepEqual(s.to, [pos[0] + s.vector[0], pos[1] + s.vector[1]]);
        } else {
          assert.ok(!r.vowelOnly);
          assert.ok(parts.includes(at(s.to).c) && at(s.to).c !== at(pos).c);
        }
        assert.ok(at(s.to));
        if (i < path.length - 1) assert.notDeepEqual(s.to, b.goal);
        used.add(s.index);
        pos = s.to;
        seen.add(pos.join());
      });
      assert.deepEqual(pos, b.goal);
      assert.equal(used.size, 2, st.n + ' ' + w + ' 두 글자 모두 사용');
      if (r.visitAll) assert.equal(seen.size, b.tiles.length);
      if (r.maxJumps) assert.ok(path.length <= r.maxJumps);
      if (r.exactJumps) assert.equal(path.length, r.exactJumps);
    }
  }
});

test('실시간 생성기: 난이도별로 규칙대로 풀리는 문제를 만들고, 같은 시드면 같은 문제', () => {
  global.window = global.window || {};
  require('../fam.js');
  const G = require('../gen.js');
  const ctx = G.makeContext(window.FAM);
  for (const lv of ['easy', 'normal', 'hard']) {
    for (let i = 0; i < 15; i++) {
      const p = G.generate(ctx, lv, G.mulberry32(G.hashSeed(lv + i)));
      assert.ok(p, lv + i);
      const L = G.LEVELS[lv];
      assert.ok(p.answers.length >= L.fam[0] && p.answers.length <= L.fam[1]);
      for (const w of p.answers) assert.ok(H.findPath(p.board, w), lv + ' ' + w);
    }
  }
  const a = G.generate(ctx, 'hard', G.mulberry32(G.hashSeed('daily:2026-10-09:2')));
  const b = G.generate(ctx, 'hard', G.mulberry32(G.hashSeed('daily:2026-10-09:2')));
  assert.deepEqual(a, b);
});
