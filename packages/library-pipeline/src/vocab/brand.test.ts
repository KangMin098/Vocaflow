// packages/library-pipeline/src/vocab/brand.test.ts
//
// 이 파일의 일은 **드리프트를 잡는 것**이다. 값을 여기 다시 적으면 세 곳이 되어
// 더 나빠지므로, 토큰 패키지에서 읽어 카탈로그 팔레트와 대조한다.

import { colorsDark, colorsLight, fontFamily } from '@vocaflow/design-tokens'
import { describe, expect, it } from 'vitest'
import { SERIES_SPINE } from '../textbook/series'
import {
  CATALOG_FONTS,
  CATALOG_PALETTE,
  FAMILY_DUOTONE,
  VOCAB_SERIES_BRAND,
  VOCAB_SPINE,
  buildVocabColophon,
  catalogCssVariables,
  ladderStrip,
  opensAtStep,
  rungForVLevel,
  vocabBrandFingerprint,
  vocabBrandSpecRows,
} from './brand'

describe('카탈로그 팔레트가 디자인 토큰과 어긋나지 않는다', () => {
  it('라이트 — 일곱 색이 전부 토큰 값이다', () => {
    expect(CATALOG_PALETTE.light.ink).toBe(colorsLight.t1)
    expect(CATALOG_PALETTE.light.sub).toBe(colorsLight.t3)
    expect(CATALOG_PALETTE.light.line).toBe(colorsLight.bd)
    expect(CATALOG_PALETTE.light.bg).toBe(colorsLight.bg)
    expect(CATALOG_PALETTE.light.accent).toBe(colorsLight.activeInk)
    expect(CATALOG_PALETTE.light.spine).toBe(colorsLight.p)
    expect(CATALOG_PALETTE.light.plate).toBe(colorsLight.bg2)
  })

  it('다크 — 일곱 색이 전부 토큰 값이다', () => {
    expect(CATALOG_PALETTE.dark.ink).toBe(colorsDark.t1)
    expect(CATALOG_PALETTE.dark.sub).toBe(colorsDark.t3)
    expect(CATALOG_PALETTE.dark.line).toBe(colorsDark.bd)
    expect(CATALOG_PALETTE.dark.bg).toBe(colorsDark.bg2)
    expect(CATALOG_PALETTE.dark.accent).toBe(colorsDark.activeInk)
    expect(CATALOG_PALETTE.dark.spine).toBe(colorsDark.p)
    expect(CATALOG_PALETTE.dark.plate).toBe(colorsDark.bg3)
  })

  it('라이트·다크가 같은 키를 갖는다 — 한쪽만 늘면 테마가 짝을 잃는다', () => {
    expect(Object.keys(CATALOG_PALETTE.dark).sort())
      .toEqual(Object.keys(CATALOG_PALETTE.light).sort())
  })

  it('듀오톤 다섯 계열이 전부 토큰 값이고 라이트·다크가 짝을 이룬다', () => {
    expect(Object.keys(FAMILY_DUOTONE.dark).sort())
      .toEqual(Object.keys(FAMILY_DUOTONE.light).sort())
    expect(FAMILY_DUOTONE.light.list.ink).toBe(colorsLight.info)
    expect(FAMILY_DUOTONE.light.structure.ink).toBe(colorsLight.success)
    expect(FAMILY_DUOTONE.light.corpus.ink).toBe(colorsLight.warning)
    expect(FAMILY_DUOTONE.light.delivery.ink).toBe(colorsLight.t3)
    expect(FAMILY_DUOTONE.light.unique.ink).toBe(colorsLight.p)
  })

  it('covers/design.ts 가 손으로 적어 두었던 옛 듀오톤으로 되돌아가지 않는다', () => {
    // 2026-08-30 이전 FAMILY_GRAIN 의 하드코딩 값. 다시 나타나면 실패한다.
    const retired = [
      '#2f4858', '#f3f1ec', '#f1f4ef', '#8a5a2b', '#f6f1e8',
      '#6b655c', '#f4f2ee', '#5b3fa8', '#f2f0f8',
    ]
    const inUse = [
      ...Object.values(FAMILY_DUOTONE.light),
      ...Object.values(FAMILY_DUOTONE.dark),
    ].flatMap((d) => [d.ink, d.paper]).map((v) => v.toLowerCase())
    for (const old of retired) expect(inUse).not.toContain(old)
  })

  it('표제어 서체는 Lora — v06.39 시그니처다', () => {
    expect(CATALOG_FONTS.english).toBe(fontFamily.english.join(', '))
    expect(CATALOG_FONTS.english).toContain('Lora')
  })
})

