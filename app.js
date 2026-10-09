(() => {
  'use strict';

  const H = window.HangulHide;
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
  const ARROWS = { '1,0': '→', '-1,0': '←', '0,-1': '↑', '0,1': '↓', '1,-1': '↗', '-1,1': '↙', '-1,-1': '↖', '1,1': '↘' };
  const FLAG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 21V4h11l-2.5 4L17 12H6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const STAR = (on) => '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="' + (on ? 'star-on' : 'star-off') + '" d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';
  const CROWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/></svg>';
  const ARROW_R = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h12M12 6l6 6-6 6"/></svg>';
  const SVGNS = 'http://www.w3.org/2000/svg';
  const STORE_KEY = 'jamo-jump-v1';

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(pointer: fine)').matches;

  const progress = Object.assign({ best: 0, stars: {}, tut: false, seen: {} }, JSON.parse(localStorage.getItem(STORE_KEY) || '{}'));
  const saveProgress = () => localStorage.setItem(STORE_KEY, JSON.stringify(progress));

  const state = { mode: null, stage: 0, puzzle: null, idx: null, plane: null, open: false, busy: false, hints: 0, hintAnswer: null, token: 0 };

  const sleep = (ms) => new Promise((r) => setTimeout(r, reduceMotion ? Math.min(ms, 40) : ms));
  const lastJong = (w) => {
    const code = w.charCodeAt(w.length - 1) - 0xac00;
    return code >= 0 && code <= 11171 ? code % 28 : 0;
  };
  const euro = (w) => w + (lastJong(w) && lastJong(w) !== 8 ? '으로' : '로');
  const arrowGlyph = (v) => ARROWS[Math.sign(v[0]) + ',' + Math.sign(v[1])] + Math.max(Math.abs(v[0]), Math.abs(v[1]));
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
    $('#map-play').innerHTML = '<span>스테이지 ' + cur + '</span>' + (st.boss ? '<small>보스</small>' : '') + ARROW_R;
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

  /* ---------- 스테이지 ---------- */
  function setChrome(mode) {
    $('#dock').hidden = mode !== 'stage';
    $('#coach').hidden = mode !== 'tutorial';
    $('#prog').hidden = mode !== 'stage';
    const hint = $('#btn-hint');
    hint.classList.toggle('plain', mode === 'tutorial');
    hint.textContent = mode === 'tutorial' ? '건너뛰기' : '💡 힌트';
  }

  function renderProg(n) {
    $('#prog').innerHTML = STAGES.map((st, i) => {
      const k = i + 1;
      return '<i class="' + (st.boss ? 'boss ' : '') + (k === n ? 'cur' : k <= progress.best ? 'done' : '') + '"></i>';
    }).join('');
  }

  function startStage(n) {
    const st = STAGES[n - 1];
    state.token++;
    state.mode = 'stage';
    state.stage = n;
    state.puzzle = { board: st.board, answers: st.answers.map((w) => ({ word: w, path: H.findPath(st.board, w) })).filter((a) => a.path) };
    state.idx = H.makeBoardIndex(st.board);
    state.hints = 0;
    state.hintAnswer = null;
    state.open = true;
    state.busy = false;
    closeSheets();
    show('play');
    setChrome('stage');
    const title = $('#stage-title');
    title.textContent = st.boss ? '보스 ' + n : '스테이지 ' + n;
    title.classList.toggle('boss', st.boss);
    renderProg(n);
    const c = st.board.cond;
    const cond = $('#cond');
    cond.hidden = c === 'none';
    cond.className = 'cond ' + c;
    cond.textContent = c === 'all' ? '모든 칸 밟기' : c === 'vowel' ? '모음 점프만' : '';
    state.plane = renderBoard($('#board'), st.board);
    $('#answer').value = '';
    setInput(true);
    renderAbilities();

    const intro = st.boss ? 'boss' : c !== 'none' && !progress.seen[c] ? c : null;
    if (intro) showIntro(intro, st);
    else if (finePointer) $('#answer').focus();
  }

  function showIntro(kind, st) {
    const badge = $('#intro-badge');
    badge.className = 'intro-badge ' + kind;
    const cond = st.board.cond;
    if (kind === 'boss') {
      badge.textContent = '보스 스테이지';
      $('#intro-title').textContent = '정답이 ' + st.answers.length + '개뿐';
      $('#intro-sub').textContent = cond === 'vowel' ? '게다가 모음 점프만 쓸 수 있어요.' : cond === 'all' ? '게다가 모든 칸을 밟아야 해요.' : '판을 천천히 읽어 보세요.';
      $('#intro-go').textContent = '도전';
    } else {
      badge.textContent = '새 규칙';
      $('#intro-title').textContent = cond === 'vowel' ? '모음 점프만' : '모든 칸 밟기';
      $('#intro-sub').textContent = cond === 'vowel' ? '이 판에서는 자음 점프를 쓸 수 없어요.' : '깃발에 닿기 전에 판의 모든 칸을 한 번씩 밟아야 해요.';
      $('#intro-go').textContent = '알겠어요';
      progress.seen[cond] = true;
      saveProgress();
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
    const onlyVowel = state.puzzle.board.cond === 'vowel';
    const sc = startConsonant();
    box.innerHTML = sy.map((ch) => {
      const a = H.abilitiesOf(ch);
      const chips = [];
      if (a.consonants) chips.push('<span class="chip o' + (onlyVowel ? ' blocked' : '') + '">' + a.consonants.join('↔') + '</span>');
      if (a.vector) chips.push('<span class="chip p">' + arrowGlyph(a.vector) + '</span>');
      if (!chips.length) chips.push('<span class="chip off">점프 없음</span>');
      return '<div class="ab' + (a.letters.includes(sc) ? ' here' : '') + '"><b>' + ch + '</b>' + chips.join('') + '</div>';
    }).join('');
    drawPreview();
  }

  // 출발 칸에서 입력한 글자로 할 수 있는 첫 점프를 흐리게 보여준다.
  function drawPreview() {
    if (!state.plane || state.mode !== 'stage') return;
    const g = state.plane.querySelector('.g-preview');
    g.innerHTML = '';
    if (!state.open || state.busy) return;
    const board = state.puzzle.board;
    for (const ch of typed()) {
      for (const m of H.movesFrom(state.idx, board.start, H.abilitiesOf(ch), board.cond === 'vowel')) {
        drawArrow(g, board.start, m.to, m.type === 'consonant' ? ORANGE : PURPLE, { faint: true });
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
    if (path) { clearStage(raw, path, false); return; }
    await showMiss(raw);
  }

  // 오답이면 말이 실제로 어디까지 가고 어디서 막히는지 보여준다.
  async function showMiss(word) {
    state.busy = true;
    setInput(false);
    const token = state.token;
    const board = state.puzzle.board;
    const onlyV = board.cond === 'vowel';
    const syl = [...word];
    const ab = syl.map(H.abilitiesOf);
    const plane = state.plane;
    plane.querySelector('.g-preview').innerHTML = '';
    let best = null;
    for (const i of [0, 1]) {
      for (const m of H.movesFrom(state.idx, board.start, ab[i], onlyV)) {
        const next = H.movesFrom(state.idx, m.to, ab[1 - i], onlyV);
        const cand = { i, m, next };
        if (!best || (!best.next.length && next.length)) best = cand;
      }
    }
    const pawn = plane.querySelector('.pawn');
    let msg;
    if (!best) {
      msg = '출발 자음 ' + startConsonant() + '이 든 글자가 없어요';
      const t = tileAt(plane, board.start);
      t.classList.remove('bad'); void t.offsetWidth; t.classList.add('bad');
    } else {
      await playStep(plane, { ...best.m, from: board.start, syllable: syl[best.i] });
      if (token !== state.token) return;
      const other = syl[1 - best.i];
      const here = state.idx.cells.get(best.m.to.join(','));
      if (best.next.length) {
        await playStep(plane, { ...best.next[0], from: best.m.to, syllable: other });
        msg = board.cond === 'all' ? '모든 칸을 밟지 못했어요' : '깃발에 닿지 않아요';
      } else if (!here.c) {
        msg = '깃발에 일찍 닿았어요 · 두 글자를 다 써야 해요';
      } else {
        msg = here.c + ' 칸에서 ‘' + other + '’' + (lastJong(other) && lastJong(other) !== 8 ? '으' : '') + '로는 못 가요';
      }
      pawn.classList.remove('miss'); void pawn.offsetWidth; pawn.classList.add('miss');
    }
    shakeField();
    toast(msg, 'bad');
    if (navigator.vibrate) navigator.vibrate(80);
    await sleep(1300);
    if (token !== state.token) return;
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

  function showResult(word, path, stars, revealed) {
    const st = STAGES[state.stage - 1];
    const k = $('#res-kicker');
    k.textContent = revealed ? '정답 공개' : st.boss ? '보스 격파' : '스테이지 ' + state.stage + ' 클리어';
    k.className = 'kicker' + (revealed ? ' muted' : st.boss ? ' boss' : '');
    $('#res-stars').innerHTML = [1, 2, 3].map((i) => STAR(i <= stars)).join('');
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
    det.querySelector('p').textContent = others.slice(0, 40).join(' · ');
    $('#res-next').textContent = state.stage < TOTAL ? '스테이지 ' + (state.stage + 1) : '정상으로';
    openSheet('#result');
  }

  function onHint() {
    if (state.mode === 'tutorial') { finishTutorial(); return; }
    if (!state.open || state.busy) return;
    if (!state.hints) {
      state.hints = 1;
      state.hintAnswer = state.puzzle.answers[0];
      $('#btn-hint').textContent = '정답 보기';
      $('#answer').value = '';
      renderAbilities();
      toast('첫 글자를 알려 드렸어요 · 별 2개');
      return;
    }
    const a = state.hintAnswer || state.puzzle.answers[0];
    $('#answer').value = a.word;
    clearStage(a.word, a.path, true);
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
  const TUT_STEPS = 7;

  function coach({ step, title, sub, letters, want, wrong, next }) {
    $('#coach-dots').innerHTML = Array.from({ length: TUT_STEPS }, (_, i) => '<i class="' + (i === step ? 'on' : i < step ? 'done' : '') + '"></i>').join('');
    $('#coach-title').innerHTML = title;
    const subEl = $('#coach-sub');
    subEl.textContent = sub || '';
    subEl.className = 'coach-sub';
    const box = $('#coach-letters');
    const nextBtn = $('#coach-next');
    box.innerHTML = '';
    const token = state.token;
    return new Promise((resolve) => {
      (letters || []).forEach((L) => {
        const b = el('button', 'letter tile3d' + (L.used ? ' ' + L.used : '') + (want && !L.used ? ' want' : ''), L.ch);
        b.type = 'button';
        b.disabled = !want || !!L.used;
        b.addEventListener('click', () => {
          if (token !== state.token) return;
          if (L.ch === want) { box.querySelectorAll('button').forEach((x) => { x.disabled = true; }); resolve(L.ch); return; }
          b.classList.remove('bad'); void b.offsetWidth; b.classList.add('bad');
          subEl.textContent = wrong;
          subEl.className = 'coach-sub bad';
        });
        box.append(b);
      });
      nextBtn.hidden = !next;
      if (next) {
        nextBtn.textContent = next;
        nextBtn.onclick = () => { if (token === state.token) resolve('next'); };
      }
    });
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
    const plane = renderBoard($('#board'), EXAMPLE);
    state.plane = plane;
    const path = H.findPath(EXAMPLE, '규칙');
    const spot = (...ps) => {
      plane.classList.toggle('spot', ps.length > 0);
      plane.querySelectorAll('.tile').forEach((t) => t.classList.remove('focus'));
      ps.forEach((p) => tileAt(plane, p).classList.add('focus'));
    };

    spot(EXAMPLE.start);
    await coach({ step: 0, title: '<span class="m">초록 칸</span>에서 출발해요', sub: '그 위의 금색 말이 나예요.', next: '다음' });
    if (!alive()) return;
    spot(EXAMPLE.goal);
    await coach({ step: 1, title: '<span class="c">깃발</span>까지 가면 클리어', sub: '두 글자 단어 하나로 두 번 점프해서 가요.', next: '다음' });
    if (!alive()) return;
    spot(EXAMPLE.start);
    await coach({
      step: 2, title: '지금 밟은 자음은 <span class="m">ㅊ</span>', sub: 'ㅊ이 들어 있는 글자만 쓸 수 있어요. 눌러 보세요.',
      letters: [{ ch: '규' }, { ch: '칙' }], want: '칙', wrong: '규에는 ㅊ이 없어요. 다른 글자!',
    });
    if (!alive()) return;
    spot();
    await playStep(plane, path[0]);
    if (!alive()) return;
    await coach({ step: 3, title: '<span class="o">자음 점프!</span>', sub: '칙 안의 다른 자음 ㄱ 칸으로 건너뛰었어요.', letters: [{ ch: '규' }, { ch: '칙', used: 'o' }], next: '다음' });
    if (!alive()) return;
    spot(path[0].to);
    await coach({
      step: 4, title: '이제 <span class="m">ㄱ</span> 위예요', sub: '남은 글자 규에는 ㄱ이 들어 있죠. 눌러 보세요.',
      letters: [{ ch: '규' }, { ch: '칙', used: 'o' }], want: '규', wrong: '',
    });
    if (!alive()) return;
    spot();
    await playStep(plane, path[1]);
    if (!alive()) return;
    await coach({ step: 5, title: '<span class="p">모음 점프!</span>', sub: 'ㅠ는 획이 아래로 두 개라서 아래로 2칸.', letters: [{ ch: '규', used: 'p' }, { ch: '칙', used: 'o' }], next: '다음' });
    if (!alive()) return;
    await coach({ step: 6, title: '클리어! 정답은 <span class="m">규칙</span>', sub: '이제 단어를 직접 입력해서 20 스테이지를 올라가 보세요.', next: '스테이지 1 시작' });
    if (!alive()) return;
    finishTutorial();
  }

  function finishTutorial() {
    progress.tut = true;
    saveProgress();
    if (progress.best > 0) openMap();
    else startStage(1);
  }

  /* ---------- 시작 ---------- */
  let routed = false;
  function route() {
    if (routed) return;
    routed = true;
    if (!progress.tut) runTutorial();
    else openMap();
  }

  $('#splash').addEventListener('click', route);
  setTimeout(route, reduceMotion ? 300 : 2000);

  $('#tower').addEventListener('click', (e) => {
    const b = e.target.closest('.node');
    if (b && !b.disabled) startStage(Number(b.dataset.n));
  });
  $('#map-play').addEventListener('click', () => startStage(currentStage()));
  $('#btn-tutorial').addEventListener('click', runTutorial);
  $('#btn-back').addEventListener('click', openMap);
  $('#btn-hint').addEventListener('click', onHint);
  $('#dock').addEventListener('submit', onSubmit);
  $('#answer').addEventListener('input', renderAbilities);
  $('#intro-go').addEventListener('click', () => { closeSheets(); if (finePointer) $('#answer').focus(); });
  $('#res-next').addEventListener('click', () => { if (state.stage < TOTAL) startStage(state.stage + 1); else showEnding(); });
  $('#res-map').addEventListener('click', openMap);
  $('#end-share').addEventListener('click', share);
  $('#end-map').addEventListener('click', openMap);

  // 테스트와 디버깅용
  window.__game = { state, progress, startStage, runTutorial, openMap };
})();
