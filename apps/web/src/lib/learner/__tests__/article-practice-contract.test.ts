// apps/web/src/lib/learner/__tests__/article-practice-contract.test.ts
import { createHash } from 'node:crypto'
import { describe, expect, it, vi } from 'vitest'
import { articleMarker, checkArticlePracticeAccess, keepCentralMeaningRows, readCentralMeaningChoice, type ArticlePracticeDeps } from '../article-practice-contract'

const ART = '035b1c37-6ede-4bf6-88bb-ef583aaf6994'
const OTHER = '11111111-1111-4111-8111-111111111111'
const ME = 'user-me'
const BODY = 'Flooding in Argentina hit soybean production.'
const sha = (t: string) => createHash('sha256').update(t, 'utf8').digest('hex')
const deps = (over: Partial<ArticlePracticeDeps> = {}): ArticlePracticeDeps => ({
  currentUserId: async () => ME,
  accountStatus: async () => 'active',
  findOwnArticleText: async (uid, marker) => (uid === ME && marker === articleMarker(ART) ? { id: 'text-1', content: BODY } : null),
  currentArticleBody: async (id) => (id === ART ? BODY : null),
  sha256: sha,
  ...over,
})

describe('checkArticlePracticeAccess — 읽은 같은 기사·같은 판본만', () => {
  it('본인 글이 현재 본문과 같으면 통과', async () => {
    expect(await checkArticlePracticeAccess(ART, deps())).toEqual({ ok: true, articleId: ART, textId: 'text-1' })
  })
  it('마커는 같지만 본인 글이 이전 판본이면 stale_copy(덮어쓰지 않음)', async () => {
    const r = await checkArticlePracticeAccess(ART, deps({ findOwnArticleText: async () => ({ id: 'text-1', content: 'old body' }) }))
    expect(r).toEqual({ ok: false, reason: 'stale_copy' })
    expect(await checkArticlePracticeAccess(ART, deps({ findOwnArticleText: async () => ({ id: 'text-1', content: null }) }))).toEqual({ ok: false, reason: 'stale_copy' })
    expect(await checkArticlePracticeAccess(ART, deps({ currentArticleBody: async () => null }))).toEqual({ ok: false, reason: 'stale_copy' })
  })
  it('다른 기사·아직 안 연 기사는 not_opened — 다른 글로 대신하지 않는다', async () => {
    expect(await checkArticlePracticeAccess(OTHER, deps())).toEqual({ ok: false, reason: 'not_opened' })
  })
  it('미인증·정지/해지 계정·잘못된 id·조회 실패 구분', async () => {
    expect(await checkArticlePracticeAccess(ART, deps({ currentUserId: async () => null }))).toEqual({ ok: false, reason: 'signed_out' })
    for (const st of ['suspended', 'deleted']) expect(await checkArticlePracticeAccess(ART, deps({ accountStatus: async () => st }))).toEqual({ ok: false, reason: 'blocked_account' })
    expect((await checkArticlePracticeAccess(ART, deps({ accountStatus: async () => null }))).ok).toBe(true)
    for (const bad of ['', 'nope', 123, null, [ART]]) expect(await checkArticlePracticeAccess(bad, deps())).toEqual({ ok: false, reason: 'bad_article' })
    expect(await checkArticlePracticeAccess(ART, deps({ findOwnArticleText: async () => { throw new Error('db') } }))).toEqual({ ok: false, reason: 'lookup_failed' })
  })
  it('현재 인증 사용자 id 로만 조회한다', async () => {
    const find = vi.fn(async () => null)
    await checkArticlePracticeAccess(ART, deps({ findOwnArticleText: find }))
    expect(find).toHaveBeenCalledWith(ME, `article:${ART}`)
  })
})

describe('readCentralMeaningChoice — 1~5 정수만 (grade_dcp_item NULL 경계를 앱에서 막는다)', () => {
  it('정상', () => {
    for (const c of [1, 3, 5]) expect(readCentralMeaningChoice(c)).toBe(c)
  })
  it('누락·문자열·소수·범위 밖은 null', () => {
    for (const c of [undefined, null, '1', 0, 6, 2.5, -1, Number.NaN, [1]]) expect(readCentralMeaningChoice(c)).toBeNull()
  })
})

describe('keepCentralMeaningRows — 알려진 화면 필드만 재조립', () => {
  const ID = '4451624e-ba9b-48e5-b41d-09ae9cc72a38'
  const ok = { id: ID, type: 'title', payload: { passage: 'P', stem_ko: 'S', choices: ['a', 'b', 'c', 'd', 'e'], rationale_ko: 'leak', answer: 2 } }
  it('해설·정답 같은 다른 키는 따라오지 않는다', () => {
    expect(keepCentralMeaningRows([ok])).toEqual([{ id: ID, type: 'title', payload: { passage: 'P', stem_ko: 'S', choices: ['a', 'b', 'c', 'd', 'e'] } }])
  })
  it('깨진 행은 건너뛰고 정상 행은 남긴다(예외 없음)', () => {
    const rows = [null, 'x', { id: 'arbitrary', type: 'title', payload: {} }, { id: ID, type: 'title', payload: [] }, { id: ID, type: 'blank', payload: ok.payload }, { id: ID, type: 'topic', payload: { passage: 'P', choices: ['a'] } }, ok]
    expect(keepCentralMeaningRows(rows).map((r) => r.id)).toEqual([ID])
    expect(keepCentralMeaningRows(null)).toEqual([])
  })
})
