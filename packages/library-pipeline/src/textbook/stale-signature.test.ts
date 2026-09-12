// packages/library-pipeline/src/textbook/stale-signature.test.ts
//
// **낡음 판정이 규칙이 다루는 것을 전부 대조하는지.**
//
// ── 왜 이 회귀가 생겼나 (실측 2026-09-12) ────────────────────────────
// `store-new-types.mjs` 의 `staleSignature` 는 「지금 규칙으로 다시 만들면 다른 것이 나오는가」를
// 판정한다. 그런데 **대조 항목이 규칙보다 좁아서** 같은 사고가 세 번 났다:
//
//   ① 문장만 대조 → **보기 수**가 바뀐 것을 못 잡았다(그 파일 주석에 기록됨).
//   ② 수능 3종만 대조 → `MIDDLE_CHOICES` 를 4→5 로 고쳤을 때 4,135문항이 「낡음 0건」.
//   ③ 밑줄 **낱말**을 안 대조 → 밑줄 고르는 규칙을 고쳤는데 V5 어휘 **4,436문항(42%)** 이
//      「낡음 0건」으로 보고될 상태였다. `sentences` 는 정답 자리 낱말만 바뀌고 `answer` 는
//      우연히 같을 수 있어서다.
//
// 세 번 다 원인이 같다: **판정이 무엇을 보는지 아무도 대조하지 않았다.**
// 그래서 여기서 **스크립트 소스**를 읽어, 생성기가 만들어 내는 축마다 대조가 있는지 본다.
// 스크립트는 `.mjs` 라 타입체크가 안 보므로 이 대조가 유일한 그물이다.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const HERE = dirname(fileURLToPath(import.meta.url))
const STORE = join(HERE, '..', '..', '..', '..', 'scripts', 'textbook', 'store-new-types.mjs')

/** 주석을 지운 소스 — 주석에 옛 코드가 근거로 남아 있어 그대로 찾으면 거짓 통과가 된다. */
const code = readFileSync(STORE, 'utf8')
  .split('\n')
  .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
  .join('\n')

/** `staleSignature` 객체 본문만 잘라 본다 — 파일 다른 곳의 문자열에 속지 않게. */
function signatureBlock(): string {
  const start = code.indexOf('const staleSignature = {')
  expect(start, 'staleSignature 를 못 찾았다 — 이름이 바뀌면 이 회귀가 아무것도 안 지킨다').toBeGreaterThan(-1)
  // 다음 최상위 `}` 까지. 중첩이 얕아 이 정도로 충분하다(깊어지면 검사가 먼저 깨진다).
  const end = code.indexOf('\n}', start)
  expect(end).toBeGreaterThan(start)
  return code.slice(start, end)
}

describe('낡음 판정이 규칙이 다루는 축을 대조한다', () => {
  const block = signatureBlock()

  /**
   * 밑줄을 쓰는 유형은 **밑줄 낱말**까지 대조해야 한다.
   *
   * 개수만 보면 같은 다섯 자리를 다른 낱말에 걸어도 「안 달라졌다」가 된다 —
   * 밑줄 고르는 규칙을 고칠 때 정확히 그 일이 난다.
   */
  const UNDERLINE_TYPES = ['vocab_choice', 'grammar_choice', 'unit_grammar'] as const
  /** 판정에 적힌 유형 전부 — 한 유형의 판정을 **정확히** 잘라내는 데 쓴다. */
  const ALL_TYPES = ['vocab_choice', 'grammar_choice', 'unit_vocab', 'unit_grammar'] as const

  /**
   * 그 유형의 판정만 잘라 온다.
   *
   * ⚠️ **첫 판은 빈 통과였다**(2026-09-12). `||` 로 시작하는 줄을 전부 모아 붙였더니
   *   **다른 유형의 대조가 섞여** 들어와, `vocab_choice` 의 대조를 떼도 검사가 통과했다
   *   (변이 검사로 잡았다). 자를 때는 다음 유형 키 **전부**를 경계로 본다.
   */
  function ownSignature(type: string): string {
    const idx = block.indexOf(`${type}:`)
    expect(idx, `${type} 판정이 없다`).toBeGreaterThan(-1)
    const next = ALL_TYPES.map((t) => block.indexOf(`${t}:`))
      .filter((i) => i > idx)
      .sort((a, b) => a - b)[0]
    return block.slice(idx, next ?? undefined)
  }

  it.each(UNDERLINE_TYPES)('%s 가 밑줄 낱말을 대조한다', (type) => {
    expect(ownSignature(type), `${type} 가 밑줄 낱말을 안 본다`).toContain('underlineWords')
  })

  it('한 유형의 판정을 정확히 자른다 — 다른 유형의 대조가 섞이면 빈 통과가 된다', () => {
    // 자기 이름만 들어 있어야 한다. 섞이면 위 검사가 아무것도 안 지킨다.
    for (const t of ALL_TYPES) {
      const own = ownSignature(t)
      for (const other of ALL_TYPES) {
        if (other === t) continue
        expect(own, `${t} 판정에 ${other} 가 섞였다`).not.toContain(`${other}:`)
      }
    }
  })

  it('밑줄 낱말 대조가 실제로 낱말을 꺼낸다 — 개수만 세면 뜻이 없다', () => {
    const fn = code.slice(code.indexOf('const underlineWords ='))
    expect(fn).toContain('word')
  })

  it('문장과 정답 대조는 그대로 남아 있다 — 더한 것이 뺀 것이 되지 않게', () => {
    expect(block).toContain('payload.sentences')
    expect(block).toContain('answer_key?.position')
  })

  it('보기 수를 쓰는 유형은 보기 수를 대조한다 — 첫 번째 사고가 그것이었다', () => {
    const idx = block.indexOf('unit_vocab:')
    expect(idx).toBeGreaterThan(-1)
    expect(block.slice(idx)).toContain('choices')
  })
})
