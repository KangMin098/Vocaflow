// apps/web/src/lib/learner/__tests__/article-practice-actions.test.ts
// 서버 loader·제출의 경계 — Supabase 클라이언트와 기존 채점은 대역(실제 Auth·DB·RPC 는 NOT_RUN).
import { beforeEach, describe, expect, it, vi } from 'vitest'

const ART = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const ITEM = 'b69f287f-7d20-4770-8b88-8dfe0050ad0f'
const BODY = 'Lincoln spent summers at a quiet cottage.'
const row = { id: ITEM, type: 'title', paragraph_idx: 0, payload: { passage: 'P', stem_ko: 'S', choices: ['a', 'b', 'c', 'd', 'e'] } }

const state = {
  user: 'user-me' as string | null,
  status: 'active',
  textContent: BODY as string | null,
  articleBody: BODY,
  rpc: { data: [row] as unknown, error: null as null | { code?: string; message: string } },
  profileError: null as null | { message: string },
  submit: { data: { correct: true, attempt_id: '99999999-9999-4999-8999-999999999999', answer_key: null } as unknown, error: null as null | { message: string } },
  submitCalls: [] as unknown[],
  textId: 'text-1',
  set: null as unknown,
  setError: null as null | { message: string },
  setQueries: [] as Array<[string, unknown]>,
}

function queryWithError(result: unknown, error: unknown) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: error ? null : result, error }) }
  return q
}
function query(result: unknown) {
  const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data: result, error: null }) }
  return q
}

function setQuery() {
  const q = {
    select: () => q,
    eq: (col: string, v: unknown) => (state.setQueries.push([col, v]), q),
    maybeSingle: async () => ({ data: state.setError ? null : state.set, error: state.setError }),
  }
  return q
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: state.user ? { id: state.user } : null } }) },
    from: (t: string) =>
      t === 'user_profiles' ? queryWithError({ status: state.status }, state.profileError)
        : t === 'texts' ? query({ id: state.textId })
          : t === 'shared_word_sets' ? setQuery()
          : query({ content: state.articleBody }),
    rpc: async (fn: string, args: unknown) =>
      fn === 'get_chapter_content' ? { data: state.textContent, error: null }
        : fn === 'submit_article_practice' ? (state.submitCalls.push(args), state.submit)
          : state.rpc,
  }),
}))


import { loadArticlePractice, submitArticlePractice } from '../article-practice-actions'

const CTX = { articleId: ART, textId: 'text-1', ownerId: 'user-me' }

beforeEach(() => {
  Object.assign(state, { user: 'user-me', status: 'active', textContent: BODY, articleBody: BODY, rpc: { data: [row], error: null }, profileError: null, submit: { data: { correct: true, attempt_id: '99999999-9999-4999-8999-999999999999', answer_key: null }, error: null }, submitCalls: [], textId: 'text-1', set: null, setError: null, setQueries: [] })
})

describe('loadArticlePractice', () => {
  it('정상 → 그 기사의 현재 후보만 DcpPlayer 문항으로(정답 없음)', async () => {
    const r = await loadArticlePractice(ART)
    expect(r).toEqual({ ok: true, textId: 'text-1', ownerId: 'user-me', vocab: { kind: 'text' }, items: [{ id: ITEM, type: 'title', paragraphIdx: 0, payload: { passage: 'P', choices: ['a', 'b', 'c', 'd', 'e'], stemKo: 'S', underline: null, summarySentence: null } }] })
  })
  it('함수 미설치(PGRST202)는 not_installed, 다른 오류는 query_failed, 후보 0 은 no_items', async () => {
    state.rpc = { data: null, error: { code: 'PGRST202', message: 'x' } }
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'not_installed' })
    state.rpc = { data: null, error: { code: '500', message: 'x' } }
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'query_failed' })
    state.rpc = { data: [], error: null }
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'no_items' })
  })
  it('판본 불일치·정지 계정·미인증은 RPC 전에 막는다', async () => {
    state.textContent = 'old body'
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'stale_copy' })
    state.textContent = BODY
    state.status = 'suspended'
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'blocked_account' })
    state.status = 'active'
    state.user = null
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'signed_out' })
  })
})

