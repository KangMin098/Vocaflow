// apps/web/src/lib/marketing/__tests__/trust-signals-count.test.ts
//
// **집계가 실패했는데 아무도 모르는 일**을 막는다.
//
// 2026-09-20 실측: `countOf` 가 `head: true`(HTTP HEAD)로 물어보고 있었다. HEAD 응답에는 본문이 없어서
// PostgREST 가 500 을 내도(`57014 canceling statement due to statement timeout` — `csat_dcp_items`
// 집계가 8.2초) supabase-js 가 읽을 오류 본문이 없고, 결과는 **`error: null` · `count: null`** 이었다.
// 그래서 `fetchPlatformFacts()` 가 null 을 냈고, 공개 화면의 지표 절이 **로그 한 줄 없이** 사라졌다.
// AGENTS.md 「`count ?? 0` — 없는 테이블도 head 요청엔 204/count=null 이다」와 같은 함정의 다른 얼굴이다.
//
// 소스 수준으로 잠근다: 고치는 사람이 편의상 HEAD 로 되돌리면 여기서 걸린다.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(process.cwd(), 'src/lib/marketing/trust-signals.ts'), 'utf8')
/** 주석을 뺀 코드만 — 이 파일의 주석은 함정 이름을 **일부러** 인용한다(「`count ?? 0` 을 쓰지 않는다」). */
const CODE = SRC.split(/\r?\n/)
  .filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l))
  .join('\n')

describe('집계 요청은 오류를 삼키지 않는다', () => {
  it('HEAD 로 세지 않는다 — 오류 본문이 사라진다', () => {
    expect(CODE, '`head: true` 는 HTTP HEAD 라 PostgREST 의 500 본문이 오지 않는다. `.limit(0)` 짜리 GET 을 쓴다').not.toMatch(
      /count:\s*'exact'\s*,\s*head:\s*true/,
    )
  })

  it('`limit(0)` GET 으로 센다 — 행은 0줄이고 오류는 올라온다', () => {
    expect(CODE).toMatch(/select\(\s*'\*'\s*,\s*\{\s*count:\s*'exact'\s*\}\s*\)\s*\.limit\(0\)/)
  })

  it('오류도 수도 없는 응답을 조용히 넘기지 않는다', () => {
    expect(CODE).toMatch(/집계가 오류 없이 비었다/)
  })

  it('`count ?? 0` 로 접지 않는다', () => {
    expect(CODE).not.toMatch(/count\s*\?\?\s*0/)
  })
})

describe('공개 화면 계약', () => {
  it('하나라도 못 읽으면 전부 숨긴다 — 부분 공개로 바뀌지 않았다', () => {
    expect(CODE).toMatch(/return missing\.length \? null : \(facts as PlatformFacts\)/)
  })

  it('0 은 "자산이 없다" 가 아니라 "못 읽었다" 로 친다', () => {
    expect(CODE).toMatch(/if \(v === null \|\| v === 0\) missing\.push/)
  })
})
