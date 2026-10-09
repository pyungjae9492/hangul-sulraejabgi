// 친숙한 2글자 명사와 빈도 점수를 fam.js 로 만든다. 사용법: node scripts/build-fam.js
global.window = {};
require('../words.js');
const fs = require('fs');
const path = require('path');
const F = require('./freq.json');
const MIN = 30;
const list = window.WORDS.filter((w) => (F[w] || 0) >= MIN).sort((a, b) => F[b] - F[a]);
const out = list.map((w) => w + ':' + F[w]).join(' ');
fs.writeFileSync(path.join(__dirname, '..', 'fam.js'),
  '// 출제에 쓰는 친숙한 2글자 명사와 자막 빈도 점수 (scripts/build-fam.js)\nwindow.FAM = ' + JSON.stringify(out) + '.split(" ").map((x) => x.split(":")).map(([w, n]) => [w, Number(n)]);\n');
console.log('fam', list.length);
