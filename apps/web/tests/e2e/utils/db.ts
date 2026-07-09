// apps/web/tests/e2e/utils/db.ts
// e2e 전용 service-role DB 헬퍼 — 학습 루프의 "완주 → 영속화" 를 UI 우회로 직접 단언한다.
// (playwright.config 은 .env.local 을 로드하지 않으므로 apps/web/.env.local 을 직접 읽음)

import fs from 'node:fs';
import path from 'node:path';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Playwright 는 apps/web(= playwright.config 위치)에서 실행 → cwd 기준으로 .env.local 해석.
// (import.meta 는 Playwright CJS 트랜스파일에서 미지원)
const ENV_PATH = path.resolve(process.cwd(), '.env.local');

function readEnv(key: string): string | undefined {
  try {
    const env = fs.readFileSync(ENV_PATH, 'utf8');
    return env.match(new RegExp(`^${key}=(.*)$`, 'm'))?.[1]?.trim();
  } catch {
    return process.env[key];
  }
}

let cached: SupabaseClient | null = null;

/** service-role 클라이언트 (RLS 우회 · 검증 단언 전용). 키 없으면 null. */
export function serviceClient(): SupabaseClient | null {
  if (cached) return cached;
  const url = readEnv('NEXT_PUBLIC_SUPABASE_URL');
  const key = readEnv('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return null;
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}

/** 이메일로 auth 사용자 id 조회 (계정 재생성돼도 안전). */
export async function userIdByEmail(email: string): Promise<string | null> {
  const c = serviceClient();
  if (!c) return null;
  // service-role 는 auth.admin API 로 사용자 열람 가능
  const { data, error } = await c.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error || !data) return null;
  return data.users.find((u) => u.email === email)?.id ?? null;
}

/**
 * 사용자 vocab 의 next_review_at 을 과거로 리셋 — flashcard due 큐를 반복 가능하게.
 * (게임 완주가 SRS 를 미래로 밀어 다음 실행 때 due 0 이 되는 걸 방지)
 * 반환: due 로 만든 행 수(-1 = 키 없음/오류).
 */
export async function resetDueCards(userId: string): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const past = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { data, error } = await c
    .from('vocabularies')
    .update({ next_review_at: past })
    .eq('user_id', userId)
    .select('id');
  if (error) return -1;
  return data?.length ?? 0;
}

/**
 * 특정 시각 이후 module 별 scores 행 개수 — 완주 영속화 단언용.
 * recordGameScore 는 fire-and-forget 이므로 호출부에서 폴링 권장.
 */
export async function countScoresSince(
  userId: string,
  module: string,
  sinceIso: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { count, error } = await c
    .from('scores')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('module', module)
    .gte('created_at', sinceIso);
  if (error) return -1;
  return count ?? 0;
}
