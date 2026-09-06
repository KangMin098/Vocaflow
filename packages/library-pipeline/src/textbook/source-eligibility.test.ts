// packages/library-pipeline/src/textbook/source-eligibility.test.ts
//
// **판정이 관대해지는 것을 막는 회귀.**
//
// 이 판정의 목적은 "단 한 편도 못 쓸 원문이 교재에 들어가지 않게" 하는 것이다.
// 그런 규칙은 시간이 지나면 **조용히 헐거워진다** — 통과율을 올리려고 축을 하나씩
// 빼거나, `null` 을 통과로 세거나, 등급 하나를 조판 허용에 더하는 식으로.
// 아래 검사는 그 세 가지를 각각 잠근다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { PASSAGE_WORDS } from './readability'
import {
  COMPOSABLE_GRADES,
  ELIGIBILITY_AXES,
  GRADE_LABEL,
  GRADE_NEXT_STEP,
  isComposable,
  judgeSource,
  schoolOfVLevel,
  tallyEligibility,
  type SourceEligibilityInput,
} from './source-eligibility'

/** 일곱 축을 모두 통과하는 원문. 각 검사는 여기서 **한 값만** 바꾼다. */
const OK: SourceEligibilityInput = {
  title: 'How coastal wetlands store carbon',
  status: 'ready',
  articleVLevel: 5,
  wordCount: 150,
  register: 'expository',
  cefrLevel: 'B2',
  syntaxScore: 88,
  displayOnly: false,
  licenseClass: 'cc_by',
  copyrightSafeInKr: true,
  gatePublishable: true,
  gateBlockedBy: null,
  gateVerdict: 'use',
  gatePurpose: 'csat',
  excerptWindows: null,
  outsidePct: null,
}

const at = (over: Partial<SourceEligibilityInput>) => judgeSource({ ...OK, ...over })

describe('judgeSource — 통과', () => {
  it('일곱 축을 통과하면 그대로 사용이다', () => {
    const v = at({})
    expect(v.grade).toBe('usable')
    expect(v.blockedBy).toBeNull()
    expect(isComposable(v.grade)).toBe(true)
  })

  it('축 판정을 통과한 것까지 전부 남긴다 — 사유가 없으면 다시 만들 수 없다', () => {
    const v = at({})
    // 어휘 축은 재료가 없으면 `null`(미측정)로 남는다 — 통과로 세지 않는다.
    expect(v.axes.map((a) => a.axis)).toEqual([
      'legal',
      'safety',
      'gate',
      'analysis',
      'judgement',
      'format',
      'vocabulary',
    ])
    expect(v.axes.find((a) => a.axis === 'vocabulary')?.pass).toBeNull()
  })
})

describe('judgeSource — 되돌릴 수 없는 탈락', () => {
  it('표시 전용은 사용 불가이고 되돌릴 수 없다', () => {
    const v = at({ displayOnly: true })
    expect(v.grade).toBe('blocked')
    expect(v.blockedBy).toBe('legal')
    expect(v.recoverable).toBe(false)
  })

  it('국내 저작권 불가를 통과시키지 않는다', () => {
    expect(at({ copyrightSafeInKr: false }).grade).toBe('blocked')
  })

  it('파생 불허 라이선스를 통과시키지 않는다', () => {
    expect(at({ licenseClass: 'cc_by_nd' }).blockedBy).toBe('legal')
    expect(at({ licenseClass: 'restricted' }).blockedBy).toBe('legal')
  })

  it('철회된 연구는 제목만으로 막는다 — 본문은 멀쩡히 읽힌다', () => {
    const v = at({ title: 'RETRACTED: Gut microbiota and memory' })
    expect(v.blockedBy).toBe('safety')
    expect(v.recoverable).toBe(false)
  })
})

describe('judgeSource — 되돌릴 수 있는 탈락', () => {
  it('게시 게이트 차단은 사유를 그대로 나른다', () => {
    const v = at({ gatePublishable: false, gateBlockedBy: 'poetry-drama' })
    expect(v.grade).toBe('blocked')
    expect(v.blockedBy).toBe('gate')
    expect(v.reason).toContain('poetry-drama')
    expect(v.recoverable).toBe(true)
  })

  it('학령 분석이 없으면 unknown 이다 — 무엇이 없는지 적는다', () => {
    const v = at({ articleVLevel: null, cefrLevel: null })
    expect(v.grade).toBe('unknown')
    expect(v.reason).toContain('V-Level')
    expect(v.reason).toContain('CEFR')
  })

  it('내용 판정을 안 받았으면 unjudged 다 — 규칙 통과는 판정이 아니다', () => {
    const v = at({ gateVerdict: null })
    expect(v.grade).toBe('unjudged')
    expect(v.blockedBy).toBe('judgement')
    expect(isComposable(v.grade)).toBe(false)
  })

  it('미절단 원본의 미판정은 **처방이 다르다** — 게이트를 돌려도 안 붙는다', () => {
    // `PURPOSE_RULE.raw.verdicts` 가 빈 집합이라 구조적으로 판정이 안 붙는다.
    // 같은 등급이어도 사유가 갈려야 관리자가 돌지 않을 배치를 안 돌린다.
    const raw = at({ gateVerdict: null, gatePurpose: 'raw' })
    const normal = at({ gateVerdict: null, gatePurpose: 'csat' })
    expect(raw.grade).toBe('unjudged')
    expect(raw.reason).toContain('발췌 경로')
    expect(normal.reason).not.toContain('발췌 경로')
  })
})

