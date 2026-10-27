// packages/library-pipeline/src/ingest/storyweaver-license.test.ts
// LCP StoryWeaver 도서 — 라이선스는 **본문(Story Attribution)에 귀속된** 명시 문장에서만 읽고, 아니면 멈춘다
// (2026-10-27 하드코딩 제거 · Codex 반례 반영).
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ingestFromStoryWeaver, storyweaverBookLicense } from './storyweaver'
import { licenseClassOf } from '../ingest-article/_curation-spec'

const story = (t: string) => ({ pageType: 'StoryPage', html: `<div class="page"><p>${t}</p></div>` })
const back = (t: string) => ({ pageType: 'BackCoverPage', html: `<div><p>${t}</p></div>` })
const STORY = 'Story Attribution: This story: Tell Me, What is a Drone? is written by Shabnam Minwalla . © Pratham Books , 2019. Some rights reserved.'
const ILLU = 'Illustration Attribution: Cover page: A drone, by Ruchi Bakshi Sharma © Pratham Books, 2019. Some rights reserved.'

describe('storyweaverBookLicense — 정상', () => {
  it('Story Attribution 의 CC BY 4.0 + 삽화도 같은 조건 → CC BY 4.0 (cc_by)', () => {
    const l = storyweaverBookLicense([
      story('A drone is a clever machine.'),
      back(`${STORY} Released under CC BY 4.0 license. ${ILLU} Released under CC BY 4.0 license.`),
    ])
    expect(l).toBe('CC BY 4.0')
    expect(licenseClassOf(l!)).toBe('cc_by')
  })
  it('본문이 CC BY-NC 면 그대로 — 분류는 restricted(허용으로 바꾸지 않음)', () => {
    const l = storyweaverBookLicense([back(`${STORY} Released under CC BY-NC 4.0 license.`)])
    expect(l).toBe('CC BY-NC 4.0')
    expect(licenseClassOf(l!)).toBe('restricted')
  })
})

describe('storyweaverBookLicense — 멈춘다(null)', () => {
  it('Codex 반례 1: 삽화에만 CC, 본문 귀속 없음', () => {
    expect(storyweaverBookLicense([back('Illustration Attribution: Cover page by X. Released under CC BY 4.0 license.')])).toBeNull()
  })
  it('Codex 반례 1b: 앞표지 홍보 문구의 CC', () => {
    expect(storyweaverBookLicense([{ pageType: 'FrontCoverPage', html: '<p>Other stories on StoryWeaver are Released under CC BY 4.0 license.</p>' }])).toBeNull()
  })
  it('Codex 반례 2: 본문 All rights reserved + 삽화 CC 공존', () => {
    expect(
      storyweaverBookLicense([back('Story Attribution: This story is written by X. All rights reserved. Illustration Attribution: by Y. Released under CC BY 4.0 license.')]),
    ).toBeNull()
  })
  it('Codex 반례 3: 유효 CC BY 뒤에 해석 못 하는·다른 조건', () => {
    expect(storyweaverBookLicense([back(`${STORY} Released under CC BY 4.0 license. Illustrations licensed under CC BY-NC 4.0.`)])).toBeNull()
    expect(
      storyweaverBookLicense([back(`${STORY} Released under CC BY 4.0 license. Released under a special agreement requiring prior written permission license.`)]),
    ).toBeNull()
  })
  it('한 문장 안의 두 조건 상충(세미콜론) — 첫 CC 로 성공하지 않는다', () => {
    expect(
      storyweaverBookLicense([back('Story Attribution: This story is written by X. Released under CC BY 4.0 license; illustrations released under CC BY-NC 4.0 license.')]),
    ).toBeNull()
  })
  it('본문 CC BY · 삽화 CC BY-NC 상충', () => {
    expect(storyweaverBookLicense([back(`${STORY} Released under CC BY 4.0 license. ${ILLU} Released under CC BY-NC 4.0 license.`)])).toBeNull()
  })
  it('본문 구간에 라이선스 문장이 없음 · 뒷장 없음', () => {
    expect(storyweaverBookLicense([back(`${STORY} ${ILLU} Released under CC BY 4.0 license.`)])).toBeNull()
    expect(storyweaverBookLicense([story('Only story.')])).toBeNull()
  })
  it('StoryPage(본문) 속 라이선스 같은 문장은 근거가 아니다', () => {
    expect(storyweaverBookLicense([story(`${STORY} Released under CC BY 4.0 license.`)])).toBeNull()
  })
})

describe('ingestFromStoryWeaver — 라이선스를 못 읽으면 적재 거부', () => {
  afterEach(() => vi.unstubAllGlobals())
  const payload = (backText: string) => ({
    data: {
      slug: '62772-tell-me-what-is-a-drone',
      authors: [{ name: 'Shabnam Minwalla' }],
      pages: [
        { pageType: 'FrontCoverPage', html: '<p>Tell Me, What is a Drone?</p>' },
        { pageType: 'StoryPage', html: '<div class="page"><p>A drone is a clever machine.</p></div>' },
        { pageType: 'BackCoverPage', html: `<p>${backText}</p>` },
      ],
    },
  })
  const stub = (body: unknown) =>
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => body })))

  it('본문 귀속 CC BY 4.0 이면 적재 · 기존 필드(본문·저자·출처) 유지', async () => {
    stub(payload(`${STORY} Released under CC BY 4.0 license.`))
    const b = await ingestFromStoryWeaver('62772-tell-me-what-is-a-drone')
    expect(b.license).toBe('CC BY 4.0')
    expect(b.raw_content).toBe('A drone is a clever machine.')
    expect(b.author).toBe('Shabnam Minwalla')
    expect(b.source_url).toBe('https://storyweaver.org.in/stories/62772-tell-me-what-is-a-drone')
  })
  it('삽화만 CC 이면 성공 반환 없이 throw(검수 필요)', async () => {
    stub(payload('Illustration Attribution: Cover page by X. Released under CC BY 4.0 license.'))
    await expect(ingestFromStoryWeaver('62772-tell-me-what-is-a-drone')).rejects.toThrow(/라이선스를 책에서 읽지 못했다/)
  })
})
