// apps/web/src/lib/learner/article-practice-actions.ts
// R0 — 읽은 같은 기사의 중심 의미 안내 연습: 서버 loader · 제출(/practice/article/[articleId]).
//
// 조회 RPC `article_practice_items` · 제출 `submit_article_practice` 는 2026-10-28 사용자 승인으로 적용됐다
// (migration 20261027201035 · 20261027201103 — 검수한 VOA Lincoln 2문항만). 없으면 「설치 대기」 로 돌려준다 — 레벨 풀·다른 원문으로 대신하지 않는다.
// ⚠️ 문맥 고정: loader 가 확인한 계정 · 본인 글(textId)을 화면이 들고 있다가 제출 때 그대로 돌려준다. 제출은 지금 계정이
//   그 계정이고 지금 찾은 본인 글이 그 글일 때만 RPC 를 부른다 — 계정이 바뀐 뒤 B 의 같은 기사 글을 다시 찾아 A 화면의 답에 묶지 않는다(Codex 반례).
// 제출은 매번 같은 관문(본인 글·현재 판본·계정)과 「지금 그 기사의 후보인가」 를 다시 보고, 선택 1~5 만 기존
// 서버 wrapper submit_article_practice(행 잠금 · 현재성 재확인 → 기존 grade_dcp_item)에 넘긴다. 실패는 오답이 아니다.

'use server'

import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { DcpGradeResult } from '@/lib/learner/dcp'
import { createClient } from '@/lib/supabase/server'

import {
  checkArticlePracticeAccess,
  keepCentralMeaningRows,
  readCentralMeaningChoice,
  toDcpChoiceItem,
  type ArticlePracticeAccess,
  type ArticlePracticeDeps,
} from './article-practice-contract'

export type ArticlePracticeLoad =
  | { ok: true; textId: string; ownerId: string; items: ReturnType<typeof toDcpChoiceItem>[] }
  | { ok: false; reason: Exclude<ArticlePracticeAccess, { ok: true }>['reason'] | 'not_installed' | 'query_failed' | 'no_items' }

function depsFor(client: SupabaseClient): ArticlePracticeDeps {
  return {
    currentUserId: async () => (await client.auth.getUser()).data.user?.id ?? null,
    accountStatus: async (userId) => {
      // 조회 실패는 「프로필 없음」 이 아니다 — 던져서 lookup_failed 로 간다
      const { data, error } = await client.from('user_profiles').select('status').eq('user_id', userId).maybeSingle()
      if (error) throw error
      return (data as { status?: string } | null)?.status ?? null
    },
    findOwnArticleText: async (userId, marker) => {
      const { data: row, error } = await client.from('texts').select('id').eq('user_id', userId).eq('source_url', marker).maybeSingle()
      if (error) throw error
      if (!row) return null
      const id = (row as { id: string }).id
      // 본문은 기존 본문 계약(get_chapter_content · auth.uid 와 text 소유 확인)으로 읽는다
      const { data: content, error: cErr } = await client.rpc('get_chapter_content', { p_text_id: id })
      if (cErr) throw cErr
      return { id, content: (content as string | null) ?? null }
    },
    currentArticleBody: async (articleId) => {
      const { data, error } = await client.from('library_articles').select('content').eq('id', articleId).maybeSingle()
      if (error) throw error
      return (data as { content?: string } | null)?.content ?? null
    },
    sha256: (t) => createHash('sha256').update(t, 'utf8').digest('hex'),
  }
}

async function candidates(client: SupabaseClient, articleId: string): Promise<ArticlePracticeLoad> {
  const { data, error } = await client.rpc('article_practice_items', { p_article_id: articleId })
  if (error) {
    // PostgREST: 없는 함수 → PGRST202 / 42883. 설치 대기를 「문항 없음」 과 섞지 않는다.
    const code = (error as { code?: string }).code
    return { ok: false, reason: code === 'PGRST202' || code === '42883' ? 'not_installed' : 'query_failed' }
  }
  const items = keepCentralMeaningRows(data).map(toDcpChoiceItem)
  if (items.length === 0) return { ok: false, reason: 'no_items' }
  return { ok: true, textId: '', ownerId: '', items }
}

