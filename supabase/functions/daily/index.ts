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
const ATTEMPT = 1; // 다시하기는 없앴다. 하루 한 번의 도전과, 링크로 열리는 이어하기 한 번뿐.
const CODE_RE = /^[a-z0-9]{6,12}$/;

// 같은 기기에서 링크를 열어 자기 이어하기를 여는 걸 막기 위한 지문 (IP + 브라우저). 원문은 저장하지 않는다.
async function fingerprint(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip') || '').split(',')[0].trim();
  const ua = req.headers.get('user-agent') || '';
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip + '|' + ua));
  return [...new Uint8Array(buf)].slice(0, 16).map((b) => b.toString(16).padStart(2, '0')).join('');
}
const newCode = () => [...crypto.getRandomValues(new Uint8Array(8))].map((b) => 'abcdefghjkmnpqrstuvwxyz23456789'[b % 31]).join('');

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
  const attempt = ATTEMPT;
  const stage = int(b.stage, 1, D.TOTAL);
  await player(uid);
  const run = await runOf(uid, day, attempt);
  const rows = await stagesOf(uid, day, attempt);
  const at = (n: number) => rows.find((r) => r.stage === n);
  if (stage > 1 && !at(stage - 1)?.cleared_at) throw new Fail('order');
  const ex = at(stage);
  const now = Date.now();
  if (ex?.cleared_at) throw new Fail('cleared');
  // 원래 제한 시간 안이면 같은 기록을 돌려준다(새로고침 등). 지났으면 이어하기로만 다시 열 수 있다.
  if (ex && Date.parse(ex.deadline) - GRACE_MS - 1500 > now) return { ok: true, deadline: ex.deadline };
  if (ex) {
    // 시간이 끝난 단계를 다시 여는 건 이어하기뿐이다. 보낸 링크로 다른 사람이 들어와 열린 초대가 있어야 한다. 하루 MAX_RESUMES번.
    const invs = await invitesOf(uid, day);
    if (invs.filter((i) => i.used_at).length >= D.MAX_RESUMES) throw new Fail('resume_used');
    const inv = invs.find((i) => i.unlocked_by && !i.used_at && i.stage === stage);
    if (!inv) throw new Fail('locked');
    must(await admin.from('daily_invites').update({ used_at: new Date().toISOString() }).eq('code', inv.code).is('used_at', null));
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
  const attempt = ATTEMPT;
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
  const attempt = ATTEMPT;
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

// 폰에 남은 단계별 정답으로 서버 기록을 맞춘다. 서버가 모르는 단계만, 1단계부터 이어서, 정답이 그 판을 실제로 풀 때만 받는다.
// 시간은 폰이 잰 값을 쓰되 1초~그 단계 제한 시간 사이로 자른다.
async function sync(uid: string, b: any) {
  const day = checkDay(b.day, true);
  const words = b.words && typeof b.words === 'object' ? b.words : {};
  const times = b.times && typeof b.times === 'object' ? b.times : {};
  await player(uid);
  await runOf(uid, day, ATTEMPT);
  const rows = await stagesOf(uid, day, ATTEMPT);
  const set = setFor(day);
  let added = 0;
  for (let n = 1; n <= D.TOTAL; n++) {
    const ex = rows.find((r) => r.stage === n);
    if (ex && ex.cleared_at) continue;
    const w = typeof words[n] === 'string' ? words[n].trim() : '';
    if ([...w].length !== 2 || !WORD_SET.has(w) || !H.findPath(set[n - 1].board, w)) break;
    const lim = set[n - 1].seconds * 1000;
    let ms = Number(times[n]);
    if (!Number.isFinite(ms)) ms = lim;
    ms = Math.min(Math.max(ms, 1000), lim);
    const now = Date.now() + added; // 같은 시각으로 겹치지 않게
    must(await admin.from('daily_stages').upsert({
      user_id: uid, day, attempt: ATTEMPT, stage: n,
      started_at: new Date(now - ms).toISOString(), deadline: new Date(now - ms + lim + GRACE_MS).toISOString(),
      cleared_at: new Date(now).toISOString(), word: w, hinted: ex?.hinted || false,
    }, { onConflict: 'user_id,day,attempt,stage' }));
    added++;
  }
  if (added) must(await admin.from('daily_runs').update({ synced: true }).eq('user_id', uid).eq('day', day).eq('attempt', ATTEMPT));
  return { ok: true, added, ...(await recompute(uid, day, ATTEMPT)) };
}

async function invitesOf(uid: string, day: string) {
  return must(await admin.from('daily_invites').select('*').eq('owner', uid).eq('day', day).order('created_at', { ascending: false })) as any[];
}

// 시간 초과로 멈춘 단계에 대해 이어하기 링크를 만든다. 아직 안 쓴 링크가 있으면 그걸 다시 준다.
async function invite(uid: string, b: any, fp: string) {
  const day = checkDay(b.day, true);
  const stage = int(b.stage, 1, D.TOTAL);
  const ex = (await stagesOf(uid, day, ATTEMPT)).find((r) => r.stage === stage);
  // 링크는 이어하기를 열 뿐이라 너그럽게 만든다. 이미 통과한 단계만 거절한다.
  // (시작 기록이 없거나 시계 차이로 아직 마감 전이어도, 이어하기 시작 때 서버가 다시 확인한다.)
  if (ex && ex.cleared_at) throw new Fail('cleared');
  const invs = await invitesOf(uid, day);
  if (invs.filter((i) => i.used_at).length >= D.MAX_RESUMES) throw new Fail('resume_used');
  const inv = invs.find((i) => !i.used_at);
  if (inv) {
    if (inv.stage !== stage && !inv.unlocked_by) must(await admin.from('daily_invites').update({ stage }).eq('code', inv.code));
    return { code: inv.code, unlocked: !!inv.unlocked_by && inv.stage === stage };
  }
  const code = newCode();
  must(await admin.from('daily_invites').insert({ code, owner: uid, day, stage, owner_fp: fp }));
  return { code, unlocked: false };
}

async function inviteStatus(uid: string, b: any) {
  if (typeof b.day !== 'string' || !DAY_RE.test(b.day)) throw new Fail('arg');
  const inv = (await invitesOf(uid, b.day)).find((i) => !i.used_at);
  if (!inv) return { invite: null };
  let by = null;
  if (inv.unlocked_by) by = (must(await admin.from('players').select('nickname').eq('id', inv.unlocked_by).maybeSingle()) as any)?.nickname || null;
  return { invite: { code: inv.code, stage: inv.stage, unlocked: !!inv.unlocked_by, used: !!inv.used_at, by } };
}

// 링크로 들어온 사람. 다른 계정이고 다른 기기여야 초대를 연다.
async function visit(uid: string, b: any, fp: string) {
  const code = String(b.code || '').toLowerCase();
  if (!CODE_RE.test(code)) throw new Fail('arg');
  const inv = must(await admin.from('daily_invites').select('*').eq('code', code).maybeSingle()) as any;
  if (!inv) return { ok: false, reason: 'none' };
  if (inv.owner === uid || inv.owner_fp === fp) return { ok: false, reason: 'self' };
  await player(uid);
  must(await admin.from('daily_invite_visits').upsert({ code, visitor: uid, visitor_fp: fp }, { onConflict: 'code,visitor', ignoreDuplicates: true }));
  const owner = (must(await admin.from('players').select('nickname').eq('id', inv.owner).maybeSingle()) as any)?.nickname || '친구';
  if (inv.unlocked_by || inv.used_at) return { ok: true, already: true, owner };
  must(await admin.from('daily_invites').update({ unlocked_by: uid, unlocked_at: new Date().toISOString() }).eq('code', code).is('unlocked_by', null));
  return { ok: true, owner };
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
    const fp = await fingerprint(req);
    switch (body.action) {
      case 'start': return json(await start(uid, body));
      case 'clear': return json(await clear(uid, body));
      case 'hint': return json(await hint(uid, body));
      case 'board': return json(await board(uid, body));
      case 'nick': return json(await nick(uid, body));
      case 'invite': return json(await invite(uid, body, fp));
      case 'invite_status': return json(await inviteStatus(uid, body));
      case 'visit': return json(await visit(uid, body, fp));
      case 'sync': return json(await sync(uid, body));
      default: return json({ error: 'action' }, 400);
    }
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: 'server' }, 500);
  }
});
