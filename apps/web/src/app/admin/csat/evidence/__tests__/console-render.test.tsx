// apps/web/src/app/admin/csat/evidence/__tests__/console-render.test.tsx
//
// **기출 원천 판의 약속 셋을 잠근다.**
//
// ① **축을 겹칠 수 있다** — 탭도, 세로로 세운 렌즈 목록도 없다. 행 축·열 축 드롭다운 둘이
//    전부이고, 두 축을 동시에 고를 수 있다. (여기 있던 탭 4장이 같은 802문항을 축 하나씩
//    잘라 놓은 표였고, 그래서 두 축을 겹칠 자리가 구조적으로 없었다.)
// ② **어느 조합에서도 총합이 모집단과 같다** — 피벗이 문항을 흘리거나 두 번 세면 이 화면의
//    모든 숫자가 근거로서의 자격을 잃는다. 8×8 = 64 조합을 전부 돌려 확인한다.
// ③ **막힌 문항이 첫 줄에 있다** — 「채워졌다」와 「쓸 수 있다」는 다르다. 서술은 802/802 가
//    채워져 있지만 그중 다수가 하류 공정으로 못 나간다. 옛 눈금 넉 장은 앞의 사실만 세고
//    뒤의 사실을 한 자리도 세지 않아, 초록 넉 장을 띄운 채 막혀 있었다.
//
// ⚠️ 옛 회귀는 탭 **라벨 문자열**(`'가이드 원천'` 등)의 존재를 단언했다. 그 단언이 지키려던
//    것은 라벨이 아니라 **능력**이다 — 산출물을 꺼낼 수 있는가, 빈 서술을 볼 수 있는가.
//    그래서 단언을 능력 쪽으로 옮겨 적었다(내보내기 링크 · 결함 목록 · 문항 목록).

import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  AXES,
  applyFilter,
  bucketsOf,
  coverageOf,
  keysOf,
  pivot,
  axisContext,
  type AxisContext,
  type EvidenceExam,
  type EvidenceItem,
  type EvidenceType,
} from '@/lib/csat/evidence-fold'

import { EvidenceConsole } from '../EvidenceConsole'

// ── 표본 ────────────────────────────────────────────────────────────────

const EXAMS: EvidenceExam[] = [
  { id: '2026', label: '2026학년도 수능', kind: 'suneung', year: 2026, month: 11, items: 3 },
  { id: 'M2606', label: '2026학년도 6월 모의평가', kind: 'mock', year: 2026, month: 6, items: 1 },
  // **문항이 0인 회차** — 옛 콘솔은 이런 회차를 행째로 잃었다(`csat_coverage()` 가 INNER JOIN).
  { id: 'M2009', label: '2020학년도 9월 모의평가', kind: 'mock', year: 2020, month: 9, items: 0 },
]

const TYPES: EvidenceType[] = [
  { id: 'R-BLANK', name: '빈칸 추론', status: 'active', items: 2, reportN: 3, analystMeta: ['청크'] },
  { id: 'R-ORDER', name: '글의 순서', status: 'active', items: 2, reportN: 2, analystMeta: [] },
]

function item(over: Partial<EvidenceItem> & Pick<EvidenceItem, 'id'>): EvidenceItem {
  return {
    examId: '2026',
    examLabel: '2026학년도 수능',
    year: 2026,
    kind: 'suneung',
    no: 31,
    typeId: 'R-BLANK',
    typeName: '빈칸 추론',
    points: 2,
    highScore: false,
    answer: 3,
    answerCount: 1,
    steps: 5,
    vocab: 4,
    traps: ['어휘 함정'],
    predicted: 0.5,
    timeSec: 110,
    whyLen: 300,
    rejected: 4,
    distractors: 4,
    bodyOk: true,
    quoteLocated: true,
    reviewed3: true,
    defects: [],
    ...over,
  }
}

const ITEMS: EvidenceItem[] = [
  // 깨끗한 것
  item({ id: 'a', no: 31 }),
  // 지문이 잘린 것 + 인용을 못 찾은 것 (실측에서 둘은 늘 함께 온다)
  item({ id: 'b', no: 32, bodyOk: false, quoteLocated: false, defects: ['body', 'quote'] }),
  // 유형 리포트가 오염된 것 — 문항 자체는 멀쩡한데 배포가 막힌다
  item({ id: 'c', no: 33, points: 3, highScore: true, defects: ['reportText'], traps: ['반대 진술', '무관'] }),
  // 다른 회차 · 다른 유형 · 함정 라벨 없음
  item({
    id: 'd',
    examId: 'M2606',
    examLabel: '2026학년도 6월 모의평가',
    year: 2026,
    kind: 'mock',
    no: 37,
    typeId: 'R-ORDER',
    typeName: '글의 순서',
    steps: 6,
    vocab: 5,
    traps: [],
    predicted: 0.85,
    defects: [],
  }),
]

