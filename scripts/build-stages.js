// 20개 스테이지를 미리 만들어 stages.js 로 저장한다.
// 사용법: node scripts/build-stages.js
global.window = {};
require('../words.js');
const H = require('../engine.js');
const fs = require('fs');
const path = require('path');

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// [스테이지, 칸 수, 조건, 정답 수 최소, 최대, 보스]
const SPEC = [
  [1, 3, 'none', 12, 60], [2, 3, 'none', 8, 40], [3, 4, 'none', 6, 25], [4, 4, 'none', 5, 18], [5, 4, 'none', 1, 2, true],
  [6, 4, 'vowel', 4, 14], [7, 4, 'none', 4, 12], [8, 5, 'none', 3, 10], [9, 4, 'vowel', 3, 8], [10, 5, 'vowel', 1, 2, true],
  [11, 3, 'all', 3, 12], [12, 5, 'none', 3, 8], [13, 3, 'all', 2, 6], [14, 5, 'none', 2, 6], [15, 5, 'none', 1, 1, true],
  [16, 6, 'none', 2, 5], [17, 3, 'all', 1, 4], [18, 5, 'vowel', 2, 5], [19, 6, 'none', 1, 3], [20, 6, 'none', 1, 1, true],
];
// 너무 낯선 단어가 유일한 정답이 되는 판을 피하려고 시드를 건너뛸 수 있다.
const SKIP = JSON.parse(process.env.SKIP || '{}');

const words = window.WORDS;
const out = [];
for (const [n, tiles, cond, min, max, boss] of SPEC) {
  let found = null;
  const skip = SKIP[n] || 0;
  let hits = 0;
  for (let a = 0; a < 20000 && !found; a++) {
    const b = H.randomBoard(tiles, cond, mulberry32(n * 100003 + a));
    const board = { tiles: b.tiles, start: b.start, goal: b.goal, cond };
    const answers = H.solveAll(board, words).map((x) => x.word);
    if (answers.length >= min && answers.length <= max) {
      if (hits++ < skip) continue;
      found = { n, boss: !!boss, board, answers };
    }
  }
  if (!found) throw new Error('stage ' + n + ' not found');
  out.push(found);
  console.log(String(n).padStart(2), boss ? 'BOSS' : '    ', cond.padEnd(5), tiles, found.answers.length, found.answers.slice(0, 10).join(' '));
}
fs.writeFileSync(path.join(__dirname, '..', 'stages.js'),
  '// scripts/build-stages.js 로 생성한 20개 스테이지\nwindow.STAGES = ' + JSON.stringify(out) + ';\n');