describe('카탈로그 CSS 변수', () => {
  it('라이트가 bare :root 에 있다 — 테마 무표시가 기본값이라', () => {
    const css = catalogCssVariables()
    const bare = css.split('\n').find((l) => l.startsWith(':root{'))
    expect(bare).toBeDefined()
    expect(bare).toContain(colorsLight.t1)
  })

  it('다크가 미디어쿼리와 data-theme 양쪽에 있다 — 토글이 두 방향 모두 이긴다', () => {
    const css = catalogCssVariables()
    expect(css).toContain('@media(prefers-color-scheme:dark)')
    expect(css).toContain(':root:not([data-theme="light"])')
    expect(css).toContain(':root[data-theme="dark"]')
  })
})

describe('브랜드 지문', () => {
  it('8자리 16진수이고 같은 입력에 같은 값이다', () => {
    const fp = vocabBrandFingerprint()
    expect(fp).toMatch(/^[0-9a-f]{8}$/)
    expect(vocabBrandFingerprint()).toBe(fp)
  })
})

describe('판권면', () => {
  const base = {
    title: 'Vocaflow Vocabulary 4',
    step: 5,
    schoolBand: '고1',
    vLevel: 5,
    selection: '국제 말뭉치 빈도 — 자주 만나는 것부터',
    wordCount: 1200,
    wordsPerDay: 30,
    issued: new Date('2026-08-30T00:00:00Z'),
    autoPassed: 1180,
    autoTotal: 1200,
  }

  it('사다리 자리를 계단·학령으로 적는다', () => {
    expect(buildVocabColophon(base).ladder).toBe('5단 · 고1')
  })

  it('사다리 밖이면 V-Level 로 적는다 — 계단이 없다고 빈칸을 두지 않는다', () => {
    const c = buildVocabColophon({ ...base, step: null, schoolBand: null, vLevel: 9 })
    expect(c.ladder).toBe('V9')
  })

  it('며칠짜리인지 세어 적는다', () => {
    expect(buildVocabColophon(base).volume).toBe('표제어 1,200 · 하루 30 · 40일')
  })

  it('하루치가 0 이면 Infinity 를 찍지 않고 낱말 수만 적는다', () => {
    const c = buildVocabColophon({ ...base, wordsPerDay: 0 })
    expect(c.volume).toBe('표제어 1,200')
    expect(c.volume).not.toContain('Infinity')
  })

  it('선정 근거를 지어내지 않고 받은 값을 그대로 싣는다', () => {
    expect(buildVocabColophon(base).selection).toBe(base.selection)
  })

  it('검수 수치를 실측 그대로 적는다', () => {
    expect(buildVocabColophon(base).review).toBe('자동 검수 1180/1200 통과')
  })
})

describe('사다리 띠', () => {
  it('현재 권만 대괄호로 표시한다', () => {
    expect(ladderStrip(3)).toEqual(['1', '2', '[3]', '4', '5', '6', '7'])
  })

  it('계단이 없으면 아무것도 표시하지 않는다', () => {
    expect(ladderStrip(null)).toEqual(['1', '2', '3', '4', '5', '6', '7'])
  })
})

describe('단어장 사다리가 독해 사다리와 한 눈금을 쓴다', () => {
  it('계단 번호·V-Level·학령이 SERIES_SPINE 과 같다 — 눈금이 둘이면 갈린다', () => {
    expect(VOCAB_SPINE).toHaveLength(SERIES_SPINE.length)
    for (const rung of VOCAB_SPINE) {
      const reading = SERIES_SPINE.find((r) => r.step === rung.step)
      expect(reading).toBeDefined()
      expect(rung.vLevels).toEqual([...reading!.vLevels])
      expect(rung.schoolBand).toBe(reading!.schoolBand)
    }
  })

  it('권 이름이 전부 시리즈 브랜드로 시작한다', () => {
    for (const rung of VOCAB_SPINE) expect(rung.volumeTitle).toContain(VOCAB_SERIES_BRAND)
  })
})

