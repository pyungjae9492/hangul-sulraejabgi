// 랭킹 서버가 화면과 같은 코드로 문제를 만들고 답을 검사하도록, 게임 스크립트를 Edge Function용 모듈 하나로 묶는다.
// 게임 규칙·사전·보스·생성기를 바꾸면 node scripts/build-edge.js 후 함수를 다시 배포한다.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = ['words.js', 'fam.js', 'engine.js', 'gen.js', 'bosses.js', 'daily.js'];
const body = files.map((f) => '// ---- ' + f + '\n' + fs.readFileSync(path.join(root, f), 'utf8')).join('\n;\n');
// 스크립트들은 self나 this에 붙는데, Deno에는 전역 self가 있어서 둘 다 같은 객체를 가리키게 막아 둔다.
const out = '// 자동 생성 파일: node scripts/build-edge.js\n// deno-lint-ignore-file\nconst window = {};\nconst self = window;\n(function () {\n' + body + '\n}).call(window);\nexport default window;\n';
fs.writeFileSync(path.join(root, 'supabase/functions/daily/game.js'), out);
console.log('game.js', (out.length / 1024).toFixed(0) + 'KB');
