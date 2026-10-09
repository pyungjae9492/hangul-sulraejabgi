const test = require('node:test');
const assert = require('node:assert/strict');
const H = require('../engine.js');

// 영상 예시 문제: 출발 ㅊ, 도착 빈 칸. 정답 "규칙", 오답 "경축".
const exampleBoard = {
  tiles: [
    { x: 0, y: 0, c: 'ㅊ' },
    { x: 1, y: 1, c: 'ㄱ' },
    { x: 0, y: 2, c: 'ㅇ' },
    { x: 1, y: 3, c: null },
  ],
  start: [0, 0],
  goal: [1, 3],
  cond: 'none',
};

test('영상 예시: 규칙은 정답, 칙(자음) 다음 규(모음 아래 2칸)', () => {
  const path = H.findPath(exampleBoard, '규칙');
  assert.ok(path);
  assert.deepEqual(path.map((s) => [s.syllable, s.type]), [['칙', 'consonant'], ['규', 'vowel']]);
  assert.deepEqual(path[1].to, [1, 3]);
});

test('영상 예시: 경축은 오답', () => {
  assert.equal(H.findPath(exampleBoard, '경축'), null);
});

test('글자별 능력: 숨/연/질/꼭/바 (영상 설명)', () => {
  assert.deepEqual(H.abilitiesOf('숨'), { consonants: ['ㅅ', 'ㅁ'], vector: [0, 1] });
  assert.deepEqual(H.abilitiesOf('연'), { consonants: ['ㅇ', 'ㄴ'], vector: [-2, 0] });
  assert.deepEqual(H.abilitiesOf('질'), { consonants: ['ㅈ', 'ㄹ'], vector: null });
  assert.deepEqual(H.abilitiesOf('꼭'), { consonants: null, vector: [0, -1] });
  assert.deepEqual(H.abilitiesOf('바'), { consonants: null, vector: [1, 0] });
});

test('복합모음은 대각선 이동, 겹받침은 구성 자음 모두 사용', () => {
  assert.deepEqual(H.abilitiesOf('와').vector, [1, -1]);
  assert.deepEqual(H.abilitiesOf('읽').consonants, ['ㅇ', 'ㄹ', 'ㄱ']);
  assert.deepEqual(H.abilitiesOf('의').vector, null);
});

test('이동할 칸이 없으면 이동할 수 없다', () => {
  const board = { tiles: [{ x: 0, y: 0, c: 'ㄴ' }, { x: 1, y: 0, c: null }], start: [0, 0], goal: [1, 0], cond: 'none' };
  // 바(오른쪽 1칸) 한 번만 이동 가능하므로 두 글자 모두 이동해야 하는 이 보드에서는 도착 불가
  assert.equal(H.findPath(board, '바나'), null);
});

test('추가 조건: 모음 능력만 사용', () => {
  const vowelBoard = { ...exampleBoard, cond: 'vowel' };
  assert.equal(H.findPath(vowelBoard, '규칙'), null);
});

test('추가 조건: 모든 칸을 거쳐야 한다', () => {
  // ㄱ(0,0) 시작 -> 바(오른쪽1) -> ㅁ(1,0)에서 마(오른쪽1) -> 도착(2,0)
  const board = {
    tiles: [{ x: 0, y: 0, c: 'ㄱ' }, { x: 1, y: 0, c: 'ㅁ' }, { x: 2, y: 0, c: null }],
    start: [0, 0], goal: [2, 0], cond: 'all',
  };
  assert.ok(H.findPath(board, '바마'));
  const board2 = { ...board, tiles: [...board.tiles, { x: 0, y: 1, c: 'ㅅ' }] };
  assert.equal(H.findPath(board2, '바마'), null);
});

test('생성된 문제는 항상 정답이 존재하고 검증과 일치한다', () => {
  const words = ['규칙', '경축', '바마', '황폐', '전략', '암탉', '숙면', '유광', '거리', '구두', '나무', '도시', '모자', '사과', '여우', '지도', '고기', '노래'];
  for (let i = 0; i < 5; i++) {
    const p = H.generatePuzzle(words, { difficulty: 'easy', maxTries: 3000 });
    if (!p) continue;
    assert.ok(p.answers.length >= 1);
    for (const a of p.answers) assert.ok(H.findPath(p.board, a.word));
  }
});

test('모든 경로 단계가 보드 위에서 실제로 성립한다 (엔진과 독립 검증)', () => {
  global.window = {};
  require('../words.js');
  const words = window.WORDS;
  for (let n = 0; n < 40; n++) {
    const p = H.generatePuzzle(words, { difficulty: 'normal' });
    const at = (x, y) => p.board.tiles.find((t) => t.x === x && t.y === y);
    for (const a of p.answers) {
      assert.equal(a.path.length, 2);
      assert.deepEqual(a.path.map((s) => s.index).sort(), [0, 1]);
      let pos = p.board.start;
      for (const s of a.path) {
        assert.deepEqual(s.from, pos);
        const ab = H.abilitiesOf(a.word[s.index]);
        if (s.type === 'consonant') {
          assert.notEqual(p.board.cond, 'vowel');
          assert.ok(ab.consonants && ab.consonants.includes(at(pos[0], pos[1]).c), a.word + ' 출발 자음');
          assert.equal(at(s.to[0], s.to[1]).c, s.target);
          assert.ok(ab.consonants.includes(s.target), a.word + ' 도착 자음');
        } else {
          assert.deepEqual(s.to, [pos[0] + ab.vector[0], pos[1] + ab.vector[1]]);
          assert.ok(at(s.to[0], s.to[1]));
        }
        pos = s.to;
      }
      assert.deepEqual(pos, p.board.goal);
      if (p.board.cond === 'all') {
        const seen = new Set([p.board.start.join()].concat(a.path.map((s) => s.to.join())));
        assert.equal(seen.size, p.board.tiles.length);
      }
    }
  }
});
test('경로 단계는 좌표(from/to)를 정확히 가진다', () => {
  const path = H.findPath(exampleBoard, '규칙');
  assert.deepEqual(path[0].from, [0, 0]);
  assert.deepEqual(path[0].to, [1, 1]);
  assert.equal(path[0].fromC, 'ㅊ');
  assert.equal(path[0].target, 'ㄱ');
  assert.deepEqual(path[1].from, [1, 1]);
  assert.deepEqual(path[1].to, [1, 3]);
});
