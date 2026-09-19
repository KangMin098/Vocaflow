// apps/web/src/components/marketing/__tests__/no-hardcoded-stats.test.ts
//
// **공개 마케팅 화면에 통계를 상수로 적지 않는다.**
//
// 이 저장소는 같은 실패를 두 번 겪었다:
//   1. 2026-08-16 — `/pricing` 이 "학습자 12,000+ / 평점 4.8 / 학교 34곳" 을 표시하고 있었다.
//      같은 시각 실측은 3 / 0 / 0. 이용자 수·평점·도입 기관은 표시광고법이 정면으로 다룬다.
//   2. 2026-08-26 — 1번을 고치며 넣은 **콘텐츠 자산 수치**(DB 실측이었다)가 **9일 만에**
//      셋 다 어긋났다. 도서–어휘 연결은 실제보다 79 **많게** 표시되고 있었다.
//      파일 주석에 "분기마다 재확인" 이라 적어 두었는데도 그랬다.
//
// 두 번째가 요점이다 — **성실함으로는 못 막는다.** 수치는 매일 변하고 사람의 재확인은
// 분기에 한 번이라 구조적으로 항상 틀린다. 그래서 규칙을 테스트로 옮긴다:
// 공개 화면의 숫자는 서버가 DB 에서 읽어 내려 주거나, 아예 없거나 둘 중 하나다.
//
// 가격은 예외다 — 상수인 것이 맞고, 바뀌면 사람이 정하는 값이다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOTS = [
  join(process.cwd(), 'src', 'app', '(marketing)'),
  join(process.cwd(), 'src', 'components', 'marketing'),
]

/** 천 단위 구분이 든 수 — `47,137` · `1,678,478`. 통계는 거의 이 모양으로 적힌다. */
const GROUPED_NUMBER = /\b\d{1,3}(?:,\d{3})+\b/
/**
 * 가격 줄은 통과시킨다 — 상수인 것이 맞고, 바뀔 때는 사람이 정한다.
 * 통화 기호가 없는 경우가 있어(annualTotal) **필드 이름**도 본다. 이름을 근거로 삼는 만큼
 * 좁게 잡는다 — count·total 같은 일반어를 넣으면 통계까지 통과시켜 테스트가 무력해진다.
 */
const PRICE_HINT = /[₩$]|price|Price|annualTotal|monthlyPrice/

function walk(dir: string): string[] {
  let out: string[] = []
  for (const name of readdirSync(dir)) {
    if (name === '__tests__') continue
    const p = join(dir, name)
    if (statSync(p).isDirectory()) out = out.concat(walk(p))
    else if (/\.tsx?$/.test(name)) out.push(p)
  }
  return out
}

describe('공개 마케팅 화면 — 통계 상수 금지', () => {
  const files = ROOTS.flatMap((r) => {
    try {
      return walk(r)
    } catch {
      return []
    }
  })

  it('검사 대상 파일이 있다 — 경로가 바뀌면 이 테스트가 조용히 아무것도 안 본다', () => {
    expect(files.length).toBeGreaterThan(3)
  })

  it('천 단위 수를 소스에 박아 두지 않는다 (가격 제외)', () => {
    const offenders: string[] = []

    for (const f of files) {
      const lines = readFileSync(f, 'utf8').split(/\r?\n/)
      lines.forEach((line, i) => {
        // 주석은 이력을 적는 자리다 — 화면에 나가지 않는다.
        const code = line.trim()
        if (code.startsWith('//') || code.startsWith('*') || code.startsWith('/*')) return
        if (!GROUPED_NUMBER.test(line)) return
        if (PRICE_HINT.test(line)) return
        offenders.push(`${f.split('src')[1]}:${i + 1}  ${code.slice(0, 80)}`)
      })
    }

    expect(
      offenders,
      `공개 화면에 통계가 상수로 박혀 있다 — 서버가 DB 에서 읽어 내려 주도록 바꿀 것:\n${offenders.join('\n')}`,
    ).toEqual([])
  })
})
