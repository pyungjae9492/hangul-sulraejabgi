(() => {
  const H = window.HangulHide;
  const WORDS = window.WORDS || [];
  const WORD_SET = new Set(WORDS);
  const $ = (s) => document.querySelector(s);

  const LOCK_MS = 30000;
  const WIN_POINTS = 2;
  const PLAYERS = [
    { name: '나', human: true, color: '#ffcf8a', skill: 1 },
    { name: '서연', color: '#8bd3ff', skill: 0.9 },
    { name: '민준', color: '#b5f08a', skill: 1.1 },
  ];
  const CPU_SECONDS = { easy: [22, 55], normal: [12, 40], hard: [8, 30] };
  const CPU_MISTAKE = { easy: 0.25, normal: 0.15, hard: 0.08 };

  const state = {
    mode: null,
    difficulty: 'normal',
    players: [],
    round: 0,
    roundId: 0,
    roundOpen: false,
    over: false,
    puzzle: null,
    timers: [],
    solved: 0,
    ticker: null,
  };

  const rand = (a, b) => a + Math.random() * (b - a);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const nowMs = () => Date.now();

  /* ---------- 보드 그리기 ---------- */
  function dims(board) {
    return {
      cols: Math.max(...board.tiles.map((t) => t.x)) + 1,
      rows: Math.max(...board.tiles.map((t) => t.y)) + 1,
    };
  }

  function renderBoard(el, board) {
    const { cols, rows } = dims(board);
    el.innerHTML = '';
    el.style.setProperty('--cols', cols);
    el.style.setProperty('--rows', rows);
    const map = new Map(board.tiles.map((t) => [t.x + ',' + t.y, t]));
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const t = map.get(x + ',' + y);
        const d = document.createElement('div');
        if (!t) {
          d.className = 'cell void';
        } else {
          d.className = 'cell tile';
          const isStart = x === board.start[0] && y === board.start[1];
          const isGoal = x === board.goal[0] && y === board.goal[1];
          if (isStart) d.classList.add('start');
          if (isGoal) d.classList.add('goal');
          if (isStart || isGoal) {
            const tag = document.createElement('span');
            tag.className = 'tag';
            tag.textContent = isStart ? '출발' : '도착';
            d.appendChild(tag);
          }
          if (t.c) d.appendChild(document.createTextNode(t.c));
        }
        el.appendChild(d);
      }
    }
  }

  const px = (el, name) => parseFloat(getComputedStyle(el).getPropertyValue(name));
  function center(el, x, y) {
    const cell = px(el, '--cell');
    const gap = px(el, '--gap');
    return [x * (cell + gap) + cell / 2, y * (cell + gap) + cell / 2];
  }

  const ARROWS = { '1,0': '→', '-1,0': '←', '0,-1': '↑', '0,1': '↓', '1,-1': '↗', '-1,1': '↙', '-1,-1': '↖', '1,1': '↘' };
  function arrowText(v) {
    const n = Math.max(Math.abs(v[0]), Math.abs(v[1]));
    const g = ARROWS[Math.sign(v[0]) + ',' + Math.sign(v[1])];
    return g + n + '칸';
  }
  function describeStep(s) {
    return s.type === 'consonant'
      ? s.syllable + ' · 자음 ' + s.fromC + '→' + s.target
      : s.syllable + ' · 모음 ' + arrowText(s.vector);
  }

  const SVG = 'http://www.w3.org/2000/svg';
  async function playPath(el, path, token) {
    el.querySelectorAll('.path-layer, .pawn').forEach((n) => n.remove());
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('class', 'path-layer');
    svg.setAttribute('viewBox', '0 0 ' + el.offsetWidth + ' ' + el.offsetHeight);
    el.appendChild(svg);
    const pawn = document.createElement('div');
    pawn.className = 'pawn';
    const place = (x, y) => {
      const [cx, cy] = center(el, x, y);
      pawn.style.left = cx - 15 + 'px';
      pawn.style.top = cy - 15 + 'px';
    };
    place(path[0].from[0], path[0].from[1]);
    el.appendChild(pawn);
    await sleep(350);
    for (const s of path) {
      if (token !== state.roundId) return;
      const color = s.type === 'consonant' ? '#f0902f' : '#9a6bff';
      const [cx1, cy1] = center(el, s.from[0], s.from[1]);
      const [x2, y2] = center(el, s.to[0], s.to[1]);
      const len = Math.hypot(x2 - cx1, y2 - cy1) || 1;
      const ux = (x2 - cx1) / len;
      const uy = (y2 - cy1) / len;
      const x1 = cx1 + ux * 26;
      const y1 = cy1 + uy * 26;
      const ex = x2 - ux * 16;
      const ey = y2 - uy * 16;
      const line = document.createElementNS(SVG, 'line');
      Object.entries({ x1, y1, x2: ex, y2: ey, stroke: color, 'stroke-width': 5, 'stroke-linecap': 'round' }).forEach(([k, v]) => line.setAttribute(k, v));
      svg.appendChild(line);
      const head = document.createElementNS(SVG, 'polygon');
      const hx = (n) => n.toFixed(1);
      head.setAttribute('points', [
        hx(ex + ux * 14) + ',' + hx(ey + uy * 14),
        hx(ex - uy * 8) + ',' + hx(ey + ux * 8),
        hx(ex + uy * 8) + ',' + hx(ey - ux * 8),
      ].join(' '));
      head.setAttribute('fill', color);
      svg.appendChild(head);
      const label = document.createElementNS(SVG, 'text');
      label.setAttribute('x', (x1 + x2) / 2 + 14);
      label.setAttribute('y', (y1 + y2) / 2 - 6);
      label.setAttribute('fill', color);
      label.setAttribute('font-size', '22');
      label.setAttribute('font-weight', '800');
      label.setAttribute('stroke', '#000c');
      label.setAttribute('stroke-width', '4');
      label.setAttribute('paint-order', 'stroke');
      label.textContent = s.syllable;
      svg.appendChild(label);
      place(s.to[0], s.to[1]);
      await sleep(750);
    }
  }

  /* ---------- 화면 전환 ---------- */
  function show(id) {
    document.querySelectorAll('.screen').forEach((s) => s.classList.toggle('active', s.id === id));
  }

  function clearTimers() {
    state.timers.forEach(clearTimeout);
    state.timers = [];
  }

  function leaveGame() {
    clearTimers();
    clearInterval(state.ticker);
    state.ticker = null;
    state.roundId++;
    state.roundOpen = false;
    $('#result-modal').hidden = true;
    show('menu');
  }

  /* ---------- 점수판 ---------- */
  function renderScoreboard() {
    const box = $('#scoreboard');
    if (state.mode === 'practice') {
      box.innerHTML = '<div class="pcard me"><div class="avatar" style="--c:#ffcf8a">연</div><div><div class="pname">연습 모드</div><div class="pstate">맞힌 문제</div></div><div class="pts">' + state.solved + '</div></div>';
      return;
    }
    box.innerHTML = '';
    state.players.forEach((p) => {
      const left = Math.ceil((p.lockUntil - nowMs()) / 1000);
      const locked = p.status === 'active' && left > 0;
      const card = document.createElement('div');
      card.className = 'pcard' + (p.human ? ' me' : '') + (p.status === 'survived' ? ' survived' : '') + (p.status === 'out' ? ' out' : '') + (locked ? ' locked' : '');
      const stateText = p.status === 'survived' ? '생존' : p.status === 'out' ? '탈락' : locked ? '오답 · ' + left + '초 정지' : '';
      card.innerHTML = '<div class="avatar" style="--c:' + p.color + '">' + p.name[0] + '</div><div><div class="pname">' + p.name + '</div><div class="pstate">' + stateText + '</div></div><div class="pts">' + p.points + '</div>';
      box.appendChild(card);
    });
  }

  function tick() {
    if (state.mode !== 'match') return;
    renderScoreboard();
    const me = state.players[0];
    const left = Math.ceil((me.lockUntil - nowMs()) / 1000);
    const lock = $('#lock-msg');
    const locked = left > 0 && state.roundOpen && me.status === 'active';
    lock.hidden = !locked;
    if (locked) lock.textContent = '오답입니다. ' + left + '초 동안 제시할 수 없습니다.';
    setInputEnabled(state.roundOpen && me.status === 'active' && !locked);
  }

  function setInputEnabled(on) {
    const input = $('#answer');
    const wasDisabled = input.disabled;
    input.disabled = !on;
    $('#btn-submit').disabled = !on;
    if (on && wasDisabled) input.focus();
  }

  function log(text) {
    const li = document.createElement('li');
    li.textContent = text;
    $('#log').prepend(li);
  }

  function setFeedback(text, kind) {
    const f = $('#feedback');
    f.textContent = text;
    f.className = 'feedback' + (kind ? ' ' + kind : '');
  }

  /* ---------- 라운드 ---------- */
  function startMatch() {
    state.mode = 'match';
    state.over = false;
    state.round = 0;
    state.players = PLAYERS.map((p) => ({ ...p, points: 0, status: 'active', lockUntil: 0 }));
    $('#mode-title').textContent = '데스매치 · 미니 숨바꼭질';
    $('#practice-tools').hidden = true;
    $('#log').innerHTML = '';
    enterGame();
    newRound();
  }

  function startPractice() {
    state.mode = 'practice';
    state.over = false;
    state.round = 0;
    state.solved = 0;
    state.players = [];
    $('#mode-title').textContent = '연습 모드';
    $('#practice-tools').hidden = false;
    $('#log').innerHTML = '';
    enterGame();
    newRound();
  }

  function enterGame() {
    state.difficulty = $('#difficulty').value;
    show('game');
    clearInterval(state.ticker);
    state.ticker = setInterval(tick, 250);
  }

  function makePuzzle() {
    for (let i = 0; i < 8; i++) {
      const p = H.generatePuzzle(WORDS, { difficulty: state.difficulty });
      if (p) return p;
    }
    return null;
  }

  function newRound() {
    clearTimers();
    state.roundId++;
    state.round++;
    state.puzzle = makePuzzle();
    state.roundOpen = true;
    const { board } = state.puzzle;
    renderBoard($('#board'), board);
    $('#round-label').textContent = (state.mode === 'match' ? '라운드 ' : '문제 ') + state.round;
    const badge = $('#cond-badge');
    const condText = { none: '', all: '모든 칸을 거쳐야 한다', vowel: '모음 능력만 사용해야 한다' }[board.cond];
    badge.textContent = condText;
    badge.className = 'badge' + (board.cond === 'none' ? ' none' : '');
    $('#next-bar').hidden = true;
    $('#answer').value = '';
    setFeedback('', '');
    renderScoreboard();
    if (state.mode === 'match') {
      state.players.forEach((p, i) => { if (!p.human && p.status === 'active') scheduleCpu(i); });
    }
    tick();
    setInputEnabled(true);
    $('#answer').focus();
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
    if (!state.roundOpen || id !== state.roundId) return;
    const p = state.players[i];
    if (p.status !== 'active') return;
    if (Math.random() < CPU_MISTAKE[state.difficulty]) {
      p.lockUntil = nowMs() + LOCK_MS;
      log(p.name + ' 오답 · 30초 정지');
      renderScoreboard();
      scheduleCpu(i, LOCK_MS);
      return;
    }
    const a = state.puzzle.answers[Math.floor(Math.random() * state.puzzle.answers.length)];
    roundWon(i, a.word, a.path);
  }

  function roundWon(i, word, path) {
    if (!state.roundOpen) return;
    state.roundOpen = false;
    clearTimers();
    setInputEnabled(false);
    $('#lock-msg').hidden = true;
    const token = state.roundId;
    const name = state.mode === 'match' ? state.players[i].name : '나';
    const steps = path.map(describeStep).join('  →  ');
    $('#result-text').innerHTML = '<b>' + name + '</b> 정답 <b>' + word + '</b>  (' + steps + ')';
    log(name + ' 정답 ' + word);

    if (state.mode === 'practice') {
      state.solved++;
      renderScoreboard();
      setFeedback('정답입니다! 가능한 코드네임은 총 ' + state.puzzle.answers.length + '개.', 'ok');
      $('#btn-next').textContent = '다음 문제';
      $('#next-bar').hidden = false;
      playPath($('#board'), path, token);
      return;
    }

    const p = state.players[i];
    p.points++;
    if (p.points >= WIN_POINTS) p.status = 'survived';
    const survivors = state.players.filter((q) => q.status === 'survived');
    if (i === 0) setFeedback('정답입니다! +1점', 'ok');
    else setFeedback(name + '이(가) 먼저 맞혔습니다.', 'bad');
    renderScoreboard();

    if (survivors.length >= 2) {
      state.players.forEach((q) => { if (q.status === 'active') q.status = 'out'; });
      state.over = true;
    } else if (state.players[0].status === 'survived') {
      // 내가 생존하면 남은 두 명의 대결은 자동으로 진행한다.
      simulateRest();
      state.over = true;
    }

    renderScoreboard();
    $('#btn-next').textContent = state.over ? '결과 보기' : '다음 라운드';
    $('#next-bar').hidden = false;
    playPath($('#board'), path, token);
  }

  function simulateRest() {
    const act = state.players.filter((q) => q.status === 'active');
    while (act.some((q) => q.status === 'active')) {
      const live = act.filter((q) => q.status === 'active');
      const w = live[Math.floor(Math.random() * live.length)];
      w.points++;
      if (w.points >= WIN_POINTS) {
        w.status = 'survived';
        act.filter((q) => q.status === 'active').forEach((q) => { q.status = 'out'; });
      }
    }
  }

  /* ---------- 제출 ---------- */
  function onSubmit(e) {
    e.preventDefault();
    if (!state.roundOpen) return;
    const raw = $('#answer').value.replace(/\s+/g, '');
    if (![...raw].length || [...raw].length !== 2 || !H.isHangulWord(raw)) {
      setFeedback('두 글자 한글 단어를 입력하세요.', 'bad');
      return;
    }
    if (!WORD_SET.has(raw)) {
      setFeedback('"' + raw + '"은(는) 사전에 없는 단어입니다. (제출로 치지 않습니다)', 'bad');
      return;
    }
    const path = H.findPath(state.puzzle.board, raw);
    if (path) {
      roundWon(0, raw, path);
      return;
    }
    if (state.mode === 'match') {
      const me = state.players[0];
      me.lockUntil = nowMs() + LOCK_MS;
      log('나 오답 ' + raw + ' · 30초 정지');
      setFeedback('"' + raw + '"으로는 도착 칸에 갈 수 없습니다.', 'bad');
      $('#answer').value = '';
      tick();
    } else {
      setFeedback('"' + raw + '"은(는) 사전에는 있지만 도착 칸에 갈 수 없습니다.', 'bad');
    }
  }

  function onNext() {
    if (state.over) showFinal();
    else newRound();
  }

  function showFinal() {
    const me = state.players[0];
    const survived = me.status === 'survived';
    $('#final-title').textContent = survived ? '생존했습니다' : '탈락했습니다';
    const others = state.players.filter((p) => !p.human);
    const out = state.players.find((p) => p.status === 'out');
    $('#final-text').textContent = survived
      ? '3회전 데스매치를 통과했습니다. 탈락자: ' + out.name + ' (' + out.points + '점)'
      : '이번 데스매치의 탈락자는 나입니다. (' + me.points + '점) 생존: ' + others.filter((p) => p.status === 'survived').map((p) => p.name).join(', ');
    $('#result-modal').hidden = false;
  }

  /* ---------- 연습 도구 ---------- */
  function onHint() {
    if (!state.roundOpen) return;
    const a = state.puzzle.answers[Math.floor(Math.random() * state.puzzle.answers.length)];
    setFeedback('가능한 코드네임은 ' + state.puzzle.answers.length + '개. 예: ' + a.word[0] + '○', '');
  }

  function onReveal() {
    if (!state.roundOpen) return;
    const first = state.puzzle.answers[0];
    state.roundOpen = false;
    setInputEnabled(false);
    const list = state.puzzle.answers.slice(0, 20).map((a) => a.word).join(', ');
    $('#result-text').innerHTML = '정답 ' + state.puzzle.answers.length + '개: ' + list + (state.puzzle.answers.length > 20 ? ' …' : '');
    $('#btn-next').textContent = '다음 문제';
    $('#next-bar').hidden = false;
    playPath($('#board'), first.path, state.roundId);
  }

  /* ---------- 규칙 모달 ---------- */
  function openRules() {
    const example = {
      tiles: [{ x: 0, y: 0, c: 'ㅊ' }, { x: 1, y: 1, c: 'ㄱ' }, { x: 0, y: 2, c: 'ㅇ' }, { x: 1, y: 3, c: null }],
      start: [0, 0], goal: [1, 3], cond: 'none',
    };
    const el = $('#rules-example');
    renderBoard(el, example);
    $('#rules-modal').hidden = false;
    playPath(el, H.findPath(example, '규칙'), state.roundId);

    const groups = new Map();
    Object.entries(H.VOWEL_MOVES).forEach(([v, m]) => {
      const k = m ? arrowText(m) : '없음';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(v);
    });
    $('#vowel-table').innerHTML = '<tr><th>이동</th><th>모음</th></tr>' + [...groups].map(([k, vs]) => '<tr><td>' + k + '</td><td>' + vs.join(' ') + '</td></tr>').join('');
  }

  /* ---------- 이벤트 ---------- */
  $('#btn-match').addEventListener('click', startMatch);
  $('#btn-practice').addEventListener('click', startPractice);
  $('#btn-rules').addEventListener('click', openRules);
  $('#btn-rules-2').addEventListener('click', openRules);
  $('#btn-rules-close').addEventListener('click', () => { $('#rules-modal').hidden = true; });
  $('#rules-modal').addEventListener('click', (e) => { if (e.target.id === 'rules-modal') $('#rules-modal').hidden = true; });
  $('#btn-back').addEventListener('click', leaveGame);
  $('#answer-form').addEventListener('submit', onSubmit);
  $('#btn-next').addEventListener('click', onNext);
  $('#btn-hint').addEventListener('click', onHint);
  $('#btn-reveal').addEventListener('click', onReveal);
  $('#btn-skip').addEventListener('click', newRound);
  $('#btn-again').addEventListener('click', () => { $('#result-modal').hidden = true; startMatch(); });
  $('#btn-to-menu').addEventListener('click', leaveGame);

  // 테스트와 디버깅용
  window.__game = { state, newRound };
})();
