// packages/library-pipeline/src/ingest/storyweaver-license.test.ts
// LCP StoryWeaver 도서 — 라이선스는 책 뒷장에서 읽고, 못 읽으면 허용으로 채우지 않는다(2026-10-27 하드코딩 제거).
import { describe, expect, it } from 'vitest'
import { storyweaverBookLicense } from './storyweaver'
import { licenseClassOf } from '../ingest-article/_curation-spec'

const story = (t: string) => ({ pageType: 'StoryPage', html: `<div class="page"><p>${t}</p></div>` })
const back = (t: string) => ({ pageType: 'BackCoverPage', html: `<div><p>${t}</p></div>` })
const ATTR = 'Story Attribution: This story: Tell Me, What is a Drone? is written by Shabnam Minwalla . © Pratham Books , 2019. Some rights reserved.'

describe('storyweaverBookLicense', () => {
  it('뒷장의 명시 CC BY 4.0 → 기존 도서 표기, 분류도 cc_by', () => {
    const l = storyweaverBookLicense([story('A drone is a clever machine.'), back(`${ATTR} Released under CC BY 4.0 license.`)])
    expect(l).toBe('CC BY 4.0')
    expect(licenseClassOf(l!)).toBe('cc_by')
  })
  it('다른 CC 도 그대로 — NC 는 restricted 로 분류된다(허용으로 바꾸지 않는다)', () => {
    const l = storyweaverBookLicense([back(`${ATTR} Released under CC BY-NC 4.0 license.`)])
    expect(l).toBe('CC BY-NC 4.0')
    expect(licenseClassOf(l!)).toBe('restricted')
  })
  it('뒷장 없음·라이선스 문장 없음·All rights reserved → null', () => {
    expect(storyweaverBookLicense([story('Only story.')])).toBeNull()
    expect(storyweaverBookLicense([story('x'), back(ATTR)])).toBeNull()
    expect(storyweaverBookLicense([back('© Pratham Books, 2015. All rights reserved.')])).toBeNull()
  })
  it('서로 다른 라이선스 문장이 둘 이상(예: 삽화만 다른 조건) → null', () => {
    const l = storyweaverBookLicense([
      back(`${ATTR} Released under CC BY 4.0 license.`),
      { pageType: 'BackInnerCover', html: '<p>Illustration Attribution: Cover page by X. Released under CC BY-NC 4.0 license.</p>' },
    ])
    expect(l).toBeNull()
  })
  it('같은 라이선스 문장이 여러 기여자에 반복되면 그 하나', () => {
    const l = storyweaverBookLicense([
      back(`${ATTR} Released under CC BY 4.0 license.`),
      { pageType: 'BackInnerCover', html: '<p>Illustration Attribution: page 2 by Ruchi Bakshi. Released under CC BY 4.0 license.</p>' },
    ])
    expect(l).toBe('CC BY 4.0')
  })
  it('본문(StoryPage)에 적힌 라이선스 같은 문장은 근거로 쓰지 않는다', () => {
    expect(storyweaverBookLicense([story('The sign said: Released under CC BY 4.0 license.'), back(ATTR)])).toBeNull()
  })
  it('알 수 없는 라이선스 문구(Released under some license)는 null', () => {
    expect(storyweaverBookLicense([back(`${ATTR} Released under a custom license.`)])).toBeNull()
  })
})
