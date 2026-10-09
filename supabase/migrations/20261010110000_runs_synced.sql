-- 화면과 서버 기록이 어긋났을 때(서버가 거절했는데 화면은 진행한 경우 등) 폰에 남은 정답으로 다시 맞춘 기록인지 표시한다.
alter table public.daily_runs add column if not exists synced boolean not null default false;
