// apps/web/src/lib/__tests__/secret-scan.test.ts
//
// **추적 파일 전체에 비밀값이 없다** — CI verify(turbo test)에서 돈다. 규칙 정본: scripts/security/secret-scan.mjs.
// 왜: 2026-09-19 검증 계정 비밀번호가 문서 1곳 + 코드 56곳에 평문(`process.env.X || '<값>'` 대체값)으로 박혀 있었다.
//     한 번 들어가면 히스토리에 남는다 — 들어오는 순간 떨어뜨리는 것이 유일한 방어다(design/DECISIONS DD-48).
// 떨어지면: 값을 .env* 로 옮기고 코드는 process.env 만 읽게 한다. 오탐이면 스캐너의 제외 규칙을 고친다(값을 허용 목록에 넣지 않는다).

import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../../../..')

describe('비밀값 검사 — 추적 파일 전체', () => {
  it('비밀값 패턴이 0건이다', async () => {
    const mod = await import(/* @vite-ignore */ pathToFileURL(resolve(ROOT, 'scripts/security/secret-scan.mjs')).href)
    const { files, hits } = mod.scanTracked(ROOT) as { files: number; hits: { kind: string; at: string }[] }
    expect(files).toBeGreaterThan(1000) // git ls-files 가 비면 검사가 눈이 먼 것이다
    expect(hits.map((h) => `[${h.kind}] ${h.at}`), '값을 .env* 로 옮기고 process.env 만 읽게 한다').toEqual([])
  }, 120_000)
})
