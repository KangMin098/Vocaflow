// packages/library-pipeline/src/textbook/scorecard.ts
//
// **학습자·교사·학부모 세 관점 채점표.**
//
// ── 왜 필요한가 ──────────────────────────────────────────────────────
// 목표에 "세 사람이 이 교재를 선택할 수 있는 종합 평가에서 우위" 가 있는데,
// 여기까지 **형식과 재고만 쟀고 그 축은 한 번도 측정한 적이 없다.**
// 재지 않으면 "우위" 는 확인할 수 없는 말이 된다.
//
// ── 자동으로 재는 것과 사람이 볼 것을 나눈다 ─────────────────────────
// 채점표를 전부 자동화하면 잴 수 없는 것에 가짜 점수가 붙는다. 그래서 둘로 나눈다:
//
//   auto   단원 데이터만으로 판정 가능 — 형식·분량·중복·출처
//   human  사람이 봐야 하는 것 — 소재 적절성·오답 매력도·레벨 타당성
//
// `human` 항목은 **점수를 만들지 않고 질문만 남긴다.** 이 저장소에서 근거 없는 임계값을
// 세웠다 지운 적이 두 번 있어서(소스 감사 Cycle 5·6), 못 재는 것에 숫자를 붙이지 않는다.

import { CSAT_ITEM_WORDS, type Unit } from './compose-unit'

export type Audience = 'learner' | 'teacher' | 'parent'

export interface AutoCheck {
  audience: Audience
  /** 무엇을 봤는가. 화면·리포트에 그대로 쓰는 문장. */
  label: string
  pass: boolean
  /** 실측값. 통과든 아니든 남긴다 — 숫자가 없으면 다음에 또 재야 한다. */
  detail: string
}

export interface HumanCheck {
  audience: Audience
  label: string
  /** 사람에게 던지는 질문. 답은 코드가 만들지 않는다. */
  question: string
  /** 판단에 필요한 재료(자동으로 뽑을 수 있는 것). */
  evidence: string
}

export interface Scorecard {
  auto: AutoCheck[]
  human: HumanCheck[]
  /** 자동 항목만의 통과율. human 은 분모에 넣지 않는다 — 섞으면 점수가 거짓이 된다. */
  autoPassRate: number
}

/** 한 단원이 학습자에게 적당한 분량인가 — 수능 1회분(70분)의 4분의 1 안팎. */
export const UNIT_MINUTES = { min: 10, max: 25 } as const

/**
 * 단원 묶음(=한 권)을 채점한다.
 *
 * 권 단위로 보는 이유: 단원 하나만 보면 "같은 소재가 반복되는가" 를 볼 수 없다.
 */