describe('judgeSource — 긴 글은 잘린 지문이 있어야 쓴다', () => {
  it('미절단 원본(oversize-raw)은 차단이 아니라 갈래다', () => {
    // PLOS 논문 전문 — 게이트는 게시 불가지만 "자르기 전에는" 이라는 뜻이다.
    // 판정을 받았고 문항이 붙어 있으면 잘린 지문이 이미 존재한다.
    const v = at({
      wordCount: 4307,
      gatePublishable: false,
      gateBlockedBy: 'oversize-raw',
      gatePurpose: 'raw',
      gateVerdict: 'use',
      hasItems: true,
    })
    expect(v.grade).toBe('excerpt')
    expect(isComposable(v.grade)).toBe(true)
  })

  it('**문항 보유가 발췌창보다 먼저다** — 발췌창은 아무도 안 읽는 열이다', () => {
    const v = at({ wordCount: 4307, hasItems: true, excerptWindows: null })
    expect(v.grade).toBe('excerpt')
    expect(v.reason).toContain('문항')
  })

  it('문항이 없어도 발췌창이 있으면 자를 자리는 있다', () => {
    const v = at({ wordCount: 4307, hasItems: false, excerptWindows: 3 })
    expect(v.grade).toBe('excerpt')
    expect(v.reason).toContain('발췌창')
  })

  it('길고 문항도 발췌창도 없으면 조판이 받으면 안 된다', () => {
    const v = at({ wordCount: 4307, hasItems: false, excerptWindows: null })
    expect(v.grade).toBe('excerpt-blind')
    expect(isComposable(v.grade)).toBe(false)
  })

  it('발췌창 0개·문항 없음은 보유로 세지 않는다', () => {
    expect(at({ wordCount: 900, excerptWindows: 0, hasItems: false }).grade).toBe('excerpt-blind')
  })

  it('hasItems 를 못 쟀으면(null) 통과로 세지 않는다', () => {
    expect(at({ wordCount: 900, hasItems: null, excerptWindows: null }).grade).toBe('excerpt-blind')
  })

  it('창 하한 미만은 이을 수도 자를 수도 없다', () => {
    const v = at({ wordCount: PASSAGE_WORDS.min - 1 })
    expect(v.grade).toBe('blocked')
    expect(v.blockedBy).toBe('format')
  })

  it('창 경계값은 통과다 — 경계에서 한 편도 잃지 않는다', () => {
    expect(at({ wordCount: PASSAGE_WORDS.min }).grade).toBe('usable')
    expect(at({ wordCount: PASSAGE_WORDS.max }).grade).toBe('usable')
  })
})

describe('judgeSource — 어휘 축', () => {
  it('초·중 밴드에서 시중 p90 을 넘으면 막는다', () => {
    const v = at({ articleVLevel: 2, wordCount: 150, outsidePct: 60 })
    expect(v.grade).toBe('blocked')
    expect(v.blockedBy).toBe('vocabulary')
  })

  it('밖% 가 없으면 통과가 아니라 미측정으로 남긴다', () => {
    const v = at({ articleVLevel: 2, outsidePct: null })
    expect(v.grade).toBe('usable')
    expect(v.axes.find((a) => a.axis === 'vocabulary')?.pass).toBeNull()
  })

  it('고등 밴드는 어휘 자를 대지 않는다 — 시중 분포를 안 쟀다', () => {
    expect(schoolOfVLevel(6)).toBeNull()
    expect(schoolOfVLevel(2)).toBe('elementary')
    expect(schoolOfVLevel(4)).toBe('middle')
  })
})

