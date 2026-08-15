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

/**
 * 특정 시각 이후 적재된 scores 의 콘텐츠 참조 — "어떤 자료로 학습했나" 단언용.
 *
 * 이 값이 없던 시절 scores 는 49행 전부 `text_id IS NULL` 이었다(`text_id` 는 texts FK 라
 * 큐레이션 도서·단어장을 가리킬 수 없었다). 조용히 되돌아가면 콘텐츠 단위 진행률·리포트가
 * 통째로 죽으므로 회귀를 여기서 막는다.
 */
export async function latestScoreContent(
  userId: string,
  module: string,
  sinceIso: string,
): Promise<{ type: string | null; id: string | null; chapter: number | null } | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('scores')
    .select('content_type, content_id, content_chapter')
    .eq('user_id', userId)
    .eq('module', module)
    .gte('created_at', sinceIso)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const r = data[0] as {
    content_type: string | null;
    content_id: string | null;
    content_chapter: number | null;
  };
  return { type: r.content_type, id: r.content_id, chapter: r.content_chapter };
}

/**
 * 특정 시각 이후 완주된 받아쓰기 세션 수 — "완주 → dictation_sessions 마감" 단언용.
 * 세션 INSERT 는 시작 시점이므로 completed_at 으로 센다(중도 이탈과 구분).
 */
export async function countDictationSessionsSince(
  userId: string,
  sinceIso: string,
  onlyCompleted = true,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  let q = c
    .from('dictation_sessions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('started_at', sinceIso);
  if (onlyCompleted) q = q.not('completed_at', 'is', null);
  const { count, error } = await q;
  if (error) return -1;
  return count ?? 0;
}

/** 특정 시각 이후 받아쓰기 문항 시도 수 — 문항마다 즉시 적재되는지 단언용. */
export async function countDictationAttemptsSince(
  userId: string,
  sinceIso: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { count, error } = await c
    .from('dictation_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', sinceIso);
  if (error) return -1;
  return count ?? 0;
}

/**
 * 테스트가 만든 받아쓰기 기록 정리(멱등).
 *
 * ⚠️ 반드시 finally 에서 호출할 것 — 오늘의 받아쓰기는 **오늘 이미 받아쓴 문장을 제외**하므로,
 * 테스트가 남긴 attempt 를 지우지 않으면 같은 날 재실행 시 문장이 고갈돼 테스트가 스스로를
 * 무력화한다 (08-text-extract-trust 의 word_familiarity 원복과 같은 이유).
 * attempts 는 세션 FK ON DELETE CASCADE 로 함께 지워진다.
 */
export async function deleteDictationSince(userId: string, sinceIso: string): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { data, error } = await c
    .from('dictation_sessions')
    .delete()
    .eq('user_id', userId)
    .gte('started_at', sinceIso)
    .select('id');
  if (error) return -1;
  return data?.length ?? 0;
}

/** 테스트가 적재한 scores 정리 — 모듈 지정(멱등). */
export async function deleteScoresSince(
  userId: string,
  module: string,
  sinceIso: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { data, error } = await c
    .from('scores')
    .delete()
    .eq('user_id', userId)
    .eq('module', module)
    .gte('created_at', sinceIso)
    .select('id');
  if (error) return -1;
  return data?.length ?? 0;
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

/**
 * 테스트 실행 후 쌓인 pending_words(사전 갭 백로그) 조회.
 *
 * v06.35 이후 이 테이블은 **resolve_dict_headword 가 해석에 실패한 단어만** 받는다.
 * 이전에는 "추출 결과에 없는 단어" 를 전부 받아 92.5% 가 오탐이었다(실측 2026-08-13).
 * 그 계약이 실제 경로에서 지켜지는지 단언하려면 적재된 lemma 를 직접 봐야 한다.
 *
 * pending_words 는 lemma 유니크(전역 백로그)라 user_id 로 좁히지 않고 시각 기준으로만 본다.
 */
export async function fetchPendingWordsSince(sinceIso: string): Promise<string[]> {
  const c = serviceClient();
  if (!c) return [];
  const { data, error } = await c
    .from('pending_words')
    .select('lemma')
    .gte('created_at', sinceIso);
  if (error) return [];
  return (data ?? []).map((r) => String((r as { lemma: unknown }).lemma));
}

/**
 * 입력 표면형 중 사전이 해석하지 못하는 것 — unresolved_dict_words RPC 직접 호출.
 * pending_words 적재분이 "정말로 사전 갭인가" 를 교차 검증할 때 쓴다.
 */
export async function unresolvedDictWords(words: string[]): Promise<string[]> {
  const c = serviceClient();
  if (!c) return [];
  const { data, error } = await c.rpc('unresolved_dict_words' as never, {
    p_words: words,
  } as never);
  if (error) return [];
  return (data as unknown as string[]) ?? [];
}

/** 테스트가 만든 pending_words 정리(멱등) — 백로그가 테스트 데이터로 오염되지 않게. */
export async function deletePendingWordsSince(sinceIso: string): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { data, error } = await c
    .from('pending_words')
    .delete()
    .gte('created_at', sinceIso)
    .select('lemma');
  if (error) return -1;
  return data?.length ?? 0;
}

// ──────────────────────────────────────────────────────────────
// 인증 회귀(20-auth-flows) 전용 — 역할·상태 조작
// ⚠️ 전부 service-role 경유. 학습자 세션은 이 컬럼들을 쓸 수 없다
//    (마이그레이션 20260814150000 이 컬럼 GRANT + 트리거로 차단).
//    테스트는 반드시 finally 에서 원복할 것 — 남기면 계정이 잠긴다.
// ──────────────────────────────────────────────────────────────

