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
 * 공용단어장 구독 보장(멱등) — 06-chapter-launch 등 챕터 학습 검증의 데이터 전제.
 * 이미 있으면 no-op. service-role 키 없으면 false(호출부는 기존 영속 데이터에 의존).
 */
export async function ensureWordSetSubscription(userId: string, setId: string): Promise<boolean> {
  const c = serviceClient();
  if (!c) return false;
  const { data } = await c
    .from('user_word_set_subscriptions')
    .select('user_id')
    .eq('user_id', userId)
    .eq('set_id', setId)
    .limit(1);
  if (data && data.length > 0) return true;
  const { error } = await c.from('user_word_set_subscriptions').insert({ user_id: userId, set_id: setId });
  return !error;
}

/**
 * 공용단어장 계획 항목 보장(멱등) — '오늘의 학습'에 뜨도록 오늘 요일(KST ISODOW) 배치.
 * 같은 (user, word_set, set) 항목이 이미 있으면 no-op(multi-entry 라 unique 없음 → check-then-insert).
 */
export async function ensureWordSetPlanItem(userId: string, setId: string): Promise<boolean> {
  const c = serviceClient();
  if (!c) return false;
  const { data: existing } = await c
    .from('study_plan_items')
    .select('id')
    .eq('user_id', userId)
    .eq('material_type', 'word_set')
    .eq('material_id', setId)
    .limit(1);
  if (existing && existing.length > 0) return true;
  // KST(UTC+9) 요일 → ISO 1=월..7=일 (일=0→7)
  const kstDow = new Date(Date.now() + 9 * 3600 * 1000).getUTCDay();
  const isoDow = kstDow === 0 ? 7 : kstDow;
  const { error } = await c.from('study_plan_items').insert({
    user_id: userId,
    material_type: 'word_set',
    material_id: setId,
    modules: ['vocab', 'flashcard', 'wordblitz'],
    chapters: [],
    weekdays: [isoDow],
  });
  return !error;
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
 * 특정 시각 이후 word_familiarity 행 개수 — "알아요/몰라요" 판정 영속화 단언용.
 * set_word_familiarity RPC 는 브라우저에서 fire-and-forget 이므로 호출부에서 폴링 권장.
 */
export async function countWordFamiliaritySince(
  userId: string,
  sinceIso: string,
  verdict?: 'known' | 'unknown',
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  let q = c
    .from('word_familiarity')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('updated_at', sinceIso);
  if (verdict) q = q.eq('verdict', verdict);
  const { count, error } = await q;
  if (error) return -1;
  return count ?? 0;
}

/** 테스트가 만든 word_familiarity 정리(멱등) — known 판정이 다음 추출을 영구 축소하지 않도록 반드시 원복. */
export async function deleteWordFamiliaritySince(userId: string, sinceIso: string): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { data, error } = await c
    .from('word_familiarity')
    .delete()
    .eq('user_id', userId)
    .gte('updated_at', sinceIso)
    .select('lemma');
  if (error) return -1;
  return data?.length ?? 0;
}

/**
 * 특정 시각 이후 `vocabularies` 에 담긴 단어 수 — L2 전달(deliver_chapter_vocab p_commit) 단언용.
 * origin 을 좁히면 그 경로로 들어온 것만 센다 ('shared_set' = 단어장/L2 경유).
 */
export async function countVocabulariesSince(
  userId: string,
  sinceIso: string,
  origin?: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  let q = c
    .from('vocabularies')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso);
  if (origin) q = q.eq('origin', origin);
  const { count, error } = await q;
  if (error) return -1;
  return count ?? 0;
}

/**
 * 테스트가 담은 vocabularies 정리(멱등).
 *
 * ⚠️ 반드시 finally 에서 호출할 것 — deliver_chapter_vocab 은 **기보유 단어를 제외**하므로,
 * 테스트가 담은 행을 남기면 다음 실행의 전달 목록이 영구적으로 줄어들어 같은 테스트가
 * 스스로를 무력화한다 (08-text-extract-trust 의 word_familiarity 원복과 같은 이유).
 */
export async function deleteVocabulariesSince(userId: string, sinceIso: string): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { data, error } = await c
    .from('vocabularies')
    .delete()
    .eq('user_id', userId)
    .gte('created_at', sinceIso)
    .select('word');
  if (error) return -1;
  return data?.length ?? 0;
}

/**
 * 사용자 vocabularies 를 due 우선으로 조회 — 게임이 "내 단어"를 실제로 쓰는지 단언용.
 * 정렬은 lib/game/due-words.fetchDueGameWords 와 동일(next_review_at ASC nullsFirst → created_at ASC).
 */
export async function fetchUserVocabWords(
  userId: string,
  limit = 40,
): Promise<Array<{ word: string; meaning: string }>> {
  const c = serviceClient();
  if (!c) return [];
  const { data, error } = await c
    .from('vocabularies')
    .select('word, meaning')
    .eq('user_id', userId)
    .not('meaning', 'is', null)
    .neq('meaning', '')
    .order('next_review_at', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => ({ word: r.word as string, meaning: (r.meaning as string) ?? '' }));
}

