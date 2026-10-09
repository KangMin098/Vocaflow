// apps/web/src/lib/admin/__tests__/retention-server-boundary.test.ts
//
// 계정 분류의 **서버 경계**를 소스 수준에서 지킨다(T-0006 · Codex r1 P2-2).
//
// vitest 는 `server-only` 를 빈 모듈로 바꾸므로(vitest.config alias), 경계 선언을 지워도 동작 테스트는 통과한다.
// 그래서 여기서는 동작이 아니라 **선언과 import 그래프**를 읽는다:
//   1. 환경변수·service-role·이메일을 다루는 `retention.ts` 는 `import 'server-only'` 로 시작한다
//      (클라이언트 번들에 들어가면 Next 빌드가 실패한다 — 그 실패가 경계다).
//   2. 클라이언트에서 쓰일 수 있는 순수 모듈(`account-classification.ts` · `retention-math.ts`)은
//      `process.env` · `server-only` 조회부 · Supabase 클라이언트를 import 하지 않는다.
//   3. 컴포넌트는 조회부(`@/lib/admin/retention`)를 import 하지 않는다 — 수만 담긴 props 로만 받는다.

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(join(SRC, rel), 'utf8')

/** 주석·빈 줄을 건너뛴 첫 실행 문장 */
function firstStatement(src: string): string {
  const withoutBlock = src.replace(/\/\*[\s\S]*?\*\//g, '')
  return (
    withoutBlock
      .split('\n')
      .map((l) => l.trim())
      .find((l) => l && !l.startsWith('//')) ?? ''
  )
}

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name)
    return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx)$/.test(name) ? [p] : []
  })
}

describe('계정 분류 — 서버 경계', () => {
  it('조회부 retention.ts 의 첫 문장은 import "server-only" 다', () => {
    expect(firstStatement(read('lib/admin/retention.ts'))).toBe("import 'server-only'")
  })

  it('순수 모듈은 환경변수·조회부·Supabase 클라이언트를 쓰지 않는다', () => {
    for (const f of ['lib/admin/account-classification.ts', 'lib/admin/retention-math.ts']) {
      const src = read(f)
      expect(src, f).not.toMatch(/process\.env/)
      expect(src, f).not.toMatch(/from ['"]@\/lib\/admin\/retention['"]|from ['"]\.\/retention['"]/)
      expect(src, f).not.toMatch(/@\/lib\/supabase\//)
      expect(src, f).not.toMatch(/import ['"]server-only['"]/) // 순수부는 클라이언트도 쓴다
    }
  })

  it('컴포넌트는 조회부를 import 하지 않는다(props 로 수만 받는다)', () => {
    const offenders = walk(join(SRC, 'components'))
      .filter((p) => /from ['"]@\/lib\/admin\/retention['"]/.test(readFileSync(p, 'utf8')))
      .map((p) => p.slice(SRC.length + 1))
    expect(offenders).toEqual([])
  })
})