const CTX: AxisContext = axisContext(ITEMS, EXAMS, TYPES)

const PROPS = {
  items: ITEMS,
  exams: EXAMS,
  types: TYPES,
  generatedAt: '2026-09-16 00:00:00Z',
  loadError: null,
  initialFilter: {},
  initialRow: 'defect' as const,
  initialCol: 'type' as const,
  initialMeasure: 'items' as const,
}

const text = (html: string) => html.replace(/<!--[\s\S]*?-->/g, '')

// ── ① 축을 겹칠 수 있다 ─────────────────────────────────────────────────

describe('구조 — 탭이 아니라 축이다', () => {
  it('탭도 세로 렌즈 목록도 없다 — 행·열 축 선택자만 있다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    for (const gone of ['회차 커버리지', '유형별 진행', '문항 분석', '가이드 원천']) {
      expect(html, `탭 「${gone}」이 되돌아왔다 — 축을 겹칠 수 없는 구조로 되돌아간 것이다`).not.toContain(gone)
    }
    expect(html).toContain('<select')
    // 축 여덟이 **행에도 열에도** 올 수 있어야 64 조합이 나온다
    expect(html.match(/<select/g)?.length ?? 0).toBeGreaterThanOrEqual(3)
    for (const a of AXES) expect(html).toContain(a.label)
  })

  it('두 축을 동시에 고른 상태로 열 수 있다 — 링크로 넘기는 근거', () => {
    const html = text(
      renderToString(
        <EvidenceConsole {...PROPS} initialFilter={{ year: ['2026'], type: ['R-BLANK'] }} initialRow="trap" initialCol="year" />,
      ),
    )
    expect(html).toContain('빈칸 추론')
    expect(html).toContain('2026학년도')
  })
})

// ── ② 합산 무결성 ───────────────────────────────────────────────────────

describe('합산 무결성 — 어느 조합에서도 총합이 모집단과 같다', () => {
  it('8 × 8 = 64 조합 전부에서 총합 = 문항 수', () => {
    for (const r of AXES) {
      for (const c of AXES) {
        const p = pivot(ITEMS, r.id, c.id, 'items', CTX)
        expect(p.grand, `${r.id} × ${c.id} 의 총합이 모집단과 다르다`).toBe(ITEMS.length)
      }
    }
  })

  it('단일 축에서는 칸 합도 문항 수와 같다 — 흘리지도 두 번 세지도 않는다', () => {
    for (const r of AXES.filter((a) => !a.multi)) {
      for (const c of AXES.filter((a) => !a.multi)) {
        const p = pivot(ITEMS, r.id, c.id, 'items', CTX)
        expect(p.cellSum, `${r.id} × ${c.id} 에서 문항이 새거나 겹쳤다`).toBe(ITEMS.length)
      }
    }
  })

  it('다중 축(함정·결함)은 칸 합이 더 크고, 그 사실을 화면이 말한다', () => {
    const p = pivot(ITEMS, 'trap', 'type', 'items', CTX)
    expect(p.multi).toBe(true)
    expect(p.cellSum).toBeGreaterThan(p.grand)
    const html = text(renderToString(<EvidenceConsole {...PROPS} initialRow="trap" />))
    expect(html, '칸 합과 총합이 다른데 화면이 총합만 적으면 「합이 안 맞는다」로 읽힌다').toContain('칸 합')
  })

  it('어느 축에서도 칸에 못 들어가는 문항이 없다 — 누락 0', () => {
    for (const a of AXES) {
      const known = new Set(bucketsOf(a.id, CTX).map((b) => b.key))
      for (const it of ITEMS) {
        const keys = keysOf(it, a.id)
        expect(keys.length, `${a.id}: ${it.id} 이(가) 어느 칸에도 안 들어간다`).toBeGreaterThan(0)
        // 목록에 없는 키는 「그 밖」 칸으로 접히므로, 축 자체에 접을 칸이 있어야 한다
        if (!keys.every((k) => known.has(k))) {
          expect(a.multi || known.has('—'), `${a.id}: 접을 칸이 없다`).toBeTruthy()
        }
      }
    }
  })

  it('문항이 0인 회차도 행으로 남는다 — 옛 콘솔은 이것을 잃고 「29/29 완료」라고 적었다', () => {
    const rows = bucketsOf('exam', CTX)
    expect(rows).toHaveLength(EXAMS.length)
    expect(rows.map((r) => r.key)).toContain('M2009')
  })
})

// ── ③ 막힌 문항이 첫 줄에 있다 ──────────────────────────────────────────