/**
 * 공용 단어장/도서 챕터 세트의 단어 — "게임이 정말 이 자료로 도는가" 단언용.
 *
 * 라벨(세션 셸 aria-label)만 보면 부족하다는 것이 v07.8 에서 드러났다:
 * morpheme-rules 는 자료 라벨을 정상으로 달고도 실제 문제는 내장 61단어 격자에서
 * 냈고, 그래서 onCorrect/onWrong 의 99.7% 가 recordGameResult 에서 silent skip 됐다.
 * 화면에 그 자료의 단어가 실제로 나오는지까지 봐야 한다.
 */
export async function fetchSharedSetWords(
  setId: string,
  limit = 60,
): Promise<Array<{ word: string; meaning: string }>> {
  const c = serviceClient();
  if (!c) return [];
  const { data, error } = await c
    .from('shared_words')
    .select('word, meaning_ko')
    .eq('set_id', setId)
    .limit(limit);
  if (error) return [];
  return (data ?? []).map((r) => ({
    word: (r.word as string) ?? '',
    meaning: (r.meaning_ko as string) ?? '',
  }));
}

/**
 * 특정 시각 이후 module 별 learning_records 행 개수 — 게임 인출 결과의 FSRS audit 단언용.
 * recordGameResult 는 fire-and-forget 이므로 호출부에서 폴링 권장.
 *
 * ⚠ 시각 컬럼은 `attempted_at` — scores(created_at) 와 다르다(실측 검증).
 */
export async function countLearningRecordsSince(
  userId: string,
  module: string,
  sinceIso: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { count, error } = await c
    .from('learning_records')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('module', module)
    .gte('attempted_at', sinceIso);
  if (error) return -1;
  return count ?? 0;
}

/** user_profiles.current_v_level 조회 (밴드 적응성 검증용 · 원복 기준값). 키/행 없으면 null. */
export async function getUserVLevel(userId: string): Promise<number | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('user_profiles')
    .select('current_v_level')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { current_v_level: number | null }).current_v_level ?? null;
}

/** user_profiles.current_v_level 설정 (밴드별 화면 검증용 · 테스트 후 반드시 원복). */
export async function setUserVLevel(userId: string, v: number): Promise<boolean> {
  const c = serviceClient();
  if (!c) return false;
  const { error } = await c
    .from('user_profiles')
    .update({ current_v_level: v })
    .eq('user_id', userId);
  return !error;
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

/**
 * 특정 시각 이후 diagnostic 사유의 user_level_snapshots 행 개수 — 진단→프로필 갱신 단언용.
 * (analyze_and_apply_* RPC 가 snapshot INSERT + user_profiles 갱신을 함께 수행)
 */
export async function countDiagnosticSnapshotsSince(
  userId: string,
  sinceIso: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { count, error } = await c
    .from('user_level_snapshots')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('taken_reason', 'diagnostic')
    .gte('taken_at', sinceIso);
  if (error) return -1;
  return count ?? 0;
}

/**
 * CCP 만화 진도 — 리더가 save_comic_progress 로 서버에 위치를 남겼는지 단언용.
 * 행이 없으면 null (아직 한 번도 안 봄).
 */
export async function getComicProgress(
  userId: string,
  bookId: string,
): Promise<{ lastIndex: number; panelsTotal: number; completed: boolean } | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('comic_read_progress')
    .select('last_index, panels_total, completed_at')
    .eq('user_id', userId)
    .eq('library_book_id', bookId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as { last_index: number | null; panels_total: number | null; completed_at: string | null };
  return {
    lastIndex: row.last_index ?? 0,
    panelsTotal: row.panels_total ?? 0,
    completed: row.completed_at != null,
  };
}

/**
 * 학습자 단어와 **겹치지 않는** 공용 세트를 하나 고른다 — 결합 침묵 계약 검증용.
 *
 * 왜 필요한가:
 *   "세트로 놀면 복습 일정에 반영되지 않는다는 고지가 뜬다" 를 검증하려면 그 세트가
 *   실제로 내 단어와 겹치지 않아야 한다. 겹치는 세트로 하면 고지가 안 뜨는 것이 **정상**이고,
 *   그러면 "고지 없음" 이 결함인지 정상인지 구별할 수 없다.
 *
 *   세트 id 를 테스트에 하드코딩하면 데이터가 바뀌는 순간 조용히 낡는다. UI 목록을
 *   스크래핑하는 것도 취약했다(링크 구조가 바뀌면 깨진다). 그래서 DB 에서 고른다.
 *
 * @param minWords 게임이 성립하는 하한(cascade minWords 5 보다 넉넉히)
 */
export async function pickSetWithoutOverlap(
  userId: string,
  minWords = 12,
): Promise<{ setId: string; title: string; words: number } | null> {
  const c = serviceClient();
  if (!c) return null;

  const { data: vocab } = await c.from('vocabularies').select('word').eq('user_id', userId);
  const mine = new Set(((vocab ?? []) as Array<{ word: string }>).map((r) => r.word.toLowerCase()));

  const { data: sets } = await c
    .from('shared_word_sets')
    .select('id, title')
    .limit(40);

  for (const s of (sets ?? []) as Array<{ id: string; title: string }>) {
    const { data: words } = await c.from('shared_words').select('word').eq('set_id', s.id).limit(200);
    const list = ((words ?? []) as Array<{ word: string }>).map((r) => r.word.toLowerCase());
    if (list.length < minWords) continue;
    if (list.some((w) => mine.has(w))) continue; // 하나라도 겹치면 판정이 흐려진다
    return { setId: s.id, title: s.title, words: list.length };
  }
  return null;
}
