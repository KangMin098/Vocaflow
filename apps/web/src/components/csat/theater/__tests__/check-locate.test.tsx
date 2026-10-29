// apps/web/src/components/csat/theater/__tests__/check-locate.test.tsx
//
// 이해 확인 — 고른 근거 번호를 지도 위치로 확인(U02-MAP-01).
// 학습자가 「선택한 N번 문장 지도에서 보기」를 눌렀을 때만 비춘다 · 지도 문장 수가 과제와 다르거나 범위 밖이면 비추지 않는다 ·
// 문장 수가 같아도 문항 · 판본 · 단위 해시 · 지도 분할이 바뀌면 지난 강조를 무효로 한다 · v3 근거 연결(v3Linkable)과 무관하다 ·
// 기록(onRecord)은 건드리지 않는다 · 누른 문장을 근거 판의 보이는 자리로 옮긴다.
// 클릭 흐름(고르기 → 보기 → 재선택 · 답 보기 · 스크롤)은 이 저장소의 node 테스트 환경에서 돌릴 수 없어 PC 하네스(pdu-*)가 본다.
import fs from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import type { UnderstandingCheck } from '@/lib/csat/understanding-check'

import {
  checkLocateBinding,
  checkLocateFocus,
  checkLocateKey,
  isCheckLocateKey,
  resolveCheckLocate,
  UnderstandingChecks,
} from '../UnderstandingChecks'

const EVIDENCE: UnderstandingCheck = { kind: 'evidence', sentenceCount: 5, correct: [1, 3] }
const noop = () => {}
const SENT = [{ chars: 60 }, { chars: 85 }, { chars: 110 }, { chars: 135 }, { chars: 160 }]
const BASE = { itemId: '2026#22', analysisVersion: 3, unitsHash: 'u-abc', sentences: SENT }
const B = checkLocateBinding(BASE)

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

describe('checkLocateBinding — 문항 · 판본 · 단위 해시 · 분할 결속', () => {
  it('같은 입력은 같은 값', () => {
    expect(checkLocateBinding({ ...BASE, sentences: SENT.map((s) => ({ ...s })) })).toBe(B)
  })

  it('넷 중 하나만 바뀌어도 다른 값(문장 수는 그대로)', () => {
    const others = [
      checkLocateBinding({ ...BASE, itemId: '2026#23' }),
      checkLocateBinding({ ...BASE, analysisVersion: 4 }),
      checkLocateBinding({ ...BASE, analysisVersion: null }),
      checkLocateBinding({ ...BASE, unitsHash: 'u-xyz' }),
      checkLocateBinding({ ...BASE, unitsHash: null }),
      checkLocateBinding({ ...BASE, sentences: [{ chars: 85 }, { chars: 60 }, { chars: 110 }, { chars: 135 }, { chars: 160 }] }),
    ]
    for (const o of others) expect(o).not.toBe(B)
    expect(new Set(others).size).toBe(others.length)
  })
})

