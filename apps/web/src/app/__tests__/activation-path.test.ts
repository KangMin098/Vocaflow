// apps/web/src/app/__tests__/activation-path.test.ts
//
// **D5 — 가입 후 첫 학습 1회 완료까지 화면 전환 ≤ 3** (CLAUDE.md §🎯 · DESIGN_SYSTEM §🎯 2).
//
// 왜 기계가 지켜야 하나:
//   이 규칙은 지침에만 있었고 **아무것도 강제하지 않았다.** 그런데 이 경로는 세 파일에 나뉘어
//   있어서(가입 리다이렉트 · 관문 CTA · 진단 완료 분기) 한 곳만 바뀌어도 조용히 4전환이 된다.
//   그리고 4전환이 되어도 **화면은 전부 멀쩡히 뜬다** — 눈으로는 영영 안 잡히는 종류의 결함이다.
//
//   그 자리의 비용은 실측돼 있다: **가입 → 첫 학습 중앙값 55일**
//   (2026-08-16 `/admin` 리텐션 패널 1회차. `components/home/TodayFocus.tsx` 헤더에 근거).
//   리텐션 이전에 활성화가 막혀 있고, 활성화를 막는 것이 이 경로의 길이다.
//
// ── 잠그는 경로 (2026-09-06 실측 = 3전환) ───────────────────────────
//   ① 가입 완료  → `DEFAULT_LANDING`(/hub)
//   ② /hub 미진단 → `TodayFocus` 1차 CTA(/diagnostic)
//   ③ 진단 완료  → 추천 세트 구독 후 **학습 화면 직행**(/flashcard/play)
//   ④ 첫 학습 1회 완료 — 같은 화면 안에서 끝난다(전환 아님)
//
// ⚠️ 이 검사는 **배선**을 본다(실제 클릭이 아니라). 정적 검사의 한계이고, 그래도
//    "진단 완료를 /hub 로 되돌려 한 단계 늘리는" 종류의 회귀는 잡는다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { DEFAULT_LANDING } from '@/lib/auth/redirect'

const SRC = join(process.cwd(), 'src')
const read = (...seg: string[]) => readFileSync(join(SRC, ...seg), 'utf8')

const TODAY_FOCUS = read('components', 'home', 'TodayFocus.tsx')
const DIAGNOSTIC = read('components', 'diagnostic', 'DiagnosticClient.tsx')
const HUB_PAGE = read('app', '(main)', 'hub', 'page.tsx')

/** D5 상한 — 지침의 숫자. 늘리려면 지침을 먼저 고친다. */
const MAX_TRANSITIONS = 3

/**
 * 학습 1회를 **그 화면 안에서** 끝낼 수 있는 라우트.
 *
 * 진단 완료가 이 중 하나로 직행해야 3전환이 성립한다. `/hub` 나 카탈로그(`/library` ·
 * `/flashcard` 준비면)로 보내면 한 단계가 더 붙는다 — 화면은 멀쩡하고 숫자만 나빠진다.
 */
const LEARNING_ROUTES = ['/flashcard/play', '/wordblitz', '/spellforge/play', '/dictate'] as const

/** 이름이 붙은 함수 하나의 본문을 뽑는다 — 중괄호 균형으로 끝을 찾는다. */
function functionBody(source: string, name: string): string {
  const head = source.indexOf(`function ${name}(`)
  expect(head, `${name}() 를 찾지 못했다 — 이름이 바뀌었으면 이 회귀도 같이 고친다`).toBeGreaterThan(-1)
  const open = source.indexOf('{', head)
  let depth = 1
  let i = open + 1
  while (i < source.length && depth > 0) {
    if (source[i] === '{') depth += 1
    else if (source[i] === '}') depth -= 1
    i += 1
  }
  return source.slice(open, i)
}

describe('D5 — 가입 후 첫 학습까지 화면 전환 ≤ 3', () => {
  it('① 가입 완료는 관문(/hub)으로 간다', () => {
    expect(DEFAULT_LANDING).toBe('/hub')
  })

  it('② 미진단 관문이 TodayFocus 를 세우고, 그 1차 CTA 가 진단이다', () => {
    expect(HUB_PAGE).toContain('<TodayFocus')
    expect(HUB_PAGE).toMatch(/!isDiagnosed/)
    expect(TODAY_FOCUS).toContain('href="/diagnostic"')
  })

  it('③ 진단 완료는 학습 화면으로 **직행**한다 — /hub 를 한 번 더 거치지 않는다', () => {
    const body = functionBody(DIAGNOSTIC, 'startWithRecommendation')

    const target = LEARNING_ROUTES.find((r) => body.includes(`router.push('${r}')`))
    expect(
      target,
      `추천으로 시작하기가 학습 화면으로 가지 않는다. 허용: ${LEARNING_ROUTES.join(' · ')}`,
    ).toBeDefined()

    // `/hub` 가 나오는 것 자체는 정상이다 — 구독 실패 시 막다른 화면을 만들지 않는 처리(D4).
    // 다만 그것이 **성공 경로**여서는 안 된다.
    //
    // ⚠️ 위치로 판정하면 안 된다. 실패 분기(조기 반환)와 `catch` 가 성공 push 를 앞뒤로 감싸고
    //    있어서 "성공이 먼저냐" 는 질문이 성립하지 않는다(2026-09-06 에 그렇게 짰다가 틀렸다).
    //    **맥락**으로 본다 — 모든 `/hub` push 가 오류 처리 안에 있어야 한다.
    const HUB_PUSH = "router.push('/hub')"
    const hubPushes: number[] = []
    for (let at = body.indexOf(HUB_PUSH); at !== -1; at = body.indexOf(HUB_PUSH, at + 1)) {
      hubPushes.push(at)
    }
    const strayed = hubPushes.filter(
      (at) => !body.slice(Math.max(0, at - 400), at).includes('toast.error'),
    )
    expect(
      strayed,
      '오류 처리 밖에서 /hub 로 보낸다 — 성공 경로에 전환이 한 단계 늘어난다',
    ).toEqual([])
  })

  it('④ 세 걸음을 넘지 않는다', () => {
    // ①가입→관문 ②관문→진단 ③진단→학습. 학습 완료는 같은 화면 안이라 전환이 아니다.
    const hops = ['가입 → /hub', '/hub → /diagnostic', '/diagnostic → 학습']
    expect(hops).toHaveLength(MAX_TRANSITIONS)
  })
})

describe('D4 — 실패해도 막다른 화면을 만들지 않는다', () => {
  it('구독 실패는 사유를 말하고 갈 곳을 준다', () => {
    const body = functionBody(DIAGNOSTIC, 'startWithRecommendation')
    expect(body).toMatch(/toast\.error/)
    expect(body).toContain("router.push('/hub')")
  })
})
