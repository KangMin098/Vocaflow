// packages/library-pipeline/src/vocab/book-guide.ts
//
// **설명 지면 — "이 책이 무엇이고 왜 이렇게 만들었는가" 를 조판기가 쓴다.**
//
// ── 시중 교재는 이 자리를 어떻게 쓰나 (실측 2026-09-07 · 능률VOCA 4권) ──
// 어휘 교재는 본문 앞에 **설명 지면 둘**을 반드시 둔다. 4권 모두 p2·p5 에 있었다.
//
//   ① **머리말** — "왜 이 책인가". 번호 붙은 주장 셋이 표준형이고, 각 주장은
//      `영문 키워드 + 한국어 라벨 + 문단` 이다.
//      (능률 고등 기본: 1 Time-efficient 효율적인 어휘 학습 / 2 Practical 실용적인 예문 /
//       3 User-friendly 학습자 친화적인 장치)
//   ② **FEATURES** — 실제 지면 한 장에 번호 1~7 을 찍어 **각 칸이 무엇인지** 가리킨다.
//      학습자가 처음 펼쳤을 때 "이 숫자는 뭐지" 를 묻지 않게 하는 장치다.
//
// ── 우리가 다르게 하는 것 ───────────────────────────────────────────
// 시중 머리말의 주장은 **문장이다** — "학습일마다 어휘 난이도를 일정하게 배분해 두었습니다"
// 라고 쓰지만 그 배분이 얼마인지는 적지 않는다. 확인할 방법이 학습자에게 없다.
//
// **여기서는 근거 수치가 없는 주장을 싣지 않는다.** 조판기가 이미 그 권의 값을 알고 있으므로
// (`VocabSpread`), 주장마다 그 권에서 실제로 센 값을 붙인다. 값이 없으면 그 주장을 **뺀다** —
// 빈 주장을 남기면 설명 지면이 광고가 된다.
//
// ── FEATURES 도 지어내지 않는다 ─────────────────────────────────────
// 콜아웃은 **이 권이 실제로 채운 장치**(`spread.apparatus`)만 가리킨다. 예문이 없는 권에
// "④ 예문" 을 찍으면 학습자가 없는 칸을 찾게 된다.

import type { VocabSpread } from './typeset'

/** 콜아웃 한 칸 — 지면의 그 자리가 무엇인지. */
export interface GuideFeature {
  n: number
  /** `spread.apparatus` 의 id 와 같은 눈금. */
  id: string
  label: string
  says: string
}

/** 주장 하나 — **근거 수치와 함께가 아니면 존재하지 않는다.** */
export interface GuideClaim {
  n: number
  /** 영문 키워드. 시중 머리말의 관례를 따른다. */
  key: string
  label: string
  body: string
  /** 이 권에서 실제로 센 값. 이것이 비면 주장을 싣지 않는다. */
  evidence: string
}

export interface BookGuide {
  /** 설명 지면의 머리 질문. 시중은 "왜 이 책으로 학습해야 할까요" 를 쓴다. */
  question: string
  claims: GuideClaim[]
  features: GuideFeature[]
  /** 콜아웃이 가리킬 표본 표제어 — 이 권의 **실제** 첫 항목. 지어낸 예를 쓰지 않는다. */
  sampleWord: string | null
}

/**
 * 지면 장치 → 설명 문구.
 *
 * `says` 는 **그 칸이 학습자에게 무엇을 하는지**를 적는다. 라벨을 되풀이하지 않는다
 * ("예문 — 예문입니다" 는 설명이 아니다).
 */
const FEATURE_TEXT: Record<string, { label: string; says: string }> = {
  entryNumber: { label: '표제어 번호', says: '권 전체를 관통하는 일련번호. 어디까지 왔는지 늘 보인다' },
  runningHead: { label: '학습일 머리', says: '스크롤해도 남는다 — 지금 며칟날 것인지 잃지 않는다' },
  posLabel: { label: '품사', says: '뜻 앞 같은 자리. 품사를 모르면 문장에 넣지 못한다' },
  senseNumber: { label: '뜻 번호', says: '뜻이 갈리는 낱말은 번호로 나눈다 — 한 덩어리로 주면 어느 뜻도 남지 않는다' },
  derivedRow: { label: '파생어', says: '같은 어간에서 갈라져 나온 말. 낱말 하나로 여럿을 가져간다' },
  inflection: { label: '활용형', says: '표제어 옆 괄호. 불규칙하게 변하는 것만 적는다' },
  exampleEn: { label: '예문', says: '그 낱말이 실제로 쓰인 문장. 맥락 없는 뜻은 인출되지 않는다' },
  exampleKo: { label: '예문 해석', says: '예문 바로 아래 같은 자리. 읽지 못한 채 넘어가지 않게 한다' },
  usageNote: { label: '어법 칸', says: '헷갈리는 자리를 한 번 더 판다' },
  crossRef: { label: '상호참조', says: '이 권 안의 다른 표제어로 잇는다 — 밖을 가리키지 않는다' },
  dailyTest: { label: '학습일 테스트', says: '그날 것을 그 자리에서 확인한다' },
  cumulativeReview: { label: '누적 복습', says: '앞의 며칠을 묶어 다시 묻는다' },
  partDivider: { label: '묶음 구분', says: '묶음 원리가 바뀌는 자리를 지면이 알린다' },
  rootHeader: { label: '묶음 원리', says: '이 묶음이 무엇으로 묶였는지 머리에 적는다' },
  studyPlanGrid: { label: '학습 계획', says: '며칠이면 끝나는지 먼저 보여 준다' },
  index: { label: '색인', says: '낱말로 되찾는 자리' },
  checkbox: { label: '회독 칸', says: '몇 번 봤는지 표시한다' },
}

