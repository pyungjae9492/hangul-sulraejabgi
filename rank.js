/*
 * 오늘의 도전 랭킹 서버 연결 (Supabase 익명 로그인 + Edge Function "daily")
 * 처음 쓸 때만 라이브러리를 불러오고, 실패해도 게임은 그대로 돌아간다.
 */
(function () {
  const URL = 'https://jjkyrjuffdvulqmprkms.supabase.co';
  const KEY = 'sb_publishable_NtBA4BMBgi7DXUxlDYE30Q_kKHEn70c'; // 공개용 키. 테이블은 모두 막혀 있고 기록은 서버 함수만 쓴다.
  const LIB = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/dist/umd/supabase.js';
  let libP = null;
  let client = null;
  let sessionP = null;
  let chain = Promise.resolve();

  function lib() {
    if (window.supabase) return Promise.resolve();
    return libP || (libP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = LIB;
      s.async = true;
      s.onload = res;
      s.onerror = () => { libP = null; rej(new Error('lib')); };
      document.head.append(s);
    }));
  }

  async function sb() {
    await lib();
    if (!client) client = window.supabase.createClient(URL, KEY, { auth: { persistSession: true, autoRefreshToken: true, storageKey: 'jamo-jump-auth' } });
    return client;
  }

  async function session() {
    const c = await sb();
    if (!sessionP) {
      sessionP = (async () => {
        const { data } = await c.auth.getSession();
        if (data.session) return data.session;
        const r = await c.auth.signInAnonymously();
        if (r.error) throw r.error;
        return r.data.session;
      })().catch((e) => { sessionP = null; throw e; });
    }
    return sessionP;
  }

  async function call(action, body) {
    await session();
    const c = await sb();
    const { data, error } = await c.functions.invoke('daily', { body: Object.assign({ action }, body) });
    if (error) {
      let code = error.message;
      try { code = (await error.context.json()).error || code; } catch (e) { /* 그대로 둔다 */ }
      throw new Error(code);
    }
    return data;
  }

  // 시작 → 통과처럼 순서가 중요한 요청은 줄을 세워 보낸다.
  function queue(action, body) {
    const p = chain.then(() => call(action, body));
    chain = p.catch(() => {});
    return p;
  }

  window.JamoRank = { call, queue, warm: () => session().catch(() => {}) };
})();

