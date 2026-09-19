// apps/web/src/lib/admin/__tests__/compose-help.test.ts
//
// ACP §20 — 콘솔 탭 라벨과 화면도움말의 드리프트 잠금.
//
// 왜 이 테스트가 필요한가: AdminScreenHelp 는 탭을 **라벨 문자열로** 조회한다.
// 라벨을 바꾸면 타입 에러도 런타임 에러도 없이 **도움말만 조용히 사라진다** —
// 관리자는 그 화면에서 다음에 뭘 눌러야 하는지 모른 채 조작하게 된다.
// (CLAUDE.md §3 에 "탭 라벨 변경 → 도움말 키" 가 명문화돼 있다.)

import { describe, expect, it } from 'vitest'

import { COMPOSE_TABS, COMPOSE_TAB_BACKING } from '../compose-tabs'
import { HELP_REGISTRY } from '../help'

describe('compose 화면도움말', () => {
  const entry = HELP_REGISTRY['compose']

  it('레지스트리에 등록돼 있다', () => {
    expect(entry).toBeDefined()
    expect(entry!.title).toContain('재저작')
    expect(entry!.screen.summary.length).toBeGreaterThan(20)
  })

  it('탭 라벨과 도움말 키가 정확히 일치한다', () => {
    expect(Object.keys(entry!.tabs ?? {}).sort()).toEqual([...COMPOSE_TABS].sort())
  })

  it('모든 탭에 backing 자산이 적혀 있다 (빈 화면으로 두지 않는다)', () => {
    for (const t of COMPOSE_TABS) {
      expect(COMPOSE_TAB_BACKING[t].length).toBeGreaterThan(0)
    }
  })

  it('탭마다 요약이 있다', () => {
    for (const t of COMPOSE_TABS) {
      expect(entry!.tabs![t]!.summary.length).toBeGreaterThan(15)
    }
  })
})

describe('drain 절차 — 재실행 안전 여부가 반드시 적혀 있어야 한다', () => {
  const drain = HELP_REGISTRY['compose']!.tabs!['작성']!.drain

  it('작성 탭에 드레인 절차가 있다', () => {
    expect(drain).toBeDefined()
    expect(drain!.procedure.length).toBeGreaterThanOrEqual(5)
    expect(drain!.prerequisites.length).toBeGreaterThan(0)
    expect(drain!.verify.length).toBeGreaterThan(0)
  })

  it('재실행 안전 여부를 명시한다 (CLAUDE.md §3 필수 항목)', () => {
    const recovery = (drain!.recovery ?? []).join(' ')
    expect(recovery).toContain('재실행')
    expect(recovery).toContain('안전')
  })

  it('중복 생성이 왜 안 나는지를 설명한다', () => {
    const recovery = (drain!.recovery ?? []).join(' ')
    expect(recovery).toMatch(/중복|하나뿐/)
  })

  it('죽은 세션 회수를 설명한다 — 이게 없으면 큐가 영원히 잠긴다', () => {
    const all = [...(drain!.recovery ?? []), ...drain!.procedure.map((p) => p.detail)].join(' ')
    expect(all).toContain('30분')
  })

  it('되돌릴 수 없는 것과 유료 호출이 경고에 있다', () => {
    const cautions = (HELP_REGISTRY['compose']!.tabs!['작성']!.cautions ?? []).join(' ')
    expect(cautions).toContain('유료')
    const publish = (HELP_REGISTRY['compose']!.tabs!['발행']!.cautions ?? []).join(' ')
    expect(publish).toMatch(/되돌|자동으로 발행되지/)
  })

  it('소스 본문 주입 금지가 경고에 있다 — 이 파이프라인의 핵심 규칙', () => {
    const cautions = (HELP_REGISTRY['compose']!.tabs!['작성']!.cautions ?? []).join(' ')
    expect(cautions).toContain('본문을 프롬프트에 넣지 않는다')
    expect(cautions).toContain('형제')
  })
})
