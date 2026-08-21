// apps/web/src/lib/textbook/__tests__/promise-guard.test.ts
//
// **화면이 시스템보다 앞서 말하지 않게 한다.**
//
// ── 왜 이 테스트가 있나 (실측 2026-08-22) ────────────────────────────────
// 권 상세가 이렇게 적고 있었다:
//   "이 권의 문항은 오늘의 학습에 섞여 나옵니다. 지금 수준에 맞는 단원부터 자동으로 배정돼요."
// `prescribe_today` 본문을 읽어 보니 셋 다 틀렸다.
//   ① 담은 교재를 보지 않는다 — `user_textbook_selections` 를 읽는 곳이 조회·쓰기 모듈뿐이다.
//   ② '단원' 이라는 단위가 배정에 없다 — stage_band 로 거르고 `md5(id||current_date)` 무작위 5문항.
//   ③ 유형이 `order`·`insert` 로 제한된다 — 문항 5,952개 중 오늘의 학습이 닿는 건 895개(15%).
//      어휘 추론·어법·흐름 무관 2,830개는 이 경로로 한 번도 안 나온다.
//
// 이런 문장은 **틀려도 아무 예외가 안 난다.** 화면은 멀쩡히 뜨고 학습자만 속는다.
// 그래서 코드가 아니라 **문구**를 회귀로 잡는다.
//
// ⚠️ 배정이 실제로 담은 교재를 보게 되면(= 처방 경로가 `user_textbook_selections` 를 읽으면)
//    이 테스트가 먼저 실패한다. 그때 **테스트와 문구를 함께** 갱신할 것.
//    지금 이 파일이 하는 일은 "아직 안 됐다" 를 기억해 두는 것이다.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
const VOLUME_PAGE = path.join(SRC, 'app', '(main)', 'library', 'textbooks', '[step]', 'page.tsx')

/**
 * 주석을 지운다 — 블록 · JSX 블록 · 줄 주석.
 *
 * ⚠️ 첫 판이 줄 앞머리만 보고 걸렀다가 **여러 줄짜리 JSX 주석 안의 문장**을 화면 문구로 세서
 *    스스로 실패했다. 이 파일이 잡으려는 것과 정확히 같은 종류의 실수다 —
 *    "적혀 있다" 와 "학습자가 읽는다" 는 다르다.
 */
function stripComments(src: string): string {
  const JSX_COMMENT = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g
  const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
  const LINE_COMMENT = /^\s*\/\/.*$/gm
  return src.replace(JSX_COMMENT, '').replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '')
}

/** 담은 교재를 **코드에서** 읽는 모듈. 저장소를 소유한 두 모듈은 당연하므로 뺀다. */
function modulesReadingSelections(): string[] {
  const OWNERS = ['lib/textbook/my-shelf-query', 'lib/textbook/my-shelf-actions']
  const out: string[] = []

  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name)
      if (statSync(full).isDirectory()) {
        if (name === 'node_modules' || name === '__tests__') continue
        walk(full)
        continue
      }
      if (!/\.tsx?$/.test(name)) continue

      const rel = path.relative(SRC, full).replace(/\\/g, '/')
      if (OWNERS.some((o) => rel.startsWith(o))) continue

      // 주석에 이름만 적힌 것은 읽는 것이 아니다 — 권 상세는 왜 문구를 고쳤는지
      // 설명하느라 표 이름을 주석에 적고 있다.
      if (stripComments(readFileSync(full, 'utf8')).includes('user_textbook_selections')) {
        out.push(rel)
      }
    }
  }

  walk(SRC)
  return out
}

describe('담기가 오늘의 학습을 바꾸는가 — 아직 아니다', () => {
  it('처방 경로가 담은 교재를 읽지 않는다는 사실이 유지된다', () => {
    expect(
      modulesReadingSelections(),
      '담은 교재를 읽는 곳이 생겼다 — 권 상세의 "담기가 오늘의 학습을 바꾸지는 않습니다" 문구를 갱신할 것',
    ).toEqual([])
  })

  it('권 상세가 지키지 못할 약속을 하지 않는다', () => {
    const rendered = stripComments(readFileSync(VOLUME_PAGE, 'utf8'))
    for (const claim of ['자동으로 배정', '섞여 나옵니다']) {
      expect(
        rendered.includes(claim),
        `지켜지지 않는 약속이 화면에 있다: "${claim}" — prescribe_today 는 담은 교재를 보지 않는다`,
      ).toBe(false)
    }
  })

  it('대신 지금 참인 것을 말한다', () => {
    const rendered = stripComments(readFileSync(VOLUME_PAGE, 'utf8'))
    expect(rendered).toContain('담기가 오늘의 학습을 바꾸지는')
  })
})

describe('숫자를 손으로 적지 않는다', () => {
  // 권 상세의 "약 N시간" 은 한동안 `3` 을 손으로 적어 계산했고, 주석은 라이브러리 상수를
  // 가리켰다. 확인해 보니 그 패키지 안에 같은 이름의 상수가 **둘**이고 값이 다르다
  // (assemble-unit 2분 · compose-unit 3분). 손으로 적은 숫자는 어느 쪽과도 묶여 있지 않았다.
  it('권 상세가 소요 시간 상수를 import 한다', () => {
    const src = readFileSync(VOLUME_PAGE, 'utf8')
    expect(src, '소요 시간 상수를 import 하지 않는다').toContain('MINUTES_PER_ITEM')
    expect(src, '단원 구성 상수를 import 하지 않는다').toContain('DEFAULT_SLOTS')
  })

  it('두 모델이 다르므로 단일 숫자로 인쇄하지 않는다 — 범위로 말한다', () => {
    const rendered = stripComments(readFileSync(VOLUME_PAGE, 'utf8'))
    expect(rendered, '시간을 범위가 아니라 한 숫자로 적고 있다').toContain('~')
    expect(rendered).toContain('COMPOSE_MINUTES_PER_ITEM')
  })
})
