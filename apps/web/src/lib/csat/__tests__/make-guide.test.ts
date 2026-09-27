// apps/web/src/lib/csat/__tests__/make-guide.test.ts
//
// **다섯 갈래 안내가 사용자를 막다른 곳에 두지 않는가.**
//   · 걸음이 가리키는 화면이 실제로 있다(없는 화면을 가리키면 거기서 멈춘다).
//   · 지시문에 폼 값이 그대로 들어가고, 절차의 안전장치(빈 계단 · 재고 먼저 · --only 커밋)가 빠지지 않는다.
//   · 칸이 비면 복사를 막는다 — 빈 지시문을 붙여 넣으면 Claude 가 근거 없이 시리즈를 만든다.

import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

import { MAKE_CASES, buildPrompt, missingFields, type SeriesForm } from '../make-guide'
import { claudeAsk, claudeAskGate, contentsCommand, renderCommand, type OrderVolume } from '../order-model'

const APP = resolve(__dirname, '..', '..', '..', 'app')

const FULL: SeriesForm = {
  name: 'Vocaflow Grammar',
  short: 'GRAMMAR',
  kind: 'grammar',
  accent: '#2F6FB5',
  question: '문장의 규칙을 스스로 고치는가',
  trigger: 'competition',
  evidence: '시중 22종 중 문법 4종',
  measuredOn: '2026-09-24',
  grades: ['고1', '고2'],
}

describe('걸음이 가리키는 화면', () => {
  it('모든 「여는 화면」이 실제 라우트다', () => {
    for (const c of MAKE_CASES) {
      for (const s of c.steps) {
        if (!s.where) continue
        const path = s.where.href.split(/[?#]/)[0]!
        expect(existsSync(join(APP, ...path.split('/').filter(Boolean), 'page.tsx')), `${c.letter} ${s.title} → ${path}`).toBe(true)
      }
    }
  })

  it('다섯 갈래가 모두 있고, 사람이 정하는 걸음이 표시된다', () => {
    expect(MAKE_CASES.map((c) => c.letter)).toEqual(['A', 'B', 'C', 'D', 'E'])
    for (const c of MAKE_CASES) expect(c.steps.some((s) => s.decides), c.name).toBe(true)
  })

  it('코드 정의가 필요한 갈래(C·D·E)는 Claude 지시문 걸음을 갖는다 — 「코드에 있다」로 끝나지 않는다', () => {
    for (const key of ['series', 'brand', 'single'] as const) {
      const c = MAKE_CASES.find((m) => m.key === key)!
      expect(c.steps.some((s) => s.claude), c.name).toBe(true)
    }
  })

  it('A·B 는 발행 승인에서 끝난다 — 사람 결재 없이 끝나는 길이 없다', () => {
    for (const key of ['volume', 'revise'] as const) {
      const last = MAKE_CASES.find((m) => m.key === key)!.steps.at(-1)!
      expect(last.where?.href).toBe('/admin/csat/press')
      expect(last.decides).toBe(true)
    }
  })
})

describe('Claude Code 지시문', () => {
  it('새 시리즈 — 폼 값이 들어가고 계단은 비운다', () => {
    const p = buildPrompt('defineSeries', FULL)
    for (const v of [FULL.name, FULL.question, FULL.evidence, FULL.measuredOn, 'competition', FULL.accent]) expect(p).toContain(v)
    expect(p).toContain('rungs 는 **비워 둬**')
    expect(p).toContain('git commit --only')
  })

  it('계단 설계 — 재고를 먼저 재고 모자란 학년은 넣지 않는다', () => {
    const p = buildPrompt('designLadder', FULL)
    expect(p).toContain('고1 · 고2')
    expect(p).toContain('**넣기 전에**')
    expect(p).toContain('**넣지 말고**')
  })

  it('단행본 — 한 칸 · 몫이 안 되면 등록하지 않는다', () => {
    const p = buildPrompt('defineSingle', { ...FULL, grades: ['고1'] })
    expect(p).toContain('학년: 고1')
    expect(p).toContain('**등록하지 말고**')
  })

  it('이름 바꾸기 — 다시 묶을 권 목록을 실측으로 받는다', () => {
    const p = buildPrompt('renameBrand', { seriesId: 'reading', oldName: 'Vocaflow Reading', newName: 'Vocaflow Read' })
    expect(p).toContain('「Vocaflow Read」')
    expect(p).toContain('textbook_volume_renders')
  })

  it('칸이 비면 무엇이 비었는지 말한다 — 빈 지시문을 복사하게 두지 않는다', () => {
    const empty = { ...FULL, name: '', evidence: '', measuredOn: '24/09/2026', grades: [] }
    expect(missingFields('defineSeries', empty)).toEqual(['이름', '그때 본 숫자', '잰 날(YYYY-MM-DD)'])
    expect(missingFields('designLadder', empty)).toContain('넣을 학년')
    expect(missingFields('defineSingle', FULL)).toContain('학년 하나')
    expect(missingFields('defineSeries', FULL)).toEqual([])
    expect(missingFields('renameBrand', { seriesId: '', oldName: '', newName: ' ' })).toEqual(['바꿀 시리즈', '새 이름'])
  })
})

describe('발주 — 실행 줄과 맡기기', () => {
  const v = { seriesId: 'vocab', step: 5, title: 'Vocaflow Vocab 5' } as OrderVolume

  it('묶기와 목차 굽기가 같은 권 · 같은 단원 수를 겨냥한다', () => {
    expect(renderCommand(v, 12)).toContain('--series vocab --band 5 --units 12')
    expect(contentsCommand(v, 12)).toContain('--series vocab --bands 5 --units 12')
  })

  it('맡기기 지시문은 명령을 그대로 싣고 무엇을 알려 달라는지 적는다', () => {
    const cmd = renderCommand(v, 10)
    const a = claudeAsk(cmd, '묶는다')
    expect(a).toContain(cmd)
    expect(a).toContain('끝나면 알려 줘')
  })

  it('관문 통째 맡기기는 줄 순서를 지키고 --commit 을 앞 줄 확인 뒤로 미룬다', () => {
    const g = claudeAskGate('Vocaflow Vocab 5', '해설이 60개 있나', [
      { cmd: 'a-export', why: '뽑는다' },
      { cmd: '청크를 채운다', why: '쓴다', claudeCode: true },
      { cmd: 'a-import --commit', why: '넣는다' },
    ])
    expect(g.indexOf('a-export')).toBeLessThan(g.indexOf('청크를 채운다'))
    expect(g.indexOf('청크를 채운다')).toBeLessThan(g.indexOf('a-import --commit'))
    expect(g).toContain('--commit 이 붙은 줄은 앞 줄 결과를 확인한 뒤에만')
  })
})
