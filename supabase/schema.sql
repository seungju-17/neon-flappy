-- ============================================================
-- Neon Flappy : Supabase 스키마
-- Supabase Dashboard > SQL Editor 에서 이 파일 전체를 실행하세요.
-- ============================================================

-- 1) 게임 점수 테이블 (모든 플레이어의 플레이 기록)
create table if not exists game_scores (
  id           uuid primary key default gen_random_uuid(),
  player_name  text not null check (char_length(player_name) between 1 and 20),
  score        integer not null check (score >= 0),
  level        integer not null default 1 check (level >= 1),
  duration_sec integer not null default 0 check (duration_sec >= 0),
  created_at   timestamptz not null default now()
);

create index if not exists game_scores_score_idx on game_scores (score desc, created_at asc);
create index if not exists game_scores_player_idx on game_scores (player_name, created_at desc);

-- 2) 게임 리뷰 테이블
create table if not exists game_reviews (
  id          uuid primary key default gen_random_uuid(),
  author      text not null check (char_length(author) between 1 and 20),
  rating      integer not null check (rating between 1 and 5),
  content     text not null check (char_length(content) between 1 and 300),
  created_at  timestamptz not null default now()
);

create index if not exists game_reviews_created_idx on game_reviews (created_at desc);

-- 3) 통계 뷰 (집계는 뷰에서 처리)
create or replace view game_stats as
select
  count(*)::int                        as total_plays,
  count(distinct player_name)::int     as total_players,
  coalesce(round(avg(score)), 0)::int  as avg_score,
  coalesce(max(score), 0)::int         as best_score,
  coalesce(max(level), 0)::int         as best_level
from game_scores;

create or replace view review_stats as
select
  count(*)::int                           as total_reviews,
  coalesce(round(avg(rating), 2), 0)::numeric as avg_rating
from game_reviews;

-- 4) RLS: 로그인 없이 누구나 읽기/쓰기 가능 (삭제/수정은 불가)
alter table game_scores  enable row level security;
alter table game_reviews enable row level security;

drop policy if exists "scores_select"  on game_scores;
drop policy if exists "scores_insert"  on game_scores;
drop policy if exists "reviews_select" on game_reviews;
drop policy if exists "reviews_insert" on game_reviews;

create policy "scores_select"  on game_scores  for select to anon, authenticated using (true);
create policy "scores_insert"  on game_scores  for insert to anon, authenticated with check (true);
create policy "reviews_select" on game_reviews for select to anon, authenticated using (true);
create policy "reviews_insert" on game_reviews for insert to anon, authenticated with check (true);

grant select on game_stats, review_stats to anon, authenticated;
