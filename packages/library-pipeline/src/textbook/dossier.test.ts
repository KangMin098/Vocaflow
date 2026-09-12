// packages/library-pipeline/src/textbook/dossier.test.ts
//
// 권 서지 회귀. 지키려는 것은 **없는 것을 적지 않는가** 다.
//
// 이 저장소가 교재 화면에서 반복해서 겪은 사고가 하나다: 못 잰 값을 0 으로 적어
// "해설 0%" · "출처 없음" 같은 **거짓 경보**를 내는 것. 서지는 그 값들을 산문으로
// 바꿔 인쇄하므로, 같은 실수를 하면 화면보다 오래 남는다(공유 카드·검색 결과).

import { describe, expect, it } from 'vitest'

import { buildDossier, SKELETON_ITEMS_PER_UNIT, type DossierInput } from './dossier'
import { ITEMS_PER_UNIT } from './rung-mix'
import { SERIES_SPINE } from './series'
import { SERIES_CATALOG } from './series-catalog'

const base: DossierInput = {
  step: 4,
  title: 'Vocaflow Reading 3',
  schoolBand: '중학 3학년',
  vLevels: [4],
  types: ['order', 'insert', 'grammar'],
  byType: { order: 400, insert: 380, grammar: 255 },
  itemCount: 1035,
  explainedCount: 1035,
  bySource: { nasa: 400, plos: 300 },
  issued: new Date('2026-09-06T00:00:00Z'),
}

describe('권 서지', () => {
  it('일곱 권 전부 머리말이 있다 — 빈 머리말은 상품이 아니다', () => {
    for (const rung of SERIES_SPINE) {
      const d = buildDossier({ ...base, step: rung.step, title: rung.volumeTitle, schoolBand: rung.schoolBand })
      expect(d.preface.title.length, `step ${rung.step}`).toBeGreaterThan(4)
      expect(d.preface.paragraphs.length, `step ${rung.step}`).toBeGreaterThanOrEqual(2)
      expect(d.preface.closing.length, `step ${rung.step}`).toBeGreaterThan(8)
    }
  })

  it('권마다 머리말이 다르다 — 같은 글 일곱 번은 여섯 번이 거짓이다', () => {
    const titles = SERIES_SPINE.map(
      (r) => buildDossier({ ...base, step: r.step, title: r.volumeTitle, schoolBand: r.schoolBand }).preface.title,
    )
    expect(new Set(titles).size).toBe(SERIES_SPINE.length)
  })

  it('해설 수를 못 셌으면(null) 해설을 아예 말하지 않는다', () => {
    const d = buildDossier({ ...base, explainedCount: null })
    const said = d.features.some((f) => f.title.includes('해설'))
    expect(said).toBe(false)
    // 부가 자료에서도 마찬가지 — "해설 열람" 을 약속하지 않는다.
    expect(d.extras.some((e) => e.label.includes('해설'))).toBe(false)
  })

  it('해설이 전부는 아니면 100% 라고 적지 않고, 왜 빠졌는지 말한다', () => {
    const d = buildDossier({ ...base, explainedCount: 900, itemCount: 1035 })
    const f = d.features.find((x) => x.title.includes('해설'))
    expect(f).toBeDefined()
    expect(f!.title).not.toContain('전부')
    expect(f!.title).toContain('87%')
    expect(f!.body).toContain('지어내지 않습니다')
  })

  it('출처를 못 읽었으면(빈 객체) 출처를 밝힌다고 적지 않는다', () => {
    const d = buildDossier({ ...base, bySource: {} })
    expect(d.features.some((f) => f.title.includes('출처'))).toBe(false)
    expect(d.appendix.some((a) => a.label.includes('출처'))).toBe(false)
  })

  it('계획표에 **비는 날**이 있다 — 꽉 찬 계획표는 이틀째에 버려진다', () => {
    const d = buildDossier(base)
    const days = d.studyPlan.weeks.flatMap((w) => w.days)
    expect(days).toHaveLength(14)
    expect(days.some((x) => x.task === null)).toBe(true)
  })

  it('계획표가 복습을 넣는다 — 그리고 복습은 앞 단원을 가리킨다', () => {
    const d = buildDossier(base)
    const reviews = d.studyPlan.weeks.flatMap((w) => w.days).filter((x) => x.task?.startsWith('복습'))
    expect(reviews.length).toBe(2)
    for (const r of reviews) expect(r.note).toMatch(/UNIT \d+–\d+/)
  })

  it('인쇄되는 단원 문항 수는 설계상 단원 크기와 **다른 수**다', () => {
    // 이름이 같으면 화면이 6 을 적고 책이 4 를 찍는 어긋남이 조용히 생긴다.
    expect(SKELETON_ITEMS_PER_UNIT).toBe(4)
    expect(ITEMS_PER_UNIT).toBe(6)
    expect(SKELETON_ITEMS_PER_UNIT).not.toBe(ITEMS_PER_UNIT)
  })

  it('사다리가 일곱 단이고 지금 권 하나만 current 다', () => {
    const d = buildDossier(base)
    expect(d.difficulty.rungs).toHaveLength(SERIES_SPINE.length)
    expect(d.difficulty.rungs.filter((r) => r.current)).toHaveLength(1)
    expect(d.difficulty.rungs.find((r) => r.current)!.step).toBe(4)
  })

  it('판권이 발행일을 받은 날짜로 적는다 — 오늘로 지어내지 않는다', () => {
    const d = buildDossier(base)
    expect(d.colophon.issued).toBe('2026-09-06')
    expect(d.colophon.ladder).toBe('4단 · 중학 3학년')
  })

  it('같은 입력이면 같은 책이 나온다 — 순수 함수다', () => {
    expect(JSON.stringify(buildDossier(base))).toBe(JSON.stringify(buildDossier(base)))
  })
})
/**
 * **브랜드와 사다리가 시리즈를 따르는지.**
 *
 * ── 왜 (실측 2026-09-12) ────────────────────────────────────────────
 * 서지는 브랜드를 전역 상수에서 읽었다 — `COVER_BRAND || SERIES_BRAND`. 그래서 어휘·구문
 * 권을 학습자에게 열면 표지와 판권면이 **독해 브랜드**로 찍혔다. 조판기는 2026-09-06 에
 * 같은 사고를 고쳤는데(카탈로그 도움말에 「전역 브랜드를 쓰면 셋 다 READING 으로 찍힌다」가
 * 실측으로 적혀 있다) **서지는 따라오지 않았다.** 같은 브랜드를 두 곳이 다른 근거로 말했다.
 *
 * 아래 첫 검사가 그 회귀를 잠근다 — 전역 상수로 되돌리면 `brand` 가 'Reading' 으로 나온다.
 */
