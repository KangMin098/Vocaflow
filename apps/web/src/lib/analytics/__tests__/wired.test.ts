// apps/web/src/lib/analytics/__tests__/wired.test.ts
//
// **정의된 이벤트가 실제로 불리는가** — 계측이 죽는 가장 조용한 방식.
//
// 2026-08-26, 프로덕션 빌드가 `TeacherClient.tsx` 에서 `'noteInviteShared' is defined but
// never used` 를 냈다. import 만 있고 호출이 없었다. 그 말은 `funnel_events.invite_shared`
// 가 **영원히 0행**이고, 대시보드의 "초대코드를 공유했고 → 학생이 왔다" 구간은 분모가 0 이라
// 아예 읽을 수 없었다는 뜻이다. 화면은 멀쩡히 돌았고 타입 검사도 통과했다.
//
// 이 파일이 지키는 계약: **목록에 있는 이벤트는 어딘가에서 불려야 한다.**
// 이름만 늘리고 배선을 잊는 것을 막는다 — 그 상태는 "0건" 으로 보이지 "고장" 으로 안 보인다.
//
// ⚠️ 이름의 **등장**을 보지 실행을 보지 않는다. 정적 검사의 한계이고, 그래도
//    "import 만 있고 호출이 없다" 는 실제 사고를 잡는다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { ALLOWED_EVENTS } from '../events'

const SRC = join(process.cwd(), 'src')

/** 정의가 사는 곳 — 여기서의 등장은 "배선" 이 아니다. */
const DEFINITION_FILES = ['events.ts', 'funnel.ts', 'client.ts']

function walk(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '__tests__' || name === 'node_modules') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (/\.tsx?$/.test(name) && !DEFINITION_FILES.includes(name)) out.push(p)
  }
  return out
}

const sources = walk(SRC).map((f) => readFileSync(f, 'utf8'))
const haystack = sources.join('\n')

describe('계측 배선', () => {
  it.each([...ALLOWED_EVENTS])('%s 를 실제로 보내는 곳이 있다', (event) => {
    expect(
      haystack.includes(event),
      `${event} 는 목록에만 있고 아무도 보내지 않는다 — 대시보드에서 "0건" 으로 보일 뿐 고장으로 안 보인다`,
    ).toBe(true)
  })

  /**
   * `funnel_events` 2종은 별도로 본다 — `ALLOWED_EVENTS`(PostHog)와 다른 계통이다.
   * 목록을 여기 복사하는 대신 `funnel.ts` 의 타입 유니온에서 읽어 온다.
   */
  it('funnel_events 2종도 호출부가 있다', () => {
    const funnelSrc = readFileSync(join(SRC, 'lib', 'analytics', 'funnel.ts'), 'utf8')
    // ⚠️ 파일 전체에서 따옴표 문자열을 긁으면 RPC 이름(record_funnel_event)까지 걸린다.
    //    **타입 유니온 블록만** 읽는다 — 거기 적힌 것이 곧 보낼 수 있는 이벤트다.
    const union = /export type FunnelEvent =([\s\S]*?)\n\n/.exec(funnelSrc)?.[1] ?? ''
    const names = [...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] as string)

    const declared = new Set(names)
    expect(declared.size, 'funnel.ts 에서 이벤트 이름을 못 읽었다').toBeGreaterThan(0)

    const missing = [...declared].filter((n) => !haystack.includes(n))
    expect(
      missing,
      `funnel_events 에 정의됐는데 보내는 곳이 없다: ${missing.join(', ')}`,
    ).toEqual([])
  })
})
