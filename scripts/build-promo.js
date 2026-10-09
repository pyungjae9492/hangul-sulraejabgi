// 공유용 영상 페이지가 게임과 같은 판·말·화살표 코드를 쓰도록 app.js에서 필요한 부분만 뽑아 promo-lib.js로 만든다.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const s = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const lines = s.split('\n');
const pick = (from, to) => lines.slice(from - 1, to).join('\n');
const find = (re) => lines.findIndex((l) => re.test(l)) + 1;
const out = [
  '(function () {',
  '  const H = window.HangulHide;',
  "  const $ = (q) => document.querySelector(q);",
  '  const G = 0.14;',
  "  const ORANGE = '#FF8A3D'; const PURPLE = '#9B6BFF';",
  "  const ARROWS = { '1,0': '→', '-1,0': '←', '0,-1': '↑', '0,1': '↓', '1,-1': '↗', '-1,1': '↙', '-1,-1': '↖', '1,1': '↘' };",
  '  const reduceMotion = false;',
  "  const SVGNS = 'http://www.w3.org/2000/svg';",
  '  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));',
  "  const FLAG = '<svg viewBox=\"0 0 24 24\" aria-hidden=\"true\"><path d=\"M6 21V4h11l-2.5 4L17 12H6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>';",
  pick(find(/\/\/ 모음 그림:/), find(/^  const RULE_TEXT/) - 1),
  pick(find(/^  function el\(/), find(/^  function drawBoard/) - 1),
  pick(find(/^  function drawBoard/), find(/^  async function playPath/) - 1),
  '  window.Promo = { el, svgEl, setPos, center, drawBoard, tileAt, drawArrow, resetPath, playStep, VG, ORANGE, PURPLE, sleep, H };',
  '})();',
].join('\n');
fs.writeFileSync(path.join(root, 'design/promo-lib.js'), out);
console.log('promo-lib.js', out.length);

