(function () {
  const H = window.HangulHide;
  const $ = (q) => document.querySelector(q);
  const G = 0.14;
  const ORANGE = '#FF8A3D'; const PURPLE = '#9B6BFF';
  const ARROWS = { '1,0': '→', '-1,0': '←', '0,-1': '↑', '0,1': '↓', '1,-1': '↗', '-1,1': '↙', '-1,-1': '↖', '1,1': '↘' };
  const reduceMotion = false;
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  // 모음 그림: 튀어나온 획만 보라색으로 칠해, 그 방향과 획 수가 곧 점프라는 걸 보여 준다.
  const VG = (() => {
    const V = (x, a, b) => [x, a, x, b];
    const Hz = (y, a, b) => [a, y, b, y];
    // [기본 획들, 튀어나온 획들] (24x24 칸 좌표)
    const S = {
      'ㅏ': [[V(11, 3, 21)], [Hz(12, 11, 18)]],
      'ㅑ': [[V(11, 3, 21)], [Hz(9, 11, 18), Hz(15, 11, 18)]],
      'ㅓ': [[V(14, 3, 21)], [Hz(12, 7, 14)]],
      'ㅕ': [[V(14, 3, 21)], [Hz(9, 7, 14), Hz(15, 7, 14)]],
      'ㅐ': [[V(9, 3, 21), V(17, 3, 21)], [Hz(12, 9, 17)]],
      'ㅒ': [[V(9, 3, 21), V(17, 3, 21)], [Hz(9, 9, 17), Hz(15, 9, 17)]],
      'ㅔ': [[V(10, 3, 21), V(18, 3, 21)], [Hz(12, 4, 10)]],
      'ㅖ': [[V(10, 3, 21), V(18, 3, 21)], [Hz(9, 4, 10), Hz(15, 4, 10)]],
      'ㅗ': [[Hz(17, 3, 21)], [V(12, 10, 17)]],
      'ㅛ': [[Hz(17, 3, 21)], [V(9, 10, 17), V(15, 10, 17)]],
      'ㅜ': [[Hz(8, 3, 21)], [V(12, 8, 15)]],
      'ㅠ': [[Hz(8, 3, 21)], [V(9, 8, 15), V(15, 8, 15)]],
      'ㅡ': [[Hz(12, 3, 21)], []],
      'ㅣ': [[V(12, 3, 21)], []],
      'ㅢ': [[Hz(14, 2, 14), V(18, 3, 21)], []],
      'ㅚ': [[Hz(17, 2, 14), V(18, 3, 21)], [V(8, 11, 17)]],
      'ㅟ': [[Hz(8, 2, 14), V(18, 3, 21)], [V(8, 8, 14)]],
      'ㅘ': [[Hz(17, 2, 13), V(17, 3, 21)], [V(7.5, 11, 17), Hz(11, 17, 22)]],
      'ㅙ': [[Hz(17, 2, 11), V(14, 3, 21), V(20, 3, 21)], [V(6.5, 11, 17), Hz(11, 14, 20)]],
      'ㅝ': [[Hz(8, 2, 12), V(20, 3, 21)], [V(7, 8, 14), Hz(14, 14, 20)]],
      'ㅞ': [[Hz(8, 2, 10), V(15, 3, 21), V(21, 3, 21)], [V(6, 8, 14), Hz(14, 10, 15)]],
    };
    const line = (l, cls) => '<line' + (cls ? ' class="' + cls + '"' : '') + ' x1="' + l[0] + '" y1="' + l[1] + '" x2="' + l[2] + '" y2="' + l[3] + '"/>';
    return (v) => {
      const s = S[v];
      if (!s) return v;
      return '<svg class="vg" viewBox="0 0 24 24" role="img" aria-label="' + v + '">' + s[0].map((l) => line(l)).join('') + s[1].map((l) => line(l, 'pr')).join('') + '</svg>';
    };
  })();

  function el(tag, cls, html) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }
  function svgEl(tag, attrs) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    return e;
  }
  const setPos = (e, p) => { e.style.setProperty('--x', p[0]); e.style.setProperty('--y', p[1]); };
  const center = (p) => [p[0] * (1 + G) + 0.5, p[1] * (1 + G) + 0.5];

  function renderBoard(host, board) {
    return drawBoard(host, board);
  }

  // 칸 크기: 평소엔 화면 폭에 맞추고, 키패드가 올라와 있으면 남은 높이 안에 판 전체가 들어오게 더 줄인다.
  // availH를 주면 그 높이를 기준으로 미리 계산한다(키패드가 올라오는 동안 판이 함께 줄어들게).
  function sizeBoard(host, availH) {
    const byWidth = 'calc((min(100vw, 520px) - 40px) / ' + host.dataset.span + ')';
    let cap = '80px';
    const cs = getComputedStyle(host);
    const h = (availH != null ? availH : host.clientHeight) - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    if (host.clientHeight && h > 0) cap = Math.max(26, Math.min(80, Math.floor((h - 8) / Number(host.dataset.tall)))) + 'px';
    host.style.setProperty('--cell', 'min(' + cap + ', ' + byWidth + ')');
  }

  function drawBoard(host, board) {
    const cols = Math.max(...board.tiles.map((t) => t.x)) + 1;
    const rows = Math.max(...board.tiles.map((t) => t.y)) + 1;
    host.innerHTML = '';
    // 열이 많은 판(외길 등)도 화면 폭 안에 들어오도록 칸 크기를 열 수에 맞춘다.
    const span = cols * (1 + G) - G + 0.6;
    host.dataset.span = Math.max(5.2, span).toFixed(2);
    host.dataset.tall = (rows * (1 + G) - G + 0.95).toFixed(2);
    if (!host.classList.contains('demo')) sizeBoard(host);
    const mat = el('div', 'mat');
    const plane = el('div', 'plane');
    plane.style.setProperty('--cols', cols);
    plane.style.setProperty('--rows', rows);
    const occupied = new Set(board.tiles.map((t) => t.x + ',' + t.y));
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      if (occupied.has(x + ',' + y)) continue;
      const v = el('div', 'void');
      setPos(v, [x, y]);
      plane.append(v);
    }
    for (const t of board.tiles) {
      const isStart = t.x === board.start[0] && t.y === board.start[1];
      const isGoal = t.x === board.goal[0] && t.y === board.goal[1];
      const tile = el('div', 'tile' + (isStart ? ' start' : '') + (isGoal ? ' goal' : ''));
      tile.dataset.key = t.x + ',' + t.y;
      setPos(tile, [t.x, t.y]);
      if (isGoal) { tile.setAttribute('aria-label', '깃발'); tile.append(el('span', 'flag', FLAG)); }
      if (t.c) tile.append(el('span', 'glyph', t.c));
      plane.append(tile);
    }
    const w = cols * (1 + G) - G;
    const h = rows * (1 + G) - G;
    const svg = svgEl('svg', { class: 'lines', viewBox: '0 0 ' + w + ' ' + h, 'aria-hidden': 'true' });
    svg.append(svgEl('g', { class: 'g-preview' }), svgEl('g', { class: 'g-path' }));
    plane.append(svg);
    const pawn = el('div', 'pawn still', '<i></i>');
    setPos(pawn, board.start);
    plane.append(pawn);
    mat.append(plane);
    host.append(mat);
    requestAnimationFrame(() => pawn.classList.remove('still'));
    return plane;
  }

  const tileAt = (plane, p) => plane.querySelector('.tile[data-key="' + p[0] + ',' + p[1] + '"]');

  function drawArrow(g, from, to, color, o = {}) {
    const [x1, y1] = center(from);
    const [x2, y2] = center(to);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const px = -uy, py = ux;
    const sx = x1 + ux * 0.42, sy = y1 + uy * 0.42;
    const ex = x2 - ux * 0.4, ey = y2 - uy * 0.4;
    const f = (n) => n.toFixed(3);
    const grp = svgEl('g', { class: o.faint ? 'faint' + (o.far ? ' far' : '') : '' });
    const line = svgEl('line', { x1: f(sx), y1: f(sy), x2: f(ex), y2: f(ey), stroke: color, 'stroke-width': o.faint ? 0.06 : 0.1, 'stroke-linecap': 'round' });
    const pts = [[ex + ux * 0.22, ey + uy * 0.22], [ex + px * 0.15, ey + py * 0.15], [ex - px * 0.15, ey - py * 0.15]];
    const head = svgEl('polygon', { class: 'head', points: pts.map((p) => f(p[0]) + ',' + f(p[1])).join(' '), fill: color });
    grp.append(line, head);
    let label = null;
    if (o.label) {
      label = svgEl('text', { x: f((sx + ex) / 2 + px * 0.28), y: f((sy + ey) / 2 + py * 0.28), fill: color, 'text-anchor': 'middle', 'dominant-baseline': 'central' });
      label.textContent = o.label;
      grp.append(label);
    }
    g.append(grp);
    if (o.animate && !reduceMotion) {
      const L = Math.hypot(ex - sx, ey - sy);
      line.style.strokeDasharray = L;
      line.style.strokeDashoffset = L;
      head.style.opacity = 0;
      if (label) label.style.opacity = 0;
      line.getBoundingClientRect();
      line.style.transition = 'stroke-dashoffset .34s ease-out';
      line.style.strokeDashoffset = 0;
      setTimeout(() => { head.style.opacity = 1; if (label) label.style.opacity = 1; }, 260);
    }
  }

  function resetPath(plane, board) {
    plane.querySelector('.g-path').innerHTML = '';
    plane.querySelector('.g-preview').innerHTML = '';
    plane.querySelectorAll('.tile.lit').forEach((t) => t.classList.remove('lit'));
    const pawn = plane.querySelector('.pawn');
    if (board) setPos(pawn, board.start);
  }

  async function playStep(plane, s) {
    const color = s.type === 'consonant' ? ORANGE : PURPLE;
    drawArrow(plane.querySelector('.g-path'), s.from, s.to, color, { label: s.syllable, animate: true });
    await sleep(300);
    const pawn = plane.querySelector('.pawn');
    setPos(pawn, s.to);
    pawn.classList.remove('hop');
    void pawn.offsetWidth;
    pawn.classList.add('hop');
    await sleep(460);
    const tile = tileAt(plane, s.to);
    if (tile) { tile.style.setProperty('--glow-c', color); tile.classList.add('lit'); }
  }

  window.Promo = { el, svgEl, setPos, center, drawBoard, tileAt, drawArrow, resetPath, playStep, VG, ORANGE, PURPLE, sleep, H };
})();