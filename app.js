(() => {
  'use strict';

  const H = window.HangulHide;
  const Gen = window.JamoGen;
  const WORDS = window.WORDS || [];
  const WORD_SET = new Set(WORDS.concat(window.WORDS_EXTRA || []));
  const Daily = window.JamoDaily;
  const TOTAL = Daily.TOTAL;
  const BOSS_AT = Daily.BOSS_AT;
  const $ = (s) => document.querySelector(s);

  const G = 0.14;
  const ORANGE = '#FF8A3D';
  const PURPLE = '#9B6BFF';
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

  const RULE_TEXT = {
    vowelOnly: () => '모음 점프만',
    consonantOnly: () => '자음 점프만',
    useBoth: () => '두 글자 모두 쓰기',
    visitAll: () => '모든 칸 밟기',
    visitOnce: () => '모든 칸 한 번씩만',
    maxJumps: (n) => n + '번 안에',
    exactJumps: (n) => '딱 ' + n + '번 점프',
  };
  const RULE_INFO = {
    vowelOnly: '이 판에서는 자음 점프를 쓸 수 없어요.',
    consonantOnly: '이 판에서는 모음 점프를 쓸 수 없어요.',
    useBoth: '단어의 두 글자를 모두 한 번 이상 써서 깃발에 닿아야 해요. 한 글자로만 가는 길은 정답이 아니에요.',
    visitAll: '깃발에 닿기 전에 모든 칸을 밟아야 해요. 같은 칸을 다시 밟아도 괜찮아요.',
    visitOnce: '모든 칸을 밟되, 어느 칸도 두 번 밟으면 안 돼요. 출발 칸으로 되돌아가는 것도 안 돼요.',
    maxJumps: '정해진 횟수 안에 깃발에 닿아야 해요.',
    exactJumps: '정확히 그 횟수만큼 점프해서 깃발에 닿아야 해요.',
  };
  const activeRules = (board) => Object.entries(H.rulesOf(board)).filter(([, v]) => v);

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
    if (id !== 'play' && state.closeKeypad) state.closeKeypad();
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

  /* ---------- 지도: 오늘의 20단계 ---------- */
  function renderMap() {
    syncDaily();
    const set = todaySet();
    const tower = $('#tower');
    const rowH = 104, pad = 70;
    const height = TOTAL * rowH + pad * 2 - rowH;
    tower.style.height = height + 'px';
    const cur = currentStage();
    const pts = [];
    let nodes = '';
    set.forEach((st, i) => {
      const n = i + 1;
      const x = 50 + 27 * Math.sin(i * 0.9);
      const y = height - pad - i * rowH;
      pts.push([x, y]);
      const cleared = n < cur || daily.status === 'done';
      const isCur = n === cur && daily.status !== 'done';
      const failed = isCur && daily.status === 'failed';
      const playable = isCur && !daily.final;
      const cls = 'node' + (st.boss ? ' boss' : '') + (cleared ? ' cleared' : '') + (isCur ? ' current' : '') + (failed ? ' failed' : '') + (!cleared && !isCur ? ' locked' : '');
      const t = daily.times[n];
      nodes += '<button type="button" class="' + cls + '" style="left:' + x.toFixed(2) + '%;top:' + y + 'px" data-n="' + n + '"' + (playable ? '' : ' disabled') +
        ' aria-label="스테이지 ' + n + (st.boss ? ' 보스 ' + st.title : '') + '">' +
        (st.boss ? '<span class="crown">' + CROWN + '</span>' : '') +
        '<span class="num">' + n + '</span>' +
        (cleared && t != null ? '<span class="ntime">' + fmt(t) + '</span>' : '') +
        (isCur && !daily.final ? '<span class="me"><i></i></span>' : '') + '</button>';
    });
    const d = (list) => list.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(2) + ' ' + p[1]).join(' ');
    const doneIdx = daily.status === 'done' ? TOTAL - 1 : cur - 1;
    tower.innerHTML =
      '<svg viewBox="0 0 100 ' + height + '" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + d(pts) + '" fill="none" stroke="#2A2C34" stroke-width="3" stroke-dasharray="2 9" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      (doneIdx > 0 ? '<path d="' + d(pts.slice(0, doneIdx + 1)) + '" fill="none" stroke="#3DDC97" stroke-opacity=".55" stroke-width="3" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' : '') +
      '</svg>' + nodes;
    $('#map-title').textContent = '오늘의 도전 · ' + dateLabel(daily.date);
    $('#star-total').textContent = '★ ' + dailyStars() + '/4';
    const play = $('#map-play');
    const st = set[Math.min(cur, TOTAL) - 1];
    if (daily.final || daily.status === 'done') {
      play.innerHTML = '<span>결과 보기</span><small class="muted">' + nextDailyText() + '</small>' + ARROW_R;
    } else if (daily.status === 'failed') {
      play.innerHTML = '<span>시간 초과</span><small>' + (daily.invite && daily.invite.unlocked ? '이어하기 열림' : '링크로 이어하기') + '</small>' + ARROW_R;
    } else {
      const sec = daily.status === 'playing' && daily.deadline ? fmt(daily.deadline - Date.now()) + ' 남음' : st.seconds + '초';
      play.innerHTML = '<span>' + (st.boss ? st.title : '스테이지 ' + cur) + '</span><small' + (st.boss ? '' : ' class="muted"') + '>' + (st.boss ? '보스 · ' : '') + sec + '</small>' + ARROW_R;
    }
    const wrap = $('#tower-wrap');
    requestAnimationFrame(() => { wrap.scrollTop = pts[Math.min(cur, TOTAL) - 1][1] - wrap.clientHeight * 0.55; });
    clearInterval(state.mapTick);
    if (daily.status === 'playing') state.mapTick = setInterval(() => { if (state.mode === 'map') renderMap(); else clearInterval(state.mapTick); }, 1000);
  }

  function openMap() {
    state.token++;
    state.mode = 'map';
    state.open = false;
    clearInterval(state.clock);
    closeSheets();
    show('map');
    renderMap();
  }

  /* ---------- 판 띄우기 (스테이지·무한·도전 공통) ---------- */
  function setChrome(mode) {
    const playing = mode === 'stage' || mode === 'endless' || mode === 'daily' || mode === 'practice';
    $('#dock').hidden = !playing;
    state.tutWait = null;
    $('#coach').hidden = mode !== 'tutorial';
    $('#prog').hidden = true;
    $('#stage-title').hidden = mode === 'endless';
    $('#level-btn').hidden = mode !== 'endless';
    $('#bar-sub').hidden = !(mode === 'endless' || mode === 'daily' || mode === 'practice');
    $('#timer').hidden = mode !== 'daily';
    $('#clock').hidden = mode !== 'daily';
    const hint = $('#btn-hint');
    hint.hidden = mode === 'tutorial';
    hint.classList.remove('spent', 'arm');
    hint.textContent = '힌트';
    $('#btn-skip').hidden = !(mode === 'tutorial' || mode === 'practice');
    $('#btn-back').setAttribute('aria-label', mode === 'daily' ? '지도로' : '처음으로');
  }

  function renderProg(n) {
    $('#prog').innerHTML = Array.from({ length: TOTAL }, (_, i) => {
      const k = i + 1;
      return '<i class="' + (BOSS_AT.includes(k) ? 'boss ' : '') + (k === n ? 'cur' : k < n ? 'done' : '') + '"></i>';
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

  function showRuleIntro(rules) {
    const fresh = rules.map(([k]) => k).find((k) => !progress.seen[k]);
    if (!fresh) return false;
    showIntro({ boss: false, board: state.puzzle.board }, fresh);
    return true;
  }

  function showIntro(st, fresh) {
    state.introGo = null;
    $('#intro-list').hidden = true;
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
    $('#field').classList.toggle('ready', sy.length === 2);
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
      if (a.vector) chips.push('<span class="chip p' + (rules.consonantOnly ? ' blocked' : '') + '">' + VG(H.decompose(ch).jung) + arrowGlyph(a.vector) + '</span>');
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
      else if (state.mode === 'practice') clearPractice(raw, path, false);
      else if (state.mode === 'daily') clearDaily(raw, path);
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
      used: '두 글자를 모두 써야 하는 판이에요',
      visit: rules.visitOnce ? '모든 칸을 한 번씩만 밟아야 해요' : '모든 칸을 밟지 못했어요',
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

  function onHint() {
    if (state.mode === 'tutorial') { finishTutorial(); return; }
    if (!state.open || state.busy) return;
    if (state.mode === 'daily') { useDailyHint(); return; }
    const reveal = state.mode === 'practice' ? clearPractice : clearEndless;
    if (state.mode === 'practice') {
      const a = state.puzzle.answers[0];
      $('#answer').value = a.word;
      renderAbilities();
      clearPractice(a.word, a.path, true);
      return;
    }
    if (!state.hints) {
      state.hints = 1;
      state.hintAnswer = state.puzzle.answers[0];
      $('#btn-hint').textContent = '정답 보기';
      $('#answer').value = '';
      renderAbilities();
      toast(state.mode === 'practice' ? '첫 글자를 알려 드렸어요 · 한 번 더 누르면 정답' : '첫 글자를 알려 드렸어요 · 정답을 보면 연속 기록이 끊겨요');
      return;
    }
    const a = state.hintAnswer || state.puzzle.answers[0];
    $('#answer').value = a.word;
    reveal(a.word, a.path, true);
  }

  /* ---------- 튜토리얼 ---------- */
  /* ---------- 무한 모드 ---------- */
  let genCtx = null;
  const ctx = () => genCtx || (genCtx = Gen.makeContext(window.FAM));
  const LEVEL_LABEL = { warm: '입문', easy: '쉬움', normal: '보통', tricky: '까다로움', hard: '어려움' };
  const endlessOf = (lv) => progress.endless[lv] || (progress.endless[lv] = { best: 0 });

  function startEndless(level) {
    state.level = level;
    progress.level = level;
    saveProgress();
    const used = progress.used[level] || (progress.used[level] = []);
    let p = Gen.generate(ctx(), level, Math.random, { avoid: new Set(used) });
    if (!p) p = Gen.generate(ctx(), level, Math.random);
    const rules = loadPuzzle('endless', p.board, p.answers);
    state.endlessKey = p.key;
    $('#level-label').textContent = LEVEL_LABEL[level];
    renderStreak();
    if (!showRuleIntro(rules) && finePointer) $('#answer').focus();
  }

  const LEVEL_INFO = {
    easy: '작은 판, 조건 없이 익숙한 단어',
    normal: '칸이 늘고 가끔 조건이 붙어요',
    hard: '외길·고리 판과 까다로운 조건',
  };

  // 무한 모드 난이도는 게임 안에서 고른다. 처음 들어올 때만 먼저 묻는다.
  function openLevels() {
    const cur = state.mode === 'endless' ? state.level : null;
    $('#level-list').innerHTML = ['easy', 'normal', 'hard'].map((lv) =>
      '<button type="button" role="radio" class="level-row ' + lv + '" data-level="' + lv + '" aria-checked="' + (lv === cur) + '">' +
      '<span class="lv-dots" aria-hidden="true">' + '<i></i>'.repeat({ easy: 1, normal: 2, hard: 3 }[lv]) + '</span>' +
      '<span class="lv-text"><strong>' + LEVEL_LABEL[lv] + '</strong><small>' + LEVEL_INFO[lv] + '</small></span>' +
      '<span class="lv-best">' + (endlessOf(lv).best ? '최고 ' + endlessOf(lv).best : '') + '</span></button>').join('');
    openSheet('#levels', true);
  }

  function pickLevel(lv) {
    const same = state.mode === 'endless' && state.level === lv;
    progress.levelPicked = true;
    closeSheets();
    if (same) { if (finePointer) $('#answer').focus(); return; }
    state.streak = 0;
    startEndless(lv);
  }

  function openEndless() {
    if (!progress.levelPicked) { openLevels(); return; }
    state.streak = 0;
    startEndless(progress.level || 'normal');
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

  /* ---------- 오늘의 도전: 하루 20단계 ---------- */
  // 5·10·15·20단계는 미리 만들어 둔 보스 풀에서 날짜별로 하나씩, 나머지 16단계는 날짜 시드로 그 자리에서 만든다.
  const DAILY_KEY = 'jamo-jump-daily3';
  const { MAX_RESUMES, MAX_HINTS } = Daily; // 이어하기는 하루 1번(보낸 링크로 다른 사람이 들어와야 열림), 힌트는 3번
  const todayKey = () => Daily.kstDate();
  // 하루 한 번의 도전. 다시하기는 없고, 시간 초과로 멈추면 링크 초대로 열리는 이어하기만 있다.
  // final은 오늘 도전이 끝났다는 뜻(완주했거나, 이어하기 없이 마쳤거나, 이어하기를 이미 쓰고 다시 멈춤).
  const freshDaily = () => ({ date: todayKey(), stage: 1, status: 'ready', deadline: null, final: false, times: {}, words: {}, resumes: 0, hinted: {}, invite: null });
  let daily = (() => {
    const d = JSON.parse(localStorage.getItem(DAILY_KEY) || 'null');
    return d && d.date === todayKey() ? Object.assign(freshDaily(), d) : freshDaily();
  })();
  const saveDaily = () => localStorage.setItem(DAILY_KEY, JSON.stringify(daily));
  const fmt = (ms) => { const s = Math.max(0, Math.ceil(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };
  const dateLabel = (k) => Number(k.slice(5, 7)) + '월 ' + Number(k.slice(8, 10)) + '일';
  const currentStage = () => Math.min(daily.stage, TOTAL);
  const clearedCount = () => (daily.status === 'done' ? TOTAL : daily.stage - 1);
  const dailyStars = () => BOSS_AT.filter((b) => clearedCount() >= b).length;
  const totalTime = () => Object.values(daily.times).reduce((a, b) => a + b, 0);
  const hintsUsed = () => Object.keys(daily.hinted || {}).length;

  // 랭킹 서버로 보내는 기록. 실패해도 게임은 그대로 이어진다.
  const Rank = window.JamoRank;
  function rankSend(action, extra) {
    if (!Rank) return Promise.resolve(null);
    return Rank.queue(action, Object.assign({ day: daily.date, attempt: 1 }, extra))
      .catch((e) => { console.warn('랭킹 기록 실패', action, e.message); return null; });
  }

  function endRun() {
    daily.final = true;
    daily.deadline = null;
    saveDaily();
  }

  const setCache = {};

  function todaySet(date = daily.date) {
    return setCache[date] || (setCache[date] = Daily.buildSet(date, ctx(), window.BOSSES));
  }

  function syncDaily() {
    if (daily.date !== todayKey()) { daily = freshDaily(); saveDaily(); }
    if (daily.status === 'playing' && daily.deadline && Date.now() >= daily.deadline) failDaily();
  }

  function failDaily() {
    daily.status = 'failed';
    daily.deadline = null;
    if (daily.resumes >= MAX_RESUMES) endRun();
    saveDaily();
  }

  function openDaily() {
    syncDaily();
    openMap();
  }

  // 지도에서 처음 시작을 누를 때 오늘의 도전 규칙을 한 번 길게 안내한다.
  function startDaily() {
    syncDaily();
    if (daily.final || daily.status === 'done' || daily.status === 'failed') { showSettle(); return; }
    if (daily.status === 'ready' && daily.stage === 1 && !progress.dailyIntro) {
      progress.dailyIntro = true;
      saveProgress();
      state.introGo = playDaily;
      $('#intro-badge').className = 'intro-badge boss';
      $('#intro-badge').textContent = '오늘의 도전';
      $('#intro-title').textContent = '하루 한 번, 20단계';
      $('#intro-sub').textContent = '오늘은 모두가 같은 20단계를 올라요.';
      const list = $('#intro-list');
      list.innerHTML = [
        ['⏱', '<b>단계마다 제한 시간</b>이 있어요. 화면을 나가도 시간은 흘러요.'],
        ['📈', '위로 갈수록 판이 넓어지고 <b>조건</b>이 붙어요.'],
        ['👑', '5·10·15·20단계는 <b>보스</b>예요. 넘을 때마다 별 하나, 최대 4개.'],
        ['💡', '<b>힌트는 20단계 통틀어 3번</b>. 누르면 정답의 첫 글자를 알려 줘요.'],
        ['🏆', '통과한 단계와 시간으로 <b>오늘의 랭킹</b>에 올라가요.'],
      ].map(([ic, t]) => '<li><span aria-hidden="true">' + ic + '</span><p>' + t + '</p></li>').join('');
      list.hidden = false;
      $('#intro-go').textContent = '1단계 시작';
      openSheet('#intro', true);
      return;
    }
    playDaily();
  }

  function playDaily() {
    syncDaily();
    if (daily.final || daily.status === 'done' || daily.status === 'failed') { showSettle(); return; }
    const n = currentStage();
    const st = todaySet()[n - 1];
    const resumed = daily.status === 'playing' && daily.deadline;
    const rules = loadPuzzle('daily', st.board, st.answers);
    state.stage = n;
    const title = $('#stage-title');
    title.textContent = st.boss ? st.title : '스테이지 ' + n;
    title.classList.toggle('boss', st.boss);
    $('#bar-sub').textContent = n + ' / ' + TOTAL + ' · ' + (st.boss ? '보스' : LEVEL_LABEL[st.level]);
    renderProg(n);
    setInput(false);
    $('#clock').textContent = fmt(resumed ? daily.deadline - Date.now() : st.seconds * 1000);
    $('#timer-fill').style.width = '100%';
    if (daily.hinted[n]) applyHint();
    renderDailyHint();
    const go = () => {
      if (!daily.deadline) daily.deadline = Date.now() + st.seconds * 1000;
      daily.status = 'playing';
      saveDaily();
      rankSend('start', { stage: n });
      setInput(true);
      startClock();
      if (finePointer) $('#answer').focus();
    };
    if (resumed) { go(); return; }
    const fresh = rules.map(([k]) => k).find((k) => !progress.seen[k]);
    if (st.boss || fresh) {
      showIntro(st, fresh);
      if (st.boss) $('#intro-sub').textContent = st.tip + ' 제한 시간 ' + st.seconds + '초.';
      $('#intro-go').textContent = '시작';
      state.introGo = go;
    } else go();
  }

  // 오늘의 도전 힌트: 한 시도(20단계) 동안 3번. 실수로 쓰지 않게 한 번 더 눌러야 쓴다.
  function applyHint() {
    const key = todaySet()[currentStage() - 1].key;
    state.hints = 1;
    state.hintAnswer = state.puzzle.answers.find((a) => a.word === key) || state.puzzle.answers[0];
    $('#answer').value = '';
    renderAbilities();
  }

  function renderDailyHint() {
    const b = $('#btn-hint');
    const left = MAX_HINTS - hintsUsed();
    b.classList.remove('arm');
    b.classList.toggle('spent', !!daily.hinted[currentStage()] || left <= 0);
    b.innerHTML = '힌트 <b>' + left + '</b>';
    b.setAttribute('aria-label', '힌트 ' + left + '개 남음');
  }

  function useDailyHint() {
    const n = currentStage();
    const b = $('#btn-hint');
    if (daily.hinted[n]) { toast('이 단계 힌트는 이미 썼어요'); return; }
    if (hintsUsed() >= MAX_HINTS) { toast('이번 도전의 힌트 ' + MAX_HINTS + '개를 다 썼어요'); return; }
    if (!b.classList.contains('arm')) {
      b.classList.add('arm');
      b.textContent = '첫 글자 보기';
      clearTimeout(state.hintArm);
      state.hintArm = setTimeout(renderDailyHint, 3000);
      return;
    }
    clearTimeout(state.hintArm);
    daily.hinted[n] = true;
    saveDaily();
    applyHint();
    renderDailyHint();
    rankSend('hint', { stage: n });
    toast('첫 글자를 알려 드렸어요 · 남은 힌트 ' + (MAX_HINTS - hintsUsed()));
  }

  function startClock() {
    clearInterval(state.clock);
    const total = todaySet()[currentStage() - 1].seconds * 1000;
    const tick = () => {
      if (state.mode !== 'daily' || !daily.deadline) { clearInterval(state.clock); return; }
      const left = daily.deadline - Date.now();
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
    const n = currentStage();
    const st = todaySet()[n - 1];
    const used = Math.max(0, st.seconds * 1000 - (daily.deadline - Date.now()));
    clearInterval(state.clock);
    state.open = false;
    state.busy = true;
    setInput(false);
    $('#answer').blur();
    daily.times[n] = used;
    daily.words[n] = word;
    daily.deadline = null;
    rankSend('clear', { stage: n, word });
    if (n === TOTAL) { daily.status = 'done'; endRun(); } else { daily.stage = n + 1; daily.status = 'between'; }
    saveDaily();
    renderProg(n + 1);
    const token = state.token;
    await playPath(state.plane, state.puzzle.board, path, () => token === state.token);
    if (token !== state.token) return;
    await sleep(250);
    if (daily.status === 'done') { showSettle(); return; }
    const k = $('#res-kicker');
    k.textContent = (st.boss ? '보스 격파 · ' + st.title : '스테이지 ' + n + ' 클리어') + ' · ' + fmt(used);
    k.className = 'kicker' + (st.boss ? ' boss' : '');
    $('#res-stars').hidden = !st.boss;
    $('#res-stars').innerHTML = BOSS_AT.map((b) => STAR(clearedCount() >= b)).join('');
    fillResult(word, path);
    const next = todaySet()[n];
    $('#res-next').textContent = (next.boss ? '보스 · ' + next.title : '스테이지 ' + (n + 1)) + ' · ' + next.seconds + '초';
    $('#res-map').textContent = '지도';
    openSheet('#result');
  }

  function showSettle() {
    closeSheets();
    syncDaily();
    stopInvitePoll();
    const done = daily.status === 'done';
    const failed = daily.status === 'failed';
    const canResume = failed && !daily.final && daily.resumes < MAX_RESUMES;
    const reached = clearedCount();
    $('#settle-kicker').textContent = '오늘의 도전 · ' + dateLabel(daily.date);
    const t = $('#settle-title');
    t.textContent = done ? '완주' : canResume ? '시간 초과' : reached + '단계 통과';
    t.className = 'verdict sm ' + (done ? 'ok' : canResume ? 'bad' : '');
    $('#settle-stars').innerHTML = BOSS_AT.map((b) => STAR(reached >= b)).join('');
    const set = todaySet();
    const failSt = set[currentStage() - 1];
    const rows = [
      ['통과', reached + ' / ' + TOTAL + '단계'],
      ['보스', BOSS_AT.map((b) => '<span class="sr-boss' + (reached >= b ? ' on' : '') + '">' + set[b - 1].title + '</span>').join('')],
      ['총 시간', fmt(totalTime())],
    ];
    if (failed) rows.push(['멈춘 곳', (failSt.boss ? failSt.title : '스테이지 ' + failSt.n) + (daily.final ? ' · 정답 <b class="sr-ans">' + failSt.key + '</b>' : '')]);
    if (daily.resumes) rows.push(['이어하기', daily.resumes + '번']);
    if (hintsUsed()) rows.push(['힌트', hintsUsed() + ' / ' + MAX_HINTS]);
    $('#settle-rounds').innerHTML = rows.map(([k, v]) => '<li><span class="sr-lv">' + k + '</span><span class="sr-val">' + v + '</span></li>').join('') +
      (Rank ? '<li class="sr-rank"><button type="button" id="settle-rank"><span class="sr-lv">오늘 랭킹</span><span class="sr-val" id="settle-rank-val">불러오는 중…</span></button></li>' : '');
    if (Rank) {
      $('#settle-rank').onclick = () => openRank(showSettle);
      rankSend('board').then((b) => {
        const v = $('#settle-rank-val');
        if (!v) return;
        if (b) state.rank = Object.assign({ day: daily.date }, b);
        v.textContent = b && b.me ? b.me.rank + '위 · ' + b.total + '명 중 ›' : b ? '아직 기록 없음 ›' : '연결 안 됨';
      });
    }
    $('#settle-next').textContent = daily.final || done ? nextDailyText() : '정답은 오늘 도전을 마치면 공개돼요.';
    if (canResume) renderResume();
    else {
      const pri = $('#settle-primary');
      const sec = $('#settle-secondary');
      choice(pri, 'btn-primary wide', '결과 공유');
      pri.onclick = () => shareDaily();
      choice(sec, 'btn-text', '지도');
      sec.onclick = openMap;
      $('#settle-tertiary').hidden = true;
    }
    setTimeout(() => openSheet('#settle', true), 200);
  }

  function choice(btn, cls, title, caption) {
    btn.className = cls + (caption ? ' choice' : '');
    btn.disabled = false;
    btn.innerHTML = '<span>' + title + '</span>' + (caption ? '<small>' + caption + '</small>' : '');
  }

  // 시간 초과 뒤: 링크를 보내고, 그 링크로 다른 사람이 실제로 들어와야 이어하기가 열린다.
  function renderResume() {
    const inv = daily.invite;
    const pri = $('#settle-primary');
    const sec = $('#settle-secondary');
    const ter = $('#settle-tertiary');
    if (inv && inv.unlocked) {
      choice(pri, 'btn-primary wide go', '이어하기', (inv.by ? inv.by + '님이' : '친구가') + ' 링크로 들어와서 열렸어요');
      pri.onclick = resumeDaily;
      $('#settle-next').textContent = '멈춘 단계부터 시간을 새로 받아요. 오늘 한 번뿐이에요.';
    } else {
      choice(pri, 'btn-primary wide', inv ? '링크 다시 보내기' : '친구에게 링크 보내기', '보낸 링크로 친구가 들어오면 이어하기가 열려요 · 오늘 1번');
      pri.onclick = sendInvite;
      $('#settle-next').innerHTML = inv ? '<span class="waiting">친구가 링크로 들어오길 기다리는 중</span>' : '정답은 오늘 도전을 마치면 공개돼요.';
      if (inv) startInvitePoll();
    }
    choice(sec, 'btn-text', '오늘은 여기까지');
    sec.onclick = () => { stopInvitePoll(); endRun(); showSettle(); };
    ter.hidden = false;
    ter.textContent = '지도';
    ter.onclick = () => { stopInvitePoll(); openMap(); };
  }

  async function sendInvite() {
    const pri = $('#settle-primary');
    pri.disabled = true;
    const r = await rankSend('invite', { stage: currentStage() });
    pri.disabled = false;
    if (!r || !r.code) { toast('인터넷에 연결되어 있어야 링크를 만들 수 있어요', 'bad'); return; }
    daily.invite = { code: r.code, unlocked: !!r.unlocked, by: null };
    saveDaily();
    if (!r.unlocked) await shareDaily(r.code);
    renderResume();
  }

  function stopInvitePoll() { clearInterval(state.invitePoll); state.invitePoll = null; }
  function startInvitePoll() {
    if (state.invitePoll) return;
    state.invitePoll = setInterval(checkInvite, 4000);
    checkInvite();
  }
  async function checkInvite() {
    if (!$('#settle').classList.contains('open') || daily.final) { stopInvitePoll(); return; }
    const r = await rankSend('invite_status');
    const inv = r && r.invite;
    if (!inv || !inv.unlocked || (daily.invite && daily.invite.unlocked)) return;
    daily.invite = { code: inv.code, unlocked: true, by: inv.by };
    saveDaily();
    stopInvitePoll();
    toast((inv.by || '친구') + '님이 들어왔어요! 이어서 할 수 있어요', 'ok');
    if (navigator.vibrate) navigator.vibrate(60);
    renderResume();
  }

  function resumeDaily() {
    stopInvitePoll();
    daily.resumes++;
    daily.status = 'between';
    daily.deadline = null;
    saveDaily();
    playDaily();
  }

  /* ---------- 오늘의 랭킹 ---------- */
  const pct = (rank, total) => Math.max(1, Math.ceil((rank / Math.max(1, total)) * 100));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MEDAL = ['🥇', '🥈', '🥉'];
  const runLabel = (r) => (r.done ? '완주' : r.reached + '단계');

  async function openRank(back) {
    state.rankBack = back || null;
    closeSheets();
    $('#rank-sub').textContent = dateLabel(daily.date) + ' · 한 사람당 오늘 가장 좋은 시도';
    $('#rank-me').innerHTML = '<p class="rank-note">불러오는 중…</p>';
    $('#rank-list').innerHTML = '';
    setTimeout(() => openSheet('#rank', true), 200);
    await loadRank();
  }

  async function loadRank() {
    const b = await rankSend('board');
    if (!b) { $('#rank-me').innerHTML = '<p class="rank-note">랭킹을 불러오지 못했어요. 인터넷 연결을 확인해 주세요.</p>'; return; }
    state.rank = Object.assign({ day: daily.date }, b);
    renderRank(state.rank);
  }

  function renderRank(b) {
    const me = b.me;
    $('#rank-me').innerHTML =
      '<div class="rm-name"><span id="rm-nick">' + esc(b.nickname || '') + '</span><button type="button" id="rm-edit" class="rm-edit">이름 바꾸기</button></div>' +
      (me
        ? '<div class="rm-stat"><b>' + me.rank + '<small>위</small></b><span>' + b.total + '명 중 · 상위 ' + pct(me.rank, b.total) + '%<br>' + runLabel(me) + ' · ' + fmt(me.ms) + '</span></div>'
        : '<p class="rank-note">1단계를 통과하면 랭킹에 올라가요.</p>');
    $('#rm-edit').onclick = editNick;
    $('#rank-list').innerHTML = b.top.length
      ? b.top.map((r) => '<li class="' + (r.me ? 'mine' : '') + '"><span class="rk">' + (MEDAL[r.rank - 1] || r.rank) + '</span><span class="rn">' + esc(r.nickname) + '</span><span class="rr">' + runLabel(r) + '</span><span class="rt">' + fmt(r.ms) + '</span></li>').join('')
      : '<li class="empty">아직 오늘 기록이 없어요. 첫 번째가 되어 보세요.</li>';
  }

  function editNick() {
    const box = $('#rank-me .rm-name');
    const cur = $('#rm-nick').textContent;
    box.innerHTML = '<input id="rm-input" maxlength="12" value="' + esc(cur) + '" aria-label="랭킹에 보일 이름" /><button type="button" id="rm-save" class="rm-edit on">저장</button>';
    const input = $('#rm-input');
    input.focus();
    input.select();
    const save = async () => {
      const name = input.value.trim();
      if ([...name].length < 2) { toast('두 글자 이상 적어 주세요', 'bad'); return; }
      $('#rm-save').disabled = true;
      try {
        await Rank.call('nick', { nickname: name });
        toast('이름을 바꿨어요', 'ok');
      } catch (e) {
        toast(e.message === 'nick_bad' ? '쓸 수 없는 이름이에요' : e.message === 'nick_len' ? '2~12글자로 적어 주세요' : '이름을 바꾸지 못했어요', 'bad');
      }
      await loadRank();
    };
    $('#rm-save').onclick = save;
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
  }

  function nextDailyText() {
    const now = new Date(Date.now() + 9 * 3600e3);
    const left = 24 * 3600e3 - ((now.getUTCHours() * 60 + now.getUTCMinutes()) * 60e3 + now.getUTCSeconds() * 1e3);
    const h = Math.floor(left / 3600e3), m = Math.floor((left % 3600e3) / 60e3);
    return '다음 도전까지 ' + (h ? h + '시간 ' : '') + m + '분';
  }

  // code가 있으면 이어하기 초대 링크로 보낸다.
  async function shareDaily(code) {
    const reached = clearedCount();
    const blocks = Array.from({ length: TOTAL }, (_, i) => {
      const n = i + 1;
      if (n <= reached) return BOSS_AT.includes(n) ? '👑' : '🟩';
      if (n === reached + 1 && daily.status === 'failed') return '🟥';
      return '⬜';
    });
    const rowsTxt = [blocks.slice(0, 10).join(''), blocks.slice(10).join('')];
    const text = ['자모 점프 · 오늘의 도전 ' + daily.date.slice(5).replace('-', '/'),
      (daily.status === 'done' ? '완주! ' : reached + '/20 ') + '★'.repeat(dailyStars()) + '☆'.repeat(4 - dailyStars()) + ' · ' + fmt(totalTime()),
      ...rowsTxt, daily.resumes ? '이어하기 ' + daily.resumes + '번' : '',
      state.rank && state.rank.day === daily.date && state.rank.me ? '🏆 오늘 ' + state.rank.me.rank + '위 (상위 ' + pct(state.rank.me.rank, state.rank.total) + '%)' : '',
      code ? '\n' + (currentStage()) + '단계에서 멈췄어요. 이 링크로 들어와 주면 이어서 할 수 있어요 🙏' : '',
      code ? 'https://jamojump.app/?r=' + code : 'https://jamojump.app'].filter(Boolean).join('\n');
    try {
      if (navigator.share) { await navigator.share({ text }); return true; }
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
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
    const reached = clearedCount();
    // 카드에는 지금 해야 할 일이 있을 때만 작은 상태 하나를 띄운다.
    let badge = '';
    let tone = '';
    if (daily.status === 'playing') { badge = currentStage() + '단계 · ' + fmt(daily.deadline - Date.now()); tone = 'live'; }
    else if (daily.status === 'between') badge = reached + '단계 통과';
    else if (daily.status === 'failed' && !daily.final) { badge = '시간 초과'; tone = 'warn'; }
    else if (daily.final) {
      badge = (daily.status === 'done' ? '완주' : reached + '단계') + ' · ★' + dailyStars();
      tone = 'done';
    }
    const b = $('#daily-badge');
    b.hidden = !badge;
    b.textContent = badge;
    b.className = 'mc-badge' + (tone ? ' ' + tone : '');
    clearInterval(state.homeTick);
    if (daily.status === 'playing') state.homeTick = setInterval(() => { if (state.mode === 'home') renderHome(); else clearInterval(state.homeTick); }, 1000);
  }

  /* ---------- 튜토리얼: 자동으로 흘러가는 설명 영상 (스토리 형식) ---------- */
  // 장면마다 실제 게임판·말·화살표로 규칙 하나씩 보여 준다. 탭하면 다음 장면, 왼쪽을 탭하면 이전 장면.
  const TB = (list, start, goal, rules) => ({ tiles: list.map(([x, y, c]) => ({ x, y, c })), start, goal, rules: rules || {} });
  const B = {
    intro: TB([[0, 0, 'ㅇ'], [2, 0, 'ㄱ'], [1, 1, 'ㅁ'], [2, 1, null], [0, 2, 'ㅅ']], [0, 0], [2, 1]),
    cons: TB([[0, 0, 'ㄱ'], [1, 1, 'ㅁ'], [2, 2, null]], [0, 0], [2, 2]),
    dak: TB([[0, 0, 'ㄷ'], [2, 0, 'ㄹ'], [1, 1, 'ㄱ'], [1, 2, null]], [0, 0], [1, 2]),
    twoM: TB([[0, 0, 'ㄱ'], [2, 0, 'ㅁ'], [0, 2, 'ㅁ'], [2, 2, null]], [0, 0], [2, 2]),
    right: TB([[0, 0, 'ㄴ'], [1, 0, 'ㅁ'], [2, 0, null]], [0, 0], [2, 0]),
    two: TB([[0, 0, 'ㅇ'], [0, 2, 'ㄹ'], [1, 2, null]], [0, 0], [1, 2]),
    wa: TB([[0, 1, 'ㅇ'], [1, 0, 'ㄹ'], [2, 0, null]], [0, 1], [2, 0]),
    edge: TB([[0, 0, 'ㄴ'], [0, 1, 'ㅁ'], [1, 1, null]], [0, 0], [1, 1]),
    line: TB([[0, 0, 'ㅅ'], [1, 0, 'ㅁ'], [2, 0, 'ㄹ'], [3, 0, null]], [0, 0], [3, 0]),
  };
  const step = (type, syllable, from, to) => ({ type, syllable, from, to });
  const tour = { tok: 0, i: 0, plane: null };
  const STOP = Symbol('stop');
  const o = (t) => '<span class="o">' + t + '</span>';
  const pu = (t) => '<span class="p">' + t + '</span>';

  function tourCap(html) {
    const c = $('#tour-cap');
    c.classList.remove('in');
    void c.offsetWidth;
    c.innerHTML = html;
    c.classList.add('in');
  }
  function tourVis(html) { $('#tour-vis').innerHTML = html || ''; }
  function tourBoard(b, build) {
    $('#tour').classList.toggle('noboard', !b);
    tour.plane = b ? renderBoard($('#tour-board'), b) : null;
    if (tour.plane && build) {
      tour.plane.classList.add('build');
      tour.plane.querySelectorAll('.tile, .void').forEach((t) => t.style.setProperty('--k', Math.round((Number(t.style.getPropertyValue('--x')) + Number(t.style.getPropertyValue('--y'))) * 10) / 10));
    }
    if (!b) $('#tour-board').innerHTML = '';
    return tour.plane;
  }
  function tourSpot(...ps) {
    const plane = tour.plane;
    if (!plane) return;
    plane.classList.toggle('spot', ps.length > 0);
    plane.querySelectorAll('.tile').forEach((t) => t.classList.remove('focus'));
    ps.forEach((p) => { const t = tileAt(plane, p); if (t) t.classList.add('focus'); });
  }
  function tourPawn(p) {
    const pawn = tour.plane.querySelector('.pawn');
    pawn.classList.add('still');
    setPos(pawn, p);
    requestAnimationFrame(() => pawn.classList.remove('still'));
  }
  const tourJump = (s) => (tour.plane ? playStep(tour.plane, s) : null);
  const tourHint = (from, to, color, label) => drawArrow(tour.plane.querySelector('.g-preview'), from, to, color, { faint: true, label, animate: true });
  // 글자 하나가 자음·모음 조각으로 갈라지는 그림. 쌍자음은 기본 자음을, 겹받침은 두 자음을 함께 보여 준다.
  const BASE_OF = { 'ㄲ': 'ㄱ', 'ㄸ': 'ㄷ', 'ㅃ': 'ㅂ', 'ㅆ': 'ㅅ', 'ㅉ': 'ㅈ' };
  const JONG_SPLIT = { 'ㄳ': 'ㄱㅅ', 'ㄵ': 'ㄴㅈ', 'ㄶ': 'ㄴㅎ', 'ㄺ': 'ㄹㄱ', 'ㄻ': 'ㄹㅁ', 'ㄼ': 'ㄹㅂ', 'ㄽ': 'ㄹㅅ', 'ㄾ': 'ㄹㅌ', 'ㄿ': 'ㄹㅍ', 'ㅀ': 'ㄹㅎ', 'ㅄ': 'ㅂㅅ' };
  const split = (ch, mark) => {
    const d = H.decompose(ch);
    let i = 0;
    const piece = (cls, inner) => '<i class="' + cls + '" style="--i:' + (i++) + '">' + inner + '</i>';
    const cons = (c) => piece('c', c + (BASE_OF[c] ? '<small>' + BASE_OF[c] + '</small>' : ''));
    let jong = '';
    if (d.jong) jong = JONG_SPLIT[d.jong] ? [...JONG_SPLIT[d.jong]].map(cons).join('') : cons(d.jong);
    return '<div class="split ' + (mark || '') + '"><b class="whole tile3d">' + ch + '</b><span class="pieces">' +
      cons(d.cho) + piece('v', VG(d.jung)) + jong + '</span></div>';
  };
  const vbig = (v, label) => '<div class="vbig"><span class="vg-box">' + VG(v) + '</span><span class="vlabel">' + label + '</span></div>';
  const vgrid = (g) => '<div class="vgrid">' + g.map(([v, a], i) => '<span style="--i:' + i + '"' + (a === '✕' ? ' class="no"' : '') + '>' + VG(v) + '<em>' + a + '</em></span>').join('') + '</div>';
  const slots = (a, cls) => '<div class="slots ' + (cls || '') + '">' + a.map((t) => '<i class="tile3d">' + t + '</i>').join('') + '</div>';
  const allTiles = (b) => b.tiles.map((t) => [t.x, t.y]);

  const TOUR = [
    // 1. 게임 소개와 놀이판
    { dur: 3000, async run(w) {
      tourBoard(null);
      tourVis('<div class="tour-logo hopping"><i>자</i><i>모</i><i>점</i><i>프</i><b class="logo-pawn"></b></div>');
      tourCap('두 글자 단어로 말을 움직이는<br><b>한글 점프 퍼즐</b>이에요');
    } },
    { dur: 5600, async run(w) {
      const plane = tourBoard(B.intro, true);
      tourCap('자모 점프는 ' + o('자음 점프') + '와 ' + pu('모음 점프') + '로<br>말을 <span class="m">시작 칸</span>에서 <span class="c">깃발 칸</span>까지 옮겨 줄<br><b>정답 단어</b>를 찾는 게임이에요');
      await w(1500);
      drawArrow(plane.querySelector('.g-preview'), B.intro.start, B.intro.goal, '#C9CBD3', { faint: true, animate: true });
      plane.querySelector('.g-preview').classList.add('ghost');
    } },
    { dur: 3600, async run(w) {
      tourBoard(B.intro);
      tourCap('칸마다 <b>자음이 하나씩</b> 적혀 있어요');
      const cons = B.intro.tiles.filter((t) => t.c).map((t) => [t.x, t.y]);
      for (let k = 1; k <= cons.length; k++) { tourSpot(...cons.slice(0, k)); await w(380); }
    } },
    { dur: 3200, async run(w) {
      const plane = tourBoard(B.intro);
      tourSpot(B.intro.start);
      tourCap('말은 <span class="m">초록 테두리 칸</span>에서 출발해요');
      await w(500);
      plane.querySelector('.pawn').classList.add('bounce');
    } },
    { dur: 3400, async run(w) {
      const plane = tourBoard(B.intro);
      tourSpot(B.intro.goal);
      tileAt(plane, B.intro.goal).classList.add('wave');
      tourCap('<span class="c">깃발 칸</span>까지 가면 성공이에요');
    } },
    { dur: 3200, async run(w) {
      const plane = tourBoard(B.intro);
      plane.classList.add('spot');
      plane.querySelectorAll('.void').forEach((v, k) => { v.style.setProperty('--k', k); v.classList.add('hl'); });
      tourCap('점만 찍힌 곳은 <b>빈자리</b>라서<br>밟을 수 없어요');
    } },
    { dur: 5000, async run(w) {
      tourBoard(B.intro);
      tourVis(slots(['엄', '마'], 'popin'));
      tourCap('단어의 <b>글자 하나가 점프 한 번</b>이에요<br>' + o('자음 점프') + '나 ' + pu('모음 점프') + '로 뛰어요');
      await w(1300);
      const t = $('#tour-vis').querySelectorAll('.slots i');
      t[0].classList.add('o-ring');
      tourHint([0, 0], [1, 1], ORANGE, '엄');
      await w(1000);
      t[1].classList.add('p-ring');
      tourHint([1, 1], [2, 1], PURPLE, '마');
    } },
    // 2. 자음 점프
    { dur: 3200, async run(w) {
      tourBoard(B.cons);
      tourVis(split('금'));
      tourCap('글자를 ' + o('자음') + '과 ' + pu('모음') + '으로 나눠 볼게요');
      await w(500);
      $('#tour-vis .split').classList.add('open');
    } },
    { dur: 4000, async run(w) {
      tourBoard(B.cons);
      tourVis(split('금', 'open cons'));
      tourCap(o('자음 점프') + '<br>한 글자 안에 있는 <b>다른 자음 칸</b>으로 뛰어요');
      await w(1100);
      await tourJump(step('consonant', '금', [0, 0], [1, 1]));
    } },
    { dur: 3600, async run(w) {
      tourBoard(B.cons);
      tourPawn([1, 1]);
      tourVis(split('금', 'open cons'));
      tourCap('반대로 받침 <b>ㅁ</b>에서<br>첫소리 <b>ㄱ</b> 쪽으로도 뛸 수 있어요');
      await w(1000);
      await tourJump(step('consonant', '금', [1, 1], [0, 0]));
    } },
    { dur: 3200, async run(w) {
      tourBoard(null);
      tourVis(split('가', 'open cons no'));
      tourCap('받침이 없는 글자는 자음이 하나뿐이라<br>' + o('자음 점프') + '를 할 수 없어요');
    } },
    { dur: 4200, async run(w) {
      tourBoard(B.cons);
      tourVis(split('꿈', 'open cons'));
      tourCap('<b>ㄲ ㄸ ㅃ ㅆ ㅉ</b>은<br>ㄱ ㄷ ㅂ ㅅ ㅈ과 같은 자음으로 봐요');
      await w(1300);
      await tourJump(step('consonant', '꿈', [0, 0], [1, 1]));
    } },
    { dur: 3200, async run(w) {
      tourBoard(null);
      tourVis(split('꼭', 'open cons no'));
      tourCap('꼭은 ㄲ과 ㄱ이 결국 같은 자음이라<br>' + o('자음 점프') + '를 할 수 없어요');
    } },
    { dur: 4400, async run(w) {
      tourBoard(B.dak);
      tourVis(split('닭', 'open cons'));
      tourCap('닭처럼 <b>받침이 둘</b>이면<br>ㄹ 칸, ㄱ 칸 어디로든 뛸 수 있어요');
      await w(900);
      tourHint([0, 0], [2, 0], ORANGE, '닭');
      await w(500);
      await tourJump(step('consonant', '닭', [0, 0], [1, 1]));
    } },
    { dur: 4000, async run(w) {
      tourBoard(B.twoM);
      tourVis(split('금', 'open cons'));
      tourCap('같은 자음 칸이 여러 개면<br><b>아무 칸이나</b> 골라 뛰어도 돼요');
      await w(700);
      tourHint([0, 0], [2, 0], ORANGE, '금');
      await w(400);
      await tourJump(step('consonant', '금', [0, 0], [0, 2]));
    } },
    // 3. 모음 점프
    { dur: 4200, async run(w) {
      tourBoard(B.right);
      tourVis(vbig('ㅏ', '→ 1칸'));
      tourCap(pu('모음 점프') + '<br>모음 획이 <b>튀어나온 쪽</b>으로 뛰어요');
      await w(1500);
      await tourJump(step('vowel', '나', [0, 0], [1, 0]));
    } },
    { dur: 4000, async run(w) {
      tourBoard(B.two);
      tourVis(vbig('ㅠ', '↓ 2칸'));
      tourCap('획이 두 개면 <b>두 칸</b>을 뛰어요<br>중간 빈자리는 그냥 넘어가요');
      await w(1400);
      await tourJump(step('vowel', '유', [0, 0], [0, 2]));
    } },
    { dur: 3800, async run(w) {
      tourBoard(null);
      tourVis(vgrid([['ㅗ', '↑'], ['ㅜ', '↓'], ['ㅓ', '←'], ['ㅛ', '↑2'], ['ㅠ', '↓2'], ['ㅕ', '←2']]));
      tourCap('ㅗ는 위, ㅜ는 아래, ㅓ는 왼쪽<br>ㅛ ㅠ ㅕ는 두 칸씩이에요');
    } },
    { dur: 4600, async run(w) {
      tourBoard(null);
      tourVis(vgrid([['ㅐ', '→'], ['ㅔ', '←'], ['ㅚ', '↑'], ['ㅟ', '↓'], ['ㅘ', '↗'], ['ㅝ', '↙']]));
      tourCap('<b>겹모음</b>도 튀어나온 획을 따라가요<br>ㅘ ㅙ는 ↗, ㅝ ㅞ는 ↙ 한 칸');
    } },
    { dur: 3800, async run(w) {
      tourBoard(B.wa);
      tourVis(vbig('ㅘ', '↗ 1칸'));
      tourCap('ㅘ는 ㅗ(위)와 ㅏ(오른쪽)가 합쳐져서<br><b>오른쪽 위</b>로 뛰어요');
      await w(1300);
      await tourJump(step('vowel', '와', [0, 1], [1, 0]));
    } },
    { dur: 3400, async run(w) {
      tourBoard(null);
      tourVis(vgrid([['ㅡ', '✕'], ['ㅣ', '✕'], ['ㅢ', '✕']]));
      tourCap('<b>ㅡ ㅣ ㅢ</b>는 튀어나온 획이 없어서<br>' + pu('모음 점프') + '를 할 수 없어요');
    } },
    { dur: 3800, async run(w) {
      const plane = tourBoard(B.edge);
      tourVis(vbig('ㅏ', '→ ✕'));
      tourCap('내려설 <b>칸이 없는 쪽</b>으로는<br>뛸 수 없어요');
      await w(900);
      drawArrow(plane.querySelector('.g-path'), [0, 0], [1, 0], '#FF5A5F', { label: '나', animate: true });
    } },
    // 4. 단어로 풀기
    { dur: 4200, async run(w) {
      tourBoard(B.intro);
      tourSpot(B.intro.start);
      tourVis(slots(['엄', '마'], 'pick'));
      tourCap('하나 더, 지금 <b>밟고 있는 자음</b>이<br>들어간 글자로만 뛸 수 있어요');
      await w(1400);
      const t = $('#tour-vis').querySelectorAll('.slots i');
      t[0].classList.add('yes');
      t[1].classList.add('nope');
    } },
    { dur: 5400, async run(w) {
      tourBoard(B.intro);
      tourVis('<div class="slots"><i class="tile3d o-ring">엄</i><i class="tile3d p-ring">마</i></div>');
      tourCap(o('엄') + '으로 ㅇ에서 ㅁ으로 자음 점프');
      await w(800);
      await tourJump(step('consonant', '엄', [0, 0], [1, 1]));
      tourCap(pu('마') + '로 오른쪽 모음 점프');
      await w(500);
      await tourJump(step('vowel', '마', [1, 1], [2, 1]));
      tourCap('<b>엄마</b>로 깃발 도착!');
    } },
    { dur: 5000, async run(w) {
      tourBoard(B.line);
      tourVis(slots(['사', '람']));
      tourCap('글자 순서는 상관없고<br>같은 글자를 <b>여러 번</b> 써도 돼요');
      await w(900);
      await tourJump(step('vowel', '사', [0, 0], [1, 0]));
      await tourJump(step('vowel', '람', [1, 0], [2, 0]));
      await tourJump(step('vowel', '람', [2, 0], [3, 0]));
    } },
    { dur: 4200, async run(w) {
      tourBoard(null);
      const R = ['vowelOnly', 'consonantOnly', 'useBoth', 'visitAll', 'visitOnce'];
      tourVis('<div class="rule-demo">' + R.map((k, i) => '<span class="rule ' + k + '" style="--i:' + i + '">' + RULE_TEXT[k]() + '</span>').join('') + '</div>');
      tourCap('판에 따라 <b>조건</b>이 붙기도 해요<br>처음 나올 때 알려 드릴게요');
    } },
    { dur: 5000, async run(w) {
      tourBoard(B.intro);
      tourVis('<div class="fake-field"><span class="typed"></span><i class="caret"></i></div>');
      tourCap('단어를 입력하는 동안<br><b>갈 수 있는 길</b>이 미리 보여요');
      const typed = $('#tour-vis .typed');
      await w(800);
      typed.textContent = '엄';
      tourHint([0, 0], [1, 1], ORANGE, '엄');
      await w(800);
      typed.textContent = '엄마';
      tourHint([1, 1], [2, 1], PURPLE, '마');
    } },
    { dur: 0, async run(w) {
      tourBoard(null);
      tourVis('<div class="tour-logo small"><i>자</i><i>모</i><i>점</i><i>프</i></div>');
      tourCap('정답은 <b>사전에 있는 두 글자 명사</b>예요<br>쉬운 연습 다섯 판으로 감을 잡아 봐요');
      $('#tour-end').hidden = false;
    } },
  ];


  function playScene(i) {
    if (i < 0) i = 0;
    if (i >= TOUR.length) return;
    const tok = ++tour.tok;
    tour.i = i;
    const alive = () => tok === tour.tok && state.mode === 'tour';
    const w = (ms) => new Promise((res, rej) => setTimeout(() => (alive() ? res() : rej(STOP)), reduceMotion ? Math.min(ms, 400) : ms));
    const sc = TOUR[i];
    $('#tour-end').hidden = true;
    $('#tour-hint').hidden = i > 1 || !sc.dur;
    $('#tour-bar').innerHTML = TOUR.map((s, k) => '<span class="' + (k < i ? 'done' : k === i ? 'on' : '') + '"><i style="--d:' + (s.dur || 1) + 'ms"></i></span>').join('');
    tourVis('');
    const t0 = performance.now();
    sc.run(w).then(async () => {
      if (!sc.dur) return;
      const left = sc.dur - (performance.now() - t0);
      if (left > 0) await w(left);
      if (alive()) playScene(i + 1);
    }).catch((e) => { if (e !== STOP) console.error(e); });
  }

  /* ---------- 연습 스테이지 3개 (설명 영상 뒤, 실제로 입력해서 풀기) ---------- */
  const PRACTICE = [
    { tip: '자음 점프', answer: '지금', board: TB([[0, 0, 'ㄱ'], [1, 1, 'ㅁ']], [0, 0], [1, 1]) },
    { tip: '모음 점프', answer: '우리', board: TB([[0, 0, 'ㅇ'], [0, 1, null]], [0, 0], [0, 1]) },
    { tip: '모음 두 칸', answer: '우유', board: TB([[0, 0, 'ㅇ'], [0, 2, null]], [0, 0], [0, 2]) },
    { tip: '두 글자 모두 쓰기', answer: '나라', board: TB([[0, 0, 'ㄴ'], [1, 0, 'ㄹ'], [2, 0, null]], [0, 0], [2, 0], { useBoth: true }) },
    { tip: '자음 + 모음, 두 글자 모두', answer: '엄마', board: TB([[0, 0, 'ㅇ'], [1, 1, 'ㅁ'], [2, 1, null]], [0, 0], [2, 1], { useBoth: true }) },
  ];

  function startPractice(i) {
    tour.tok++;
    state.practice = i;
    const P = PRACTICE[i];
    const more = (window.FAM || []).map(([w]) => w).filter((w) => w !== P.answer && H.findPath(P.board, w)).slice(0, 4);
    loadPuzzle('practice', P.board, [P.answer].concat(more));
    $('#stage-title').textContent = '연습 ' + (i + 1) + ' / ' + PRACTICE.length;
    $('#bar-sub').textContent = P.tip;
    $('#btn-hint').textContent = '정답 보기';
    if (finePointer) $('#answer').focus();
  }

  async function clearPractice(word, path, revealed) {
    state.open = false;
    state.busy = true;
    setInput(false);
    $('#answer').blur();
    const token = state.token;
    await playPath(state.plane, state.puzzle.board, path, () => token === state.token);
    if (token !== state.token) return;
    await sleep(250);
    const last = state.practice === PRACTICE.length - 1;
    const k = $('#res-kicker');
    k.textContent = '연습 ' + (state.practice + 1) + ' 통과' + (revealed ? ' · 정답을 봤어요' : '');
    k.className = 'kicker';
    $('#res-stars').hidden = true;
    fillResult(word, path);
    $('#res-next').textContent = last ? '연습 끝! 시작하기' : '다음 연습';
    $('#res-map').textContent = '연습 건너뛰기';
    openSheet('#result');
  }

  function runTutorial() {
    closeSheets();
    state.token++;
    state.mode = 'tour';
    show('tour');
    playScene(0);
  }


  function finishTutorial() {
    tour.tok++;
    state.practice = null;
    state.tutWait = null;
    progress.tut = true;
    saveProgress();
    openHome();
  }

  /* ---------- 시작 ---------- */
  let routed = false;
  // ?r=코드 로 들어오면, 링크를 보낸 사람의 이어하기를 열어 준다.
  const inviteCode = new URLSearchParams(location.search).get('r');
  if (inviteCode) {
    history.replaceState(null, '', location.pathname);
    if (Rank) {
      Rank.call('visit', { code: inviteCode })
        .then((r) => { if (r && r.ok && !r.already) setTimeout(() => toast(r.owner + '님의 이어하기를 열어 줬어요 🙌', 'ok'), 2300); })
        .catch(() => {});
    }
  }

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
    if (b && !b.disabled) startDaily();
  });
  $('#map-play').addEventListener('click', startDaily);
  $('#btn-tutorial').addEventListener('click', runTutorial);
  $('#tour').addEventListener('click', (e) => {
    if (e.target.closest('button, a')) return;
    const r = $('#tour').getBoundingClientRect();
    playScene(e.clientX - r.left < r.width * 0.3 ? tour.i - 1 : tour.i + 1);
  });
  $('#tour-skip').addEventListener('click', () => startPractice(0));
  $('#tour-start').addEventListener('click', () => startPractice(0));
  $('#tour-replay').addEventListener('click', () => playScene(0));
  $('#btn-back').addEventListener('click', () => {
    if (state.mode === 'daily') { if (state.open && daily.status === 'playing') toast('타이머는 계속 흘러요'); openMap(); }
    else if (state.mode === 'tutorial' || state.mode === 'practice') finishTutorial();
    else openHome();
  });
  $('#map-back').addEventListener('click', openHome);
  $('#daily-card').addEventListener('click', openDaily);
  $('#endless-card').addEventListener('click', openEndless);
  $('#level-btn').addEventListener('click', openLevels);
  $('#level-list').addEventListener('click', (e) => {
    const row = e.target.closest('.level-row');
    if (row) pickLevel(row.dataset.level);
  });
  $('#scrim').addEventListener('click', () => {
    if ($('#levels').classList.contains('open')) closeSheets();
    else if ($('#rank').classList.contains('open')) closeRank();
  });
  function closeRank() {
    closeSheets();
    const back = state.rankBack;
    state.rankBack = null;
    if (back) back();
  }
  $('#rank-close').addEventListener('click', closeRank);
  $('#map-rank').addEventListener('click', () => openRank(null));
  $('#settle').addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && state.mode === 'daily') { syncDaily(); if (daily.status === 'failed' && state.open) timeUp(); }
  });
  $('#btn-hint').addEventListener('click', onHint);
  $('#btn-skip').addEventListener('click', finishTutorial);
  $('#dock').addEventListener('submit', onSubmit);
  $('#answer').addEventListener('input', renderAbilities);

  /* ---------- 게임 안 한글 키패드 (터치 기기) ---------- */
  // 시스템 키패드는 Safari의 주소 줄·확인 줄이 붙고 화면이 밀려서, 휴대폰에서는 직접 만든 키패드를 쓴다.
  const KP = window.JamoKeypad;
  const useKeypad = !!KP && matchMedia('(pointer: coarse)').matches;
  const kp = { keys: [], shift: false, open: false };

  function buildKeypad() {
    const label = { shift: '⇧', back: '⌫' };
    const rows = KP.ROWS.map((row, i) => '<div class="kp-row r' + i + '">' + row.map((k) =>
      '<button type="button" class="kp-key' + (KP.isVowel(k) ? ' v' : '') + (label[k] ? ' fn ' + k : '') + '" data-k="' + k + '">' + (label[k] || k) + '</button>').join('') + '</div>');
    rows.push('<div class="kp-row r3"><button type="button" class="kp-key fn close" data-k="close" aria-label="키패드 닫기"><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button>' +
      '<button type="button" class="kp-key fn go" data-k="go">점프<svg viewBox="0 0 24 24"><path d="M5 12h12M12 6l6 6-6 6"/></svg></button></div>');
    $('#keypad').innerHTML = rows.join('');
  }

  function renderShift() {
    $('#keypad').classList.toggle('shifted', kp.shift);
    $('#keypad').querySelectorAll('.kp-key[data-k]').forEach((b) => {
      const k = b.dataset.k;
      if (KP.SHIFT[k]) b.textContent = kp.shift ? KP.SHIFT[k] : k;
    });
  }

  function pressKey(k) {
    const input = $('#answer');
    if (k === 'close') { closeKeypad(); return; }
    if (k === 'go') { if (!input.disabled) onSubmit({ preventDefault() {} }); return; }
    if (input.disabled) return;
    if (KP.compose(kp.keys) !== input.value) kp.keys = KP.toKeys(input.value); // 힌트·튜토리얼이 값을 바꾼 경우
    if (k === 'shift') { kp.shift = !kp.shift; renderShift(); return; }
    let next;
    if (k === 'back') next = kp.keys.slice(0, -1);
    else next = kp.keys.concat(kp.shift && KP.SHIFT[k] ? KP.SHIFT[k] : k);
    const text = KP.compose(next);
    if ([...text].length > 2) { shakeField(); return; }
    kp.keys = next;
    input.value = text;
    if (kp.shift && k !== 'back') { kp.shift = false; renderShift(); }
    renderAbilities();
  }

  // 키패드가 올라오는 높이만큼 판이 들어갈 자리를 미리 계산해, 판 크기가 같은 시간 동안 함께 줄어들게 한다.
  function setKeypad(open) {
    if (!useKeypad || kp.open === open) return;
    kp.open = open;
    const wrap = $('#kp-wrap');
    const host = $('#board');
    const kh = $('#keypad').scrollHeight;
    if (host.dataset.span) {
      host.classList.add('anim');
      sizeBoard(host, host.clientHeight + (open ? -kh : kh));
      clearTimeout(kp.animT);
      kp.animT = setTimeout(() => { host.classList.remove('anim'); sizeBoard(host); }, 340);
    }
    wrap.style.maxHeight = open ? kh + 'px' : '0px';
    wrap.setAttribute('aria-hidden', String(!open));
    document.body.classList.toggle('kp', open);
    $('#field').classList.toggle('active', open);
  }
  const openKeypad = () => { if (!$('#answer').disabled) setKeypad(true); };
  const closeKeypad = () => setKeypad(false);
  state.closeKeypad = closeKeypad;

  if (useKeypad) {
    buildKeypad();
    const input = $('#answer');
    input.readOnly = true;
    input.inputMode = 'none';
    input.tabIndex = -1;
    $('#field').addEventListener('pointerdown', (e) => {
      if (e.target.closest('#btn-submit')) return;
      e.preventDefault();
      openKeypad();
    });
    $('#board').addEventListener('click', closeKeypad);
    const pad = $('#keypad');
    // 키 사이 틈이나 가장자리를 눌러도 가장 가까운 키가 눌리게 한다.
    const nearest = (x, y) => {
      let best = null, bd = Infinity;
      pad.querySelectorAll('.kp-key').forEach((k) => {
        const r = k.getBoundingClientRect();
        const dx = Math.max(r.left - x, 0, x - r.right), dy = Math.max(r.top - y, 0, y - r.bottom);
        const d = dx * dx + dy * dy;
        if (d < bd) { bd = d; best = k; }
      });
      return bd <= 24 * 24 ? best : null;
    };
    pad.addEventListener('pointerdown', (e) => {
      const b = e.target.closest('.kp-key') || nearest(e.clientX, e.clientY);
      if (!b) return;
      e.preventDefault();
      b.classList.add('down');
      pressKey(b.dataset.k);
    });
    const up = () => pad.querySelectorAll('.kp-key.down').forEach((b) => b.classList.remove('down'));
    ['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => pad.addEventListener(t, up));
    pad.addEventListener('pointerout', up);
    window.addEventListener('resize', () => { const h = $('#board'); if (h.dataset.span && !h.classList.contains('anim')) sizeBoard(h); });
  }


  // 키패드가 올라오면(보이는 영역이 크게 줄면) 헤더를 숨기고, 놀이 화면을 보이는 영역에 딱 맞춰 고정한다.
  // iOS는 키패드가 열리면 페이지 전체를 밀어 올리기 때문에, 보이는 영역의 위치(offsetTop)를 따라간다.
  const vv = window.visualViewport;
  if (vv) {
    let fullH = vv.height;
    const fit = () => {
      const typing = document.activeElement === $('#answer');
      if (!typing) fullH = Math.max(vv.height, window.innerHeight * 0.6);
      const kb = typing && vv.height < fullH - 120;
      const rs = document.documentElement.style;
      rs.setProperty('--vvh', Math.round(vv.height) + 'px');
      rs.setProperty('--vvt', Math.round(vv.offsetTop) + 'px');
      if (kb !== document.body.classList.contains('kb')) {
        document.body.classList.toggle('kb', kb);
        if (!kb) window.scrollTo(0, 0);
      }
      const host = $('#board');
      if (host.dataset.span) requestAnimationFrame(() => sizeBoard(host));
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
    $('#answer').addEventListener('focus', () => setTimeout(fit, 60));
    $('#answer').addEventListener('blur', () => setTimeout(fit, 60));
  }
  $('#intro-go').addEventListener('click', () => {
    const go = state.introGo;
    state.introGo = null;
    closeSheets();
    if (go) go();
    else if (finePointer) $('#answer').focus();
  });
  $('#res-next').addEventListener('click', () => {
    if (state.mode === 'endless') startEndless(state.level);
    else if (state.mode === 'practice') { if (state.practice < PRACTICE.length - 1) startPractice(state.practice + 1); else finishTutorial(); }
    else if (state.mode === 'daily') playDaily();
  });
  $('#res-map').addEventListener('click', () => { if (state.mode === 'daily') openMap(); else if (state.mode === 'practice') finishTutorial(); else openHome(); });

  // 테스트와 디버깅용
  window.__game = { state, progress, runTutorial, openMap, openHome, playDaily, startEndless, todaySet, getDaily: () => daily, setDaily: (d) => { daily = d; saveDaily(); } };
})();