/** 콜아웃 순서 — **지면에서 눈이 가는 순서**다. 알파벳순이면 설명이 지면을 안 따라간다. */
const FEATURE_ORDER: string[] = [
  'entryNumber', 'runningHead', 'posLabel', 'senseNumber', 'exampleEn', 'exampleKo',
  'derivedRow', 'inflection', 'crossRef', 'usageNote',
  'dailyTest', 'cumulativeReview', 'partDivider', 'rootHeader', 'studyPlanGrid', 'index', 'checkbox',
]

/** 시중 관례대로 콜아웃은 일곱 개까지. 더 찍으면 지면이 번호밭이 된다. */
const MAX_FEATURES = 7

const pct = (n: number, d: number): number => (d === 0 ? 0 : Math.round((n / d) * 100))

/**
 * 설명 지면을 만든다.
 *
 * **전체 지면**을 받아야 한다 — 앞 며칠치만 잘라 넘기면 보유율이 그 며칠의 값이 되어
 * 근거 수치가 거짓이 된다(라우트가 자르기 **전에** 부른다).
 */
export function buildBookGuide(spread: VocabSpread): BookGuide {
  const entries = spread.parts.flatMap((p) => p.days.flatMap((d) => d.entries))
  const n = entries.length

  const has = (id: string): boolean => spread.apparatus.includes(id)

  const features: GuideFeature[] = FEATURE_ORDER.filter((id) => has(id) && FEATURE_TEXT[id])
    .slice(0, MAX_FEATURES)
    .map((id, i) => ({ n: i + 1, id, label: FEATURE_TEXT[id]!.label, says: FEATURE_TEXT[id]!.says }))

  /*
    주장 후보. 각 항목은 **근거가 성립할 때만** 남는다 — `evidence` 를 만들지 못하면
    그 주장은 목록에서 빠진다. 순서는 학습자가 궁금해하는 순서다(얼마나 걸리나 → 무엇을
    주나 → 어떻게 안 잊게 하나).
  */
  const withExample = entries.filter((e) => e.senses.some((s) => s.exampleEn)).length
  const withPair = entries.filter((e) => e.senses.some((s) => s.exampleEn && s.exampleKo)).length
  const multiSense = entries.filter((e) => e.senses.length > 1).length
  const withNet = entries.filter(
    (e) => e.derived.length > 0 || e.collocations.length > 0 || e.crossRefs.length > 0,
  ).length
  const withNote = entries.filter((e) => e.note).length

  const candidates: Array<GuideClaim | null> = [
    spread.studyPlan.days > 0
      ? {
          n: 0,
          key: 'Paced',
          label: '하루치가 정해져 있다',
          body: '하루에 몇 개를 며칠 동안 볼지 먼저 정하고 그 크기로 잘랐다. 분량을 학습자가 매번 정하지 않아도 된다.',
          evidence: `하루 ${spread.studyPlan.perDay}개 · ${spread.studyPlan.days}일`,
        }
      : null,
    withPair > 0
      ? {
          n: 0,
          key: 'In context',
          label: '뜻마다 예문과 해석을 함께',
          body: '맥락 없이 외운 뜻은 필요할 때 나오지 않는다. 뜻 갈래마다 그 뜻으로 쓰인 문장과 해석을 붙였다.',
          evidence: `예문 ${pct(withExample, n)}% · 해석까지 ${pct(withPair, n)}%`,
        }
      : null,
    multiSense > 0
      ? {
          n: 0,
          key: 'Split senses',
          label: '뜻이 여럿이면 갈라서',
          body: '뜻을 한 덩어리로 주면 어느 뜻도 남지 않는다. 갈래를 번호로 나누고 각각에 예문을 두었다.',
          evidence: `뜻 둘 이상 ${pct(multiSense, n)}%`,
        }
      : null,
    withNet > 0
      ? {
          n: 0,
          key: 'Networked',
          label: '낱말을 혼자 두지 않는다',
          body: '갈라져 나온 말·함께 쓰는 말·이 권 안의 관련 표제어를 같이 실어 한 번에 여럿을 가져가게 했다.',
          evidence: `그물 있는 표제어 ${pct(withNet, n)}%`,
        }
      : null,
    spread.reviews.length > 0
      ? {
          n: 0,
          key: 'Recycled',
          label: '지나간 것을 다시 묻는다',
          body: '한 번 보고 넘어가면 잊는다. 며칠치를 묶어 다시 묻는 지면을 사이사이에 두었다.',
          evidence: `누적 복습 ${spread.reviews.length}회`,
        }
      : null,
    withNote > 0
      ? {
          n: 0,
          key: 'Annotated',
          label: '헷갈리는 자리에 주석',
          body: '한국어 화자가 특히 틀리는 낱말에는 왜 틀리는지를 적었다.',
          evidence: `어법 주석 ${pct(withNote, n)}%`,
        }
      : null,
    spread.index.length > 0
      ? {
          n: 0,
          key: 'Indexed',
          label: '낱말로 되찾을 수 있다',
          body: '어느 날 것이었는지 몰라도 낱말로 찾아 그 자리로 갈 수 있다.',
          evidence: `색인 ${spread.index.length.toLocaleString()}개`,
        }
      : null,
  ]

  const claims = candidates
    .filter((c): c is GuideClaim => c !== null && c.evidence.trim().length > 0)
    .map((c, i) => ({ ...c, n: i + 1 }))

  return {
    question: `왜 「${spread.title}」인가`,
    claims,
    features,
    sampleWord: entries[0]?.word ?? null,
  }
}