export function scoreVolume(units: ReadonlyArray<Unit>): Scorecard {
  const auto: AutoCheck[] = []
  const human: HumanCheck[] = []

  const allItems = units.flatMap((u) => u.items)
  const allWords = units.flatMap((u) => u.vocabulary.map((v) => v.word))
  const uniqWords = new Set(allWords)

  // ── 학습자 ─────────────────────────────────────────────────────────
  const outOfSpec = allItems.filter(
    (i) => i.passage_words < CSAT_ITEM_WORDS.min || i.passage_words > CSAT_ITEM_WORDS.max,
  )
  auto.push({
    audience: 'learner',
    label: '지문 길이가 수능 규격이다',
    pass: outOfSpec.length === 0,
    detail: `${allItems.length}문항 중 규격 밖 ${outOfSpec.length} (기준 ${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어)`,
  })

  const badMinutes = units.filter(
    (u) => u.estimated_minutes < UNIT_MINUTES.min || u.estimated_minutes > UNIT_MINUTES.max,
  )
  auto.push({
    audience: 'learner',
    label: '한 단원을 한 자리에서 끝낼 수 있다',
    pass: badMinutes.length === 0,
    detail: `${units.length}단원 중 ${UNIT_MINUTES.min}~${UNIT_MINUTES.max}분 밖 ${badMinutes.length}`,
  })

  auto.push({
    audience: 'learner',
    label: '같은 낱말을 두 번 외우게 하지 않는다',
    pass: uniqWords.size === allWords.length,
    detail: `어휘 ${allWords.length}개 중 중복 ${allWords.length - uniqWords.size}`,
  })

  // 한 단원 안에서 같은 글이 두 번 나오면 같은 소재를 네 번 읽게 된다.
  const dupInUnit = units.filter((u) => new Set(u.items.map((i) => i.ref_id)).size !== u.items.length)
  auto.push({
    audience: 'learner',
    label: '한 단원에서 같은 글이 반복되지 않는다',
    pass: dupInUnit.length === 0,
    detail: `${units.length}단원 중 반복 ${dupInUnit.length}`,
  })

  human.push({
    audience: 'learner',
    label: '오답이 매력적인가',
    question: '틀린 답지를 골랐을 때 "그럴듯했다" 고 느끼는가, 아니면 명백히 틀려 보이는가?',
    evidence:
      '순서·삽입은 원문 구조가 정답을 정하므로 오답 설계가 필요 없다(결정론). ' +
      '빈칸·요지 유형을 넣는다면 이 질문이 핵심이 된다.',
  })

  // ── 교사 ───────────────────────────────────────────────────────────
  const noSource = units.filter((u) => u.sources.length === 0)
  auto.push({
    audience: 'teacher',
    label: '출처가 단원마다 밝혀져 있다',
    pass: noSource.length === 0,
    detail: `${units.length}단원 중 출처 없음 ${noSource.length}`,
  })

  const bands = new Set(units.map((u) => u.band))
  auto.push({
    audience: 'teacher',
    label: '한 권이 한 레벨로 묶여 있다',
    pass: bands.size <= 1,
    detail: `밴드 ${[...bands].join(', ') || '없음'}`,
  })

  const thinVocab = units.filter((u) => u.vocabulary.length < 15)
  auto.push({
    audience: 'teacher',
    label: '단원마다 어휘가 충분하다',
    pass: thinVocab.length === 0,
    detail: `${units.length}단원 중 15개 미만 ${thinVocab.length}`,
  })

  human.push({
    audience: 'teacher',
    label: '레벨 표기를 믿을 수 있는가',
    question: 'V5 라고 적힌 지문이 실제로 고1 수준인가?',
    evidence:
      'vocaflow_levels 12밴드 중 V7 만 KICE 13년으로 검증됐고(confidence 1.00) ' +
      'V6 은 0.70, 나머지 10개 밴드는 classification_method="in_progress" 다.',
  })

  human.push({
    audience: 'teacher',
    label: '소재가 수업에 쓸 만한가',
    question: '이 지문을 교실에서 읽힐 수 있는가?',
    evidence:
      '출처가 PD/CC 라 법적으로는 문제없다. 다만 소재는 백과·기관 보도자료·논문이라 ' +
      '수능 논설과 결이 다르다 — 이건 자동으로 못 재고 읽어 봐야 안다.',
  })

  // ── 학부모 ─────────────────────────────────────────────────────────
  const totalMinutes = units.reduce((a, u) => a + u.estimated_minutes, 0)
  auto.push({
    audience: 'parent',
    label: '한 권의 분량이 눈에 보인다',
    pass: units.length > 0,
    detail: `${units.length}단원 · 총 ${totalMinutes}분 (약 ${Math.round(totalMinutes / 60)}시간)`,
  })

  auto.push({
    audience: 'parent',
    label: '한 권이 시중 교재 분량에 닿는다',
    pass: units.length >= 20,
    detail: `${units.length}/20단원`,
  })

  human.push({
    audience: 'parent',
    label: '왜 이걸 믿어야 하는가',
    question: '브랜드도 저자도 없는 교재를 왜 쓰게 되는가?',
    evidence:
      '학부모는 AI 문항을 검증할 수 없어 **누가 줬는가**로 판단한다. ' +
      '교사·강사를 거치지 않는 직접 판매 경로는 이 질문에 답이 없다.',
  })

  const passed = auto.filter((c) => c.pass).length
  return { auto, human, autoPassRate: auto.length ? passed / auto.length : 0 }
}
