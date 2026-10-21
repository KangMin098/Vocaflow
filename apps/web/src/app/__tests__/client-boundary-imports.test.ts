// apps/web/src/app/__tests__/client-boundary-imports.test.ts
// 서버 컴포넌트(page.tsx · layout.tsx · 'use client' 아닌 파일)가 'use client' 모듈에서 **값**(상수 · 함수)을 가져오면
// 서버에서는 클라이언트 참조(proxy)가 되어 읽는 순간 오류가 난다 — 화면 전체가 「문제가 발생했어요」(2026-10-18 /csat/learn 격리 e2e 실측).
// 가드: app/ 아래 서버 파일이 'use client' 모듈에서 가져오는 이름은 컴포넌트(대문자 시작)이거나 type 이어야 한다.
import fs from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../..')
const APP = path.join(SRC, 'app')
const isClient = (file: string) => /^\s*(\/\/[^\n]*\n|\s)*['"]use client['"]/.test(fs.readFileSync(file, 'utf8'))

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out) }
    else if (/\.(tsx|ts)$/.test(e.name) && !/\.test\./.test(e.name)) out.push(p)
  }
  return out
}

function resolveImport(from: string, spec: string): string | null {
  const base = spec.startsWith('@/') ? path.join(SRC, spec.slice(2)) : spec.startsWith('.') ? path.resolve(path.dirname(from), spec) : null
  if (!base) return null
  for (const c of [base, `${base}.tsx`, `${base}.ts`, path.join(base, 'index.tsx'), path.join(base, 'index.ts')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  return null
}

describe('서버 ↔ 클라이언트 경계 import', () => {
  it("app/ 서버 파일은 'use client' 모듈에서 컴포넌트 · 타입만 가져온다", () => {
    const bad: string[] = []
    for (const file of walk(APP).filter((f) => !isClient(f))) {
      const src = fs.readFileSync(file, 'utf8')
      for (const m of src.matchAll(/import\s+(type\s+)?\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/g)) {
        if (m[1]) continue
        const target = resolveImport(file, m[3])
        if (!target || !isClient(target)) continue
        for (const raw of m[2].split(',')) {
          const name = raw.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]
          if (!name || raw.trim().startsWith('type ')) continue
          if (!/^[A-Z]/.test(name) || /^[A-Z0-9_]+$/.test(name)) bad.push(`${path.relative(SRC, file)} ← ${name} (${m[3]})`)
        }
      }
    }
    expect(bad, '서버 파일이 클라이언트 모듈의 값을 가져온다 — 공용 모듈로 옮길 것').toEqual([])
  })
})
