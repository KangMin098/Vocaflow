// apps/web/src/app/admin/db/__tests__/hydration-safety.test.ts
//
// 클라이언트 컴포넌트에서 **서버와 브라우저가 다르게 읽는 것**을 금지한다.
//
// 왜 회귀로 잠그나 (2026-09-06 실측): `/admin/db` 의 라이브 패널이 cron 실패 시각을
// `new Date(r.at).toLocaleTimeString('ko-KR')` 로 그렸다. 개발 기계에서는 서버(Node)와
// 브라우저가 같은 타임존이라 우연히 맞았지만, **배포하면 서버는 UTC 이고 보는 사람은 KST** 라
// 아홉 시간이 어긋난다 — React 하이드레이션 오류가 확정적으로 난다.
// 같은 이유로 클라이언트 컴포넌트 안의 `new Date()`(인자 없음)도 금지한다: SSR 순간과
// 하이드레이션 순간이 달라 「N시간 전」이 경계에서 갈린다. 기준 시각은 서버가 prop 으로 준다.
//
// ⚠️ 이 검사가 조용히 무력해지는 방식 — 파일을 하나도 못 읽으면 위반 0 으로 통과한다.
//    그래서 **읽은 클라이언트 컴포넌트 수의 하한**도 함께 단언한다.

import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { formatKstTime } from '@/lib/admin/db-health/derive'

const DIR = resolve(fileURLToPath(new URL('.', import.meta.url)), '..')

/** 주석은 뺀다 — 「쓰지 말 것」이라 적어 둔 주석까지 위반으로 세면 규칙이 스스로를 막는다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
}

const clientFiles = readdirSync(DIR)
  .filter((f) => f.endsWith('.tsx'))
  .map((f) => ({ name: f, src: readFileSync(resolve(DIR, f), 'utf8') }))
  .filter((f) => /^\s*['"]use client['"]/m.test(f.src))

describe('클라이언트 컴포넌트는 서버와 같은 글자를 그린다', () => {
  it('스캔이 실제로 일어났다 — 클라이언트 컴포넌트를 찾았다', () => {
    // 파서가 죽으면 위반 0 으로 통과한다. 이 하한이 그것을 막는다.
    expect(clientFiles.map((f) => f.name).sort()).toEqual(
      ['ActionButton.tsx', 'AlertTriage.tsx', 'CollectButtons.tsx', 'InfoTip.tsx', 'LivePanel.tsx'].sort(),
    )
  })

  it('로캘·타임존에 기대는 포맷이 없다', () => {
    const bad: string[] = []
    for (const f of clientFiles) {
      const body = stripComments(f.src)
      for (const m of body.matchAll(/toLocale(?:Date|Time)?String\s*\(/g)) {
        bad.push(`${f.name}: ${body.slice(Math.max(0, m.index - 40), m.index + 30).trim()}`)
      }
    }
    expect(bad, `클라이언트에서 로캘 포맷을 쓰면 SSR 과 갈린다:\n${bad.join('\n')}`).toEqual([])
  })

  it('인자 없는 new Date() 가 없다 — 「지금」은 서버가 정해 준다', () => {
    const bad: string[] = []
    for (const f of clientFiles) {
      const body = stripComments(f.src)
      for (const m of body.matchAll(/new Date\(\s*\)/g)) {
        bad.push(`${f.name}: ${body.slice(Math.max(0, m.index - 40), m.index + 20).trim()}`)
      }
    }
    expect(bad, `SSR 순간과 하이드레이션 순간이 다르다:\n${bad.join('\n')}`).toEqual([])
  })
})

describe('formatKstTime — 어디서 돌든 같은 글자', () => {
  it('오프셋을 직접 더해 KST 시:분:초를 만든다', () => {
    expect(formatKstTime('2026-09-06T11:51:00.000Z')).toBe('20:51:00')
    expect(formatKstTime('2026-09-06T00:00:00.000Z')).toBe('09:00:00')
    // 자정을 넘겨도 맞는다 — 날짜가 바뀌는 자리에서 틀리면 야간 배치를 못 읽는다.
    expect(formatKstTime('2026-09-06T15:00:00.000Z')).toBe('00:00:00')
  })

  it('오프셋이 붙은 표기도 같은 순간으로 읽는다', () => {
    expect(formatKstTime('2026-09-06T20:51:00+09:00')).toBe('20:51:00')
  })

  it('읽을 수 없는 값은 지어내지 않는다', () => {
    expect(formatKstTime('그런 시각 없음')).toBe('—')
  })
})
