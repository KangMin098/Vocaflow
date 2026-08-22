// apps/web/src/lib/textbook/__tests__/promise-guard.test.ts
//
// **화면이 시스템보다 앞서 말하지 않게 한다 — 그리고 뒤처지지도 않게 한다.**
//
// ── 왜 이 테스트가 있나 (실측 2026-08-22) ────────────────────────────────
// 권 상세가 "이 권의 문항은 오늘의 학습에 섞여 나옵니다. 지금 수준에 맞는 단원부터
// 자동으로 배정돼요" 라고 적고 있었는데 `prescribe_today` 는 담은 교재를 보지 않았다.
// 이런 문장은 **틀려도 아무 예외가 안 난다.** 화면은 멀쩡히 뜨고 학습자만 속는다.
//
// ⚠️ **첫 판은 잘못된 것을 봤다.** "어떤 모듈이 `user_textbook_selections` 라는 **문자열**을
//    담고 있나" 를 셌는데, 배선이 실제로 붙었을 때 처방 모듈은 그 표를 직접 읽지 않고
//    `fetchMyTextbooks()` 를 통해 읽었다 — 그래서 **가드가 초록인 채로 통과했다.**
//    문자열이 아니라 **계약**을 봐야 한다: 처방 호출이 담은 교재를 넘기는가.
//
// 지금은 양방향이다. 배선이 없으면 "바꾸지 않는다" 라고 적어야 하고,
// 배선이 있으면 그 말이 남아 있으면 안 된다.

import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = path.resolve(__dirname, '../../..')
const VOLUME_PAGE = path.join(SRC, 'app', '(main)', 'library', 'textbooks', '[step]', 'page.tsx')
const DCP_ACTIONS = path.join(SRC, 'lib', 'learner', 'dcp-actions.ts')

/**
 * 주석을 지운다 — 블록 · JSX 블록 · 줄 주석.
 *
 * ⚠️ 이것도 첫 판이 틀렸다. 줄 앞머리만 보고 걸렀다가 **여러 줄짜리 JSX 주석 안의 문장**을
 *    화면 문구로 세서 스스로 실패했다. "적혀 있다" 와 "학습자가 읽는다" 는 다르다.
 */
function stripComments(src: string): string {
  const JSX_COMMENT = /\{\s*\/\*[\s\S]*?\*\/\s*\}/g
  const BLOCK_COMMENT = /\/\*[\s\S]*?\*\//g
  const LINE_COMMENT = /^\s*\/\/.*$/gm
  return src.replace(JSX_COMMENT, '').replace(BLOCK_COMMENT, '').replace(LINE_COMMENT, '')
}

/**
 * 처방이 담은 교재를 **실제로** 받는가.
 *
 * 판정 근거는 하나뿐이다 — `prescribe_today` 호출에 `p_v_levels` 를 넘기는가.
 * 그것이 이 약속의 기계적 정의다(사다리는 호출부가 풀고, SQL 은 레벨만 안다).
 */
function prescriptionReadsTextbooks(): boolean {
  const src = stripComments(readFileSync(DCP_ACTIONS, 'utf8'))
  return src.includes('prescribe_today') && src.includes('p_v_levels')
}

const WIRED = prescriptionReadsTextbooks()

describe('담기와 오늘의 학습 — 화면과 시스템이 같은 말을 한다', () => {
  it('처방 배선 여부를 기계로 판정할 수 있다', () => {
    // 이 단언이 깨지면 판정 자체가 낡은 것이다(호출 방식이 바뀌었다는 뜻).
    const src = stripComments(readFileSync(DCP_ACTIONS, 'utf8'))
    expect(src, '처방 호출부를 못 찾았다 — 이 가드가 아무것도 안 지키고 있다').toContain(
      'prescribe_today',
    )
  })

  it('배선이 있으면 "바꾸지 않는다" 가 화면에 남아 있지 않다', () => {
    if (!WIRED) return
    const rendered = stripComments(readFileSync(VOLUME_PAGE, 'utf8'))
    expect(
      rendered.includes('담기가 오늘의 학습을 바꾸지는'),
      '처방이 담은 교재를 읽는데 화면은 아직 "바꾸지 않는다" 라고 말한다 — 이제 뒤처진 쪽은 화면이다',
    ).toBe(false)
  })

  it('배선이 없으면 자동 배정을 약속하지 않는다', () => {
    if (WIRED) return
    const rendered = stripComments(readFileSync(VOLUME_PAGE, 'utf8'))
    for (const claim of ['자동으로 배정', '섞여 나옵니다']) {
      expect(
        rendered.includes(claim),
        `지켜지지 않는 약속이 화면에 있다: "${claim}"`,
      ).toBe(false)
    }
  })

  it('배선이 있으면 화면이 그 사실을 말한다', () => {
    if (!WIRED) return
    const rendered = stripComments(readFileSync(VOLUME_PAGE, 'utf8'))
    expect(
      rendered.includes('오늘의 학습'),
      '담기가 오늘의 학습을 바꾸는데 화면이 그 말을 안 한다 — 보이지 않는 기능이 된다',
    ).toBe(true)
  })

  it('담기가 오늘 할 것을 **줄이지는** 않는다는 계약이 적혀 있다', () => {
    // 담은 교재로 5문항을 못 채우면 예전 방식으로 채운다. 이 폴백이 사라지면
    // 교재를 담았다는 이유로 오늘 할 것이 줄어들고, 담기는 벌이 된다.
    const sql = readFileSync(
      path.resolve(SRC, '../../../supabase/migrations/20260822110000_prescribe_today_textbook_steer.sql'),
      'utf8',
    )
    expect(sql).toContain('NOT v_steered')
  })
})
