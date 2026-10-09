-- 자모 점프 오늘의 도전 랭킹
-- 클라이언트는 테이블에 직접 접근하지 못한다. 기록은 Edge Function(daily)이 문제를 다시 만들어 검증한 뒤에만 쓴다.

create table if not exists public.players (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null,
  created_at timestamptz not null default now()
);

-- 시도 하나(1~20단계)의 요약. 랭킹에는 하루 중 가장 좋은 시도가 올라간다.
create table if not exists public.daily_runs (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  attempt int not null check (attempt between 1 and 6),
  reached int not null default 0,
  ms bigint not null default 0,
  stars int not null default 0,
  hints int not null default 0,
  resumes int not null default 0,
  done boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key (user_id, day, attempt)
);

-- 단계별 시작·통과 시각. 시간은 서버 시계로만 잰다.
create table if not exists public.daily_stages (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  attempt int not null,
  stage int not null check (stage between 1 and 20),
  started_at timestamptz not null,
  deadline timestamptz not null,
  cleared_at timestamptz,
  word text,
  hinted boolean not null default false,
  primary key (user_id, day, attempt, stage)
);

create index if not exists daily_runs_day_rank on public.daily_runs (day, reached desc, ms asc);

alter table public.players enable row level security;
alter table public.daily_runs enable row level security;
alter table public.daily_stages enable row level security;
revoke all on public.players, public.daily_runs, public.daily_stages from anon, authenticated;

-- 한 사람의 그날 최고 시도만 모아 순위를 매긴다: 통과한 단계가 많은 순, 같으면 총 시간이 짧은 순.
create or replace function public.daily_board(p_day date, p_uid uuid, p_limit int default 50)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with best as (
    select distinct on (r.user_id) r.user_id, r.attempt, r.reached, r.ms, r.stars, r.hints, r.done
    from daily_runs r
    where r.day = p_day and r.reached > 0
    order by r.user_id, r.reached desc, r.ms asc, r.attempt asc
  ), ranked as (
    select b.*, rank() over (order by b.reached desc, b.ms asc) as rank, coalesce(p.nickname, '익명') as nickname
    from best b left join players p on p.id = b.user_id
  )
  select json_build_object(
    'total', (select count(*) from ranked),
    'top', coalesce((
      select json_agg(x order by x.rank, x.ms)
      from (select rank, nickname, reached, ms, stars, hints, done, user_id = p_uid as me from ranked order by rank, ms limit p_limit) x
    ), '[]'::json),
    'me', (select row_to_json(m) from (select rank, nickname, reached, ms, stars, hints, done, attempt from ranked where user_id = p_uid) m)
  );
$$;

revoke all on function public.daily_board(date, uuid, int) from public, anon, authenticated;
grant execute on function public.daily_board(date, uuid, int) to service_role;

