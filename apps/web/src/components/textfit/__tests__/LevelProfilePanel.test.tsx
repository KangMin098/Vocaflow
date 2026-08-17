// apps/web/src/components/textfit/__tests__/LevelProfilePanel.test.tsx
//
// 공개 레벨 프로파일 렌더 회귀. 이 화면은 **가입 전 첫인상**이라 다음이 깨지면 채널이 끊긴다:
//
//  1. 교사의 질문에 한 줄로 답한다 — "몇 학년용인가".
//  2. 레벨 미상을 감추지 않는다 — 감추면 "고1 96%" 라고 해놓고 실제로 89% 일 수 있다.
//  3. 학년 이름이 **글자로** 나온다 — 색과 막대만으로 정보를 전달하지 않는다.

import { renderToString } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}))

import { LevelProfilePanel } from '../LevelProfilePanel'
import { buildLevelProfile } from '@/lib/textfit/profile'
import type { PublicWord } from '@/lib/textfit/profile'

const lv = (surface: string, count: number, vLevel: number): PublicWord => ({
  surface,
  lemma: surface,
  count,
  status: 'leveled',
  vLevel,
})
const un = (surface: string, count: number): PublicWord => ({
  surface,
  lemma: surface,
  count,
  status: 'unleveled',
  vLevel: null,
})

describe('LevelProfilePanel — 렌더', () => {
  it('로딩 중에는 진행 상태를 알린다', () => {
    const html = renderToString(<LevelProfilePanel profile={null} loading />)
    expect(html).toContain('role="status"')
    expect(html).toContain('학년축에 올려보는 중')
  })

  it('입력이 없으면 아무것도 그리지 않는다 — 빈 카드로 자리를 차지하지 않는다', () => {
    expect(renderToString(<LevelProfilePanel profile={null} loading={false} />)).toBe('')
    const empty = buildLevelProfile([], 0)
    expect(renderToString(<LevelProfilePanel profile={empty} loading={false} />)).toBe('')
  })

  it('교사의 질문에 한 줄로 답한다 — 몇 학년용인가', () => {
    const p = buildLevelProfile([lv('a', 6, 7)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    expect(html).toContain('고2 · 수능 기본')
    expect(html).toContain('편하게 읽혀요')
  })

  it('여덟 학년을 모두 글자로 낸다 — 색만으로 전달하지 않는다', () => {
    const p = buildLevelProfile([lv('a', 5, 8)], 200)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    for (const label of ['초등 고학년', '중1–2', '중3', '고1', '수능 심화 · 실무', '학술 · 원서']) {
      expect(html).toContain(label)
    }
  })

  it('적정 레벨에 "적정" 표시를 붙인다', () => {
    const p = buildLevelProfile([lv('a', 6, 7)], 100)
    expect(renderToString(<LevelProfilePanel profile={p} loading={false} />)).toContain('적정')
  })

  it('레벨 미상이 있으면 범위로 표시한다고 밝힌다', () => {
    const p = buildLevelProfile([lv('a', 2, 5), un('mystery', 10)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    expect(html).toContain('레벨을 알 수 없어서')
    expect(html).toContain('하나의 숫자로 단정하지 않습니다')
  })

  it('레벨 미상이 거의 없으면 고지를 띄우지 않는다 — 없는 불확실성을 만들지 않는다', () => {
    const p = buildLevelProfile([lv('a', 10, 5)], 100)
    expect(renderToString(<LevelProfilePanel profile={p} loading={false} />)).not.toContain(
      '하나의 숫자로 단정하지 않습니다',
    )
  })

  it('각 막대에 스크린리더 문장을 붙인다 (범위 포함)', () => {
    const p = buildLevelProfile([lv('a', 5, 8), un('b', 5)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    expect(html).toContain('커버리지')
    expect(html).toContain('범위')
  })

  it('가장 어려운 단어를 V-Level 과 함께 낸다 — 수업 전 예습에 그대로 쓰인다', () => {
    const p = buildLevelProfile([lv('ubiquitous', 2, 10), lv('easy', 9, 3)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    expect(html).toContain('ubiquitous')
    expect(html).toContain('V10')
  })

  it('로그인 모드로 넘어가는 다음 단계를 제시한다 (교사 → 학습자 전환 고리)', () => {
    const p = buildLevelProfile([lv('a', 5, 6)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    expect(html).toContain('/signup')
    expect(html).toContain('2주 뒤')
  })

  it('입력이 잘렸으면 숨기지 않는다 — 전체 지문의 숫자가 아니다', () => {
    const p = buildLevelProfile([lv('a', 5, 6)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} truncated />)
    expect(html).toContain('앞부분만 분석했어요')
  })

  it('교육과정을 넘는 지문은 그렇게 말한다 — 억지로 학년을 붙이지 않는다', () => {
    const p = buildLevelProfile([lv('a', 30, 11)], 100)
    const html = renderToString(<LevelProfilePanel profile={p} loading={false} />)
    expect(html).toContain('학술 원서 수준')
    expect(html).not.toContain('적정</span>')
  })
})
