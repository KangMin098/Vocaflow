// apps/web/src/app/admin/csat/__tests__/sources-inventory.test.tsx
//
// **재설계하다 정보가 빠지는 것을 막는다.**
//
// ── 왜 (2026-09-15) ─────────────────────────────────────────────────
// 「원문 적격」 화면을 읽기 좋게 다시 짜는 작업을 하면서, 요구가 하나 붙었다 —
// **기존 수치·명령어·문구가 하나도 빠지면 안 된다.** 눈으로 대조하면 반드시 놓친다:
// 재설계 전 화면에는 명령/식별자 17개 · 절 제목 11개 · 표 헤더 35개가 있었다.
//
// 그래서 재설계 **전에** 그 목록을 파일로 찍어 두고(`sources-inventory-baseline.json`),
// 지금 화면이 그것을 전부 들고 있는지 본다. 사라지면 여기서 걸린다.
//
// ⚠️ **이름이 바뀌는 것은 정보가 빠진 것이 아니다.** 절 제목을 고쳐 부르는 것은 재설계의
//   일부라 `HEADING_RENAMES` 로 옛 이름 → 새 이름을 적어 통과시킨다. 다만 **적어야**
//   통과한다 — 조용히 사라지는 길은 없다.
//
// ⚠️ 숫자는 검사하지 않는다. 스냅샷을 다시 재면 바뀌는 값이라 고정하면 거짓 실패가 된다.
//   대신 **명령어**(관리자가 복사해 돌리는 것)와 **표 헤더**(데이터 열)를 잠근다 —
//   그 둘이 남아 있으면 그 수치를 낼 자리도 남아 있다.

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { buildSourceEligibilityPanel } from '@/lib/textbook/source-eligibility-view'
import { buildSourceInventoryPanel } from '@/lib/textbook/source-inventory-view'

import { SourceEligibilityClient } from '../sources/SourceEligibilityClient'

interface Baseline {
  capturedAt: string
  codes: string[]
  headings: string[]
  tableHeaders: string[]
}

const baseline: Baseline = JSON.parse(
  readFileSync(resolve(__dirname, 'sources-inventory-baseline.json'), 'utf8'),
)

const html = renderToString(<SourceEligibilityClient panel={buildSourceEligibilityPanel()} inventory={buildSourceInventoryPanel()} />)
/** 태그를 걷어낸 화면 텍스트 — 어디에 있든 「있다」로 센다(배치는 재설계의 자유다). */
const text = html
  .replace(/<[^>]*>/g, ' ')
  .replace(/&[a-z#0-9]+;/g, ' ')
  .replace(/\s+/g, ' ')

/**
 * 절 제목을 고쳐 부른 것 — **옛 이름 → 지금 화면에 있어야 할 문자열**.
 * 비어 있으면 이름을 하나도 안 바꿨다는 뜻이다.
 */
const HEADING_RENAMES: Record<string, string> = {}

const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('원문 적격 — 재설계해도 정보가 빠지지 않는다', () => {
  it('기준선을 실제로 읽었다', () => {
    // 빈 기준선과 비교하면 **0건 비교로 통과**한다 — 분모부터 본다(§CONVENTIONS).
    expect(baseline.codes.length, '기준선 codes 가 비었다').toBeGreaterThan(10)
    expect(baseline.tableHeaders.length, '기준선 tableHeaders 가 비었다').toBeGreaterThan(20)
    expect(text.length, '화면이 렌더되지 않았다').toBeGreaterThan(1000)
  })

  it('관리자가 돌리는 명령·식별자가 하나도 사라지지 않았다', () => {
    const missing = baseline.codes.filter((c) => !text.includes(norm(c)))
    expect(
      missing,
      `화면에서 사라진 명령/식별자:\n  ${missing.join('\n  ')}\n` +
        '— 재설계로 자리를 옮기는 것은 괜찮지만 없애면 안 된다(복사 버튼 안에 두어도 된다).',
    ).toEqual([])
  })

  it('표의 데이터 열이 하나도 사라지지 않았다', () => {
    const missing = baseline.tableHeaders.filter((h) => !text.includes(norm(h)))
    expect(
      missing,
      `화면에서 사라진 표 헤더:\n  ${missing.join('\n  ')}\n` +
        '— 열을 없애면 그 수치를 낼 자리가 없어진다.',
    ).toEqual([])
  })

  it('절이 사라지지 않았다 — 이름을 바꿨다면 HEADING_RENAMES 에 적혀 있다', () => {
    const missing = baseline.headings.filter((h) => {
      const want = HEADING_RENAMES[h] ?? h
      // 「등급 분포87,626편」처럼 숫자가 붙은 제목은 앞부분만 본다(숫자는 스냅샷마다 바뀐다).
      const head = want.replace(/[\d,]+편?$/, '').trim()
      return !text.includes(head)
    })
    expect(
      missing,
      `화면에서 사라진 절:\n  ${missing.join('\n  ')}\n` +
        '— 이름을 바꾼 것이면 이 파일의 HEADING_RENAMES 에 옛 이름 → 새 이름을 적을 것.',
    ).toEqual([])
  })
})