describe('checkLocateFocus — 근거 상태 → 지도 강조(0-기반)', () => {
  it('위치 확인 키는 1-기반 문장을 0-기반으로 돌려 비춘다', () => {
    expect(checkLocateFocus({ sentences: [1], key: checkLocateKey(5, B) }, 5, B)).toEqual([0])
    expect(checkLocateFocus({ sentences: [5], key: checkLocateKey(5, B) }, 5, B)).toEqual([4])
  })

  it('문장 수는 같고 판본 · 분할 · 문항만 다르면 강조 0', () => {
    const ev = { sentences: [2], key: checkLocateKey(5, B) }
    expect(checkLocateFocus(ev, 5, checkLocateBinding({ ...BASE, analysisVersion: 4 }))).toBeNull()
    expect(checkLocateFocus(ev, 5, checkLocateBinding({ ...BASE, unitsHash: 'u-xyz' }))).toBeNull()
    expect(checkLocateFocus(ev, 5, checkLocateBinding({ ...BASE, sentences: [...SENT].reverse() }))).toBeNull()
    expect(checkLocateFocus(ev, 5, checkLocateBinding({ ...BASE, itemId: '2026#23' }))).toBeNull()
    expect(checkLocateFocus(ev, 5, null)).toBeNull()
  })

  it('지도 문장 수가 달라지거나 범위 밖이면(기억에서 되살아난 값 포함) 비추지 않는다', () => {
    expect(checkLocateFocus({ sentences: [2], key: checkLocateKey(5, B) }, 6, B)).toBeNull()
    expect(checkLocateFocus({ sentences: [2], key: checkLocateKey(5, B) }, null, B)).toBeNull()
    expect(checkLocateFocus({ sentences: [6], key: checkLocateKey(5, B) }, 5, B)).toBeNull()
  })

  it('다른 근거(v3 · 노트 · 비교 쌍) · 옛 형식(결속값 없음) · 형식 오류는 위치 확인으로 읽지 않는다', () => {
    expect(checkLocateFocus({ sentences: [2], key: 'note-evidence' }, 5, B)).toBeNull()
    expect(checkLocateFocus({ sentences: [2], key: 'check-locate:5' }, 5, B)).toBeNull()
    expect(checkLocateFocus({ sentences: [2], key: `check-locate:5:${B}:x` }, 5, B)).toBeNull()
    expect(checkLocateFocus({ sentences: [2, 3], key: checkLocateKey(5, B) }, 5, B)).toBeNull()
    expect(checkLocateFocus({ sentences: [2], key: `check-locate:x:${B}` }, 5, B)).toBeNull()
    expect(checkLocateFocus(null, 5, B)).toBeNull()
    expect(isCheckLocateKey(checkLocateKey(3, B))).toBe(true)
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

describe('AnalysisTheater 결속 — 명시적 callback · 판본 결속 · 스크롤 · v3Linkable 비의존', () => {
  const src = fs.readFileSync(path.join(__dirname, '../AnalysisTheater.tsx'), 'utf8')
  const at = (marker: string, n = 700) => src.slice(src.indexOf(marker), src.indexOf(marker) + n)

  it('지도가 있을 때만 onLocate 를 넘긴다', () => {
    expect(src).toContain('onLocate={map ? locateCheck : undefined} locateBinding={locateBinding}')
  })

  it('결속값은 문항 id · 분석 판본 · 단위 해시 · 지도 문장으로 만들고, 강조는 그 결속값과 대조한다', () => {
    expect(at('const locateBinding')).toContain('checkLocateBinding({ itemId, analysisVersion: inquiry?.analysis_version ?? analysisVersion, unitsHash: sourceUnitsHash, sentences: map.sentences })')
    expect(src).toContain('const checkFocus = checkLocateFocus(evidence, map ? map.sentences.length : null, locateBinding)')
  })

  it('위치 확인은 감춘 지도 · 지도 없음에서 비추지 않고, 지도 문장 수로 검증하며, 관계 보기 · 접힌 판을 지도로 되돌린다', () => {
    const body = at('const locateCheck')
    expect(body).toContain('if (withheld || !map || !locateBinding) return false')
    expect(body).toContain('resolveCheckLocate(map.sentences.length, sentenceCount, sentence)')
    expect(body).toContain('checkLocateKey(sentenceCount, locateBinding)')
    expect(body).toContain('setEvidenceCollapsed(false)')
    expect(body).toContain("setEvidenceView('map')")
    expect(body.slice(0, body.indexOf('return true'))).not.toMatch(/v3Linkable|recordCheck|onRecord/)
  })

  it('누른 뒤 그 문장을 근거 판 보이는 자리로 — block nearest · reduced-motion 이면 smooth 아님', () => {
    const eff = at('const locateScroll', 900)
    expect(eff).toContain('anchor:sentence:${k}')
    expect(eff).toContain("block: 'nearest'")
    expect(eff).toContain("(prefers-reduced-motion: reduce)")
    expect(eff).toContain("behavior: reduce ? 'auto' : 'smooth'")
  })

  it('지도 강조는 위치 확인이 먼저이고, 위치 확인 키는 v3 근거로 비추지 않는다', () => {
    expect(src).toContain('const mapFocus = checkFocus ??')
    expect(src).toContain('const v3Evidence = evidence && !isCheckLocateKey(evidence.key) ? evidence : null')
  })

  it('스크롤은 명시적 클릭(locateCheck 의 tick)으로만 — 선택 · 렌더 · 강의 초점 변화에는 걸리지 않는다', () => {
    expect(src).toMatch(/li\.scrollIntoView\(\{ block: 'nearest', behavior: reduce \? 'auto' : 'smooth' \}\)\n {2}\}, \[locateTick\]\)/)
    expect(src.match(/setLocateTick\(/g)?.length).toBe(1)
    expect(at('const locateCheck')).toContain('setLocateTick((t) => t + 1)')
  })
})

describe('UnderstandingChecks 결속 — 판본 · 분할이 바뀌면 고른 번호 · 안내를 지운다(재리뷰 P2)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../UnderstandingChecks.tsx'), 'utf8')

  it('고른 번호는 고른 때의 결속값과 함께 저장하고, 지금 결속값과 같을 때만 쓴다', () => {
    expect(src).toContain('const current = pickState && pickState.binding === locateBinding ? pickState : null')
    expect(src).toContain("if (typeof v === 'number') setPickState({ k: v, binding: locateBinding, located: null })")
  })

  it('시도 수 · 틀린 번호 · 결과 상태는 결속값과 분리돼 그대로다(기록 · 채점 불변)', () => {
    expect(src).toContain('const [tries, setTries] = useState(0)')
    expect(src).toContain('const [wrong, setWrong] = useState<(number | string)[]>([])')
    expect(src).not.toMatch(/key=\{[^}]*locateBinding/)
  })
})