describe('커버리지 한 줄 — 「내보내도 되나」에 먼저 답한다', () => {
  it('막힌 문항 수가 첫 줄에 있고 그 수가 결함 문항 수와 맞는다', () => {
    const cov = coverageOf(ITEMS)
    expect(cov.blockedItems).toBe(2)
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    expect(html).toContain('막힌 문항')
    expect(html).toContain('내보낼 수 없다')
  })

  it('결함이 없으면 「내보낼 수 있다」로 뒤집힌다', () => {
    const clean = ITEMS.filter((i) => i.defects.length === 0)
    const html = text(renderToString(<EvidenceConsole {...PROPS} items={clean} />))
    expect(html).toContain('내보낼 수 있다')
    expect(html).not.toContain('내보낼 수 없다')
  })

  it('카드형 눈금을 되돌리지 않는다 — 옛 넉 장은 전부 「이상 없음」만 말했다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    for (const gone of ['검수 기록', '정답 미상', '표시 중']) {
      expect(html, `옛 눈금 「${gone}」이 되돌아왔다`).not.toContain(gone)
    }
  })

  it('결함마다 **막는 하류 공정**을 함께 적는다 — 왜 고쳐야 하는지가 거기 있다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    expect(html).toContain('지문 잘림')
    expect(html).toContain('④소재')
    expect(html).toContain('학습자 배포')
  })
})

// ── 필터 ────────────────────────────────────────────────────────────────

describe('교차 필터 — 한 축에서 건 조건이 다른 축에 남는다', () => {
  it('축끼리는 AND, 같은 축 안은 OR', () => {
    expect(applyFilter(ITEMS, { type: ['R-BLANK'] }, CTX)).toHaveLength(3)
    expect(applyFilter(ITEMS, { type: ['R-BLANK', 'R-ORDER'] }, CTX)).toHaveLength(4)
    expect(applyFilter(ITEMS, { type: ['R-BLANK'], defect: ['body'] }, CTX)).toHaveLength(1)
    expect(applyFilter(ITEMS, { type: ['R-ORDER'], defect: ['body'] }, CTX)).toHaveLength(0)
  })

  it('결함 없음 칸으로도 거를 수 있다', () => {
    expect(applyFilter(ITEMS, { defect: ['__clean__'] }, CTX)).toHaveLength(2)
  })
})

// ── 빈 상태 · 실패 ──────────────────────────────────────────────────────

describe('빈 상태와 실패를 삼키지 않는다', () => {
  it('문항이 하나도 없어도 그려지고 다음에 할 일을 말한다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} items={[]} exams={[]} types={[]} />))
    expect(html).toContain('기출 원천')
    expect(html).toContain('문항이 없다')
  })

  it('불러오기 실패를 그대로 적는다', () => {
    const html = renderToString(<EvidenceConsole {...PROPS} loadError="csat_items: not found" />)
    expect(html).toContain('csat_items: not found')
  })

  it('산출물을 꺼내는 자리가 남아 있다 — 없으면 파이프라인이 진행률만 세는 판으로 되돌아간다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    expect(html).toContain('/api/admin/csat/guide?format=md')
    expect(html).toContain('format=json')
  })
})

// ── 축 패널 — 피벗이 구조상 말할 수 없는 것 ────────────────────────────
//
// 축마다 전용 「화면」을 만들면 축을 겹칠 수 없게 되어 탭 시절로 되돌아간다. 그렇다고 전부
// 피벗 하나로 밀면 세 가지가 빠진다 — 계열 아래 **어떤 라벨이 묶였나** · 결함을 **어느 순서로
// 고치나** · 유형 리포트의 **문항 줄에 없는 두 칸**. 그래서 피벗은 늘 있고 그 위에 패널이 붙는다.

describe('함정 축 — 라벨이 아니라 계열이다', () => {
  it('라벨 513종을 행으로 세우지 않는다 — 계열로 접어 축에 올린다', () => {
    // 표본의 세 라벨은 서로 안 겹치므로 계열도 셋이다. 요점은 **축이 계열 키를 쓴다**는 것.
    const keys = bucketsOf('trap', CTX).map((b) => b.key)
    for (const f of CTX.trap.families) expect(keys).toContain(f.key)
    // 라벨이 하나도 없는 문항이 들어와도 축에서 사라지지 않아야 한다
    expect(keys).toContain('__notrap__')
  })

  it('계열 축에서도 총합은 모집단과 같다', () => {
    const p = pivot(ITEMS, 'trap', 'exam', 'items', CTX)
    expect(p.grand).toBe(ITEMS.length)
  })

  it('원 라벨을 접어 두지 않고 함께 보여 준다 — 병합이 휴리스틱이라 사람이 확인해야 한다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} initialRow="trap" />))
    expect(html).toContain('함정 계열 —')
    expect(html).toContain('과잉')
    for (const label of ['어휘 함정', '반대 진술', '무관']) expect(html).toContain(label)
  })

  it('라벨 → 계열 대조표 없이 접는 시늉을 하지 않는다', () => {
    // ctx 를 안 주면 라벨 그대로 돌려준다 — 틀린 묶음보다 안 묶은 게 낫다.
    const it3 = ITEMS.find((i) => i.id === 'c') as EvidenceItem
    expect(keysOf(it3, 'trap')).toEqual(['반대 진술', '무관'])
  })
})