/** user_profiles.role 조회. */
export async function getUserRole(userId: string): Promise<string | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('user_profiles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { role: string | null }).role ?? null;
}

/** user_profiles.role 설정 (admin 가드 검증용 · 테스트 후 반드시 원복). */
export async function setUserRole(userId: string, role: string): Promise<boolean> {
  const c = serviceClient();
  if (!c) return false;
  const { error } = await c.from('user_profiles').update({ role }).eq('user_id', userId);
  return !error;
}

/** user_profiles.status 조회. */
export async function getUserStatus(userId: string): Promise<string | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('user_profiles')
    .select('status')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return (data as { status: string | null }).status ?? null;
}

/** user_profiles.status 설정 (정지 게이트 검증용 · 테스트 후 반드시 'active' 로 원복). */
export async function setUserStatus(userId: string, status: string): Promise<boolean> {
  const c = serviceClient();
  if (!c) return false;
  const { error } = await c.from('user_profiles').update({ status }).eq('user_id', userId);
  return !error;
}

/**
 * 개발 전용 admin 우회(DEV_ADMIN_BYPASS=1)가 켜져 있는가.
 * 켜져 있으면 /admin 가드는 인증을 보지 않고 통과시키므로, 가드 회귀 테스트는 skip 해야 한다.
 */
export function devAdminBypassActive(): boolean {
  // 셸 환경변수가 우선 — Next.js 도 .env.local 보다 process.env 를 우선하므로,
  // `DEV_ADMIN_BYPASS=0 pnpm dev` 로 띄운 서버와 테스트의 판단이 일치한다.
  if (process.env.DEV_ADMIN_BYPASS !== undefined) {
    return process.env.DEV_ADMIN_BYPASS === '1';
  }
  return readEnv('DEV_ADMIN_BYPASS') === '1';
}

/**
 * 텍스트에 스코프된 학습자 단어 하나를 심는다 — EchoMatch 청각 신호 경로 검증용.
 *
 * 왜 심어야 하나: EchoMatch 는 문장에 든 **내 단어**에만 기록을 남긴다
 * (`vocabularies.text_id` 기준 · dictation 과 같은 규칙). 검증 텍스트에는 학습자 단어가
 * 0개라 아무것도 심지 않으면 신호 경로가 **한 번도 실행되지 않은 채 초록**이 된다.
 *
 * ⚠️ 공유 픽스처를 영구히 늘리지 않는다 — 심은 행은 반드시 `deleteVocabularyById` 로 되돌린다.
 *    남기면 다음 실행의 추출 후보와 면 분포가 조용히 달라진다.
 */
export async function seedScopedVocabulary(
  userId: string,
  textId: string,
  word: string,
): Promise<string | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('vocabularies')
    // `meaning` 은 NOT NULL — 없으면 INSERT 가 조용히 실패하고 테스트가 skip 으로 새어 나간다
    .insert({ user_id: userId, word, lemma: word, meaning: '(e2e 시드)', text_id: textId })
    .select('id')
    .single();
  if (error || !data) return null;
  return (data as { id: string }).id;
}

/** seedScopedVocabulary 원복 — 그 단어에 달린 학습 기록까지 함께 지운다. */
export async function deleteVocabularyById(vocabularyId: string): Promise<boolean> {
  const c = serviceClient();
  if (!c) return false;
  await c.from('learning_records').delete().eq('vocabulary_id', vocabularyId);
  const { error } = await c.from('vocabularies').delete().eq('id', vocabularyId);
  return !error;
}

/**
 * 완주된 받아쓰기 세션 요약 — **결과 화면의 수치가 적재와 같은가**를 재기 위한 것.
 *
 * 개수만 세는 단언(세션 1행·시도 N행)은 화면이 **틀린 숫자**를 보여줘도 통과한다.
 * 결과 화면은 "오늘 무엇이 남았나" 를 말하는 자리라 숫자가 틀리면 그 자체가 결함이다.
 */
export async function latestDictationSummary(
  userId: string,
  sinceIso: string,
): Promise<{ avgAccuracy: number | null; totalHints: number; attempts: number } | null> {
  const c = serviceClient();
  if (!c) return null;
  const { data, error } = await c
    .from('dictation_sessions')
    .select('id, avg_accuracy, total_hints')
    .eq('user_id', userId)
    .not('completed_at', 'is', null)
    .gte('completed_at', sinceIso)
    .order('completed_at', { ascending: false })
    .limit(1);
  if (error || !data || data.length === 0) return null;
  const row = data[0] as { id: string; avg_accuracy: number | null; total_hints: number | null };
  const { count } = await c
    .from('dictation_attempts')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', row.id);
  return {
    avgAccuracy: row.avg_accuracy == null ? null : Number(row.avg_accuracy),
    totalHints: Number(row.total_hints ?? 0),
    attempts: count ?? 0,
  };
}

/**
 * 오류 태그가 붙은 시도 수 — "오답 → 태그 → 약점 패널" 사슬의 중간 고리.
 *
 * 이 값이 0 이면 약점 패널은 영영 뜨지 않고, 학습자는 자기가 무엇을 반복해 놓치는지
 * 모른 채 계속 놓친다. 태그 규칙이 조용히 어긋나도 화면은 멀쩡하므로 여기서 잰다.
 */
export async function countAttemptsWithTagsSince(
  userId: string,
  sinceIso: string,
): Promise<number> {
  const c = serviceClient();
  if (!c) return -1;
  const { data, error } = await c
    .from('dictation_attempts')
    .select('error_tags')
    .eq('user_id', userId)
    .gte('created_at', sinceIso);
  if (error) return -1;
  return (data ?? []).filter((r) => ((r.error_tags as string[] | null) ?? []).length > 0).length;
}
