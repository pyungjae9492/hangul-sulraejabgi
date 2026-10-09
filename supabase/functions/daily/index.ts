// 오늘의 도전 랭킹 서버.
// 단계 시작·통과를 서버 시계로 기록하고, 제출한 단어가 그날 그 단계의 판을 실제로 푸는지 다시 검사한 뒤에만 기록한다.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
import G from './game.js';

const H = G.HangulHide;
const Gen = G.JamoGen;
const D = G.JamoDaily;
const WORD_SET = new Set([...(G.WORDS || []), ...(G.WORDS_EXTRA || [])]);
const ctx = Gen.makeContext(G.FAM);
const sets = new Map<string, any[]>();
const setFor = (day: string) => {
  if (!sets.has(day)) {
    if (sets.size > 4) sets.clear();
    sets.set(day, D.buildSet(day, ctx, G.BOSSES));
  }
  return sets.get(day)!;
};

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

class Fail extends Error {
  status: number;
  constructor(code: string, status = 400) { super(code); this.status = status; }
}
const GRACE_MS = 4000; // 네트워크 지연 여유
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

function int(v: unknown, lo: number, hi: number) {
  const n = Number(v);
  if (!Number.isInteger(n) || n < lo || n > hi) throw new Fail('arg');
  return n;
}
// 시작은 오늘 날짜만, 통과·힌트는 자정을 막 넘긴 경우를 위해 15분 전 날짜도 받는다.
function checkDay(day: unknown, lenient = false) {
  if (typeof day !== 'string' || !DAY_RE.test(day)) throw new Fail('arg');
  if (day === D.kstDate()) return day;
  if (lenient && day === D.kstDate(Date.now() - 15 * 60e3)) return day;
  throw new Fail('day');
}
const must = <T>(r: { data: T; error: unknown }) => {
  if (r.error) throw r.error;
  return r.data;
};

const ADJ = ['날쌘', '느긋한', '용감한', '졸린', '반짝이는', '수줍은', '배고픈', '씩씩한', '엉뚱한', '다정한', '꼼꼼한', '재빠른'];
const ANIMAL = ['다람쥐', '고양이', '펭귄', '수달', '여우', '부엉이', '토끼', '고래', '판다', '햄스터', '거북이', '참새'];
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];

async function player(uid: string) {
  const got = must(await admin.from('players').select('nickname').eq('id', uid).maybeSingle()) as { nickname: string } | null;
  if (got) return got.nickname;
  const nickname = pick(ADJ) + ' ' + pick(ANIMAL) + ' ' + String(Math.floor(Math.random() * 90) + 10);
  must(await admin.from('players').upsert({ id: uid, nickname }, { onConflict: 'id', ignoreDuplicates: true }));
  return nickname;
}

async function stagesOf(uid: string, day: string, attempt: number) {
  return must(await admin.from('daily_stages').select('*').eq('user_id', uid).eq('day', day).eq('attempt', attempt)) as any[];
}

async function runOf(uid: string, day: string, attempt: number) {
  const r = must(await admin.from('daily_runs').select('*').eq('user_id', uid).eq('day', day).eq('attempt', attempt).maybeSingle()) as any;
  if (r) return r;
  must(await admin.from('daily_runs').upsert({ user_id: uid, day, attempt }, { onConflict: 'user_id,day,attempt', ignoreDuplicates: true }));
  return { user_id: uid, day, attempt, hints: 0, resumes: 0 };
}

// 단계 기록에서 시도 요약을 다시 계산한다: 1단계부터 이어서 통과한 단계 수와 그 시간 합.
async function recompute(uid: string, day: string, attempt: number) {
  const rows = (await stagesOf(uid, day, attempt)).sort((a, b) => a.stage - b.stage);
  let reached = 0;
  let ms = 0;
  for (const r of rows) {
    if (r.stage !== reached + 1 || !r.cleared_at) break;
    reached = r.stage;
    ms += Date.parse(r.cleared_at) - Date.parse(r.started_at);
  }
  const stars = D.BOSS_AT.filter((b: number) => reached >= b).length;
  must(await admin.from('daily_runs').update({ reached, ms, stars, done: reached === D.TOTAL, updated_at: new Date().toISOString() })
    .eq('user_id', uid).eq('day', day).eq('attempt', attempt));
  return { reached, ms, stars };
}

