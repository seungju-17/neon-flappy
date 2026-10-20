import { getSupabase } from '@/lib/supabase';

export interface ScoreRow {
  id: string;
  player_name: string;
  score: number;
  level: number;
  duration_sec: number;
  created_at: string;
}

export interface ReviewRow {
  id: string;
  author: string;
  rating: number;
  content: string;
  created_at: string;
}

export interface GameStats {
  total_plays: number;
  total_players: number;
  avg_score: number;
  best_score: number;
  best_level: number;
}

export interface ReviewStats {
  total_reviews: number;
  avg_rating: number;
}

export interface ScoreInput {
  player_name: string;
  score: number;
  level: number;
  duration_sec: number;
}

export interface ReviewInput {
  author: string;
  rating: number;
  content: string;
}

function fail(prefix: string, error: { message: string } | null): never {
  throw new Error(`${prefix}: ${error?.message ?? 'unknown error'}`);
}

/** 상위 점수 (점수 내림차순, 같은 점수면 먼저 달성한 사람이 위) */
export async function fetchTopScores(limit = 10): Promise<ScoreRow[]> {
  const { data, error } = await getSupabase()
    .from('game_scores')
    .select('*')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) fail('랭킹 조회 실패', error);
  return data ?? [];
}

/** 점수 저장 후 저장된 행 반환 */
export async function insertScore(input: ScoreInput): Promise<ScoreRow> {
  const { data, error } = await getSupabase()
    .from('game_scores')
    .insert(input)
    .select()
    .single();
  if (error) fail('점수 저장 실패', error);
  return data as ScoreRow;
}

/** 주어진 점수가 전체에서 몇 등인지 (자기보다 높은 점수 개수 + 1) */
export async function fetchRankOf(score: number): Promise<number> {
  const { count, error } = await getSupabase()
    .from('game_scores')
    .select('id', { count: 'exact', head: true })
    .gt('score', score);
  if (error) fail('순위 조회 실패', error);
  return (count ?? 0) + 1;
}

/** 특정 플레이어의 최근 기록 */
export async function fetchMyScores(playerName: string, limit = 10): Promise<ScoreRow[]> {
  const { data, error } = await getSupabase()
    .from('game_scores')
    .select('*')
    .eq('player_name', playerName)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail('내 기록 조회 실패', error);
  return data ?? [];
}

export async function fetchReviews(limit = 50): Promise<ReviewRow[]> {
  const { data, error } = await getSupabase()
    .from('game_reviews')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) fail('리뷰 조회 실패', error);
  return data ?? [];
}

export async function insertReview(input: ReviewInput): Promise<ReviewRow> {
  const { data, error } = await getSupabase()
    .from('game_reviews')
    .insert(input)
    .select()
    .single();
  if (error) fail('리뷰 저장 실패', error);
  return data as ReviewRow;
}

export async function fetchGameStats(): Promise<GameStats> {
  const { data, error } = await getSupabase().from('game_stats').select('*').single();
  if (error) fail('통계 조회 실패', error);
  return data as GameStats;
}

export async function fetchReviewStats(): Promise<ReviewStats> {
  const { data, error } = await getSupabase().from('review_stats').select('*').single();
  if (error) fail('리뷰 통계 조회 실패', error);
  return { ...(data as ReviewStats), avg_rating: Number((data as ReviewStats).avg_rating) };
}
