// packages/library-pipeline/src/ingest-article/short-body.test.ts
//
// **짧은 본문은 버리지 않고 기사째 들고 나온다** — 사용자 결정 2026-09-23
// ("길이로 원문을 제외하지 않는다", docs/SOURCE_INTAKE_DESIGN.md).
//
// 하한은 파서 고장을 잡으려고 남긴다 — 그래서 오류는 그대로 던지고 문구도 그대로다
// ("too short" / "너무 짧다"). 달라진 것은 오류가 **본문과 기사**를 들고 나간다는 것뿐이다.
// 호출자는 본문이 있으면 `queued` 로 담고, 빈 본문(0어)이면 담지도 판정으로 적지도 않는다.

import { afterEach, describe, expect, it, vi } from 'vitest'

import { ShortBodyError, isShortBodyError } from './short-body'
import { ingestNoaaArticle } from './noaa'
import { isTransientHarvestError } from './voa'

describe('ShortBodyError', () => {
  it('본문·어수·자수를 들고 나가고, 문구는 그대로 둔다', () => {
    const e = new ShortBodyError('X body too short: 3 words', {
      source: 'x',
      url: 'https://example.org/a',
      content: '  one two three  ',
    })
    expect(e).toBeInstanceOf(Error)
    expect(e.message).toMatch(/too short/)
    expect(e.content).toBe('one two three')
    expect(e.words).toBe(3)
    expect(e.chars).toBe(13)
    expect(e.isEmpty).toBe(false)
    expect(e.article).toBeNull()
    expect(isShortBodyError(e)).toBe(true)
    // 짧음은 일시적 사고가 아니다 — 보류로 새면 같은 쪽을 영영 다시 받는다.
    expect(isTransientHarvestError(e.message)).toBe(false)
  })

  it('빈 본문은 isEmpty — 호출자가 담지 않고 파서 확인으로 센다', () => {
    const e = new ShortBodyError('X body too short: 0 words', { source: 'x', url: 'u', content: '   ' })
    expect(e.isEmpty).toBe(true)
    expect(e.words).toBe(0)
  })

  it('다른 번들의 같은 모양 오류도 알아본다 — 일반 Error 는 아니다', () => {
    const foreign = Object.assign(new Error('too short'), { name: 'ShortBodyError', content: 'a b', words: 2 })
    expect(isShortBodyError(foreign)).toBe(true)
    expect(isShortBodyError(new Error('NOAA body too short: 12 words'))).toBe(false)
    expect(isShortBodyError(null)).toBe(false)
  })
})

describe('수집기 — 짧은 본문을 기사째 던진다 (NOAA)', () => {
  const URL_ = 'https://www.climate.gov/news-features/understanding-climate/short-piece'
  const HEAD = '<meta property="og:title" content="Short Piece" />'

  function stubPage(html: string) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: true, status: 200, text: async () => html })),
    )
  }

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('하한 밑이지만 본문이 있으면 ShortBodyError 에 본문과 기사를 싣는다', async () => {
    const sentence = 'Scientists measured the warming of coastal waters over two decades. '
    stubPage(`${HEAD}<div class="field--name-body"><p>${sentence.repeat(5)}</p></div>`)
    const err = await ingestNoaaArticle(URL_).catch((e: unknown) => e)
    expect(isShortBodyError(err)).toBe(true)
    const e = err as ShortBodyError
    expect(e.message).toMatch(/NOAA body too short: \d+ words/)
    expect(e.isEmpty).toBe(false)
    expect(e.words).toBeGreaterThan(0)
    expect(e.words).toBeLessThan(200)
    expect(e.content).toContain('coastal waters')
    // 호출자가 그대로 담을 수 있게 — 성공 경로와 같은 필드다.
    expect(e.article).not.toBeNull()
    expect(e.article!.source).toBe('noaa')
    expect(e.article!.source_url).toBe(URL_)
    expect(e.article!.title).toBe('Short Piece')
    expect(e.article!.license).toMatch(/Public Domain/)
    expect(e.article!.content.trim()).toBe(e.content)
  })

  it('본문이 비면 여전히 던지고 isEmpty 다 — 파서 고장은 계속 보인다', async () => {
    stubPage(`${HEAD}<div class="field--name-body"><div class="wrap"></div></div>`)
    const err = await ingestNoaaArticle(URL_).catch((e: unknown) => e)
    expect(isShortBodyError(err)).toBe(true)
    expect((err as ShortBodyError).isEmpty).toBe(true)
    expect((err as Error).message).toMatch(/too short: 0 words/)
  })
})
