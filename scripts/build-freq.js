// 자막 빈도 목록(어절)에서 조사를 떼어 2글자 명사별 친숙도를 합산한다.
// 사용법: node scripts/build-freq.js <ko_50k.txt>
// 출처: https://github.com/hermitdave/FrequencyWords (CC-BY-SA 4.0, OpenSubtitles 2018)
global.window = {};
require('../words.js');
const fs = require('fs');
const path = require('path');
const JOSA = ['에서는', '에게서', '한테서', '으로는', '이라고', '이라는', '이에요', '이었어', '이랑', '이나', '이야', '이지', '이다', '에서', '에게', '한테', '으로', '까지', '부터', '처럼', '보다', '마다', '조차', '라고', '라는', '이요', '예요', '은', '는', '이', '가', '을', '를', '에', '의', '도', '만', '과', '와', '로', '랑', '나', '야', '요'];
const nouns = new Set(window.WORDS.concat(window.WORDS_EXTRA));
const score = new Map();
for (const line of fs.readFileSync(process.argv[2], 'utf8').trim().split('\n')) {
  const [w, c] = line.split(' ');
  const n = Number(c);
  const add = (k) => { if (nouns.has(k)) score.set(k, (score.get(k) || 0) + n); };
  if (w.length === 2) { add(w); continue; }
  if (w.length > 2) {
    const stem = w.slice(0, 2);
    if (JOSA.includes(w.slice(2))) add(stem);
  }
}
const out = {};
for (const [k, v] of score) if (v >= 3) out[k] = v;
fs.writeFileSync(path.join(__dirname, 'freq.json'), JSON.stringify(out));
console.log('scored', Object.keys(out).length);
