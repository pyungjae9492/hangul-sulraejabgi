-- 이어하기를 하루 여러 번(MAX_RESUMES) 할 수 있도록, 사람당 하루 초대 하나 제한을 없앤다. 한 번 쓴 초대는 다시 못 쓴다.
alter table public.daily_invites drop constraint if exists daily_invites_owner_day_key;
create index if not exists daily_invites_owner_day on public.daily_invites (owner, day, created_at desc);