describe('결함 축 — 몇 개인가가 아니라 어느 순서로 고치나', () => {
  it('막는 공정이 이른 것부터 세운다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} initialRow="defect" />))
    expect(html).toContain('고치는 순서 —')
    // 배점 모순(①커버리지)이 리포트 작업 로그(학습자 배포)보다 먼저 나와야 한다
    expect(html.indexOf('배점 모순')).toBeLessThan(html.indexOf('리포트 작업 로그'))
  })

  it('결함마다 **다음 한 걸음**을 적는다 — 라벨은 무엇을 돌릴지 말하지 않는다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} initialRow="defect" />))
    expect(html).toContain('locus-refold')
    expect(html).toContain('--redo')
  })

  it('결함 칩과 순서 패널을 동시에 그리지 않는다 — 같은 말이 두 번이다', () => {
    const withPanel = text(renderToString(<EvidenceConsole {...PROPS} initialRow="defect" />))
    const noPanel = text(renderToString(<EvidenceConsole {...PROPS} initialRow="exam" initialCol="type" />))
    expect(withPanel).toContain('고치는 순서 —')
    expect(noPanel).not.toContain('고치는 순서 —')
    // 패널이 없을 때는 칩이 그 자리를 대신한다 — 어느 축에서도 결함으로 들어갈 길은 남는다
    expect(noPanel).toContain('결함 없음')
  })
})

describe('유형 축 — 문항 수로는 안 보이는 두 칸', () => {
  it('리포트 계수 불일치와 학습자 배포 막힘을 유형마다 적는다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} initialRow="type" />))
    expect(html).toContain('유형 리포트 —')
    // R-BLANK 는 리포트 n=3 인데 실제 2 라 어긋나고, 작업 로그(청크)가 섞여 배포가 막힌다
    expect(html).toContain('계수 3 ≠ 실제 2')
    expect(html).toContain('청크')
  })

  it('패널이 없는 축에서는 빈 상자를 두지 않는다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} initialRow="steps" initialCol="vocab" />))
    // 패널 제목으로 본다 — 「유형 리포트」 넉 자는 결함 칩의 설명에도 나오므로 오탐이 난다
    for (const gone of ['함정 계열 —', '고치는 순서 —', '유형 리포트 —']) expect(html).not.toContain(gone)
  })
})

describe('커버리지 한 줄 — 누를 수 없는 숫자를 두지 않는다', () => {
  it('「채움」을 첫 줄에서 뺐다 — 아무 행동으로도 이어지지 않는 수였다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    expect(html).not.toContain('채움')
  })

  it('분모(문항·필드·셀)와 못 쓰는 칸이 전부 버튼이다', () => {
    const html = renderToString(<EvidenceConsole {...PROPS} />)
    const head = html.slice(0, html.indexOf('막힌 문항'))
    // 첫 줄에 남은 숫자가 버튼 밖에 있으면 추적할 수 없는 숫자가 된다
    expect(head).toContain('필드')
    expect(head).toContain('셀')
    expect(head).toContain('쓸 수 없는 칸')
    expect((head.match(/<button/g) ?? []).length).toBeGreaterThanOrEqual(4)
  })

  it('필드 목록을 펴면 어느 필드가 몇 칸을 막는지와 **누가 읽는지**가 함께 나온다', () => {
    // 펼침은 클라이언트 상태라 서버 렌더에는 안 보인다 — 계산 쪽 계약만 잠근다.
    const cov = coverageOf(ITEMS)
    const body = cov.byField.find((f) => f.key === 'body')
    expect(body?.bad).toBe(1)
    expect(body?.stage).toContain('④소재')
    expect(cov.byField.every((f) => f.bad >= 0)).toBe(true)
    // 못 쓰는 칸의 합은 필드별 합과 같아야 한다 — 한 곳에서만 세면 두 수가 갈라진다
    expect(cov.byField.reduce((s, f) => s + f.bad, 0)).toBe(cov.cells - cov.fill)
  })
})

describe('피벗 키보드 — 칸 810개를 탭 정지점으로 두지 않는다', () => {
  it('방향키 규칙을 화면에 눈에 보이게 적는다', () => {
    const html = text(renderToString(<EvidenceConsole {...PROPS} />))
    expect(html).toContain('방향키')
    expect(html).toContain('Enter')
  })
})
