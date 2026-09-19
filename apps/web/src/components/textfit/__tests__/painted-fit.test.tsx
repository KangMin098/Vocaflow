// apps/web/src/components/textfit/__tests__/painted-fit.test.tsx
//
// `/fit` 발산 A+B(2026-09-19, docs/design/compare/fit.md)의 회귀.
//   A 「칠해지는 입력칸」 — 원문을 잃지 않고 칠한다 · 학년이 오르면 칠이 줄어든다 · 서버 렌더에 원문이 남는다
//   B 「학급에 나눠 줄 한 장」 — 권점은 처음 만나는 낱말에만 · 난외는 뜻이 있는 것만, 원문 등장 순서로
// 그리고 정직성: 원문은 서버로 가지 않는다(응답 표는 표면형→레벨뿐).

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { ClassSheet, buildGloss } from '@/components/textfit/ClassSheet'
import { PaintedPassage, runs } from '@/components/textfit/PaintedPassage'
import { countUnknownTypes, paintTokens, splitSurface } from '@/lib/textfit/paint'
import type { LevelProfile, LevelReading } from '@/lib/textfit/profile'

const TEXT = 'The retrieval pathway is reinforced, and the scarce time is allocated.'
const SURFACES = {
  retrieval: 8,
  pathway: 7,
  reinforced: 7,
  scarce: 9,
  time: 2,
  allocated: 8,
  mystery: null,
}

const READINGS: LevelReading[] = [3, 4, 5, 6, 7, 8, 9, 10].map((level) => ({
  level: level as LevelReading['level'],
  label: String(level),
  coverage: 0.7 + level * 0.02,
  coverageLow: 0.68 + level * 0.02,
  coverageHigh: 0.72 + level * 0.02,
  band: 'study',
  unknownWords: 10 - level,
}))

function profile(): LevelProfile {
  return {
    totalTokens: 12,
    uniqueContentWords: 6,
    readings: READINGS,
    fitLevel: 8,
    textVLevel: 8,
    resolvedShare: 1,
    hardestWords: [
      { surface: 'scarce', lemma: 'scarce', count: 1, status: 'leveled', vLevel: 9, meaningKo: '부족한' },
      { surface: 'retrieval', lemma: 'retrieval', count: 1, status: 'leveled', vLevel: 8, meaningKo: '인출' },
      { surface: 'allocated', lemma: 'allocate', count: 1, status: 'leveled', vLevel: 8, meaningKo: null },
      { surface: 'pathway', lemma: 'pathway', count: 1, status: 'leveled', vLevel: 7, meaningKo: '경로' },
    ],
    breakdown: { leveled: 6, unleveled: 0, unresolved: 0, function_word: 6 },
  }
}

describe('칠하기 규칙 (A)', () => {
  it('원문을 한 글자도 잃지 않는다 — 조각을 이어 붙이면 원문이다', () => {
    const tokens = paintTokens(TEXT, SURFACES)
    expect(tokens.map((t) => t.t).join('')).toBe(TEXT)
    expect(runs(tokens, 6).map((r) => r.text).join('')).toBe(TEXT)
    expect(splitSurface(TEXT).join('')).toBe(TEXT)
  })

  it('표에 없는 낱말(기능어)은 칠하지 않고, 레벨 미상은 안다고도 모른다고도 하지 않는다', () => {
    const tokens = paintTokens('The mystery', SURFACES)
    expect(tokens.find((t) => t.t === 'The')?.v).toBeUndefined()
    expect(tokens.find((t) => t.t === 'mystery')?.v).toBeNull()
    expect(countUnknownTypes(tokens, 3)).toBe(0)
  })

  it('학년이 오르면 처음 만나는 낱말이 줄어든다 — 슬라이더가 칠을 바꾸는 근거', () => {
    const tokens = paintTokens(TEXT, SURFACES)
    expect(countUnknownTypes(tokens, 6)).toBe(5)
    expect(countUnknownTypes(tokens, 8)).toBe(1)
    expect(countUnknownTypes(tokens, 9)).toBe(0)
  })

  it('서버 렌더에 칠해진 원문과 학년 눈금이 남는다(I6) — 모르는 낱말은 mark, 숫자로도 읽힌다', () => {
    const html = renderToString(
      <PaintedPassage
        tokens={paintTokens(TEXT, SURFACES)}
        readings={READINGS}
        fitLevel={8}
        level={6}
        onLevelChange={() => {}}
        stale={false}
      />,
    )
    expect(html).toContain('<mark')
    expect(html).toContain('retrieval')
    expect(html).toContain('학년별 어휘 커버리지')
    expect(html).toContain('적정')
    expect(html).toContain('처음 만나는 낱말')
  })
})

describe('학급에 나눠 줄 한 장 (B)', () => {
  it('난외는 이 반에서 처음 만나는 낱말 중 뜻이 있는 것만, 원문 등장 순서로', () => {
    const tokens = paintTokens(TEXT, SURFACES)
    const gloss = buildGloss(profile(), tokens, 6)
    // allocated 는 뜻이 없어 빠지고, pathway(7)는 고1(6)에게 처음이라 들어간다.
    expect(gloss.map((g) => g.word)).toEqual(['retrieval', 'pathway', 'scarce'])
    expect(gloss.map((g) => g.n)).toEqual([1, 2, 3])
  })

  it('반 학년이 올라가면 난외에서 빠진다 — 그 반이 아는 낱말은 풀지 않는다', () => {
    const gloss = buildGloss(profile(), paintTokens(TEXT, SURFACES), 8)
    expect(gloss.map((g) => g.word)).toEqual(['scarce'])
  })

  it('판면은 적정 학년 도장과 기준을 밝히는 발을 갖는다 — 개인 기록이 아니라 학년 기준', () => {
    const html = renderToString(
      <ClassSheet profile={profile()} tokens={paintTokens(TEXT, SURFACES)} level={6} variant="screen" />,
    )
    expect(html).toContain('적정')
    expect(html).toContain('개인 기록이 아닙니다')
    expect(html).toContain('난외 풀이')
  })

  it('원문이 없으면(공유 링크) 원문을 지어내지 않고 그렇다고 말한다', () => {
    const html = renderToString(<ClassSheet profile={profile()} tokens={null} level={6} variant="print" />)
    expect(html).toContain('지문이 담기지 않아요')
  })
})

describe('정직성 — 원문은 서버로 가지 않는다', () => {
  it('클라이언트는 빈도표만 보내고, 라우트는 표면형→레벨 표만 돌려준다', () => {
    const client = readFileSync(join(process.cwd(), 'src/lib/textfit/public-queries.ts'), 'utf8')
    expect(client).toMatch(/JSON\.stringify\(\{ counts, totalTokens \}\)/)
    const route = readFileSync(join(process.cwd(), 'src/app/api/fit/route.ts'), 'utf8')
    expect(route).toContain('surfaceLevels(words, lemmaBySurface)')
    expect(route).not.toMatch(/body\.text|body\.passage/)
  })
})
