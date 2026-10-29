// apps/web/src/components/csat/theater/__tests__/check-locate.test.tsx
//
// 이해 확인 — 고른 근거 번호를 지도 위치로 확인(U02-MAP-01).
// 학습자가 「선택한 N번 문장 지도에서 보기」를 눌렀을 때만 비춘다 · 지도 문장 수가 과제와 다르거나 범위 밖이면 비추지 않는다 ·
// v3 근거 연결(v3Linkable)과 무관하다 · 기록(onRecord)은 건드리지 않는다.
// 클릭 흐름(고르기 → 보기 → 재선택 · 답 보기)은 이 저장소의 node 테스트 환경에서 돌릴 수 없어 PC 하네스(pd-u02-*)가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { UnderstandingCheck } from '@/lib/csat/understanding-check'

import { checkLocateFocus, checkLocateKey, isCheckLocateKey, resolveCheckLocate, UnderstandingChecks } from '../UnderstandingChecks'

const EVIDENCE: UnderstandingCheck = { kind: 'evidence', sentenceCount: 5, correct: [1, 3] }
const noop = () => {}

describe('resolveCheckLocate — 0/1 기반 · 범위 · 문장 수', () => {
  it('첫 문장(0)과 끝 문장(n-1)은 그대로, 범위 밖은 null', () => {
    expect(resolveCheckLocate(5, 5, 0)).toBe(0)
    expect(resolveCheckLocate(5, 5, 4)).toBe(4)
    expect(resolveCheckLocate(5, 5, 5)).toBeNull()
    expect(resolveCheckLocate(5, 5, -1)).toBeNull()
    expect(resolveCheckLocate(5, 5, 1.5)).toBeNull()
  })

  it('지도 없음 · 문장 수 불일치는 null', () => {
    expect(resolveCheckLocate(null, 5, 2)).toBeNull()
    expect(resolveCheckLocate(6, 5, 2)).toBeNull()
    expect(resolveCheckLocate(4, 5, 2)).toBeNull()
  })
})

describe('checkLocateFocus — 근거 상태 → 지도 강조(0-기반)', () => {
  it('위치 확인 키는 1-기반 문장을 0-기반으로 돌려 비춘다', () => {
    expect(checkLocateFocus({ sentences: [1], key: checkLocateKey(5) }, 5)).toEqual([0])
    expect(checkLocateFocus({ sentences: [5], key: checkLocateKey(5) }, 5)).toEqual([4])
  })

  it('문항 · 판본이 바뀌어 지도 문장 수가 달라지면(기억에서 되살아난 값 포함) 비추지 않는다', () => {
    expect(checkLocateFocus({ sentences: [2], key: checkLocateKey(5) }, 6)).toBeNull()
    expect(checkLocateFocus({ sentences: [2], key: checkLocateKey(5) }, null)).toBeNull()
    expect(checkLocateFocus({ sentences: [6], key: checkLocateKey(5) }, 5)).toBeNull()
  })

  it('다른 근거(v3 · 노트 · 비교 쌍)와 형식이 어긋난 값은 위치 확인으로 읽지 않는다', () => {
    expect(checkLocateFocus({ sentences: [2], key: 'note-evidence' }, 5)).toBeNull()
    expect(checkLocateFocus({ sentences: [2, 3], key: checkLocateKey(5) }, 5)).toBeNull()
    expect(checkLocateFocus({ sentences: [2], key: 'check-locate:x' }, 5)).toBeNull()
    expect(checkLocateFocus(null, 5)).toBeNull()
    expect(isCheckLocateKey(checkLocateKey(3))).toBe(true)
    expect(isCheckLocateKey('pair-1')).toBe(false)
  })
})

describe('UnderstandingChecks — 위치 확인 단추는 고른 뒤에만', () => {
  it('처음 화면(아직 안 고름)에는 지도 보기 단추가 없다 — 고르는 것만으로 지도를 움직이지 않는다', () => {
    const html = renderToStaticMarkup(<UnderstandingChecks itemId="2026#22" checks={[EVIDENCE]} saved={[]} onRecord={noop} onLocate={() => true} />)
    expect(html).not.toContain('지도에서 보기')
    expect(html).not.toContain('data-testid="check-locate"')
  })

  it('지난 결과로 열린 화면에도(이번에 고른 번호가 없음) 단추가 없다', () => {
    const html = renderToStaticMarkup(
      <UnderstandingChecks
        itemId="2026#22"
        checks={[EVIDENCE]}
        saved={[{ id: 'a', item: '2026#22', kind: 'evidence', correct: true, tries: 1, revealed: false, at: 1, afterExplanation: true }]}
        onRecord={noop}
        onLocate={() => true}
      />,
    )
    expect(html).toContain('맞아요')
    expect(html).not.toContain('data-testid="check-locate"')
  })
})

describe('AnalysisTheater 결속 — 명시적 callback · v3Linkable 비의존', () => {
  const src = fs.readFileSync(path.join(__dirname, '../AnalysisTheater.tsx'), 'utf8')

  it('지도가 있을 때만 onLocate 를 넘긴다', () => {
    expect(src).toContain('onLocate={map ? locateCheck : undefined}')
  })

  it('위치 확인은 감춘 지도 · 지도 없음에서 비추지 않고, 지도 문장 수로 검증하며, 관계 보기 · 접힌 판을 지도로 되돌린다', () => {
    const body = src.slice(src.indexOf('const locateCheck'), src.indexOf('const locateCheck') + 600)
    expect(body).toContain('if (withheld || !map) return false')
    expect(body).toContain('resolveCheckLocate(map.sentences.length, sentenceCount, sentence)')
    expect(body).toContain('setEvidenceCollapsed(false)')
    expect(body).toContain("setEvidenceView('map')")
    expect(body).not.toContain('v3Linkable')
    expect(body).not.toMatch(/recordCheck|onRecord/)
  })

  it('지도 강조는 위치 확인이 먼저이고, 위치 확인 키는 v3 근거로 비추지 않는다', () => {
    expect(src).toContain('const mapFocus = checkFocus ??')
    expect(src).toContain('const v3Evidence = evidence && !isCheckLocateKey(evidence.key) ? evidence : null')
  })
})