describe('규격이 헐거워지는 것을 막는다', () => {
  it('조판 허용 등급은 둘뿐이다', () => {
    // 여기 하나를 더하면 "못 쓸 원문이 교재에 들어간다" 는 뜻이 된다.
    expect([...COMPOSABLE_GRADES].sort()).toEqual(['excerpt', 'usable'])
  })

  it('모든 등급에 이름과 다음 한 걸음이 있다 — 막다른 화면을 만들지 않는다', () => {
    for (const g of Object.keys(GRADE_LABEL)) {
      expect(GRADE_NEXT_STEP[g as keyof typeof GRADE_NEXT_STEP]).toBeTruthy()
    }
  })

  it('모든 축이 자의 출처를 밝힌다 — 짐작으로 정한 임계값이 없다는 증거다', () => {
    expect(ELIGIBILITY_AXES).toHaveLength(7)
    for (const a of ELIGIBILITY_AXES) {
      expect(a.source.length).toBeGreaterThan(10)
      expect(a.question.endsWith('가')).toBe(true)
    }
  })
})

describe('tallyEligibility', () => {
  it('등급과 탈락 축을 함께 센다', () => {
    const rows = [
      at({}),
      at({ wordCount: 900, excerptWindows: 2 }),
      at({ gateVerdict: null }),
      at({ displayOnly: true }),
    ]
    const t = tallyEligibility(rows)
    expect(t.total).toBe(4)
    expect(t.byGrade.usable).toBe(1)
    expect(t.byGrade.excerpt).toBe(1)
    expect(t.byGrade.unjudged).toBe(1)
    expect(t.byGrade.blocked).toBe(1)
    expect(t.composable).toBe(2)
    expect(t.composablePct).toBe(50)
    expect(t.byBlockedAxis.legal).toBe(1)
    expect(t.byBlockedAxis.judgement).toBe(1)
  })

  it('빈 입력에서 0으로 나누지 않는다', () => {
    expect(tallyEligibility([]).composablePct).toBe(0)
  })

  it('「안 쟀다」를 0% 로 적지 않는다 — 재고를 버리러 가게 만든다', () => {
    // 실측 2026-09-06: 조판 로그가 `원문 적격 0/11,337 (0%)` 를 찍었는데 그중 11,333편이
    // **미판정**이었다. 0% 는 "재 봤더니 쓸 게 없다" 로 읽히지만 사실은 "아무도 안 쟀다" 였고,
    // 할 일이 정반대다 — 앞은 재고를 더 모으는 일, 뒤는 게이트를 돌리는 일.
    const allUnjudged = tallyEligibility([at({ gateVerdict: null }), at({ gateVerdict: null })])
    expect(allUnjudged.judged).toBe(0)
    expect(allUnjudged.composablePctOfJudged).toBeNull()
    // 전체 분모 쪽은 여전히 0 이다 — 그래서 이 값만 보면 안 된다는 것이 요점이다.
    expect(allUnjudged.composablePct).toBe(0)

    // 재 봤는데 정말 없는 경우는 **0 이 맞다** — null 과 구별된다.
    const judgedButNone = tallyEligibility([at({ displayOnly: true }), at({ displayOnly: true })])
    expect(judgedButNone.judged).toBe(2)
    expect(judgedButNone.composablePctOfJudged).toBe(0)
  })

  it('판정된 것만 분모로 쓰면 비율이 달라진다', () => {
    const t = tallyEligibility([at({}), at({ displayOnly: true }), at({ gateVerdict: null })])
    expect(t.composable).toBe(1)
    expect(t.composablePct).toBe(33.3) // 분모 3 (미판정 포함)
    expect(t.judged).toBe(2)
    expect(t.composablePctOfJudged).toBe(50) // 분모 2 (판정된 것만)
  })

  it('드레인으로 못 푸는 미판정을 따로 센다 — 안 그러면 화면이 헛일을 시킨다', () => {
    const t = tallyEligibility([
      at({ gateVerdict: null, gatePurpose: 'raw' }),
      at({ gateVerdict: null, gatePurpose: 'raw' }),
      at({ gateVerdict: null, gatePurpose: 'csat' }),
    ])
    expect(t.byGrade.unjudged).toBe(3)
    expect(t.structurallyUnjudged).toBe(2)
  })
})

// ── 조판이 실제로 법적 축을 거는가 ──────────────────────────────────
//
// 판정이 아무리 정확해도 **조판이 안 물어보면 소용이 없다.** 실측 2026-09-06:
// `volume-pool.mjs` 는 `display_only` 하나만 보고 있었고, `license_class='restricted'` +
// `copyright_safe_in_kr=false` 인 원글 **82편**(그중 V1 이 65편 — 초등 저학년 재고의 77%)이
// 조판 풀에 그대로 있었다. 그 밴드로 권을 찍었다면 법적으로 못 쓰는 글이 인쇄됐다.
//
// 되돌릴 수 없는 축이라 즉시 막았고, 여기서 **다시 헐거워지지 않는지** 감시한다.
// (나머지 축은 아직 조판이 안 건다 — 막으면 재고가 10% 로 줄어 권이 안 나온다.
//  그 격차는 `/admin/textbook/sources` 가 편수로 보인다.)
const POOL = fs.readFileSync(
  path.resolve(fileURLToPath(new URL('../../../../scripts/textbook/volume-pool.mjs', import.meta.url))),
  'utf8'
)

