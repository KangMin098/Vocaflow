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
/**
 * **최상위 이름을 두 번 선언했는지** 본다 — 파서 진단으로는 안 잡힌다.
 *
 * ── 왜 이 검사가 더 필요했나 (실측 2026-09-12) ──────────────────────
 * 위 검사는 `ts.createSourceFile` 의 `parseDiagnostics` 를 본다. 그것은 **구문**만 본다.
 * 그런데 같은 이름을 `const` 로 두 번 선언하는 것은 파서에게는 멀쩡한 구문이고
 * (진단은 바인더 단계의 TS2451 이다), **Node ESM 에서는 모듈을 즉사시킨다:**
 *
 *     SyntaxError: Identifier 'target' has already been declared
 *
 * 조판기에 발행 게이트를 붙이면서 `const target` 을 새로 선언했는데, 154행에 이미
 * 유형 배합 목표가 같은 이름으로 있었다. **패키지 테스트 1,888개가 전부 통과했고**
 * 조판기는 실행 즉시 죽었다 — 이 자가 지키겠다고 적은 것("깨지면 책이 한 권도 안 나온다")이
 * 정확히 그 상태였다.
 *
 * ⚠️ **최상위만 본다.** 블록 안의 같은 이름은 정상이므로(스코프가 다르다) 그것까지 세면
 *   멀쩡한 코드가 걸린다. 함수 선언도 세지 않는다 — JS 에서 재선언이 합법이다.
 */
describe('파이프라인 스크립트 최상위 이름', () => {
  it.each(files)('%s — 같은 이름을 두 번 선언하지 않는다', (name) => {
    const source = fs.readFileSync(path.join(SCRIPT_DIR, name), 'utf8')
    const sf = ts.createSourceFile(name, source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS)

    const seen = new Map<string, number>()
    const dupes: string[] = []
    const note = (id: ts.Node, text: string) => {
      const line = sf.getLineAndCharacterOfPosition(id.getStart(sf)).line + 1
      const first = seen.get(text)
      if (first != null) dupes.push(`${text} (${first}행 · ${line}행)`)
      else seen.set(text, line)
    }
    // 구조분해도 이름을 만든다 — `const { a } = …` 를 두 번 쓰면 같은 오류가 난다.
    const walkBinding = (b: ts.BindingName) => {
      if (ts.isIdentifier(b)) note(b, b.text)
      else if (ts.isObjectBindingPattern(b) || ts.isArrayBindingPattern(b)) {
        for (const el of b.elements) {
          if (ts.isBindingElement(el)) walkBinding(el.name)
        }
      }
    }
    for (const st of sf.statements) {
      if (!ts.isVariableStatement(st)) continue
      // `var` 는 재선언이 합법이다. `const`·`let` 만 본다.
      const flags = st.declarationList.flags
      if (!(flags & ts.NodeFlags.Const) && !(flags & ts.NodeFlags.Let)) continue
      for (const d of st.declarationList.declarations) walkBinding(d.name)
    }

    expect(dupes, `${name} 이 같은 최상위 이름을 두 번 선언한다:\n  ${dupes.join('\n  ')}`).toEqual([])
  })
})
