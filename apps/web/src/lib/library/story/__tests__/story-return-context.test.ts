// apps/web/src/lib/library/story/__tests__/story-return-context.test.ts
//
// D5-I02 Story 복귀 문맥 — 엄격한 두 값 · 일반 진입은 출처 없음 · 지도 복귀와 섞이면 중립 · 복귀/단어장/로그인 주소 · 공개 메타 확인.

import { describe, expect, it } from 'vitest'

import { STORY_MAX_UNIT_INDEX, STORY_RELEASE_KEY_RE, loadStoryReturnTarget, type StoryLearnerClient } from '../learner'
import {
  RETURN_MAX_UNIT_INDEX,
  RETURN_RELEASE_KEY_RE,
  parseStoryReturnParams,
  storyReturnHref,
  storyVaultHref,
  vaultPathWithStoryContext,
} from '../return-context'
import { loginUrlWithReturn } from '../../../auth/redirect'

const RK = `lsr_${'a'.repeat(32)}`

describe('parseStoryReturnParams', () => {
  it('두 값 모두 하나씩 · 엄격한 형식만 ok(0-based)', () => {
    expect(parseStoryReturnParams({ story_release: RK, story_unit: '2' })).toEqual({ status: 'ok', context: { releaseKey: RK, unitIndex: 2 } })
    expect(parseStoryReturnParams({ story_release: RK, story_unit: '0' })).toEqual({ status: 'ok', context: { releaseKey: RK, unitIndex: 0 } })
    expect(parseStoryReturnParams({ story_release: RK, story_unit: '9999' })).toMatchObject({ status: 'ok' })
  })

  it('일반 진입(두 값 모두 없음)은 none — 출처를 지어내지 않는다', () => {
    expect(parseStoryReturnParams({})).toEqual({ status: 'none' })
    expect(parseStoryReturnParams({ filter: 'all', q: 'x' })).toEqual({ status: 'none' })
  })

  it('하나만 · 여러 값 · 형식 오류 · 음수 · 앞자리 0 · 범위 초과 · 외부 주소 · 대문자는 invalid', () => {
    for (const p of [
      { story_release: RK }, { story_unit: '1' }, { story_release: [RK, RK], story_unit: '1' }, { story_release: RK, story_unit: ['1', '2'] },
      { story_release: 'lsr_123', story_unit: '1' }, { story_release: RK.toUpperCase(), story_unit: '1' }, { story_release: RK, story_unit: '-1' },
      { story_release: RK, story_unit: '01' }, { story_release: RK, story_unit: '10000' }, { story_release: RK, story_unit: '1.5' },
      { story_release: RK, story_unit: ' 1' }, { story_release: 'https://evil.example', story_unit: '1' }, { story_release: `${RK}/../x`, story_unit: '1' },
    ]) {
      expect(parseStoryReturnParams(p), JSON.stringify(p)).toEqual({ status: 'invalid' })
    }
  })

  it('지도 복귀(from=…)와 함께 오면 conflict — 어느 쪽도 적용하지 않는다', () => {
    expect(parseStoryReturnParams({ story_release: RK, story_unit: '1', from: 'map' })).toEqual({ status: 'conflict' })
    expect(parseStoryReturnParams({ story_release: RK, story_unit: '1' }, { mapReturnPresent: true })).toEqual({ status: 'conflict' })
  })

  it('형식 상수는 learner.ts 와 같다', () => {
    expect(RETURN_RELEASE_KEY_RE.source).toBe(STORY_RELEASE_KEY_RE.source)
    expect(RETURN_MAX_UNIT_INDEX).toBe(STORY_MAX_UNIT_INDEX)
  })
})

describe('주소', () => {
  it('Story → 단어장 · 단어장 → Story · 로그인 복귀는 구조화된 두 값만(사용자 · 토큰 · 본문 · 진도 없음)', () => {
    const ctx = { releaseKey: RK, unitIndex: 2 }
    expect(storyVaultHref(ctx)).toBe(`/wordvault/browse?story_release=${RK}&story_unit=2`)
    expect(storyReturnHref(ctx)).toBe(`/library/stories/${RK}?unit=2`)
    expect(vaultPathWithStoryContext(ctx)).toBe(storyVaultHref(ctx))
    expect(vaultPathWithStoryContext(null)).toBe('/wordvault/browse')
    const login = loginUrlWithReturn(vaultPathWithStoryContext(ctx))
    expect(new URL(login, 'http://x').searchParams.get('next')).toBe(`/wordvault/browse?story_release=${RK}&story_unit=2`)
    // 왕복: 단어장 주소를 다시 읽으면 같은 문맥
    const back = Object.fromEntries(new URL(storyVaultHref(ctx), 'http://x').searchParams)
    expect(parseStoryReturnParams(back)).toEqual({ status: 'ok', context: ctx })
  })
})

describe('loadStoryReturnTarget — 공개 서가 메타만', () => {
  const row = (key: string, over: Record<string, unknown> = {}) => ({
    release_key: key, work_key: 'w', edition_key: 'b1', kind: 'story_edition', coverage: 'complete_work', completion_label: 'adapted_full_work',
    title: 'The Gull', hook_text: 'h', unit_count: 3, target_cefr: 'B1', published_at: '2026-10-25T00:00:00Z', ...over,
  })
  const client = (res: { data: unknown; error: unknown }) => {
    const calls: string[] = []
    const c = { rpc: async (fn: string) => (calls.push(fn), res), auth: {}, from: () => { throw new Error('no table reads') } } as unknown as StoryLearnerClient
    return { c, calls }
  }
  it('ok · 범위 밖 단위 · 서가에 없음(철회/보류/미발행) · 조회 실패를 구분한다 · story_catalog 만 부른다', async () => {
    const ok = client({ data: [row(RK)], error: null })
    expect(await loadStoryReturnTarget({ client: ok.c }, { releaseKey: RK, unitIndex: 2 })).toEqual({ status: 'ok', releaseKey: RK, unitIndex: 2, title: 'The Gull', unitCount: 3 })
    expect(ok.calls).toEqual(['story_catalog'])
    expect(await loadStoryReturnTarget({ client: client({ data: [row(RK)], error: null }).c }, { releaseKey: RK, unitIndex: 3 })).toEqual({ status: 'bad_unit', releaseKey: RK, title: 'The Gull', unitCount: 3 })
    expect(await loadStoryReturnTarget({ client: client({ data: [], error: null }).c }, { releaseKey: RK, unitIndex: 0 })).toEqual({ status: 'unavailable' })
    expect(await loadStoryReturnTarget({ client: client({ data: null, error: { message: 'down' } }).c }, { releaseKey: RK, unitIndex: 1 })).toEqual({ status: 'error', releaseKey: RK, unitIndex: 1 })
    expect(await loadStoryReturnTarget({ client: client({ data: [row(RK)], error: null }).c }, { releaseKey: 'bad', unitIndex: 1 })).toEqual({ status: 'unavailable' })
  })
})