describe('조판 풀이 법적 축을 건다', () => {
  it('원글 필터에 isLegallyUsable 이 걸려 있다', () => {
    expect(POOL).toContain('export function isLegallyUsable')
    expect(POOL).toMatch(/isLegallyUsable\(a\)\s*&&\s*!isRetractedTitle/)
  })

  it('세 축을 모두 본다 — 하나만 보면 82편이 새 나간다', () => {
    for (const col of ['display_only', 'copyright_safe_in_kr', 'license_class']) {
      expect(POOL).toContain(col)
    }
  })

  it('조회 컬럼에 라이선스 두 열이 실려 있다 — 안 받아 오면 판정이 늘 통과다', () => {
    // 열 이름이 select 문자열 안에 있는지만 본다. 문자열 전체를 대조하면 열이 늘 때마다
    // 깨지는데, 그 깨짐은 결함을 안 알려 준다 — **없어지면 안 되는 것**만 잠근다.
    expect(POOL).toMatch(/'id, title, source, article_v_level, display_only, license_class, copyright_safe_in_kr'/)
  })

  it('허용 라이선스 목록이 판정 정본과 같다 — 두 벌이 되면 갈린다', () => {
    // 정본 쪽(`source-eligibility.ts`)은 이 네 가지다. 조판 쪽이 더 관대해지면 안 된다.
    for (const lic of ['public_domain', 'cc0', 'cc_by', 'cc_by_sa']) {
      expect(POOL).toContain(`'${lic}'`)
    }
    expect(judgeSource({ ...OK, licenseClass: 'cc_by_nd' }).grade).toBe('blocked')
    expect(judgeSource({ ...OK, licenseClass: 'restricted' }).grade).toBe('blocked')
  })

  it('라이선스가 비어 있는 옛 수집분은 막지 않는다 — 없는 것과 나쁜 것은 다르다', () => {
    expect(at({ licenseClass: null }).grade).toBe('usable')
    expect(POOL).toContain('없는 것과 나쁜 것은 다르다')
  })
})

describe('조판이 적격 판정을 건다 (규격 v2)', () => {
  it('판정 함수를 자기가 다시 짜지 않고 패키지에서 가져온다', () => {
    expect(POOL).toContain('judgeSource')
    expect(POOL).toContain('isComposable')
    expect(POOL).toMatch(/}\s*=\s*await import\('@vocaflow\/library-pipeline'\)/)
  })

  it('**문항을 받은 뒤에** 판정한다 — 그전에는 hasItems 를 모른다', () => {
    // 순서를 뒤집으면 긴 글이 전부 excerpt-blind 로 떨어져 상위 밴드가 통째로 사라진다.
    const itemFetch = POOL.indexOf('const itemRows =')
    const judge = POOL.indexOf('const withItems = new Set(itemRows.map')
    expect(itemFetch).toBeGreaterThan(0)
    expect(judge).toBeGreaterThan(itemFetch)
  })

  it('판정에 필요한 열을 실제로 받아 온다 — 안 받으면 전부 unknown 이 된다', () => {
    for (const col of ['word_count', 'register', 'cefr_level', 'syntax_score->>score']) {
      expect(POOL).toContain(col)
    }
    expect(POOL).toContain('csat_fit->gate->>verdict')
  })

  it('jsonb 텍스트를 Boolean 으로 그냥 넘기지 않는다', () => {
    // `Boolean('false') === true` 라 그냥 넘기면 **차단된 원문이 전부 통과한다.**
    expect(POOL).toContain("g.gp === 'true'")
  })

  it('강제는 스위치이고 기본은 경고다 — 편수는 항상 인쇄한다', () => {
    expect(POOL).toContain('VOCAFLOW_SOURCE_STRICT')
    expect(POOL).toContain('원문 적격')
    // 강제일 때만 거른다.
    expect(POOL).toMatch(/if \(STRICT && !isComposable\(/)
  })

  it('집계를 부르는 쪽에 돌려준다 — 로그에만 남기면 HTML 과 함께 사라진다', () => {
    expect(POOL).toContain('sourceGate,')
  })
})
