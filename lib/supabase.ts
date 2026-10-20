import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | null = null;

/**
 * Supabase 클라이언트를 처음 사용할 때 생성합니다.
 * (빌드 시 프리렌더 단계에서 환경 변수가 없어도 모듈 로드가 실패하지 않도록 지연 생성)
 */
export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      'Supabase 환경 변수가 없습니다. NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 를 설정하세요.',
    );
  }
  client = createClient(url, key);
  return client;
}
