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

test('두 글자 모두 쓰기는 조건일 때만 요구된다', () => {
  // ㄱ ㄴ 깃발 한 줄. 가가는 ㄴ 칸에서 쓸 글자가 없다.
  const b = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, 'ㄴ'), t(2, 0, null)], start: [0, 0], goal: [2, 0] };
  assert.ok(H.findPath(b, '가나'));
  assert.equal(H.findPath(b, '가가'), null);
  // ㄱ 깃발: 가 하나로 닿는 판. 기본 규칙에서는 가지도 정답, useBoth 면 오답
  const b2 = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, null)], start: [0, 0], goal: [1, 0] };
  assert.ok(H.findPath(b2, '가지'));
  assert.equal(H.findPath({ ...b2, rules: { useBoth: true } }, '가지'), null);
  assert.equal(H.diagnose({ ...b2, rules: { useBoth: true } }, '가지').reason, 'used');
});

test('모든 칸 밟기(다시 밟기 허용)와 모든 칸 한 번씩만은 다르다', () => {
  // ㄱ 출발, 오른쪽 ㄴ, 아래 깃발. 간구: 간(→1) ㄱ→ㄴ, 간(자음) ㄴ→ㄱ, 구(↓1) 깃발.
  // ㄱ 칸을 두 번 밟아야만 모든 칸을 지날 수 있다.
  const back = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, 'ㄴ'), t(0, 1, null)], start: [0, 0], goal: [0, 1] };
  assert.ok(H.findPath({ ...back, rules: { visitAll: true } }, '간구'));
  assert.equal(H.findPath({ ...back, rules: { visitOnce: true } }, '간구'), null);
  assert.equal(H.diagnose({ ...back, rules: { visitOnce: true } }, '간구').reason, 'visit');
  // 되돌아가지 않고 한 줄로 지나는 판에서는 둘 다 통과
  const row = { tiles: [t(0, 0, 'ㄱ'), t(1, 0, 'ㄴ'), t(2, 0, null)], start: [0, 0], goal: [2, 0] };
  assert.ok(H.findPath({ ...row, rules: { visitOnce: true } }, '가나'));
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
  // 모음 제약이 없으면 암의 ㅁ→ㅇ 자음 점프로 2번 만에 닿는다. 두 글자 모두 쓰기를 걸면 탉도 써야 해서 4번.
  assert.equal(H.findPath(r4free, '암탉').length, 2);
  assert.equal(H.findPath({ ...ROUND4, rules: { useBoth: true } }, '암탉').length, 4);
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

// 오늘의 도전에 나오는 문제들: 보스 풀 전체 + 며칠치 생성 문제
function dailyProblems() {
  global.window = global.window || {};
  require('../bosses.js');
  require('../fam.js');
  const G = require('../gen.js');
  const ctx = G.makeContext(window.FAM);
  const out = [];
  for (const n of [5, 10, 15, 20]) window.BOSSES[n].pool.forEach((p, i) => out.push({ n: n + '#' + i, board: p.board, answers: p.answers }));
  for (const date of ['2026-10-09', '2026-10-10']) {
    for (let n = 1; n <= 20; n++) {
      if (n % 5 === 0) continue;
      const lv = G.levelForStage(n);
      const p = G.generate(ctx, lv, G.mulberry32(G.hashSeed('daily:' + date + ':' + n)), { maxTries: 20000 });
      out.push({ n: date + ':' + n, board: p.board, answers: p.answers });
    }
  }
  return out;
}

test('보스 풀: 슬롯마다 문제가 있고 정답은 1~2개', () => {
  global.window = global.window || {};
  require('../bosses.js');
  for (const n of [5, 10, 15, 20]) {
    const slot = window.BOSSES[n];
    assert.ok(slot.pool.length >= 5, n + ' pool');
    for (const p of slot.pool) {
      assert.ok(p.answers.length >= 1 && p.answers.length <= 2);
      for (const w of p.answers) assert.ok(H.findPath(p.board, w), n + ' ' + w);
    }
  }
  assert.equal(window.BOSSES[5].pool[0].key, '암탉');
});

test('모든 경로 단계가 규칙대로 성립한다 (엔진과 독립 검증)', () => {
  const base = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
  const split = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  for (const st of dailyProblems()) {
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
      if (r.useBoth) assert.equal(used.size, 2, st.n + ' ' + w + ' 두 글자 모두 사용');
      if (r.visitAll || r.visitOnce) assert.equal(seen.size, b.tiles.length);
      if (r.visitOnce) assert.equal(seen.size, path.length + 1, st.n + ' ' + w + ' 한 번씩만');
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

test('오늘의 도전: 화면과 랭킹 서버가 같은 파일(daily.js)로 같은 20문제를 만든다', () => {
  global.window = global.window || {};
  require('../fam.js');
  require('../bosses.js');
  const G = require('../gen.js');
  const D = require('../daily.js');
  const a = D.buildSet('2026-10-09', G.makeContext(window.FAM), window.BOSSES);
  const b = D.buildSet('2026-10-09', G.makeContext(window.FAM), window.BOSSES);
  assert.equal(a.length, D.TOTAL);
  assert.deepEqual(a.map((s) => s.key), b.map((s) => s.key));
  assert.deepEqual(a.filter((s) => s.boss).map((s) => s.n), D.BOSS_AT);
  assert.equal(new Set(a.map((s) => s.key)).size, D.TOTAL);
  for (const s of a) assert.ok(H.findPath(s.board, s.key), s.n + ' ' + s.key);
  assert.deepEqual([D.MAX_HINTS, D.MAX_RESUMES], [3, 5]);
});

test('랭킹 서버용 game.js가 지금 게임 코드와 같다 (바꿨으면 node scripts/build-edge.js 후 재배포)', () => {
  const fs = require('fs');
  const path = require('path');
  const file = path.join(__dirname, '../supabase/functions/daily/game.js');
  const before = fs.readFileSync(file, 'utf8');
  require('child_process').execFileSync('node', [path.join(__dirname, '../scripts/build-edge.js')]);
  assert.equal(fs.readFileSync(file, 'utf8'), before);
});

test('게임 키패드: 두벌식 조합 (겹모음·겹받침·받침 넘어가기)', () => {
  const K = require('../keypad.js');
  const t = (s) => K.compose([...s]);
  assert.equal(t('ㄱㅠㅊㅣㄱ'), '규칙');
  assert.equal(t('ㅇㅏㅁㅌㅏㄹㄱ'), '암탉');
  assert.equal(t('ㅇㅠㄱㅗㅏㅇ'), '유광');
  assert.equal(t('ㄷㅏㄹㄱㅏ'), '달가');
  assert.equal(t('ㅇㅡㅣㅅㅏ'), '의사');
  assert.equal(t('ㄲㅗㄱ'), '꼭');
  for (const w of ['규칙', '닭', '값', '삶', '왜', '쥐', '의사']) assert.equal(K.compose(K.toKeys(w)), w);
});

