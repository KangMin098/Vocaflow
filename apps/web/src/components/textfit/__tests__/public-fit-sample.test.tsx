// apps/web/src/components/textfit/__tests__/public-fit-sample.test.tsx
//
// `/fit` 도착 화면 규칙 회귀 — 빈 입력칸이 아니라 **작동하는 결과**로 시작한다(§🎯 I1·I2).
//
// 왜 SSR 문자열로 검사하나: 이 규칙은 "도착 즉시" 에 관한 것이고, 도착 즉시 보이는 것은 서버가
// 렌더한 HTML 이다(I6). 클라이언트 효과가 돌기 전에 결과가 있어야 한다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { PROFILE_LEVELS, profileHeadline } from '@/lib/textfit/profile'
import type { LevelProfile } from '@/lib/textfit/profile'
import { FIT_SAMPLE } from '@/lib/textfit/sample'

import { PublicFitClient } from '../PublicFitClient'

const CLIENT_SRC = readFileSync(
  join(process.cwd(), 'src', 'components', 'textfit', 'PublicFitClient.tsx'),
  'utf8',
)

/** 서버가 내려준 예시 결과를 흉내낸 픽스처 — DB 를 치지 않는다. */
const SAMPLE_PROFILE: LevelProfile = {
  totalTokens: 98,
  uniqueContentWords: 41,
  readings: PROFILE_LEVELS.map((level, i) => ({
    level,
    label: String(level),
    coverage: 0.6 + i * 0.05,
    coverageLow: 0.55 + i * 0.05,
    coverageHigh: 0.65 + i * 0.05,
    band: i >= 6 ? ('growth' as const) : ('study' as const),
    unknownWords: 8 - i,
  })),
  fitLevel: 9,
  textVLevel: 7,
  resolvedShare: 0.98,
  hardestWords: [],
  breakdown: { leveled: 40, unleveled: 1, unresolved: 0, function_word: 20 },
}

describe('/fit 도착 화면 — I1·I2 (클릭 0 으로 작동하는 결과)', () => {
  const html = renderToString(<PublicFitClient initialSample={SAMPLE_PROFILE} />)

  it('결과 패널이 서버 렌더에 이미 있다', () => {
    expect(html).toContain(profileHeadline(SAMPLE_PROFILE))
    expect(html).toContain('레벨 프로파일')
  })

  it('입력칸에 예시 지문이 채워져 있다 — 결과와 같은 문장을 가리킨다', () => {
    // textarea 의 초기값은 자식 텍스트로 렌더된다. 첫 문장으로 확인한다.
    expect(html).toContain('Scientists have long assumed that memory decays')
  })

  it('예시라는 사실을 감추지 않는다', () => {
    expect(html).toContain('예시 지문의 결과')
  })

  it('예시 지문은 최소 분석 길이(120자)를 넘는다 — 아니면 서버 결과와 화면 동작이 어긋난다', () => {
    expect(FIT_SAMPLE.trim().length).toBeGreaterThanOrEqual(120)
  })
})

describe('/fit 도착 화면 — 예시가 없거나 공유 결과가 있을 때', () => {
  it('서버 결과가 없으면 예전처럼 빈 입력칸이다 — 증명만 빠지고 도구는 그대로', () => {
    const html = renderToString(<PublicFitClient />)
    expect(html).not.toContain('예시 지문의 결과')
    expect(html).not.toContain('레벨 프로파일')
  })

  it('공유 결과가 있으면 그것이 우선한다 — 두 배너가 동시에 뜨지 않는다', () => {
    const html = renderToString(
      <PublicFitClient initialShared={SAMPLE_PROFILE} initialSample={SAMPLE_PROFILE} />,
    )
    expect(html).toContain('공유받은 결과')
    expect(html).not.toContain('예시 지문의 결과')
  })
})

describe('/fit 예시 지문 — 단일 출처', () => {
  it('클라이언트 파일에 지문 사본이 없다 — 서버가 분석한 문장과 갈라질 자리를 두지 않는다', () => {
    expect(CLIENT_SRC).not.toMatch(/const SAMPLE\s*=/)
    expect(CLIENT_SRC).toContain("from '@/lib/textfit/sample'")
  })

  it('예시 상태에서는 네트워크로 다시 묻지 않는다 — 서버 결과가 이미 그 문장의 결과다', () => {
    expect(CLIENT_SRC).toMatch(/if \(viewingSample\) return/)
  })
})
