// apps/web/src/lib/knowledge/__tests__/analyzed-gate-hold.test.ts
//
// 효과 판정 보류 가드(2026-10-09) — DB 효과 게이트(learning_first_attempts)가 **다른 세션의 앞선 도움**을 아직 반영하지 않는다
// (읽기 화면은 prior-help 로 반영됨 · DB 는 별도 승인 SQL 대기). 그 SQL 이 적용되기 전에는 앱 코드가 검증을 「분석 완료」로
// 바꾸거나 항목 efficacy 를 매기지 못하게 묶어 둔다 — 오염 가능한 표본이 효과 입증으로 쓰이지 않게.
// SQL 적용 뒤 이 가드를 풀 때는 그 마이그레이션 번호를 아래에 적고 지운다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '__tests__') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}

describe('효과 판정 보류 — DB 세션 간 도움 반영 전', () => {
  it('앱 코드가 knowledge_trials 를 analyzed 로 바꾸거나 knowledge_items.efficacy 를 쓰지 않는다', () => {
    const hits: string[] = []
    for (const f of walk(SRC)) {
      const src = fs.readFileSync(f, 'utf8')
      for (const m of src.matchAll(/\.from\(\s*['"](knowledge_trials|knowledge_items)['"]\s*\)/g)) {
        const window = src.slice(m.index ?? 0, (m.index ?? 0) + 400)
        if (/\.(update|upsert|insert)\(/.test(window) && (m[1] === 'knowledge_trials' ? /['"]analyzed['"]/.test(window) : /efficacy/.test(window))) {
          hits.push(`${path.relative(SRC, f)}:${src.slice(0, m.index).split('\n').length}`)
        }
      }
    }
    expect(hits).toEqual([])
  })
})