export async function loadArticlePractice(articleId: string): Promise<ArticlePracticeLoad> {
  const client = (await createClient()) as unknown as SupabaseClient
  const deps = depsFor(client)
  const access = await checkArticlePracticeAccess(articleId, deps)
  if (!access.ok) return { ok: false, reason: access.reason }
  const c = await candidates(client, access.articleId)
  if (!c.ok) return c
  // 소유자는 화면의 신원 비교용으로만 싣는다(DOM · URL 에 넣지 않는다)
  const ownerId = await deps.currentUserId()
  return ownerId ? { ...c, textId: access.textId, ownerId } : { ok: false, reason: 'signed_out' }
}

/** loader 가 확인한 문맥 — 제출 때 그대로 돌려준다. */
export interface ArticlePracticeContext {
  articleId: string
  textId: string
  ownerId: string
}

export async function submitArticlePractice(
  context: ArticlePracticeContext,
  itemId: string,
  answer: { choice?: unknown },
): Promise<DcpGradeResult> {
  const choice = readCentralMeaningChoice(answer?.choice)
  if (choice === null) return { ok: false, error: '답을 하나 골라 주세요.' }
  if (!context || typeof context.textId !== 'string' || typeof context.ownerId !== 'string' || !context.ownerId) {
    return { ok: false, error: '이 글의 연습을 지금 열 수 없어요.' }
  }
  const client = (await createClient()) as unknown as SupabaseClient
  const deps = depsFor(client)
  // 연 사람이 지금도 같은 사람인가 — 아니면 RPC 전에 거부(다른 계정의 같은 기사 글로 갈아타지 않는다)
  if ((await deps.currentUserId()) !== context.ownerId) return { ok: false, error: '로그인 상태가 바뀌었어요. 글을 다시 열어 주세요.' }
  const access = await checkArticlePracticeAccess(context.articleId, deps)
  if (!access.ok) return { ok: false, error: '이 글의 연습을 지금 열 수 없어요.' }
  if (access.textId !== context.textId) return { ok: false, error: '처음 연 글과 다른 글이에요. 글을 다시 열어 주세요.' }
  const c = await candidates(client, access.articleId)
  if (!c.ok || !c.items.some((i) => i.id === itemId)) return { ok: false, error: '이 문항은 지금 이 글의 연습이 아니에요.' }
  // 제출은 서버 wrapper(submit_article_practice, 제안 SQL)가 같은 트랜잭션에서 행을 잠그고 현재성을 다시 본 뒤
  // 기존 grade_dcp_item 에 넘긴다 — 앱의 사전 조회만으로는 조회와 채점 사이 판본 변경을 막지 못한다.
  const { data, error } = await client.rpc('submit_article_practice', {
    p_article_id: access.articleId,
    p_text_id: access.textId,
    p_item_id: itemId,
    p_choice: choice,
  })
  if (error) return { ok: false, error: error.message }
  return readGradeReceipt(data)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 채점 응답 → 결과. **시도 기록 영수증(attempt UUID)이 없으면 성공으로 올리지 않는다** — 저장 확인 실패. */
function readGradeReceipt(data: unknown): DcpGradeResult {
  const d = (data ?? null) as { correct?: unknown; attempt_id?: unknown; answer_key?: unknown } | null
  if (!d || typeof d.correct !== 'boolean') return { ok: false, error: '채점 결과를 읽지 못했어요.' }
  if (typeof d.attempt_id !== 'string' || !UUID_RE.test(d.attempt_id)) return { ok: false, error: '풀이 기록을 확인하지 못했어요. 다시 시도해 주세요.' }
  return {
    ok: true,
    correct: d.correct,
    attemptId: d.attempt_id,
    answerKey: d.answer_key && typeof d.answer_key === 'object' ? (d.answer_key as Record<string, unknown>) : null,
  }
}
