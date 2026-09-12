// packages/library-pipeline/src/textbook/barrel-exports.test.ts
//
// **조판기가 배럴에서 꺼내 쓰는 이름이 실제로 배럴에 있는지** 본다.
//
// ⚠️ 왜 이 회귀가 생겼나 (실측 2026-09-06):
//   `brand.ts` 에 활자 7단 스케일을 넣으면서 `volumeMetricsCss` 를 만들었는데
//   **배럴(`index.ts`)에 안 실었다.** 조판기는 `await import('@vocaflow/library-pipeline')` 로
//   꺼내 쓰므로 그 이름이 `undefined` 가 되고, 실행하면
//   `TypeError: volumeMetricsCss is not a function` 으로 **통째로 죽는다.**
//
//   그런데 아무도 몰랐다 — 조판은 `.mjs` 스크립트라 타입체크가 안 보고, 회귀도 없었다.
//   `brand.test.ts` 는 `./brand` 에서 **직접** 가져오므로 배럴 누락을 못 잡는다.
//   그 사이 ⑧ 조판은 "명령을 돌리면 되는 것" 으로 화면에 적혀 있었다.
//
// 그래서 여기서는 **조판기가 실제로 쓰는 목록**을 배럴과 대조한다. 새 함수를 만들고
// 배럴에 안 실으면 이 검사가 먼저 깨진다 — 사람이 스크립트를 돌려 보기 전에.

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import * as barrel from '../index'

const HERE = dirname(fileURLToPath(import.meta.url))
const RENDERER = join(HERE, '..', '..', '..', '..', 'scripts', 'textbook', 'render-volume.mjs')

/**
 * 조판기 소스에서 **배럴 구조분해 목록**을 읽는다. 목록을 여기 손으로 적으면 조판기가
 * 새 이름을 쓰기 시작해도 이 검사가 모른다 — 그러면 같은 사고가 그대로 다시 난다.
 */
function namesDestructuredFromBarrel(src: string): string[] {
  // `const { … } = await import('@vocaflow/library-pipeline')` 블록만 본다.
  const m = src.match(/const\s*\{([\s\S]*?)\}\s*=\s*await\s+import\(\s*['"]@vocaflow\/library-pipeline['"]\s*\)/)
  if (!m) return []
  return m[1]
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, '').trim())
    .filter((l) => l && !l.startsWith('*') && !l.startsWith('/'))
    .flatMap((l) => l.split(','))
    .map((n) => n.split(':')[0].trim())
    .filter((n) => /^[A-Za-z_$][\w$]*$/.test(n))
}

describe('배럴이 조판기가 쓰는 이름을 전부 내보낸다', () => {
  const src = readFileSync(RENDERER, 'utf8')
  const used = namesDestructuredFromBarrel(src)

  it('조판기의 구조분해 목록을 읽어낸다 — 못 읽으면 이 검사는 아무것도 안 지킨다', () => {
    expect(used.length, `render-volume.mjs 에서 배럴 import 를 못 찾았다: ${RENDERER}`).toBeGreaterThan(3)
  })

  it.each(namesDestructuredFromBarrel(readFileSync(RENDERER, 'utf8')))(
    '`%s` 가 배럴에 있다',
    (name) => {
      expect(
        Object.prototype.hasOwnProperty.call(barrel, name),
        `조판기가 \`${name}\` 을 꺼내 쓰는데 배럴에 없다 — 실행하면 "${name} is not a function" 으로 죽는다`,
      ).toBe(true)
    },
  )

  it('꺼낸 것 중 함수로 부르는 이름은 실제로 함수다', () => {
    for (const name of used) {
      // 조판기가 `name(` 꼴로 부르면 함수여야 한다. 상수는 그대로 둔다.
      if (!new RegExp(`\\b${name}\\s*\\(`).test(src)) continue
      expect(typeof (barrel as Record<string, unknown>)[name], `${name} 이 함수가 아니다`).toBe(
        'function',
      )
    }
  })
})
