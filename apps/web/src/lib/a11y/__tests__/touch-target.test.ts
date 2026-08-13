// apps/web/src/lib/a11y/__tests__/touch-target.test.ts
//
// 터치 타겟 추정기 회귀 — **오탐·과소보고 특성 자체를 고정한다.**
//
// 이 세션에서 내 검출기가 여러 번 틀렸다(정적 80건 vs 실측 202건 · 진단기 v1 의
// 스크롤 컨테이너 오답). 자동화하는 검출기는 그 한계가 테스트로 못박혀 있어야 한다 —
// 한계를 모르는 채 CI 에 올리면 거짓 경보로 신뢰만 잃는다.

import { describe, expect, it } from 'vitest'

import { estimateHeight, isBelowMinTouch, MIN_TOUCH_PX } from '../touch-target'

describe('estimateHeight — 명시적 신호 우선순위', () => {
  it('min-h-[Npx] 를 최우선으로 본다', () => {
    // h-9(36px) 가 있어도 min-h 가 실제 하한이다
    expect(estimateHeight('inline-flex h-9 min-h-[44px] px-3')).toEqual({
      px: 44,
      via: 'min-h-[44px]',
    })
  })

  it('임의값 h-[Npx]', () => {
    expect(estimateHeight('h-[30px] px-2')?.px).toBe(30)
  })

  it('Tailwind 스케일 h-N → N×4px', () => {
    expect(estimateHeight('h-9 items-center')?.px).toBe(36)
    expect(estimateHeight('h-11')?.px).toBe(44)
  })

  it('py-N + 텍스트 줄높이', () => {
    // py-1.5(12px) + 14px×1.4(20px) = 32px
    expect(estimateHeight('rounded px-2.5 py-1.5')?.px).toBe(32)
    // text-[11px] 명시 시 11×1.4=15 → 12+15 = 27px (실제 결함 사례)
    expect(estimateHeight('px-2.5 py-1.5 text-[11px]')?.px).toBe(27)
  })
})

describe('판정 불가 — 추측하지 않는다', () => {
  it('높이 신호가 없으면 null', () => {
    expect(estimateHeight('flex items-center gap-2 rounded')).toBeNull()
    expect(estimateHeight('')).toBeNull()
  })

  it('null 은 위반으로 세지 않는다 (오탐 방지)', () => {
    expect(isBelowMinTouch('flex items-center')).toBe(false)
  })
})

describe('과소 보고 특성 — 알면서 남기는 한계', () => {
  it('부모가 크기를 주는 요소는 자기 클래스만으로 정상 판정할 수 없다', () => {
    // 44px label 로 감싼 20px 체크박스는 실제로 누를 수 있는 면적이 44px 지만,
    // 이 함수는 클래스 문자열만 보므로 20px 로 본다.
    // → 위반으로 보고되면 **오탐**이다. 호출부가 부모를 함께 봐야 한다.
    expect(estimateHeight('h-5 w-5 rounded')?.px).toBe(20)
    expect(isBelowMinTouch('h-5 w-5 rounded')).toBe(true) // 호출부 보정 전 값
  })

  it('flex/grid 로 분배되는 높이는 신호가 없어 놓친다 (과소 보고)', () => {
    // 실제로는 부모 grid 가 60px 를 줄 수도 있고 20px 를 줄 수도 있다.
    // 어느 쪽이든 이 함수는 판정하지 않는다 — 그래서 실측(202건)보다 항상 적게 센다.
    expect(estimateHeight('flex-1 items-center justify-center')).toBeNull()
  })

  it('조건부 클래스(템플릿 분기)는 문자열 하나로 합쳐지지 않으면 놓친다', () => {
    // `${active ? 'py-3' : 'py-1'}` 같은 분기는 정적으로 결정되지 않는다.
    expect(estimateHeight('rounded transition-colors')).toBeNull()
  })
})

describe('기준값', () => {
  it('44px 미만만 위반', () => {
    expect(isBelowMinTouch('h-11')).toBe(false) // 정확히 44
    expect(isBelowMinTouch('h-10')).toBe(true) // 40
    expect(MIN_TOUCH_PX).toBe(44)
  })
})
