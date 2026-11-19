// apps/web/src/app/(marketing)/fit/s/[payload]/__tests__/metadata.test.ts
// 공유 링크 미리보기 제목은 profileHeadline 과 같은 뜻 — 어휘 추정 / 기준 학년 미확인. 고난도 단정 금지.
import { describe, expect, it } from 'vitest'

import { buildLevelProfile } from '@/lib/textfit/profile'
import { encodeProfile } from '@/lib/textfit/share'
import { generateMetadata } from '../page'

const b64url = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url')

describe('/fit/s/[payload] generateMetadata', () => {
  it('fitLevel null 페이로드 — 「고등 교육과정 이상」 대신 기준 학년 미확인', () => {
    const payload = b64url([1, 0, 0, 100, 1, 200, 0, [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000], []])
    const m = generateMetadata({ params: { payload } })
    const title = String(m.title)
    expect(title).toContain('미확인')
    expect(title).not.toMatch(/교육과정|학술|원서/)
    expect(String(m.openGraph?.title)).toBe(title)
  })

  it('미상 20/100 프로파일도 null 로 같은 문구', () => {
    const payload = encodeProfile(
      buildLevelProfile([{ surface: 'x', lemma: 'x', count: 20, status: 'unleveled', vLevel: null }], 100),
    )
    expect(String(generateMetadata({ params: { payload } }).title)).toContain('미확인')
  })

  it('fitLevel 값이 있으면 어휘 기준 추정으로 쓴다', () => {
    const payload = encodeProfile(
      buildLevelProfile([{ surface: 'a', lemma: 'a', count: 6, status: 'leveled', vLevel: 7 }], 100),
    )
    const m = generateMetadata({ params: { payload } })
    expect(String(m.title)).toMatch(/어휘 기준 .+ 수준 추정/)
    expect(String(m.openGraph?.title)).toBe(String(m.title))
  })
})
