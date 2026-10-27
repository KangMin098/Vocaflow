// apps/web/src/lib/learner/article-practice-contract.ts
// R0 — 「읽은 같은 기사」 의 중심 의미 안내 연습(/practice/article/[articleId]).
//
// 조회는 RPC `article_practice_items(p_article_id)`(migration 20261027201035 · 2026-10-28 사용자 승인 적용 · 검수한 VOA Lincoln
// 2문항만)가 정답 없이 title·topic 만 준다. 제출은 `submit_article_practice`(20261027201103). 채점은 기존 `grade_dcp_item`(서버 answer_key · 시도 기록)을 재사용한다.
// 이 모듈은 그 앞의 앱 쪽 관문이다:
//   1. 학습자가 이 기사를 **본인 글로 열었는지**(texts.source_url = 'article:<id>', start-learning.ts 마커) — 다른 기사·남의 글로 대신하지 않는다.
//   2. 선택값은 1~5 정수만 — 학습자에게 분명한 입력 경계(UX). 기존 grade_dcp_item 은 choice 누락 시 is_correct NOT NULL
//      위반으로 예외를 낸다(쓰기·정답 반환 없음 — 2026-10-27 정정, grade-null-choice-fix.proposal.sql). 오류 문구만 거칠다.
// ⚠️ 안내 연습이다 — 원문을 이미 읽은 뒤의 연습이라 독립 수행·새 자료 전이·학습 효과의 근거가 아니다.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type ArticlePracticeAccess =
  | { ok: true; articleId: string; textId: string }
  | { ok: false; reason: 'bad_article' | 'signed_out' | 'blocked_account' | 'not_opened' | 'stale_copy' | 'lookup_failed' }

export interface ArticlePracticeDeps {
  currentUserId: () => Promise<string | null>
  /** 현재 계정 상태(user_profiles.status). 없으면 null — isUsableAccount 와 같은 의미 */
  accountStatus: (userId: string) => Promise<string | null>
  /** 그 사용자가 이 기사로 만든 본인 texts 행(source_url = marker)과 저장된 본문. 없으면 null */
  findOwnArticleText: (userId: string, marker: string) => Promise<{ id: string; content: string | null } | null>
  /** 현재 기사 본문(library_articles.content). 없으면 null */
  currentArticleBody: (articleId: string) => Promise<string | null>
  /** 본문 비교용 해시(sha256 hex) — 서버에서 node:crypto 로 주입 */
  sha256: (text: string) => string
}

export function articleMarker(articleId: string): string {
  return `article:${articleId}`
}

export async function checkArticlePracticeAccess(
  articleId: unknown,
  deps: ArticlePracticeDeps,
): Promise<ArticlePracticeAccess> {
  if (typeof articleId !== 'string' || !UUID.test(articleId)) return { ok: false, reason: 'bad_article' }
  try {
    const userId = await deps.currentUserId()
    if (!userId) return { ok: false, reason: 'signed_out' }
    const status = await deps.accountStatus(userId)
    if (status === 'suspended' || status === 'deleted') return { ok: false, reason: 'blocked_account' }
    const row = await deps.findOwnArticleText(userId, articleMarker(articleId))
    if (!row) return { ok: false, reason: 'not_opened' }
    // 마커만 같고 본문이 이전 판본이면 「읽은 같은 글」 이 아니다 — 본문을 덮어쓰지 않고 따로 알린다.
    const current = await deps.currentArticleBody(articleId)
    if (!current || !row.content || deps.sha256(row.content) !== deps.sha256(current)) return { ok: false, reason: 'stale_copy' }
    return { ok: true, articleId, textId: row.id }
  } catch {
    return { ok: false, reason: 'lookup_failed' }
  }
}

/** 중심 의미 선택값 — 1~5 정수만. 누락·문자열·소수·범위 밖은 null(채점 호출 안 함). */
export function readCentralMeaningChoice(choice: unknown): number | null {
  return typeof choice === 'number' && Number.isInteger(choice) && choice >= 1 && choice <= 5 ? choice : null
}

export interface CentralMeaningRow {
  id: string
  type: 'title' | 'topic'
  payload: { passage: string; stem_ko: string; choices: string[]; choice_language?: string }
}

/**
 * 제안 RPC 응답 → 화면 행. **알려진 화면 필드만** 다시 조립한다(해설·정답 같은 다른 키는 따라오지 않는다).
 * 행 하나가 깨져도 다른 정상 행은 남긴다. RPC 가 이미 거르지만 앱도 같은 모양만 받는다.
 */
export function keepCentralMeaningRows(rows: unknown): CentralMeaningRow[] {
  if (!Array.isArray(rows)) return []
  const out: CentralMeaningRow[] = []
  for (const r of rows) {
    if (!r || typeof r !== 'object') continue
    const x = r as { id?: unknown; type?: unknown; payload?: unknown }
    if (typeof x.id !== 'string' || !UUID.test(x.id) || (x.type !== 'title' && x.type !== 'topic')) continue
    if (!x.payload || typeof x.payload !== 'object' || Array.isArray(x.payload)) continue
    const p = x.payload as Record<string, unknown>
    if (typeof p.passage !== 'string' || !p.passage.trim()) continue
    if (typeof p.stem_ko !== 'string' || !p.stem_ko.trim()) continue // 기존 parseItem 과 같이 묻는 말이 없으면 문항이 아니다
    if (!Array.isArray(p.choices) || p.choices.length !== 5 || !p.choices.every((c) => typeof c === 'string')) continue
    out.push({
      id: x.id,
      type: x.type,
      payload: {
        passage: p.passage,
        choices: p.choices as string[],
        stem_ko: p.stem_ko,
        ...(typeof p.choice_language === 'string' ? { choice_language: p.choice_language } : {}),
      },
    })
  }
  return out
}

/** 화면 행 → 기존 DcpPlayer 의 선택지 문항(DcpChoiceItem 이 그린다). 밑줄·요약 문장은 중심 의미 유형에 없다. */
export function toDcpChoiceItem(row: CentralMeaningRow): {
  id: string
  type: 'title' | 'topic'
  paragraphIdx: number
  payload: { passage: string; choices: string[]; stemKo: string; underline: null; summarySentence: null }
} {
  return {
    id: row.id,
    type: row.type,
    paragraphIdx: 0,
    payload: { passage: row.payload.passage, choices: row.payload.choices, stemKo: row.payload.stem_ko, underline: null, summarySentence: null },
  }
}
