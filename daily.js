/*
 * 오늘의 도전 문제 세트와 규칙 상수.
 * 화면(app.js)과 랭킹 서버(supabase/functions/daily)가 이 파일 하나로 같은 날 같은 20문제를 만든다.
 * 5·10·15·20단계는 보스 풀에서 날짜별로 하나씩, 나머지는 날짜 시드로 생성한다.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./gen.js'));
  else root.JamoDaily = factory(root.JamoGen);
})(this, function (Gen) {
  const TOTAL = 20;
  const BOSS_AT = [5, 10, 15, 20];
  const BOSS_SECONDS = 180;
  const MAX_HINTS = 3; // 한 시도(20단계) 동안 쓸 수 있는 힌트
  const MAX_RESUMES = 5; // 이어하기: 하루 다섯 번, 보낸 링크로 다른 사람이 들어와야 열린다

  function buildSet(date, ctx, BOSSES) {
    const day = Math.floor(Date.parse(date + 'T00:00:00Z') / 864e5);
    const used = new Set();
    const set = [];
    for (let n = 1; n <= TOTAL; n++) {
      if (BOSS_AT.includes(n)) {
        const slot = BOSSES[n];
        const b = slot.pool[((day % slot.pool.length) + slot.pool.length) % slot.pool.length];
        set.push({ n, boss: true, title: slot.title, tip: slot.tip, board: b.board, answers: b.answers, key: b.key, seconds: BOSS_SECONDS, level: 'boss' });
        used.add(b.key);
        continue;
      }
      const level = Gen.levelForStage(n);
      const rng = Gen.mulberry32(Gen.hashSeed('daily:' + date + ':' + n));
      const p = Gen.generate(ctx, level, rng, { avoid: used, maxTries: 20000 }) || Gen.generate(ctx, level, rng, { maxTries: 20000 });
      used.add(p.key);
      set.push({ n, boss: false, board: p.board, answers: p.answers, key: p.key, seconds: Gen.LEVELS[level].seconds, level });
    }
    return set;
  }

  // 한국 시간 기준 날짜 (YYYY-MM-DD)
  const kstDate = (ms = Date.now()) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

  return { TOTAL, BOSS_AT, BOSS_SECONDS, MAX_HINTS, MAX_RESUMES, buildSet, kstDate };
});