describe('계단 구성', () => {
  it('청사진이 누적된다 — 어휘는 유형이 은퇴하지 않는다', () => {
    for (let i = 1; i < VOCAB_SPINE.length; i += 1) {
      for (const bp of VOCAB_SPINE[i - 1]!.blueprints) {
        expect(VOCAB_SPINE[i]!.blueprints).toContain(bp)
      }
    }
  })

  it('같은 청사진을 두 번 세지 않는다', () => {
    for (const rung of VOCAB_SPINE) {
      expect(new Set(rung.blueprints).size).toBe(rung.blueprints.length)
    }
  })

  it('빈 계단이 없다 — 계단 하나가 비면 그 학년이 다른 출판사로 간다', () => {
    for (const rung of VOCAB_SPINE) expect(rung.blueprints.length).toBeGreaterThan(0)
  })

  it('하루치가 계단을 따라 단조 증가한다', () => {
    for (let i = 1; i < VOCAB_SPINE.length; i += 1) {
      expect(VOCAB_SPINE[i]!.wordsPerDay).toBeGreaterThan(VOCAB_SPINE[i - 1]!.wordsPerDay)
    }
  })

  it('최상단 하루치가 시장 실측값 40 이다 (능률VOCA 고등 기본 DAY 01–40)', () => {
    expect(VOCAB_SPINE[VOCAB_SPINE.length - 1]!.wordsPerDay).toBe(40)
  })

  it('추상적인 축은 초등 계단에 없다 — 어원·유의어는 그 나이의 과제가 아니다', () => {
    const starter = VOCAB_SPINE[0]!.blueprints
    expect(starter).not.toContain('root-etymology')
    expect(starter).not.toContain('synonym-cluster')
    expect(starter).not.toContain('academic-awl')
  })

  it('학습 이력이 있어야 성립하는 축은 1·2단에 없다', () => {
    for (const step of [1, 2]) {
      const rung = VOCAB_SPINE.find((r) => r.step === step)!
      expect(rung.blueprints).not.toContain('confusion-log')
      expect(rung.blueprints).not.toContain('recycle')
      expect(rung.blueprints).not.toContain('unlock')
    }
  })

  it('계단마다 왜 이 구성인지 적혀 있다', () => {
    for (const rung of VOCAB_SPINE) expect(rung.rationale.length).toBeGreaterThan(20)
  })
})

describe('조회 도우미', () => {
  it('V-Level 로 계단을 찾는다', () => {
    expect(rungForVLevel(5)?.step).toBe(5)
    expect(rungForVLevel(1)?.step).toBe(1)
  })

  it('사다리 밖(V0 유치원 · V8+ 성인)은 null 이다', () => {
    expect(rungForVLevel(0)).toBeNull()
    expect(rungForVLevel(9)).toBeNull()
  })

  it('그 계단에서 처음 열리는 축만 돌려준다', () => {
    expect(opensAtStep(4)).toContain('synonym-cluster')
    expect(opensAtStep(4)).not.toContain('topic-field') // 1단에서 이미 열렸다
  })

  it('7단은 새로 여는 축이 없다 — 수준과 하루치가 다를 뿐이다', () => {
    expect(opensAtStep(7)).toEqual([])
  })
})

describe('규격 표', () => {
  it('일곱 줄이 전부 팔레트에서 읽은 값이다', () => {
    const rows = vocabBrandSpecRows()
    expect(rows).toHaveLength(7)
    for (const row of rows) {
      expect(row.light).toBe(CATALOG_PALETTE.light[row.key as keyof typeof CATALOG_PALETTE.light])
      expect(row.dark).toBe(CATALOG_PALETTE.dark[row.key as keyof typeof CATALOG_PALETTE.dark])
      expect(row.label.length).toBeGreaterThan(1)
    }
  })
})
