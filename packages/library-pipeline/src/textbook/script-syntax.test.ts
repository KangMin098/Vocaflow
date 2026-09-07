// packages/library-pipeline/src/textbook/script-syntax.test.ts
//
// **파이프라인 스크립트가 파싱은 되는지 지킨다.**
//
// ── 왜 (2026-09-01 실측) ────────────────────────────────────────────
// `render-volume.mjs` 가 **커밋된 채로 안 돌고 있었다.** CSS 주석 안에 이스케이프 안 된
// 백틱이 들어가 템플릿 리터럴을 닫았고, 그 뒤 전부가 코드로 파싱됐다:
//
//     /* … 판권면에 남는다(`검수 ... · 교정 초교·재교·삼교`). … */
//                           ^                              ^
//     SyntaxError: Unexpected identifier '검수'
//
// 조판기는 파이프라인의 **출력 단계**다 — 깨지면 책이 한 권도 안 나온다. 그런데 아무
// 회귀도 이것을 못 잡았다. 이 파일들은 DB 를 타서 단위 테스트가 어렵고, 그래서
// "돌려 보면 안다" 에 기대고 있었는데 **아무도 매번 돌리지는 않는다.**
//
// ⚠️ **`node --check` 로는 못 잡는다.** 이 스크립트들은 top-level await 를 쓰는 ESM 이라
//   `node --check` 가 멀쩡한 파일에도 같은 오류를 낸다(그래서 처음엔 내 변경 탓인 줄 알았다).
//   여기서는 TypeScript 파서로 **모듈로** 읽어 구문 진단만 본다 — 실행하지 않으므로
//   DB 도 환경변수도 필요 없고, 몇 밀리초면 끝난다.
//
// 이 자는 "동작한다" 를 보증하지 않는다. **"파싱은 된다"** 만 보증한다 —
// 그것이 오늘 깨진 것이고, 그 한 줄이 파이프라인 전체를 멈췄다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import ts from 'typescript'
import { describe, expect, it } from 'vitest'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT_DIR = path.resolve(HERE, '../../../../scripts/textbook')

/** 임시 파일(`_*.tmp.mjs`)은 세션이 만들었다 지우는 것이라 세지 않는다. */
const files = fs.existsSync(SCRIPT_DIR)
  ? fs
      .readdirSync(SCRIPT_DIR)
      .filter((f) => f.endsWith('.mjs') && !f.startsWith('_'))
      .sort()
  : []

describe('파이프라인 스크립트 구문', () => {
  it('검사할 스크립트가 실제로 있다 — 경로가 어긋나면 0개를 통과로 읽는다', () => {
    // 폴더를 못 찾아도 테스트가 통과하면 이 자는 아무것도 안 지킨다.
    expect(files.length).toBeGreaterThan(20)
  })

  it.each(files)('%s — 구문 오류가 없다', (name) => {
    const full = path.join(SCRIPT_DIR, name)
    const source = fs.readFileSync(full, 'utf8')
    const sf = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)

    // `parseDiagnostics` 는 공개 타입에 없지만 구문 진단이 여기 담긴다.
    const diags = (sf as unknown as { parseDiagnostics?: ts.Diagnostic[] }).parseDiagnostics ?? []
    const messages = diags.map((d) => {
      const pos = d.start != null ? sf.getLineAndCharacterOfPosition(d.start) : null
      const where = pos ? `${pos.line + 1}:${pos.character + 1}` : '?'
      return `${where} ${ts.flattenDiagnosticMessageText(d.messageText, ' ')}`
    })

    expect(messages, `${name} 구문 오류:\n  ${messages.join('\n  ')}`).toEqual([])
  })
})
