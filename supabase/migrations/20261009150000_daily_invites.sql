-- 이어하기 초대: 시간 초과로 멈춘 사람이 링크를 보내고, 다른 사람이 그 링크로 실제로 들어와야 이어하기가 열린다.
-- 하루에 한 사람당 하나(이어하기 하루 1회). 같은 계정·같은 기기(IP+브라우저 지문)로 연 건 세지 않는다.
create table if not exists public.daily_invites (
  code text primary key,
  owner uuid not null references auth.users (id) on delete cascade,
  day date not null,
  stage int not null,
  owner_fp text not null,
  created_at timestamptz not null default now(),
  unlocked_by uuid references auth.users (id) on delete set null,
  unlocked_at timestamptz,
  used_at timestamptz,
  unique (owner, day)
);
create table if not exists public.daily_invite_visits (
  code text not null references public.daily_invites (code) on delete cascade,
  visitor uuid not null references auth.users (id) on delete cascade,
  visitor_fp text not null,
  at timestamptz not null default now(),
  primary key (code, visitor)
);
alter table public.daily_invites enable row level security;
alter table public.daily_invite_visits enable row level security;
revoke all on public.daily_invites, public.daily_invite_visits from anon, authenticated;

