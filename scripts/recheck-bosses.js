// 규칙이 바뀌었을 때 보스 풀을 다시 검사한다. 사용법: node scripts/recheck-bosses.js
// 친숙한 정답이 2개를 넘으면 "두 글자 모두 쓰기"를 붙여 보고, 그래도 넘으면 풀에서 뺀다.
global.window = {};
require('../words.js');
require('../bosses.js');
const H = require('../engine.js');
const fs = require('fs');
const path = require('path');
const F = require('./freq.json');
const fam = (w) => F[w] || 0;
const FAM = window.WORDS.filter((w) => fam(w) >= 15).sort((a, b) => fam(b) - fam(a));
const famAnswers = (b, key) => H.solveAll(b, FAM.includes(key) ? FAM : [key].concat(FAM)).map((x) => x.word);
// 방송 문제(Round 4 암탉)는 외길 풀의 첫 문제로 항상 둔다
const ROUND4 = { board: { tiles: [{ x: 0, y: 0, c: 'ㅁ' }, { x: 1, y: 0, c: 'ㄹ' }, { x: 2, y: 0, c: 'ㄱ' }, { x: 3, y: 0, c: 'ㅌ' }, { x: 4, y: 0, c: 'ㅇ' }, { x: 5, y: 0, c: null }], start: [0, 0], goal: [5, 0], rules: { vowelOnly: true } }, answers: ['암탉'], key: '암탉' };
const B = window.BOSSES;
if (!B[5].pool.some((p) => p.key === '암탉')) B[5].pool.unshift(ROUND4);
for (const n of [5, 10, 15, 20]) {
  const kept = [];
  for (const p of B[n].pool) {
    let ans = famAnswers(p.board, p.key);
    let note = '';
    if (ans.length > 2 || !ans.includes(p.key)) {
      p.board.rules = Object.assign({}, p.board.rules, { useBoth: true });
      ans = famAnswers(p.board, p.key);
      note = ' +useBoth';
    }
    if (!ans.includes(p.key) || ans.length > 2) { console.log(n, 'drop', p.key, ans.slice(0, 6).join(',')); continue; }
    p.answers = [p.key].concat(ans.filter((w) => w !== p.key));
    kept.push(p);
    if (note) console.log(n, p.key, note, ans.join(','));
  }
  B[n].pool = kept;
  console.log(n, B[n].title, 'pool', kept.length);
}
fs.writeFileSync(path.join(__dirname, '..', 'bosses.js'), '// scripts/build-bosses.js 로 만들고 scripts/recheck-bosses.js 로 검사한 오늘의 도전 보스 풀\nwindow.BOSSES = ' + JSON.stringify(B) + ';\n');