describe('submitArticlePractice', () => {
  it('정상: 서버 wrapper 에 기사·본인 글·문항·선택(1기반)을 넘기고 영수증 있는 결과만 성공', async () => {
    const r = await submitArticlePractice(CTX, ITEM, { choice: 3 })
    expect(r).toEqual({ ok: true, correct: true, attemptId: '99999999-9999-4999-8999-999999999999', answerKey: null })
    expect(state.submitCalls).toEqual([{ p_article_id: ART, p_text_id: 'text-1', p_item_id: ITEM, p_choice: 3 }])
  })
  it('시도 영수증(attempt UUID)이 없거나 잘못되면 저장 확인 실패 — 성공으로 올리지 않는다', async () => {
    for (const attempt of [null, '', 'att-1']) {
      state.submit = { data: { correct: true, attempt_id: attempt, answer_key: null }, error: null }
      expect((await submitArticlePractice(CTX, ITEM, { choice: 1 })).ok).toBe(false)
    }
    state.submit = { data: { attempt_id: '99999999-9999-4999-8999-999999999999' }, error: null }
    expect((await submitArticlePractice(CTX, ITEM, { choice: 1 })).ok).toBe(false)
  })
  it('서버 거부(잠금 뒤 재확인 실패 등)는 오답이 아닌 실패', async () => {
    state.submit = { data: null, error: { message: 'Stale copy' } }
    expect(await submitArticlePractice(CTX, ITEM, { choice: 1 })).toEqual({ ok: false, error: 'Stale copy' })
  })
  it('선택 누락·범위 밖·다른 문항·후보 철회·판본 불일치·프로필 조회 오류는 서버 제출 전에 막는다', async () => {
    for (const a of [{}, { choice: 0 }, { choice: 6 }, { choice: '2' }]) expect((await submitArticlePractice(CTX, ITEM, a)).ok).toBe(false)
    expect((await submitArticlePractice(CTX, '11111111-1111-4111-8111-111111111111', { choice: 1 })).ok).toBe(false)
    state.rpc = { data: [], error: null }
    expect((await submitArticlePractice(CTX, ITEM, { choice: 1 })).ok).toBe(false)
    state.rpc = { data: [row], error: null }
    state.textContent = 'old'
    expect((await submitArticlePractice(CTX, ITEM, { choice: 1 })).ok).toBe(false)
    state.textContent = BODY
    state.profileError = { message: 'XX000' }
    expect((await submitArticlePractice(CTX, ITEM, { choice: 1 })).ok).toBe(false)
    expect(state.submitCalls).toEqual([])
  })
})

describe('프로필 조회 오류 ≠ 프로필 없음', () => {
  it('오류면 lookup_failed, 진짜 없음(null)만 통과', async () => {
    state.profileError = { message: 'XX000' }
    expect(await loadArticlePractice(ART)).toEqual({ ok: false, reason: 'lookup_failed' })
    state.profileError = null
    state.status = null as unknown as string
    expect((await loadArticlePractice(ART)).ok).toBe(true)
  })
})

describe('제출 문맥 고정 — loader 의 계정 · 본인 글', () => {
  it('A 로 연 화면의 답을 B 로 바뀐 뒤 보내면, B 에게 같은 기사 글이 있어도 RPC 전에 거부', async () => {
    state.user = 'user-b'
    state.textId = 'text-b' // B 도 같은 기사를 열어 두었다
    const r = await submitArticlePractice(CTX, ITEM, { choice: 1 })
    expect(r.ok).toBe(false)
    expect(state.submitCalls).toEqual([])
  })
  it('같은 계정이라도 지금 찾은 본인 글이 처음 연 글과 다르면 거부', async () => {
    state.textId = 'text-2'
    expect((await submitArticlePractice(CTX, ITEM, { choice: 1 })).ok).toBe(false)
    expect(state.submitCalls).toEqual([])
  })
  it('문맥이 없거나 비면 거부', async () => {
    for (const bad of [null, { articleId: ART, textId: 'text-1', ownerId: '' }, { articleId: ART, ownerId: 'user-me' }]) {
      expect((await submitArticlePractice(bad as never, ITEM, { choice: 1 })).ok).toBe(false)
    }
    expect(state.submitCalls).toEqual([])
  })
})

describe('loadArticlePractice 단어 출처(vocab) — Reader §4.7 과 같은 조회', () => {
  const SET = '5e7a0000-0000-4000-8000-000000000001'
  it('발행 library_article 세트 → set, 조회 조건은 발행 · 카테고리 · 이 기사 id', async () => {
    state.set = { id: SET }
    const r = await loadArticlePractice(ART)
    expect(r.ok && r.vocab).toEqual({ kind: 'set', setId: SET })
    expect(state.setQueries).toEqual([['is_published', true], ['category', 'library_article'], ['curation_query->>article_id', ART]])
  })
  it('세트 없음 → text(본인 글)', async () => {
    const r = await loadArticlePractice(ART)
    expect(r.ok && r.vocab).toEqual({ kind: 'text' })
  })
  it('조회 오류 → unknown(「없음」 으로 바꾸지 않는다) · 연습 자체는 열린다', async () => {
    state.setError = { message: 'permission denied' }
    const r = await loadArticlePractice(ART)
    expect(r.ok).toBe(true)
    expect(r.ok && r.vocab).toEqual({ kind: 'unknown' })
  })
  it('이상한 행(id 없음 · uuid 아님) → unknown', async () => {
    for (const bad of [{}, { id: 'not-a-uuid' }, { id: 42 }]) {
      state.set = bad
      const r = await loadArticlePractice(ART)
      expect(r.ok && r.vocab).toEqual({ kind: 'unknown' })
    }
  })
  it('loader 가 실패하면 세트를 조회하지 않는다(로그아웃 · 후보 없음)', async () => {
    state.user = null
    expect((await loadArticlePractice(ART)).ok).toBe(false)
    state.user = 'user-me'
    state.rpc = { data: [], error: null }
    expect((await loadArticlePractice(ART)).ok).toBe(false)
    expect(state.setQueries).toEqual([])
  })
})
