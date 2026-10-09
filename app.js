(() => {
  'use strict';

  const H = window.HangulHide;
  const Gen = window.JamoGen;
  const WORDS = window.WORDS || [];
  const WORD_SET = new Set(WORDS.concat(window.WORDS_EXTRA || []));
  const STAGES = window.STAGES || [];
  const TOTAL = STAGES.length;
  const $ = (s) => document.querySelector(s);

  const G = 0.14;
  const ORANGE = '#FF8A3D';
  const PURPLE = '#9B6BFF';
  const EXAMPLE = {
    tiles: [{ x: 0, y: 0, c: 'ㅊ' }, { x: 1, y: 1, c: 'ㄱ' }, { x: 0, y: 2, c: 'ㅇ' }, { x: 1, y: 3, c: null }],
    start: [0, 0], goal: [1, 3], cond: 'none',
  };
  const LINE = {
    tiles: [{ x: 0, y: 0, c: 'ㅅ' }, { x: 1, y: 0, c: 'ㅁ' }, { x: 2, y: 0, c: 'ㄹ' }, { x: 3, y: 0, c: null }],
    start: [0, 0], goal: [3, 0],
  };
  const ARROWS = { '1,0': '→', '-1,0': '←', '0,-1': '↑', '0,1': '↓', '1,-1': '↗', '-1,1': '↙', '-1,-1': '↖', '1,1': '↘' };
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STAR = (on) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="' + (on ? 'star-on' : 'star-off') + '" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';
  const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
  const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6"/></svg>';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'jamo-jump-v1';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const progress = Object.assign({ best: 0, stars: {}, tut: false, seen: {}, endless: {}, used: {}, level: 'normal' }, JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
  const saveProgress = () => localStorage.setItem(STORE_KEY, JSON.stringify(progress));

  const state = { mode: null, stage: 0, puzzle: null, idx: null, plane: null, open: false, busy: false, hints: 0, hintAnswer: null, token: 0 };

  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 40) : ms));
  const lastJong = (w) => {
    const code = w.charCodeAt(w.length - 1) - 0xac00;
    return code >= 0 && code <= 11171 ? code % 28 : 0;
  };
  const euro = (w) => w + (lastJong(w) && lastJong(w) !== 8 ? '으로' : '로');
  const arrowGlyph = (v) => ARROWS[Math.sign(v[0]) + ',' + Math.sign(v[1])] + Math.max(Math.abs(v[0]), Math.abs(v[1]));
  const RULE_TEXT = {
    vowelOnly: () => '모음 점프만',
    consonantOnly: () => '자음 점프만',
    visitAll: () => '모든 칸 밟기',
    maxJumps: (n) => n + '번 안에',
    exactJumps: (n) => '딱 ' + n + '번 점프',
  };
  const RULE_INFO = {
    vowelOnly: '이 판에서는 자음 점프를 쓸 수 없어요.',
    consonantOnly: '이 판에서는 모음 점프를 쓸 수 없어요.',
    visitAll: '깃발에 닿기 전에 모든 칸을 한 번씩은 밟아야 해요.',
    maxJumps: '정해진 횟수 안에 깃발에 닿아야 해요.',
    exactJumps: '정확히 그 횟수만큼 점프해서 깃발에 닿아야 해요.',
  };
  const activeRules = (board) => Object.entries(H.rulesOf(board)).filter(([, v]) => v);
  const totalStars = () => Object.values(progress.stars).reduce((a, b) => a + b, 0);

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
  const setPos = (e, p) => { e.style.setProperty('--x', p[0]); e.style.setProperty('--y', p[1]); };
  const center = (p) => [p[0] * (1 + G) + 0.5, p[1] * (1 + G) + 0.5];

  function renderBoard(host, board) {
    const cols = Math.max(...board.tiles.map((t) => t.x)) + 1;
    const rows = Math.max(...board.tiles.map((t) => t.y)) + 1;
    host.innerHTML = '';
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

  async function playPath(plane, board, path, alive) {
    resetPath(plane, board);
    await sleep(260);
    for (const s of path) {
      if (!alive()) return;
      await playStep(plane, s);
    }
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
  }

  function closeSheets() {
    document.querySelectorAll('.sheet.open').forEach((s) => { s.classList.remove('open'); s.setAttribute('aria-hidden', 'true'); });
    const scrim = $('#scrim');
    scrim.classList.remove('show');
    setTimeout(() => { if (!scrim.classList.contains('show')) scrim.hidden = true; }, 260);
  }

  function shakeField() {
    const f = $('#field');
    f.classList.remove('shake');
    void f.offsetWidth;
    f.classList.add('shake');
  }

  /* ---------- 지도 ---------- */
  const currentStage = () => Math.min(progress.best + 1, TOTAL);

  function renderMap() {
    const tower = $('#tower');
    const rowH = 104, pad = 70;
    const height = TOTAL * rowH + pad * 2 - rowH;
    tower.style.height = height + 'px';
    const cur = currentStage();
    const pts = [];
    let nodes = '';
    STAGES.forEach((st, i) => {
      const n = i + 1;
      const x = 50 + 27 * Math.sin(i * 0.9);
      const y = height - pad - i * rowH;
      pts.push([x, y]);
      const cleared = n <= progress.best;
      const locked = n > cur;
      const cls = 'node' + (st.boss ? ' boss' : '') + (cleared ? ' cleared' : '') + (n === cur ? ' current' : '') + (locked ? ' locked' : '');
      const s = progress.stars[n] || 0;
      nodes += '<button type="button" class="' + cls + '" style="left:' + x.toFixed(2) + '%;top:' + y + 'px" data-n="' + n + '"' + (locked ? ' disabled' : '') +
        ' aria-label="스테이지 ' + n + (st.boss ? ' 보스' : '') + (cleared ? ' 별 ' + s + '개' : '') + '">' +
        (st.boss ? '<span class="crown">' + CROWN + '</span>' : '') +
        '<span class="num">' + n + '</span>' +
        (cleared ? '<span class="stars">' + [1, 2, 3].map((k) => STAR(k <= s)).join('') + '</span>' : '') +
        (n === cur ? '<span class="me"><i></i></span>' : '') + '</button>';
    });
    const d = (list) => list.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1]).join(' ');
    const doneIdx = Math.max(0, cur - 1);
    tower.innerHTML =
      '<svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d(pts) + '" fill="none" stroke="#2A2C34" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      (doneIdx > 0 ? '<path d="' + d(pts.slice(0, doneIdx + 1)) + '" fill="none" stroke="#3DDC97" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' : '') +
      '</svg>' + nodes;
    const st = STAGES[cur - 1];
    $('#map-play').innerHTML = '<span>스테이지 ' + cur + '</span>' + (st.boss ? '<small>보스 · ' + st.title + '</small>' : '') + ARROW_R;
    $('#star-total').textContent = '★ ' + totalStars() + ' / ' + TOTAL * 3;
    const wrap = $('#tower-wrap');
    requestAnimationFrame(() => { wrap.scrollTop = pts[cur - 1][1] - wrap.clientHeight * 0.55; });
  }

  function openMap() {
    state.token++;
    state.mode = 'map';
    state.open = false;
    closeSheets();
    show('map');
    renderMap();
  }

  /* ---------- 판 띄우기 (스테이지·무한·도전 공통) ---------- */
  function setChrome(mode) {
    const playing = mode === 'stage' || mode === 'endless' || mode === 'daily';
    $('#dock').hidden = !playing;
    state.tutWait = null;
    $('#coach').hidden = mode !== 'tutorial';
    $('#prog').hidden = mode !== 'stage';
    $('#bar-sub').hidden = !(mode === 'endless' || mode === 'daily');
    $('#timer').hidden = mode !== 'daily';
    $('#clock').hidden = mode !== 'daily';
    const hint = $('#btn-hint');
    hint.hidden = mode === 'daily';
    hint.classList.toggle('plain', mode === 'tutorial');
    hint.textContent = mode === 'tutorial' ? '건너뛰기' : '💡 힌트';
    $('#btn-back').setAttribute('aria-label', mode === 'stage' ? '지도로' : '처음으로');
  }

  function renderProg(n) {
    $('#prog').innerHTML = STAGES.map((st, i) => {
      const k = i + 1;
      return '<i class="' + (st.boss ? 'boss ' : '') + (k === n ? 'cur' : k <= progress.best ? 'done' : '') + '"></i>';
    }).join('');
  }

  function loadPuzzle(mode, board, words) {
    state.token++;
    state.mode = mode;
    state.puzzle = { board, answers: words.map((w) => ({ word: w, path: H.findPath(board, w) })).filter((a) => a.path) };
    state.idx = H.makeBoardIndex(board);
    state.hints = 0;
    state.hintAnswer = null;
    state.open = true;
    state.busy = false;
    closeSheets();
    show('play');
    setChrome(mode);
    $('#stage-title').classList.remove('boss');
    const rules = activeRules(board);
    const cond = $('#cond');
    cond.hidden = !rules.length;
    cond.className = 'cond';
    cond.innerHTML = rules.map(([k, v]) => '<span class="rule ' + k + '">' + RULE_TEXT[k](v) + '</span>').join('');
    state.plane = renderBoard($('#board'), board);
    $('#answer').value = '';
    setInput(true);
    renderAbilities();
    return rules;
  }

  function startStage(n) {
    const st = STAGES[n - 1];
    state.stage = n;
    const rules = loadPuzzle('stage', st.board, st.answers);
    const title = $('#stage-title');
    title.textContent = st.boss ? st.title : '스테이지 ' + n;
    title.classList.toggle('boss', st.boss);
    renderProg(n);
    const fresh = rules.map(([k]) => k).find((k) => !progress.seen[k]);
    if (st.boss || fresh) showIntro(st, fresh);
    else if (finePointer) $('#answer').focus();
  }

  function showRuleIntro(rules) {
    const fresh = rules.map(([k]) => k).find((k) => !progress.seen[k]);
    if (!fresh) return false;
    showIntro({ boss: false, board: state.puzzle.board }, fresh);
    return true;
  }

  function showIntro(st, fresh) {
    state.introGo = null;
    const badge = $('#intro-badge');
    const rules = activeRules(st.board);
    if (fresh) { progress.seen[fresh] = true; saveProgress(); }
    if (st.boss) {
      badge.className = 'intro-badge boss';
      badge.textContent = '보스 · 스테이지 ' + st.n;
      $('#intro-title').textContent = st.title || '보스';
      $('#intro-sub').textContent = st.tip || '';
      $('#intro-go').textContent = '도전';
    } else {
      const [k, v] = rules.find(([key]) => key === fresh);
      badge.className = 'intro-badge rule';
      badge.textContent = '새 규칙';
      $('#intro-title').textContent = RULE_TEXT[k](v);
      $('#intro-sub').textContent = RULE_INFO[k];
      $('#intro-go').textContent = '알겠어요';
    }
    openSheet('#intro', true);
  }

  function setInput(on) {
    $('#answer').disabled = !on;
    $('#btn-submit').disabled = !on;
  }

  /* ---------- 입력 중 표시 ---------- */
  const typed = () => [...$('#answer').value].filter((c) => c >= '가' && c <= '힣').slice(0, 2);
  const startConsonant = () => state.idx.cells.get(state.puzzle.board.start.join(',')).c;

  function renderAbilities() {
    const box = $('#abilities');
    const sy = typed();
    if (!sy.length) {
      if (state.hintAnswer) {
        box.innerHTML = '<span class="prompt"><span class="hint-tile">' + state.hintAnswer.word[0] + '</span><span class="hint-tile q">?</span>로 시작하는 단어</span>';
      } else {
        box.innerHTML = '<span class="prompt"><span class="jamo">' + startConsonant() + '</span>이 들어간 글자로 출발</span>';
      }
      drawPreview();
      return;
    }
    const rules = H.rulesOf(state.puzzle.board);
    const sc = startConsonant();
    box.innerHTML = sy.map((ch) => {
      const a = H.abilitiesOf(ch);
      const chips = [];
      if (a.consonants) chips.push('<span class="chip o' + (rules.vowelOnly ? ' blocked' : '') + '">' + a.consonants.join('↔') + '</span>');
      if (a.vector) chips.push('<span class="chip p' + (rules.consonantOnly ? ' blocked' : '') + '">' + arrowGlyph(a.vector) + '</span>');
      if (!chips.length) chips.push('<span class="chip off">점프 없음</span>');
      return '<div class="ab' + (a.letters.includes(sc) ? ' here' : '') + '"><b>' + ch + '</b>' + chips.join('') + '</div>';
    }).join('');
    drawPreview();
  }

  // 입력한 글자로 점프할 수 있는 모든 칸에 흐린 화살표를 그린다.
  // 출발 칸에서 실제로 이어지는 화살표는 진하게, 닿을 수 없는 칸의 화살표는 더 흐리게.
  function drawPreview() {
    if (!state.plane || !state.puzzle) return;
    const g = state.plane.querySelector('.g-preview');
    g.innerHTML = '';
    if (!state.open || state.busy) return;
    const board = state.puzzle.board;
    const rules = H.rulesOf(board);
    const abil = typed().map(H.abilitiesOf);
    if (!abil.length) return;
    const isGoal = (p) => p[0] === board.goal[0] && p[1] === board.goal[1];
    const reach = new Set([board.start.join()]);
    const queue = [board.start];
    for (let i = 0; i < queue.length; i++) {
      if (isGoal(queue[i])) continue;
      for (const ab of abil) for (const m of H.movesFrom(state.idx, queue[i], ab, rules)) {
        const k = m.to.join();
        if (!reach.has(k)) { reach.add(k); queue.push(m.to); }
      }
    }
    const drawn = new Set();
    for (const t of board.tiles) {
      const p = [t.x, t.y];
      if (isGoal(p)) continue;
      for (const ab of abil) for (const m of H.movesFrom(state.idx, p, ab, rules)) {
        const k = p.join() + '>' + m.to.join();
        if (drawn.has(k)) continue;
        drawn.add(k);
        drawArrow(g, p, m.to, m.type === 'consonant' ? ORANGE : PURPLE, { faint: true, far: !reach.has(p.join()) });
      }
    }
  }

  /* ---------- 제출 ---------- */
  async function onSubmit(e) {
    e.preventDefault();
    if (!state.open || state.busy) return;
    const raw = $('#answer').value.replace(/\s+/g, '');
    if ([...raw].length !== 2 || !H.isHangulWord(raw)) {
      shakeField();
      toast('한글 두 글자를 입력하세요', 'bad');
      return;
    }
    if (!WORD_SET.has(raw)) {
      shakeField();
      toast('사전에 없는 단어예요');
      return;
    }
    const path = H.findPath(state.puzzle.board, raw);
    if (path && state.mode === 'tutorial') {
      state.open = false;
      state.busy = true;
      setInput(false);
      $('#answer').blur();
      drawPreview();
      const token = state.token;
      await playPath(state.plane, state.puzzle.board, path, () => token === state.token);
      if (token !== state.token) return;
      state.busy = false;
      const done = state.tutWait;
      state.tutWait = null;
      if (done) done({ word: raw, path });
      return;
    }
    if (path) {
      if (state.mode === 'endless') clearEndless(raw, path, false);
      else if (state.mode === 'daily') clearDaily(raw, path);
      else clearStage(raw, path, false);
      return;
    }
    await showMiss(raw);
  }

  // 오답이면 말이 실제로 어디까지 가는지 보여주고, 막힌 이유를 한 줄로 알려준다.
  async function showMiss(word) {
    state.busy = true;
    setInput(false);
    const token = state.token;
    const board = state.puzzle.board;
    const plane = state.plane;
    plane.querySelector('.g-preview').innerHTML = '';
    const d = H.diagnose(board, word, state.idx);
    const rules = H.rulesOf(board);
    const steps = d.path.slice(0, 6);
    for (const s of steps) {
      if (token !== state.token) return;
      await playStep(plane, s);
    }
    if (token !== state.token) return;
    const last = steps.length ? steps[steps.length - 1].to : board.start;
    const here = state.idx.cells.get(last.join(','));
    const msg = {
      start: '출발 자음 ' + startConsonant() + '이 든 글자가 없어요',
      stuck: here && here.c ? here.c + ' 칸에서 더 갈 곳이 없어요' : '깃발까지 이어지지 않아요',
      used: '두 글자를 모두 한 번은 써야 해요',
      visit: '모든 칸을 밟지 못했어요',
      jumps: rules.exactJumps ? '딱 ' + rules.exactJumps + '번에 닿아야 해요' : rules.maxJumps + '번 안에 못 가요',
    }[d.reason];
    if (d.reason === 'start') {
      const t = tileAt(plane, board.start);
      t.classList.remove('bad'); void t.offsetWidth; t.classList.add('bad');
    } else {
      const pawn = plane.querySelector('.pawn');
      pawn.classList.remove('miss'); void pawn.offsetWidth; pawn.classList.add('miss');
    }
    shakeField();
    toast(msg, 'bad');
    if (navigator.vibrate) navigator.vibrate(80);
    await sleep(1300);
    if (token !== state.token || !state.open) return;
    resetPath(plane, board);
    state.busy = false;
    setInput(true);
    $('#answer').select();
    renderAbilities();
  }

  async function clearStage(word, path, revealed) {
    state.open = false;
    state.busy = true;
    setInput(false);
    $('#answer').blur();
    const n = state.stage;
    const stars = revealed ? 1 : state.hints ? 2 : 3;
    progress.stars[n] = Math.max(progress.stars[n] || 0, stars);
    progress.best = Math.max(progress.best, n);
    saveProgress();
    renderProg(n);
    const token = state.token;
    await playPath(state.plane, state.puzzle.board, path, () => token === state.token);
    if (token !== state.token) return;
    await sleep(250);
    showResult(word, path, stars, revealed);
  }

  function fillResult(word, path) {
    $('#res-word').innerHTML = [...word].map((c) => '<span>' + c + '</span>').join('');
    $('#res-steps').classList.toggle('long', path.length > 3);
    $('#res-steps').innerHTML = path.map((s) => {
      const cons = s.type === 'consonant';
      return '<span class="step ' + (cons ? 'o' : 'p') + '"><b>' + s.syllable + '</b>' + (cons ? s.fromC + '→' + s.target : arrowGlyph(s.vector)) + '</span>';
    }).join('');
    const others = state.puzzle.answers.map((a) => a.word).filter((w) => w !== word);
    const det = $('#res-others');
    det.open = false;
    det.hidden = !others.length;
    det.querySelector('summary').textContent = '다른 정답 ' + others.length + '개';
    det.querySelector('p').textContent = others.slice(0, 40).join(' · ');
  }

  function showResult(word, path, stars, revealed) {
    const st = STAGES[state.stage - 1];
    const k = $('#res-kicker');
    k.textContent = revealed ? '정답 공개' : st.boss ? '보스 격파 · ' + st.title : '스테이지 ' + state.stage + ' 클리어';
    k.className = 'kicker' + (revealed ? ' muted' : st.boss ? ' boss' : '');
    $('#res-stars').hidden = false;
    $('#res-stars').innerHTML = [1, 2, 3].map((i) => STAR(i <= stars)).join('');
    $('#res-word').innerHTML = [...word].map((c) => '<span>' + c + '</span>').join('');
    $('#res-steps').classList.toggle('long', path.length > 3);
    $('#res-steps').innerHTML = path.map((s) => {
      const cons = s.type === 'consonant';
      return '<span class="step ' + (cons ? 'o' : 'p') + '"><b>' + s.syllable + '</b>' + (cons ? s.fromC + '→' + s.target : arrowGlyph(s.vector)) + '</span>';
    }).join('');
    const others = state.puzzle.answers.map((a) => a.word).filter((w) => w !== word);
    const det = $('#res-others');
    det.open = false;
    det.hidden = !others.length;
    det.querySelector('summary').textContent = '다른 정답 ' + others.length + '개';
    det.querySelector('p').textContent = others.slice(0, 40).join(' · ');
    $('#res-next').textContent = state.stage < TOTAL ? '스테이지 ' + (state.stage + 1) : '정상으로';
    $('#res-map').textContent = '지도';
    openSheet('#result');
  }

  function onHint() {
    if (state.mode === 'tutorial') { finishTutorial(); return; }
    if (state.mode === 'daily' || !state.open || state.busy) return;
    if (!state.hints) {
      state.hints = 1;
      state.hintAnswer = state.puzzle.answers[0];
      $('#btn-hint').textContent = '정답 보기';
      $('#answer').value = '';
      renderAbilities();
      toast(state.mode === 'stage' ? '첫 글자를 알려 드렸어요 · 별 2개' : '첫 글자를 알려 드렸어요');
      return;
    }
    const a = state.hintAnswer || state.puzzle.answers[0];
    $('#answer').value = a.word;
    if (state.mode === 'endless') clearEndless(a.word, a.path, true);
    else clearStage(a.word, a.path, true);
  }

  function showEnding() {
    closeSheets();
    $('#end-stars').textContent = '★ ' + totalStars() + ' / ' + TOTAL * 3;
    setTimeout(() => openSheet('#ending', true), 260);
  }

  async function share() {
    const text = '자모 점프 20 스테이지 완주 ★ ' + totalStars() + '/' + TOTAL * 3 + '\n' + location.href.split(/[?#]/)[0];
    try {
      if (navigator.share) { await navigator.share({ text }); return; }
      await navigator.clipboard.writeText(text);
      toast('복사했어요', 'ok');
    } catch (e) {
      if (!e || e.name !== 'AbortError') toast('공유하지 못했어요', 'bad');
    }
  }

  /* ---------- 튜토리얼 ---------- */
  /* ---------- 무한 모드 ---------- */
  let genCtx = null;
  const ctx = () => genCtx || (genCtx = Gen.makeContext(window.FAM));
  const LEVEL_LABEL = { easy: '쉬움', normal: '보통', hard: '어려움' };
  const endlessOf = (lv) => progress.endless[lv] || (progress.endless[lv] = { best: 0 });

  function startEndless(level) {
    state.level = level;
    progress.level = level;
    const used = progress.used[level] || (progress.used[level] = []);
    let p = Gen.generate(ctx(), level, Math.random, { avoid: new Set(used) });
    if (!p) p = Gen.generate(ctx(), level, Math.random);
    const rules = loadPuzzle('endless', p.board, p.answers);
    state.endlessKey = p.key;
    $('#stage-title').textContent = '무한 · ' + LEVEL_LABEL[level];
    renderStreak();
    if (!showRuleIntro(rules) && finePointer) $('#answer').focus();
  }

  function renderStreak() {
    const e = endlessOf(state.level);
    $('#bar-sub').textContent = '연속 ' + (state.streak || 0) + ' · 최고 ' + e.best;
  }

  async function clearEndless(word, path, revealed) {
    state.open = false;
    state.busy = true;
    setInput(false);
    $('#answer').blur();
    const e = endlessOf(state.level);
    state.streak = revealed ? 0 : (state.streak || 0) + 1;
    e.best = Math.max(e.best, state.streak);
    const used = progress.used[state.level];
    used.push(state.endlessKey);
    if (used.length > 600) used.splice(0, used.length - 600);
    saveProgress();
    renderStreak();
    const token = state.token;
    await playPath(state.plane, state.puzzle.board, path, () => token === state.token);
    if (token !== state.token) return;
    await sleep(250);
    const k = $('#res-kicker');
    k.textContent = revealed ? '정답 공개 · 연속 기록 초기화' : '연속 ' + state.streak;
    k.className = 'kicker' + (revealed ? ' muted' : '');
    $('#res-stars').hidden = true;
    fillResult(word, path);
    $('#res-next').textContent = '다음 문제';
    $('#res-map').textContent = '처음으로';
    openSheet('#result');
  }

  /* ---------- 오늘의 도전 ---------- */
  const DAILY_KEY = 'jamo-jump-daily';
  const DAILY_LEVELS = ['easy', 'normal', 'hard'];
  const MAX_RESUMES = 2;
  // 한국 시간 기준 날짜. 모든 기기가 같은 날 같은 문제를 받는다.
  const todayKey = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
  const freshDaily = () => ({ date: todayKey(), status: 'ready', round: 0, times: [null, null, null], deadline: null, resumes: 0, final: false });
  let daily = (() => {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
    return d && d.date === todayKey() ? d : freshDaily();
  })();
  const saveDaily = () => localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  const dailyCache = {};
  const secondsOf = (r) => Gen.LEVELS[DAILY_LEVELS[r]].seconds;
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const dailyStars = () => daily.times.filter(Boolean).length;
  const dateLabel = (k) => Number(k.slice(5, 7)) + '월 ' + Number(k.slice(8, 10)) + '일';

  function dailyPuzzle(r) {
    const id = daily.date + ':' + r;
    if (!dailyCache[id]) {
      const rng = Gen.mulberry32(Gen.hashSeed('daily:' + id));
      dailyCache[id] = Gen.generate(ctx(), DAILY_LEVELS[r], rng, { maxTries: 20000 }) || Gen.generate(ctx(), 'normal', rng);
    }
    return dailyCache[id];
  }

  // 날짜가 바뀌었거나 진행 중인 라운드의 시간이 다 됐으면 상태를 맞춘다.
  function syncDaily() {
    if (daily.date !== todayKey()) { daily = freshDaily(); saveDaily(); }
    if (daily.status === 'playing' && daily.deadline && Date.now() >= daily.deadline) failDaily();
  }

  function failDaily() {
    daily.status = 'failed';
    daily.deadline = null;
    if (daily.resumes >= MAX_RESUMES) daily.final = true;
    saveDaily();
  }

  function openDaily() {
    syncDaily();
    if (daily.status === 'playing' || daily.status === 'between') { startDailyRound(); return; }
    if (daily.status === 'failed' || daily.status === 'done') { showSettle(); return; }
    state.introGo = () => startDailyRound();
    $('#intro-badge').className = 'intro-badge boss';
    $('#intro-badge').textContent = '오늘의 도전 · ' + dateLabel(daily.date);
    $('#intro-title').textContent = '3라운드, 하루 한 번';
    $('#intro-sub').innerHTML = '쉬움 60초 → 보통 90초 → 어려움 120초.<br>시간 안에 못 풀면 거기서 끝나요. 깬 라운드마다 별 하나.<br>결과를 공유하면 하루 두 번까지 이어서 할 수 있어요.';
    $('#intro-go').textContent = '시작';
    openSheet('#intro', true);
  }

  function startDailyRound() {
    const r = daily.round;
    const p = dailyPuzzle(r);
    if (!daily.deadline) daily.deadline = Date.now() + secondsOf(r) * 1000;
    daily.status = 'playing';
    saveDaily();
    loadPuzzle('daily', p.board, p.answers);
    state.dailyRound = r;
    $('#stage-title').textContent = '오늘의 도전';
    $('#bar-sub').textContent = (r + 1) + '/3 · ' + LEVEL_LABEL[DAILY_LEVELS[r]];
    startClock();
    if (finePointer) $('#answer').focus();
  }

  function startClock() {
    clearInterval(state.clock);
    const tick = () => {
      if (state.mode !== 'daily' || !daily.deadline) { clearInterval(state.clock); return; }
      const left = daily.deadline - Date.now();
      const total = secondsOf(daily.round) * 1000;
      $('#timer-fill').style.width = Math.max(0, (left / total) * 100) + '%';
      $('#timer').classList.toggle('low', left < 10000);
      const c = $('#clock');
      c.textContent = fmt(left);
      c.classList.toggle('low', left < 10000);
      if (left <= 0 && state.open) timeUp();
    };
    tick();
    state.clock = setInterval(tick, 200);
  }

  function timeUp() {
    clearInterval(state.clock);
    state.token++;
    state.open = false;
    state.busy = false;
    setInput(false);
    $('#answer').blur();
    failDaily();
    $('#clock').textContent = '0:00';
    toast('시간 초과', 'bad');
    if (navigator.vibrate) navigator.vibrate([80, 60, 80]);
    setTimeout(() => { if (state.mode === 'daily') showSettle(); }, 900);
  }

  async function clearDaily(word, path) {
    const r = daily.round;
    const used = secondsOf(r) * 1000 - (daily.deadline - Date.now());
    clearInterval(state.clock);
    state.open = false;
    state.busy = true;
    setInput(false);
    $('#answer').blur();
    daily.times[r] = { ms: Math.max(0, used), word };
    daily.deadline = null;
    if (r === 2) { daily.status = 'done'; daily.final = true; } else { daily.round = r + 1; daily.status = 'between'; }
    saveDaily();
    const token = state.token;
    await playPath(state.plane, state.puzzle.board, path, () => token === state.token);
    if (token !== state.token) return;
    await sleep(250);
    if (daily.status === 'done') { showSettle(); return; }
    const k = $('#res-kicker');
    k.textContent = (r + 1) + '라운드 클리어 · ' + fmt(used);
    k.className = 'kicker';
    $('#res-stars').hidden = false;
    $('#res-stars').innerHTML = [0, 1, 2].map((i) => STAR(!!daily.times[i])).join('');
    fillResult(word, path);
    $('#res-others').hidden = true;
    const n = daily.round;
    $('#res-next').textContent = (n + 1) + '라운드 · ' + LEVEL_LABEL[DAILY_LEVELS[n]] + ' ' + secondsOf(n) + '초';
    $('#res-map').textContent = '잠깐 쉬기';
    openSheet('#result');
  }

  function showSettle() {
    closeSheets();
    syncDaily();
    const failed = daily.status === 'failed';
    const canResume = failed && !daily.final && daily.resumes < MAX_RESUMES;
    const stars = dailyStars();
    $('#settle-kicker').textContent = '오늘의 도전 · ' + dateLabel(daily.date);
    const t = $('#settle-title');
    t.textContent = daily.status === 'done' ? '완주' : canResume ? '시간 초과' : stars ? stars + '라운드 통과' : '내일 다시';
    t.className = 'verdict sm ' + (daily.status === 'done' ? 'ok' : canResume ? 'bad' : '');
    $('#settle-stars').innerHTML = [0, 1, 2].map((i) => STAR(!!daily.times[i])).join('');
    $('#settle-rounds').innerHTML = DAILY_LEVELS.map((lv, i) => {
      const rec = daily.times[i];
      let right;
      if (rec) right = '<span class="sr-word">' + rec.word + '</span><span class="sr-time">' + fmt(rec.ms) + '</span>';
      else if (failed && i === daily.round) right = daily.final
        ? '<span class="sr-fail">시간 초과</span><span class="sr-answer">정답 <b>' + dailyPuzzle(i).key + '</b></span>'
        : '<span class="sr-fail">시간 초과</span>';
      else right = '<span class="sr-none">' + (daily.final ? '도전 못 함' : '—') + '</span>';
      return '<li class="' + (rec ? 'done' : failed && i === daily.round ? 'fail' : '') + '"><span class="sr-lv">' + LEVEL_LABEL[lv] + ' <small>' + secondsOf(i) + '초</small></span>' + right + '</li>';
    }).join('');
    $('#settle-next').textContent = daily.final ? nextDailyText() : '정답은 오늘 도전이 끝나면 공개돼요.';
    const pri = $('#settle-primary');
    const sec = $('#settle-secondary');
    if (canResume) {
      pri.textContent = '공유하고 이어하기 · ' + (MAX_RESUMES - daily.resumes) + '회 남음';
      pri.onclick = async () => {
        if (!(await shareDaily())) return;
        daily.resumes++;
        daily.status = 'playing';
        daily.deadline = null;
        saveDaily();
        startDailyRound();
      };
      sec.textContent = '오늘은 여기까지';
      sec.onclick = () => { daily.final = true; saveDaily(); showSettle(); };
    } else {
      pri.textContent = '결과 공유';
      pri.onclick = () => shareDaily();
      sec.textContent = '처음으로';
      sec.onclick = openHome;
    }
    setTimeout(() => openSheet('#settle', true), 200);
  }

  function nextDailyText() {
    const now = new Date(Date.now() + 9 * 3600e3);
    const left = 24 * 3600e3 - ((now.getUTCHours() * 60 + now.getUTCMinutes()) * 60e3 + now.getUTCSeconds() * 1e3);
    const h = Math.floor(left / 3600e3), m = Math.floor((left % 3600e3) / 60e3);
    return '다음 도전까지 ' + (h ? h + '시간 ' : '') + m + '분';
  }

  async function shareDaily() {
    const rows = DAILY_LEVELS.map((lv, i) => {
      const rec = daily.times[i];
      return (rec ? '🟢 ' : i === daily.round && daily.status === 'failed' ? '🔴 ' : '⚪ ') + LEVEL_LABEL[lv] + ' ' + (rec ? fmt(rec.ms) : i === daily.round && daily.status === 'failed' ? '시간 초과' : '-');
    });
    const text = ['자모 점프 · 오늘의 도전 ' + daily.date.slice(5).replace('-', '/'), '★'.repeat(dailyStars()) + '☆'.repeat(3 - dailyStars()), ...rows,
      daily.resumes ? '(이어하기 ' + daily.resumes + '회)' : '', location.href.split(/[?#]/)[0]].filter(Boolean).join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return true; }
    } catch (e) {
      if (e && e.name === 'AbortError') return false; // 공유 창을 닫은 경우만 이어하기를 막는다
    }
    if (await copyText(text)) toast('결과를 복사했어요. 친구에게 붙여 넣어 주세요', 'ok');
    else toast('복사가 막혀 있어요. 화면을 캡처해 공유해 주세요');
    return true;
  }

  async function copyText(text) {
    // 권한 창 때문에 응답이 오지 않는 브라우저가 있어 1.2초 안에 끝나지 않으면 다른 방식으로 복사한다.
    try {
      const ok = await Promise.race([
        navigator.clipboard.writeText(text).then(() => true),
        new Promise((r) => setTimeout(() => r(false), 1200)),
      ]);
      if (ok) return true;
    } catch (e) { /* 아래 방식으로 다시 시도 */ }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0';
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
  }

  /* ---------- 처음 화면 ---------- */
  function openHome() {
    state.token++;
    state.mode = 'home';
    state.open = false;
    clearInterval(state.clock);
    closeSheets();
    show('home');
    renderHome();
  }

  function renderHome() {
    syncDaily();
    $('#daily-date').textContent = dateLabel(daily.date);
    $('#daily-rounds').innerHTML = DAILY_LEVELS.map((lv, i) => {
      const rec = daily.times[i];
      const fail = daily.status === 'failed' && i === daily.round;
      const cls = rec ? 'done' : fail ? 'fail' : (daily.status === 'playing' || daily.status === 'between') && i === daily.round ? 'now' : '';
      return '<span class="dr ' + cls + '"><b>' + LEVEL_LABEL[lv] + '</b><small>' + (rec ? fmt(rec.ms) : fail ? '시간 초과' : secondsOf(i) + '초') + '</small></span>';
    }).join('');
    let note = '하루 한 번 · 공유하면 2번 이어하기';
    let cta = '도전';
    if (daily.status === 'playing') { note = '진행 중 · ' + fmt(daily.deadline - Date.now()) + ' 남음'; cta = '이어하기'; }
    else if (daily.status === 'between') { note = (daily.round + 1) + '라운드 대기 중'; cta = '이어하기'; }
    else if (daily.status === 'failed' && !daily.final) { note = '이어하기 ' + (MAX_RESUMES - daily.resumes) + '회 남음'; cta = '결과 보기'; }
    else if (daily.final) { note = '★ ' + dailyStars() + ' · ' + nextDailyText(); cta = '결과 보기'; }
    $('#daily-note').textContent = note;
    $('#daily-cta').textContent = cta;
    $('#daily-card').classList.toggle('finished', daily.final);
    const lv = progress.level || 'normal';
    document.querySelectorAll('#home .seg button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.level === lv)));
    $('#endless-best').textContent = '최고 연속 ' + endlessOf(lv).best;
    $('#climb-meta').textContent = progress.best >= TOTAL ? '완주 · ★ ' + totalStars() : progress.best + ' / ' + TOTAL + ' · ★ ' + totalStars();
    clearInterval(state.homeTick);
    if (daily.status === 'playing') state.homeTick = setInterval(() => { if (state.mode === 'home') renderHome(); else clearInterval(state.homeTick); }, 1000);
  }

  const TUT_STEPS = 11;

  function coachLetters(word, used) {
    return [...word].map((ch, i) => ({ ch, used: used[i] }));
  }

  function coach({ step, title, sub, letters, want, wrong, next, keepUsed, fill }) {
    if (state.mode === 'tutorial' && !fill) $('#dock').hidden = true;
    $('#coach-dots').innerHTML = Array.from({ length: TUT_STEPS }, (_, i) => '<i class="' + (i === step ? 'on' : i < step ? 'done' : '') + '"></i>').join('');
    $('#coach-title').innerHTML = title;
    const subEl = $('#coach-sub');
    subEl.innerHTML = sub || '';
    subEl.className = 'coach-sub';
    const box = $('#coach-letters');
    const nextBtn = $('#coach-next');
    box.innerHTML = '';
    const token = state.token;
    return new Promise((resolve) => {
      (letters || []).forEach((L) => {
        const b = el('button', 'letter tile3d' + (L.used ? ' ' + L.used : '') + (want && (!L.used || keepUsed) ? ' want' : ''), L.ch);
        b.type = 'button';
        b.disabled = !want || (!!L.used && !keepUsed);
        b.addEventListener('click', () => {
          if (token !== state.token) return;
          if (L.ch === want) { box.querySelectorAll('button').forEach((x) => { x.disabled = true; }); resolve(L.ch); return; }
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
          subEl.textContent = wrong;
          subEl.className = 'coach-sub bad';
        });
        box.append(b);
      });
      if (fill) {
        const chip = el('button', 'fill-chip', '<b>' + fill + '</b> 넣어 보기');
        chip.type = 'button';
        chip.addEventListener('click', () => {
          $('#answer').value = fill;
          renderAbilities();
        });
        box.append(chip);
      }
      nextBtn.hidden = !next;
      if (next) {
        nextBtn.textContent = next;
        nextBtn.onclick = () => { if (token === state.token) resolve('next'); };
      }
    });
  }

  const FLAG_ICON = FLAG;
  const CONCEPT = {
    what: '<div class="concept"><div class="c-row"><span class="c-tile tile3d start">ㅊ</span><span class="c-arrow m">⋯</span><span class="c-tile tile3d goal">' + FLAG_ICON + '</span></div>' +
      '<div class="c-row"><span class="c-tile word">?</span><span class="c-tile word">?</span></div></div>',
    cons: '<div class="concept"><div class="c-list">' +
      '<div class="c-ex"><span class="c-tile tile3d sm">칙</span><span class="c-ex-chips"><span class="chip o">ㅊ↔ㄱ</span></span><span class="c-ex-note">초성↔받침, 양쪽 다 가요</span></div>' +
      '<div class="c-ex"><span class="c-tile tile3d sm">닭</span><span class="c-ex-chips"><span class="chip o">ㄷ↔ㄹ↔ㄱ</span></span><span class="c-ex-note">겹받침은 자음을 모두 써요</span></div>' +
      '<div class="c-ex off"><span class="c-tile tile3d sm">꼭</span><span class="c-ex-chips"><span class="chip off">없음</span></span><span class="c-ex-note">ㄲ은 ㄱ이라 한 종류뿐</span></div>' +
      '<div class="c-ex off"><span class="c-tile tile3d sm">가</span><span class="c-ex-chips"><span class="chip off">없음</span></span><span class="c-ex-note">받침이 없으면 못 해요</span></div>' +
      '</div></div>',
    vowel: '<div class="concept"><div class="c-vgrid wide">' +
      '<span>ㅏ ㅐ <em>→1</em></span><span>ㅑ ㅒ <em>→2</em></span><span>ㅓ ㅔ <em>←1</em></span><span>ㅕ ㅖ <em>←2</em></span>' +
      '<span>ㅗ ㅚ <em>↑1</em></span><span>ㅛ <em>↑2</em></span><span>ㅜ ㅟ <em>↓1</em></span><span>ㅠ <em>↓2</em></span>' +
      '<span>ㅘ ㅙ <em>↗1</em></span><span>ㅝ ㅞ <em>↙1</em></span><span class="off">ㅡ ㅣ ㅢ <em>없음</em></span>' +
      '</div><div class="c-list">' +
      '<div class="c-ex"><span class="c-tile tile3d sm">규</span><span class="c-ex-chips"><span class="chip p">↓2</span></span><span class="c-ex-note">사이 빈자리는 건너뛰어요</span></div>' +
      '<div class="c-ex off"><span class="c-tile tile3d sm">그</span><span class="c-ex-chips"><span class="chip off">없음</span></span><span class="c-ex-note">튀어나온 획이 없어요</span></div>' +
      '</div></div>',
    more: '<div class="concept"><div class="c-list">' +
      '<div class="c-ex"><span class="c-ico">ㄱ</span><span class="c-ex-note"><b>같은 자음이 여러 칸</b>이면 그중 어느 칸으로든 자음 점프할 수 있어요</span></div>' +
      '<div class="c-ex"><span class="c-ico c">' + FLAG_ICON + '</span><span class="c-ex-note"><b>깃발에 닿으면 바로 끝</b>. 깃발 칸에 자음이 있어도 그 칸에서 다시 점프하지 않아요</span></div>' +
      '<div class="c-ex"><span class="c-ico">✕</span><span class="c-ex-note"><b>점프할 자리에 칸이 없으면</b> 그 점프는 쓸 수 없어요</span></div>' +
      '<div class="c-ex"><span class="c-ico g">!</span><span class="c-ex-note">판에 따라 <b>모음 점프만</b>, <b>모든 칸 밟기</b> 같은 <b>추가 조건</b>이 붙어요</span></div>' +
      '</div></div>',
    dict: '<div class="concept"><div class="c-book">표준<br>국어<br>대사전</div><div class="c-row"><span class="c-tile word" style="color:var(--mint);border-color:var(--mint)">✓</span><span class="c-tile word" style="color:var(--coral);border-color:var(--coral)">✕</span></div></div>',
    credit: '<div class="concept c-credit"><span class="show">네 가지 소원</span><span class="ep">EP.2 · 3회전 데스매치 〈숨바꼭질〉</span></div>',
  };

  function tutBoard(board) {
    state.puzzle = { board, answers: [] };
    state.idx = H.makeBoardIndex(board);
    state.plane = renderBoard($('#board'), board);
    return state.plane;
  }

  function tutConcept(html) {
    state.puzzle = null;
    state.plane = null;
    $('#board').innerHTML = html;
  }

  // 실제 입력창으로 단어를 받아, 맞으면 점프 경로를 돌려준다.
  function waitWord() {
    $('#dock').hidden = false;
    $('#answer').value = '';
    state.open = true;
    state.busy = false;
    setInput(true);
    renderAbilities();
    if (finePointer) $('#answer').focus();
    return new Promise((resolve) => { state.tutWait = resolve; });
  }

  async function runTutorial() {
    closeSheets();
    state.token++;
    state.mode = 'tutorial';
    state.open = false;
    const token = state.token;
    const alive = () => token === state.token;
    show('play');
    setChrome('tutorial');
    const title = $('#stage-title');
    title.textContent = '튜토리얼';
    title.classList.remove('boss');
    $('#cond').hidden = true;

    // 1부: 판 없이 게임 설명
    tutConcept(CONCEPT.what);
    await coach({ step: 0, title: '자모 점프는',
      sub: '게임판의 <b>초록 출발 칸</b>에서 <b>깃발 칸</b>까지 <span class="o">자음 점프</span>와 <span class="p">모음 점프</span>로 이동할 수 있는 <b>두 글자 단어</b>를 찾는 게임이에요.',
      next: '다음' });
    if (!alive()) return;
    tutConcept(CONCEPT.cons);
    await coach({ step: 1, title: '<span class="o">자음 점프</span>',
      sub: '밟고 있는 자음에서 <b>같은 글자 안의 다른 자음 칸</b>으로 건너뛰어요. 받침에서 초성으로도 가요. <b>받침이 없거나 자음이 한 종류뿐</b>인 글자는 자음 점프가 없어요.',
      next: '다음' });
    if (!alive()) return;
    tutConcept(CONCEPT.vowel);
    await coach({ step: 2, title: '<span class="p">모음 점프</span>',
      sub: '모음의 획이 튀어나온 방향으로 <b>획 개수만큼</b> 이동해요. ㅘ·ㅝ는 대각선 1칸. <b>ㅡ ㅣ ㅢ</b>는 튀어나온 획이 없어 모음 점프가 없어요.',
      next: '다음' });
    if (!alive()) return;

    // 2부: 실제 게임판
    let plane = tutBoard(EXAMPLE);
    const spot = (...ps) => {
      plane.classList.toggle('spot', ps.length > 0);
      plane.querySelectorAll('.tile').forEach((t) => t.classList.remove('focus'));
      ps.forEach((p) => tileAt(plane, p).classList.add('focus'));
    };
    spot(EXAMPLE.start, EXAMPLE.goal);
    await coach({ step: 3, title: '실제 판에서 해 봐요',
      sub: '단, 점프는 <b>지금 밟고 있는 자음이 들어 있는 글자</b>로만 할 수 있어요. 지금 말은 <b>ㅊ</b> 위에 있어요.',
      next: '다음' });
    if (!alive()) return;
    spot();
    coach({ step: 4, title: '단어를 입력해 보세요',
      sub: '입력하는 동안 그 글자로 점프할 수 있는 칸마다 <b>흐린 화살표</b>가 보여요. 이 판의 정답은 <b>규칙</b>이에요.',
      fill: '규칙' });
    let res = await waitWord();
    if (!alive()) return;
    const desc = (s) => s.type === 'consonant'
      ? '<span class="o">' + s.syllable + '</span>' + euro(s.syllable).slice(1) + ' ' + s.fromC + '→' + s.target + ' 자음 점프'
      : '<span class="p">' + s.syllable + '</span>' + euro(s.syllable).slice(1) + ' ' + arrowGlyph(s.vector) + ' 모음 점프';
    await coach({ step: 5, title: '클리어!',
      sub: res.path.map(desc).join(', ') + '. 단어만 입력하면 말이 알아서 길을 찾아요.',
      next: '다음' });
    if (!alive()) return;

    plane = tutBoard(LINE);
    coach({ step: 6, title: '순서도 횟수도 자유',
      sub: '자음 점프와 모음 점프는 <b>어떤 순서로든</b>, 한 판에서 <b>몇 번이든</b> 쓸 수 있어요. 같은 글자를 다시 써도 돼요. <b>사람</b>을 입력해 보세요.',
      fill: '사람' });
    res = await waitWord();
    if (!alive()) return;
    await coach({ step: 7, title: '같은 글자를 두 번 썼어요',
      sub: res.path.map((s) => '<span class="p">' + s.syllable + '</span>').join(' → ') + ', 점프 ' + res.path.length + '번으로 깃발. 대신 <b>두 글자 모두 한 번은</b> 써야 해요.',
      next: '다음' });
    if (!alive()) return;

    tutConcept(CONCEPT.more);
    await coach({ step: 8, title: '더 알아 둘 것', sub: '실제 판에서 헷갈리기 쉬운 규칙이에요.', next: '다음' });
    if (!alive()) return;
    tutConcept(CONCEPT.dict);
    await coach({ step: 9, title: '사전에 있는 단어만',
      sub: '정답은 <b>표준국어대사전</b>을 기준으로 한 <b>두 글자 명사</b>만 인정돼요. 사전에 없는 단어는 길이 맞아도 정답이 아니에요. 대신 감점은 없어요.',
      next: '다음' });
    if (!alive()) return;
    tutConcept(CONCEPT.credit);
    await coach({ step: 10, title: '만든 이야기',
      sub: '자모 점프는 웹 예능 〈네 가지 소원〉 EP.2의 <b>숨바꼭질</b> 게임을 차용해 만들었어요. <a href="https://youtu.be/jtg5pXJ7cQM" target="_blank" rel="noopener">원본 영상 보기</a>',
      next: '시작하기' });
    if (!alive()) return;
    finishTutorial();
  }

  function finishTutorial() {
    state.tutWait = null;
    progress.tut = true;
    saveProgress();
    openHome();
  }

  /* ---------- 시작 ---------- */
  let routed = false;
  function route() {
    if (routed) return;
    routed = true;
    if (!progress.tut) runTutorial();
    else openHome();
  }

  $('#splash').addEventListener('click', route);
  setTimeout(route, reduceMotion ? 300 : 2000);

  $('#tower').addEventListener('click', (e) => {
    const b = e.target.closest('.node');
    if (b && !b.disabled) startStage(Number(b.dataset.n));
  });
  $('#map-play').addEventListener('click', () => startStage(currentStage()));
  $('#btn-tutorial').addEventListener('click', runTutorial);
  $('#btn-back').addEventListener('click', () => {
    if (state.mode === 'stage') openMap();
    else if (state.mode === 'tutorial') finishTutorial();
    else openHome();
  });
  $('#map-back').addEventListener('click', openHome);
  $('#daily-card').addEventListener('click', openDaily);
  $('#climb-card').addEventListener('click', openMap);
  document.querySelectorAll('#home .seg button').forEach((b) => b.addEventListener('click', () => {
    progress.level = b.dataset.level;
    saveProgress();
    renderHome();
  }));
  $('#endless-go').addEventListener('click', () => { state.streak = 0; startEndless(progress.level || 'normal'); });
  $('#settle').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.mode === 'daily') { syncDaily(); if (daily.status === 'failed' && state.open) timeUp(); }
  });
  $('#btn-hint').addEventListener('click', onHint);
  $('#dock').addEventListener('submit', onSubmit);
  $('#answer').addEventListener('input', renderAbilities);
  $('#intro-go').addEventListener('click', () => {
    const go = state.introGo;
    state.introGo = null;
    closeSheets();
    if (go) go();
    else if (finePointer) $('#answer').focus();
  });
  $('#res-next').addEventListener('click', () => {
    if (state.mode === 'endless') startEndless(state.level);
    else if (state.mode === 'daily') startDailyRound();
    else if (state.stage < TOTAL) startStage(state.stage + 1);
    else showEnding();
  });
  $('#res-map').addEventListener('click', () => { if (state.mode === 'stage') openMap(); else openHome(); });
  $('#end-share').addEventListener('click', share);
  $('#end-map').addEventListener('click', openMap);

  // 테스트와 디버깅용
  window.__game = { state, progress, startStage, runTutorial, openMap, openHome, startEndless, getDaily: () => daily, setDaily: (d) => { daily = d; saveDaily(); }, dailyPuzzle };
})();