describe('서지가 시리즈를 따른다', () => {
  const vocabBase: DossierInput = {
    ...base,
    step: 5,
    title: 'Vocaflow Vocab Advanced',
    schoolBand: '고1',
    vLevels: [5],
  }

  it('브랜드를 주면 그 브랜드로 찍는다', () => {
    const d = buildDossier({ ...vocabBase, brand: 'Vocaflow Vocab' })
    // 표지는 좁아서 마지막 낱말만 쓴다 — 조판기와 같은 규칙이다.
    expect(d.brand).toBe('Vocab')
    expect(d.cover.brand).toBe('Vocab')
  })

  it('브랜드를 안 주면 독해로 떨어진다 — 옛 명령이 그대로 돈다', () => {
    expect(buildDossier(vocabBase).brand).toBe('Reading')
  })

  it('사다리를 주면 그 단수를 쓴다 — 어휘 6단에 독해 7단을 그리면 없는 1단이 붙는다', () => {
    const vocabSpine = SERIES_CATALOG.find((s) => s.id === 'vocab')!.rungs
    expect(vocabSpine.length).toBe(6)
    const d = buildDossier({ ...vocabBase, brand: 'Vocaflow Vocab', spine: vocabSpine })
    expect(d.difficulty.totalSteps).toBe(6)
    expect(d.difficulty.rungs).toHaveLength(6)
    // 어휘 시리즈에 1단은 없다 — 전역 사다리를 쓰면 여기 1이 들어온다.
    expect(d.difficulty.rungs.map((r) => r.step)).not.toContain(1)
    // 지금 보는 권이 하나만 표시된다.
    expect(d.difficulty.rungs.filter((r) => r.current)).toHaveLength(1)
  })

  it('사다리를 안 주면 독해 7단이다', () => {
    expect(buildDossier(vocabBase).difficulty.totalSteps).toBe(SERIES_SPINE.length)
  })
})
