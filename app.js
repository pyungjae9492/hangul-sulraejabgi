(() => {
  'use strict';

  const H = window.HangulHide;
  const WORDS = window.WORDS || [];
  const WORD_SET = new Set(WORDS.concat(window.WORDS_EXTRA || []));
  const $ = (s) => document.querySelector(s);

  const LOCK_MS = 30000;
  const WIN_POINTS = 2;
  const G = 0.14; // 칸 사이 간격 (칸 크기 대비)
  const ORANGE = '#FF8A3D';
  const PURPLE = '#9B6BFF';
  const PLAYERS = [
    { name: '나', human: true, color: '#FFD166', skill: 1 },
    { name: '서연', color: '#6EC1FF', skill: 0.9 },
    { name: '민준', color: '#B7E36B', skill: 1.1 },
  ];
  const CPU_SECONDS = { easy: [22, 55], normal: [12, 40], hard: [8, 30] };
  const CPU_MISTAKE = { easy: 0.25, normal: 0.15, hard: 0.08 };
  const EXAMPLE = {
    tiles: [{ x: 0, y: 0, c: 'ㅊ' }, { x: 1, y: 1, c: 'ㄱ' }, { x: 0, y: 2, c: 'ㅇ' }, { x: 1, y: 3, c: null }],
    start: [0, 0], goal: [1, 3], cond: 'none',
  };
  const DIRS = { '1,0': '오른쪽', '-1,0': '왼쪽', '0,-1': '위', '0,1': '아래', '1,-1': '오른쪽 위', '-1,1': '왼쪽 아래', '-1,-1': '왼쪽 위', '1,1': '오른쪽 아래' };
  const ARROWS = { '1,0': '→', '-1,0': '←', '0,-1': '↑', '0,1': '↓', '1,-1': '↗', '-1,1': '↙', '-1,-1': '↖', '1,1': '↘' };
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const SVGNS = 'http://www.w3.org/2000/svg';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const state = {
    mode: null, difficulty: localStorage.getItem('sulrae-level') || 'normal',
    players: [], round: 0, roundId: 0, open: false, over: false,
    puzzle: null, idx: null, plane: null, timers: [], solved: 0, ticker: null,
  };

  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 40) : ms));
  const rand = (a, b) => a + Math.random() * (b - a);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------- 한국어 조사 ---------- */
  const lastJong = (w) => {
    const code = w.charCodeAt(w.length - 1) - 0xac00;
    return code >= 0 && code <= 11171 ? code % 28 : 0;
  };
  const eunNeun = (w) => w + (lastJong(w) ? '은' : '는');
  const iGa = (w) => w + (lastJong(w) ? '이' : '가');
  const euro = (w) => w + (lastJong(w) && lastJong(w) !== 8 ? '으로' : '로');

  const arrowGlyph = (v) => ARROWS[Math.sign(v[0]) + ',' + Math.sign(v[1])] + Math.max(Math.abs(v[0]), Math.abs(v[1]));
  const moveText = (v) => euro(DIRS[Math.sign(v[0]) + ',' + Math.sign(v[1])]) + ' ' + Math.max(Math.abs(v[0]), Math.abs(v[1])) + '칸';

  /* ---------- 게임판 ---------- */
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
  const setPos = (e, x, y) => { e.style.setProperty('--x', x); e.style.setProperty('--y', y); };
  const center = (x, y) => [x * (1 + G) + 0.5, y * (1 + G) + 0.5];

  function renderBoard(host, board) {
    const cols = Math.max(...board.tiles.map((t) => t.x)) + 1;
    const rows = Math.max(...board.tiles.map((t) => t.y)) + 1;
    host.innerHTML = '';
    const mat = el('div', 'mat');
    const plane = el('div', 'plane');
    plane.style.setProperty('--cols', cols);
    plane.style.setProperty('--rows', rows);
    const occupied = new Set(board.tiles.map((t) => t.x + ',' + t.y));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (occupied.has(x + ',' + y)) continue;
        const v = el('div', 'void');
        setPos(v, x, y);
        plane.append(v);
      }
    }
    for (const t of board.tiles) {
      const isStart = t.x === board.start[0] && t.y === board.start[1];
      const isGoal = t.x === board.goal[0] && t.y === board.goal[1];
      const tile = el('div', 'tile' + (isStart ? ' start' : '') + (isGoal ? ' goal' : ''));
      tile.dataset.key = t.x + ',' + t.y;
      setPos(tile, t.x, t.y);
      if (isStart) tile.setAttribute('aria-label', '출발 ' + t.c);
      if (isGoal) { tile.setAttribute('aria-label', '도착'); tile.append(el('span', 'flag', FLAG)); }
      if (t.c) tile.append(el('span', 'glyph', t.c));
      plane.append(tile);
    }
    const w = cols * (1 + G) - G;
    const h = rows * (1 + G) - G;
    const svg = svgEl('svg', { class: 'lines', viewBox: '0 0 ' + w + ' ' + h, 'aria-hidden': 'true' });
    svg.append(svgEl('g', { class: 'g-preview' }), svgEl('g', { class: 'g-path' }));
    plane.append(svg);
    const pawn = el('div', 'pawn', '<i></i>');
    pawn.hidden = true;
    plane.append(pawn);
    mat.append(plane);
    host.append(mat);
    return plane;
  }

  function drawArrow(g, from, to, color, o = {}) {
    const [x1, y1] = center(from[0], from[1]);
    const [x2, y2] = center(to[0], to[1]);
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    const px = -uy, py = ux;
    const sx = x1 + ux * 0.42, sy = y1 + uy * 0.42;
    const ex = x2 - ux * 0.4, ey = y2 - uy * 0.4;
    const f = (n) => n.toFixed(3);
    const grp = svgEl('g', { class: o.faint ? 'faint' : '' });
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

  function resetPath(plane) {
    plane.querySelector('.g-path').innerHTML = '';
    plane.querySelector('.g-preview').innerHTML = '';
    plane.querySelectorAll('.tile.lit').forEach((t) => t.classList.remove('lit'));
  }

  function hop(pawn, x, y) {
    setPos(pawn, x, y);
    pawn.classList.remove('hop');
    void pawn.offsetWidth;
    pawn.classList.add('hop');
  }

  async function playPath(plane, board, path, alive, onStep) {
    resetPath(plane);
    const pawn = plane.querySelector('.pawn');
    pawn.classList.add('still');
    setPos(pawn, board.start[0], board.start[1]);
    pawn.hidden = false;
    void pawn.offsetWidth;
    pawn.classList.remove('still');
    await sleep(320);
    for (const s of path) {
      if (!alive()) return false;
      const color = s.type === 'consonant' ? ORANGE : PURPLE;
      drawArrow(plane.querySelector('.g-path'), s.from, s.to, color, { label: s.syllable, animate: true });
      if (onStep) onStep(s);
      await sleep(300);
      hop(pawn, s.to[0], s.to[1]);
      await sleep(460);
      const tile = plane.querySelector('.tile[data-key="' + s.to.join(',') + '"]');
      if (tile) { tile.style.setProperty('--glow-c', color); tile.classList.add('lit'); }
    }
    return true;
  }

  function drawStatic(plane, board, path) {
    resetPath(plane);
    for (const s of path) drawArrow(plane.querySelector('.g-path'), s.from, s.to, s.type === 'consonant' ? ORANGE : PURPLE, { label: s.syllable });
    const pawn = plane.querySelector('.pawn');
    pawn.classList.add('still');
    setPos(pawn, board.goal[0], board.goal[1]);
    pawn.hidden = false;
  }

  /* ---------- 공통 UI ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
    window.scrollTo(0, 0);
  }

  function toast(msg, kind) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast show' + (kind ? ' ' + kind : '');
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  function openSheet(id, withScrim) {
    const sheet = $(id);
    if (withScrim) {
      const scrim = $('#scrim');
      scrim.hidden = false;
      requestAnimationFrame(() => scrim.classList.add('show'));
    }
    sheet.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => sheet.classList.add('open'));
    sheet.scrollTop = 0;
  }

  function closeSheets() {
    document.querySelectorAll('.sheet.open').forEach((s) => { s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); });
    const scrim = $('#scrim');
    scrim.classList.remove('show');
    setTimeout(() => { if (!scrim.classList.contains('show')) scrim.hidden = true; }, 260);
  }

  function shake() {
    const f = $('#field');
    f.classList.remove('shake');
    void f.offsetWidth;
    f.classList.add('shake');
  }

  /* ---------- 점수판 ---------- */
  function renderScores() {
    const box = $('#scores');
    if (state.mode === 'practice') {
      box.className = 'scores solo';
      box.innerHTML = '<div class="pl me"><div class="av" style="--c:#FFD166">' + state.solved + '</div><div class="pl-meta"><span class="pl-name">연습</span><span class="pl-sub">맞힌 문제</span></div></div>';
      return;
    }
    box.className = 'scores';
    box.innerHTML = state.players.map((p) => {
      const left = Math.max(0, p.lockUntil - Date.now());
      const locked = p.status === 'active' && left > 0;
      const cls = 'pl ' + p.status + (p.human ? ' me' : '') + (locked ? ' locked' : '');
      const inner = locked ? Math.ceil(left / 1000) : p.status === 'survived' ? '✓' : p.status === 'out' ? '✕' : esc(p.name[0]);
      const pips = Array.from({ length: WIN_POINTS }, (_, i) => '<i class="' + (i < p.points ? 'on' : '') + '"></i>').join('');
      return '<div class="' + cls + '"><div class="av" style="--c:' + p.color + ';--p:' + (left / LOCK_MS).toFixed(3) + '">' + inner + '</div>' +
        '<div class="pl-meta"><span class="pl-name">' + esc(p.name) + '</span><span class="pips" aria-label="승점 ' + p.points + '점">' + pips + '</span></div></div>';
    }).join('');
  }

  function setInput(on) {
    const input = $('#answer');
    const was = input.disabled;
    input.disabled = !on;
    $('#btn-submit').disabled = !on;
    if (on && was && finePointer) input.focus();
  }

  function tick() {
    if (state.mode !== 'match') return;
    renderScores();
    const me = state.players[0];
    const left = me.lockUntil - Date.now();
    const locked = state.open && me.status === 'active' && left > 0;
    $('#lock').hidden = !locked;
    if (locked) {
      $('#lock-fill').style.width = (left / LOCK_MS) * 100 + '%';
      $('#lock-text').textContent = Math.ceil(left / 1000) + '초 정지';
    }
    setInput(state.open && me.status === 'active' && !locked);
  }

  /* ---------- 입력 중 점프 표시 ---------- */
  const typedSyllables = () => [...$('#answer').value].filter((c) => c >= '가' && c <= '힣').slice(0, 2);

  function renderAbilities() {
    const box = $('#abilities');
    const sy = typedSyllables();
    if (!sy.length) { box.innerHTML = ''; return; }
    const onlyVowel = state.puzzle && state.puzzle.board.cond === 'vowel';
    const startC = state.puzzle ? state.idx.cells.get(state.puzzle.board.start.join(',')).c : null;
    box.innerHTML = sy.map((ch) => {
      const a = H.abilitiesOf(ch);
      const chips = [];
      if (a.consonants) chips.push('<span class="chip o' + (onlyVowel ? ' blocked' : '') + '">' + a.consonants.join('↔') + '</span>');
      if (a.vector) chips.push('<span class="chip p">' + arrowGlyph(a.vector) + '</span>');
      if (!chips.length) chips.push('<span class="chip off">점프 없음</span>');
      const fromStart = startC && a.letters.includes(startC);
      return '<div class="ab' + (fromStart ? ' here' : '') + '"><b>' + ch + '</b>' + chips.join('') + '</div>';
    }).join('');
  }

  // 연습 모드: 출발 칸에서 각 글자로 갈 수 있는 첫 이동을 흐리게 보여준다.
  function drawPreview() {
    if (!state.plane) return;
    const g = state.plane.querySelector('.g-preview');
    g.innerHTML = '';
    if (state.mode !== 'practice' || !state.open) return;
    const board = state.puzzle.board;
    for (const ch of typedSyllables()) {
      for (const m of H.movesFrom(state.idx, board.start, H.abilitiesOf(ch), board.cond === 'vowel')) {
        drawArrow(g, board.start, m.to, m.type === 'consonant' ? ORANGE : PURPLE, { faint: true });
      }
    }
  }

  /* ---------- 라운드 ---------- */
  function clearTimers() {
    state.timers.forEach(clearTimeout);
    state.timers = [];
  }

  function makePuzzle() {
    for (let i = 0; i < 6; i++) {
      const p = H.generatePuzzle(WORDS, { difficulty: state.difficulty });
      if (p) return p;
    }
    return H.generatePuzzle(WORDS, { difficulty: 'easy', maxTries: 2000 });
  }

  function startGame(mode) {
    state.mode = mode;
    state.over = false;
    state.round = 0;
    state.solved = 0;
    state.players = mode === 'match' ? PLAYERS.map((p) => ({ ...p, points: 0, status: 'active', lockUntil: 0 })) : [];
    $('#tools').hidden = mode !== 'practice';
    $('#lock').hidden = true;
    closeSheets();
    show('game');
    clearInterval(state.ticker);
    state.ticker = setInterval(tick, 250);
    newRound();
  }

  function newRound() {
    closeSheets();
    $('#game').classList.remove('resolved');
    clearTimers();
    state.roundId++;
    state.round++;
    state.puzzle = makePuzzle();
    state.idx = H.makeBoardIndex(state.puzzle.board);
    state.open = true;
    state.plane = renderBoard($('#board'), state.puzzle.board);
    $('#round-label').textContent = state.mode === 'match' ? state.round + '라운드' : '연습 ' + state.round;
    const c = state.puzzle.board.cond;
    const cond = $('#cond');
    cond.hidden = c === 'none';
    cond.className = 'cond ' + c;
    cond.textContent = c === 'all' ? '모든 칸 밟기' : c === 'vowel' ? '모음 점프만' : '';
    $('#answer').value = '';
    renderAbilities();
    renderScores();
    if (state.mode === 'match') state.players.forEach((p, i) => { if (!p.human && p.status === 'active') scheduleCpu(i); });
    tick();
    setInput(true);
    if (finePointer) $('#answer').focus();
  }

  function scheduleCpu(i, extraMs) {
    const p = state.players[i];
    const [lo, hi] = CPU_SECONDS[state.difficulty];
    const n = state.puzzle.answers.length;
    const seconds = rand(lo, hi) * p.skill * (1 + 1.2 / Math.sqrt(n));
    const id = state.roundId;
    state.timers.push(setTimeout(() => cpuDeclare(i, id), seconds * 1000 + (extraMs || 0)));
  }

  function cpuDeclare(i, id) {
    if (!state.open || id !== state.roundId) return;
    const p = state.players[i];
    if (p.status !== 'active') return;
    if (Math.random() < CPU_MISTAKE[state.difficulty]) {
      p.lockUntil = Date.now() + LOCK_MS;
      toast(p.name + ' 오답');
      renderScores();
      scheduleCpu(i, LOCK_MS);
      return;
    }
    const a = state.puzzle.answers[Math.floor(Math.random() * state.puzzle.answers.length)];
    roundWon(i, a.word, a.path);
  }

  function simulateRest() {
    const rest = state.players.filter((q) => q.status === 'active');
    while (rest.some((q) => q.status === 'active')) {
      const live = rest.filter((q) => q.status === 'active');
      const w = live[Math.floor(Math.random() * live.length)];
      w.points++;
      if (w.points >= WIN_POINTS) {
        w.status = 'survived';
        rest.filter((q) => q.status === 'active').forEach((q) => { q.status = 'out'; });
      }
    }
  }

  async function roundWon(i, word, path) {
    if (!state.open) return;
    state.open = false;
    clearTimers();
    setInput(false);
    $('#lock').hidden = true;
    $('#answer').blur();
    drawPreview();
    const token = state.roundId;
    let kicker = '정답';
    let kind = 'ok';
    if (state.mode === 'practice') {
      state.solved++;
    } else {
      const p = state.players[i];
      p.points++;
      if (p.points >= WIN_POINTS) p.status = 'survived';
      if (state.players.filter((q) => q.status === 'survived').length >= 2) {
        state.players.forEach((q) => { if (q.status === 'active') q.status = 'out'; });
        state.over = true;
      } else if (state.players[0].status === 'survived') {
        simulateRest();
        state.over = true;
      }
      if (i === 0) kicker = p.status === 'survived' ? '정답 · 생존 확정' : '정답 +1';
      else { kicker = iGa(p.name) + ' 먼저 찾았어요'; kind = 'bad'; }
    }
    renderScores();
    await playPath(state.plane, state.puzzle.board, path, () => token === state.roundId);
    if (token !== state.roundId) return;
    showResult({ kicker, kind, word, path });
  }

  function showResult({ kicker, kind, word, path }) {
    $('#game').classList.add('resolved');
    const k = $('#res-kicker');
    k.textContent = kicker;
    k.className = 'kicker ' + kind;
    $('#res-word').innerHTML = [...word].map((c) => '<span>' + c + '</span>').join('');
    $('#res-steps').innerHTML = path.map((s) => {
      const cons = s.type === 'consonant';
      return '<span class="step ' + (cons ? 'o' : 'p') + '"><b>' + s.syllable + '</b>' + (cons ? s.fromC + '→' + s.target : arrowGlyph(s.vector)) + '</span>';
    }).join('');
    const others = state.puzzle.answers.map((a) => a.word).filter((w) => w !== word);
    const det = $('#res-others');
    det.open = false;
    det.hidden = !others.length;
    det.querySelector('summary').textContent = '다른 정답 ' + others.length + '개';
    det.querySelector('p').textContent = others.slice(0, 40).join(' · ') + (others.length > 40 ? ' …' : '');
    $('#res-next').textContent = state.mode === 'practice' ? '다음' : state.over ? '결과 보기' : '다음 라운드';
    openSheet('#result');
  }

  function showFinal() {
    closeSheets();
    const me = state.players[0];
    const alive = me.status === 'survived';
    const v = $('#fin-verdict');
    v.textContent = alive ? '생존' : '탈락';
    v.className = 'verdict ' + (alive ? 'ok' : 'bad');
    const out = state.players.find((p) => p.status === 'out');
    $('#fin-sub').textContent = state.round + '라운드 · ' + (alive ? out.name + ' 탈락' : '승점 ' + me.points + '점');
    const order = state.players.slice().sort((a, b) => (b.status === 'survived') - (a.status === 'survived') || b.points - a.points);
    $('#fin-standings').innerHTML = order.map((p) =>
      '<li class="' + p.status + '"><div class="av" style="--c:' + p.color + '">' + esc(p.name[0]) + '</div><span class="name">' + esc(p.name) + '</span>' +
      '<span class="pips">' + Array.from({ length: WIN_POINTS }, (_, i) => '<i class="' + (i < p.points ? 'on' : '') + '"></i>').join('') + '</span>' +
      '<span class="tag">' + (p.status === 'survived' ? '생존' : '탈락') + '</span></li>').join('');
    setTimeout(() => openSheet('#final', true), 280);
  }

  async function shareResult() {
    const me = state.players[0];
    const lines = [
      '자모 점프',
      (me.status === 'survived' ? '🟢 생존' : '🔴 탈락') + ' · ' + state.round + '라운드',
      ...state.players.map((p) => (p.status === 'survived' ? '🟢 ' : '🔴 ') + p.name + ' ' + '●'.repeat(p.points) + '○'.repeat(WIN_POINTS - p.points)),
      location.href.split(/[?#]/)[0],
    ];
    const text = lines.join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('결과를 복사했어요', 'ok');
    } catch (e) {
      if (e && e.name === 'AbortError') return;
      toast('복사하지 못했어요. 다시 눌러 주세요', 'bad');
    }
  }

  /* ---------- 제출 ---------- */
  function onSubmit(e) {
    e.preventDefault();
    if (!state.open || $('#answer').disabled) return;
    const raw = $('#answer').value.replace(/\s+/g, '');
    if ([...raw].length !== 2 || !H.isHangulWord(raw)) {
      shake();
      toast('한글 두 글자를 입력하세요', 'bad');
      return;
    }
    if (!WORD_SET.has(raw)) {
      shake();
      toast('사전에 없는 단어예요 · 감점 없음');
      return;
    }
    const path = H.findPath(state.puzzle.board, raw);
    if (path) { roundWon(0, raw, path); return; }
    shake();
    if (navigator.vibrate) navigator.vibrate(120);
    const msg = '‘' + raw + '’' + (lastJong(raw) && lastJong(raw) !== 8 ? '으로' : '로') + '는 못 가요';
    if (state.mode === 'match') {
      state.players[0].lockUntil = Date.now() + LOCK_MS;
      toast(msg + ' · 30초 정지', 'bad');
      $('#answer').value = '';
      renderAbilities();
      tick();
    } else {
      toast(msg, 'bad');
    }
  }

  /* ---------- 연습 도구 ---------- */
  function onHint() {
    if (!state.open) return;
    const list = state.puzzle.answers;
    const a = list[Math.floor(Math.random() * list.length)];
    toast('정답 ' + list.length + '개 · ' + a.word[0] + '○');
  }

  async function onReveal() {
    if (!state.open) return;
    state.open = false;
    setInput(false);
    $('#answer').blur();
    drawPreview();
    const a = state.puzzle.answers[0];
    const token = state.roundId;
    await playPath(state.plane, state.puzzle.board, a.path, () => token === state.roundId);
    if (token !== state.roundId) return;
    showResult({ kicker: '정답', kind: 'muted', word: a.word, path: a.path });
  }

  function leaveGame() {
    clearTimers();
    clearInterval(state.ticker);
    state.ticker = null;
    state.roundId++;
    state.open = false;
    state.mode = null;
    closeSheets();
    show('home');
  }

  /* ---------- 규칙 ---------- */
  function buildVowelGrid() {
    const groups = new Map();
    Object.entries(H.VOWEL_MOVES).forEach(([v, m]) => {
      if (!m) return;
      const k = arrowGlyph(m);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    });
    $('#vowel-grid').innerHTML = [...groups].map(([k, vs]) => '<span>' + vs.join(' ') + '<em>' + k + '</em></span>').join('');
  }

  function wordLighter(id) {
    const spans = [...document.querySelectorAll(id + ' span')];
    return {
      reset: () => spans.forEach((s) => s.classList.remove('o', 'p')),
      step: (s) => spans[s.index] && spans[s.index].classList.add(s.type === 'consonant' ? 'o' : 'p'),
      all: (path) => path.forEach((s) => spans[s.index] && spans[s.index].classList.add(s.type === 'consonant' ? 'o' : 'p')),
    };
  }

  async function openRules() {
    openSheet('#rules', true);
    const plane = renderBoard($('#rules-board'), EXAMPLE);
    const path = H.findPath(EXAMPLE, '규칙');
    const lit = wordLighter('#rules-word');
    lit.reset();
    if (reduceMotion) { drawStatic(plane, EXAMPLE, path); lit.all(path); return; }
    await sleep(420);
    playPath(plane, EXAMPLE, path, () => $('#rules').classList.contains('open'), lit.step);
  }

  /* ---------- 홈 데모 ---------- */
  async function demoLoop() {
    const host = $('#hero-board');
    const path = H.findPath(EXAMPLE, '규칙');
    const lit = wordLighter('#hero-word');
    if (reduceMotion) { drawStatic(renderBoard(host, EXAMPLE), EXAMPLE, path); lit.all(path); return; }
    const onHome = () => $('#home').classList.contains('active') && !document.hidden;
    for (;;) {
      if (!onHome()) { await sleep(600); continue; }
      const plane = renderBoard(host, EXAMPLE);
      lit.reset();
      await sleep(900);
      await playPath(plane, EXAMPLE, path, onHome, lit.step);
      await sleep(2400);
    }
  }

  function setLevel(level) {
    state.difficulty = level;
    localStorage.setItem('sulrae-level', level);
    document.querySelectorAll('.seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === level)));
  }

  /* ---------- 이벤트 ---------- */
  setLevel(state.difficulty);
  document.querySelectorAll('.seg button').forEach((b) => b.addEventListener('click', () => setLevel(b.dataset.level)));
  $('#btn-match').addEventListener('click', () => startGame('match'));
  $('#btn-practice').addEventListener('click', () => startGame('practice'));
  $('#btn-rules').addEventListener('click', openRules);
  $('#btn-rules-2').addEventListener('click', openRules);
  $('#btn-rules-close').addEventListener('click', closeSheets);
  $('#scrim').addEventListener('click', () => { if ($('#rules').classList.contains('open')) closeSheets(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#rules').classList.contains('open')) closeSheets(); });
  $('#btn-back').addEventListener('click', leaveGame);
  $('#dock').addEventListener('submit', onSubmit);
  $('#answer').addEventListener('input', () => { renderAbilities(); drawPreview(); });
  $('#res-next').addEventListener('click', () => { if (state.mode === 'match' && state.over) showFinal(); else newRound(); });
  $('#btn-hint').addEventListener('click', onHint);
  $('#btn-reveal').addEventListener('click', onReveal);
  $('#btn-skip').addEventListener('click', newRound);
  $('#fin-again').addEventListener('click', () => startGame('match'));
  $('#fin-home').addEventListener('click', leaveGame);
  $('#fin-share').addEventListener('click', shareResult);

  buildVowelGrid();
  demoLoop();

  // 테스트와 디버깅용
  window.__game = { state, newRound };
})();
