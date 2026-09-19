// apps/web/src/components/textfit/__tests__/TextFitVerdict.test.tsx
//
// 판정 카드 렌더 회귀. 화면에서만 깨질 수 있는 계약 세 개를 잡는다:
//
//  1. **거짓 정밀도 금지** — 추정 비중이 크면 단일 숫자가 아니라 범위를 보여야 한다.
//  2. **감쇠는 눈에 보여야 한다** — 이 제품의 유일한 차별점이 화면에서 사라지면 남는 건 Lexile 복제품이다.
//  3. **죽은 버튼 금지** — 담을 곳이 없으면 "단어장에 담기" 를 그리지 않는다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { TextFitVerdict } from '../TextFitVerdict'
import { analyzeTextFit } from '@/lib/textfit/coverage'
import type { TextFitReport } from '@/lib/textfit/types'

const NOW = new Date('2026-08-17T00:00:00Z')

function report(over: Parameters<typeof analyzeTextFit>[0], extra?: Partial<TextFitReport>): TextFitReport {
  return {
    ...analyzeTextFit(over),
    resolutionMode: 'headword_rpc',
    isDiagnosed: true,
    ...extra,
  }
}

const base = {
  counts: {} as Record<string, number>,
  totalTokens: 0,
  userVLevel: 7 as number | null,
  familiarity: new Map<string, 'known' | 'unknown'>(),
  fsrs: new Map(),
  dictVLevel: new Map<string, number>(),
  now: NOW,
}

describe('TextFitVerdict — 렌더', () => {
  it('대역 라벨을 색이 아니라 글자로도 말한다 (색맹 대응)', () => {
    const html = renderToString(
      <TextFitVerdict report={report({ ...base, counts: { rare: 1 }, totalTokens: 100 })} />,
    )
    expect(html).toContain('술술 읽힘')
    expect(html).toContain('99.0%')
  })

  it('overload 도 격려 톤을 유지한다 — 압박 문구를 쓰지 않는다', () => {
    const html = renderToString(
      <TextFitVerdict report={report({ ...base, counts: { a: 30 }, totalTokens: 100 })} />,
    )
    expect(html).toContain('아직 이른 글')
    expect(html).not.toContain('너무 어려')
    expect(html).not.toContain('실패')
  })

  it('추정 비중이 크면 단일 숫자 대신 범위를 함께 낸다', () => {
    const html = renderToString(
      <TextFitVerdict
        report={report({
          ...base,
          counts: { alpha: 40 },
          totalTokens: 100,
          userVLevel: 9,
          dictVLevel: new Map([['alpha', 2]]),
        })}
      />,
    )
    expect(html).toContain('사이)')
  })

  it('추정이 없으면 범위를 그리지 않는다 — 없는 불확실성을 만들지 않는다', () => {
    const html = renderToString(
      <TextFitVerdict
        report={report({
          ...base,
          counts: { alpha: 5 },
          totalTokens: 100,
          familiarity: new Map([['alpha', 'known']]),
        })}
      />,
    )
    expect(html).not.toContain('사이)')
  })

  it('감쇠가 있으면 14일 예보를 화면에 낸다 (차별점 보존)', () => {
    const html = renderToString(
      <TextFitVerdict
        report={report({
          ...base,
          counts: { alpha: 20 },
          totalTokens: 100,
          fsrs: new Map([['alpha', { stability: 5, lastReviewAt: NOW }]]),
        })}
      />,
    )
    expect(html).toContain('복습하지 않으면 14일 뒤')
  })

  it('감쇠가 없으면 예보 문구를 그리지 않는다', () => {
    const html = renderToString(
      <TextFitVerdict
        report={report({
          ...base,
          counts: { alpha: 20 },
          totalTokens: 100,
          familiarity: new Map([['alpha', 'known']]),
        })}
      />,
    )
    expect(html).not.toContain('복습하지 않으면')
  })

  it('처방이 있으면 "N개만 익히면" 을 낸다', () => {
    const html = renderToString(
      <TextFitVerdict report={report({ ...base, counts: { a: 4, b: 3, c: 2 }, totalTokens: 100 })} />,
    )
    expect(html).toContain('개</b>만 익히면')
  })

  it('담을 곳이 없으면 담기 버튼을 그리지 않는다 (죽은 버튼 금지)', () => {
    const r = report({ ...base, counts: { a: 4, b: 3 }, totalTokens: 100 })
    expect(renderToString(<TextFitVerdict report={r} />)).not.toContain('단어장에 담기')
    expect(renderToString(<TextFitVerdict report={r} onCollectWords={() => {}} />)).toContain(
      '단어장에 담기',
    )
  })

  it('미진단이면 숫자의 성격을 밝힌다 — 내 기준이 아니라고 말한다', () => {
    const html = renderToString(
      <TextFitVerdict
        report={report({ ...base, counts: { a: 2 }, totalTokens: 100, userVLevel: null }, { isDiagnosed: false })}
      />,
    )
    expect(html).toContain('레벨 진단 전')
  })

  it('폴백 해석 경로였음을 숨기지 않는다', () => {
    const html = renderToString(
      <TextFitVerdict
        report={report({ ...base, counts: { a: 2 }, totalTokens: 100 }, { resolutionMode: 'exact_match_fallback' })}
      />,
    )
    // 근거는 접혀 있으므로 토글 자체가 존재하는지만 본다 (펼침은 클라이언트 상호작용).
    expect(html).toContain('이 숫자가 나온 근거')
  })

  it('스케일에 스크린리더용 문장을 붙인다', () => {
    const html = renderToString(
      <TextFitVerdict report={report({ ...base, counts: { a: 6 }, totalTokens: 100 })} />,
    )
    expect(html).toContain('role="img"')
    expect(html).toContain('어휘 커버리지')
  })
})