async function start(uid: string, b: any) {
  const day = checkDay(b.day);
  const attempt = int(b.attempt, 1, 1 + D.MAX_RETRIES);
  const stage = int(b.stage, 1, D.TOTAL);
  await player(uid);
  const run = await runOf(uid, day, attempt);
  const rows = await stagesOf(uid, day, attempt);
  const at = (n: number) => rows.find((r) => r.stage === n);
  if (stage > 1 && !at(stage - 1)?.cleared_at) throw new Fail('order');
  const ex = at(stage);
  const now = Date.now();
  if (ex?.cleared_at) throw new Fail('cleared');
  if (ex && Date.parse(ex.deadline) > now) return { ok: true, deadline: ex.deadline };
  if (ex) {
    // 시간이 끝난 단계를 다시 여는 건 '공유하고 이어하기'뿐이다. 하루 전체에서 한 번.
    const runs = must(await admin.from('daily_runs').select('resumes').eq('user_id', uid).eq('day', day)) as any[];
    if (runs.reduce((a, r) => a + r.resumes, 0) >= D.MAX_RESUMES) throw new Fail('resume_used');
    must(await admin.from('daily_runs').update({ resumes: (run.resumes || 0) + 1 }).eq('user_id', uid).eq('day', day).eq('attempt', attempt));
  }
  const st = setFor(day)[stage - 1];
  const deadline = new Date(now + st.seconds * 1000 + GRACE_MS).toISOString();
  must(await admin.from('daily_stages').upsert({
    user_id: uid, day, attempt, stage, started_at: new Date(now).toISOString(), deadline, cleared_at: null, word: null, hinted: ex?.hinted || false,
  }, { onConflict: 'user_id,day,attempt,stage' }));
  return { ok: true, deadline, resumed: !!ex };
}

async function clear(uid: string, b: any) {
  const day = checkDay(b.day, true);
  const attempt = int(b.attempt, 1, 1 + D.MAX_RETRIES);
  const stage = int(b.stage, 1, D.TOTAL);
  const word = typeof b.word === 'string' ? b.word.trim() : '';
  const ex = (await stagesOf(uid, day, attempt)).find((r) => r.stage === stage);
  if (!ex) throw new Fail('not_started');
  if (ex.cleared_at) return { ok: true, already: true, ...(await recompute(uid, day, attempt)) };
  if (Date.now() > Date.parse(ex.deadline)) throw new Fail('timeout');
  if ([...word].length !== 2 || !WORD_SET.has(word)) throw new Fail('word');
  if (!H.findPath(setFor(day)[stage - 1].board, word)) throw new Fail('path');
  must(await admin.from('daily_stages').update({ cleared_at: new Date().toISOString(), word })
    .eq('user_id', uid).eq('day', day).eq('attempt', attempt).eq('stage', stage).is('cleared_at', null));
  return { ok: true, ...(await recompute(uid, day, attempt)) };
}

async function hint(uid: string, b: any) {
  const day = checkDay(b.day, true);
  const attempt = int(b.attempt, 1, 1 + D.MAX_RETRIES);
  const stage = int(b.stage, 1, D.TOTAL);
  const rows = await stagesOf(uid, day, attempt);
  const ex = rows.find((r) => r.stage === stage);
  if (!ex) throw new Fail('not_started');
  if (ex.hinted) return { ok: true };
  const used = rows.filter((r) => r.hinted).length;
  if (used >= D.MAX_HINTS) throw new Fail('hint_used');
  must(await admin.from('daily_stages').update({ hinted: true }).eq('user_id', uid).eq('day', day).eq('attempt', attempt).eq('stage', stage));
  must(await admin.from('daily_runs').update({ hints: used + 1 }).eq('user_id', uid).eq('day', day).eq('attempt', attempt));
  return { ok: true, hints: used + 1 };
}

async function board(uid: string, b: any) {
  if (typeof b.day !== 'string' || !DAY_RE.test(b.day)) throw new Fail('arg');
  const nickname = await player(uid);
  const data = must(await admin.rpc('daily_board', { p_day: b.day, p_uid: uid, p_limit: 50 }));
  return { ...(data as object), nickname };
}

const BANNED = ['시발', '씨발', '병신', '개새', '좆', '섹스', '니미', '애미', '느금'];
async function nick(uid: string, b: any) {
  const name = String(b.nickname || '').replace(/[\u0000-\u001f<>]/g, '').replace(/\s+/g, ' ').trim();
  if ([...name].length < 2 || [...name].length > 12) throw new Fail('nick_len');
  const flat = name.replace(/\s/g, '');
  if (BANNED.some((w) => flat.includes(w))) throw new Fail('nick_bad');
  await player(uid);
  must(await admin.from('players').update({ nickname: name }).eq('id', uid));
  return { ok: true, nickname: name };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u, error } = await admin.auth.getUser(token);
  if (error || !u?.user) return json({ error: 'auth' }, 401);
  let body: any;
  try { body = await req.json(); } catch { return json({ error: 'body' }, 400); }
  try {
    const uid = u.user.id;
    switch (body.action) {
      case 'start': return json(await start(uid, body));
      case 'clear': return json(await clear(uid, body));
      case 'hint': return json(await hint(uid, body));
      case 'board': return json(await board(uid, body));
      case 'nick': return json(await nick(uid, body));
      default: return json({ error: 'action' }, 400);
    }
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'server' }, 500);
  }
});

