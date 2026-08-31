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

import {
  CSAT_ITEM_WORDS,
  CSAT_LONG_ITEM_WORDS,
  itemWordSpec,
  LONG_ITEM_TYPES,
  MAX_WORD_APPEARANCES,
  type Unit,
} from './compose-unit'
import spec from './market-spec.json'

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
 * 한 권의 단원 수 — **시중 9종 실측**(`market-spec.json` `units.unitsPerBook`).
 *
 * ⚠️ **2026-08-30 정정 — 여기 `20` 이라고 적혀 있었고 그 근거는 없었다.**
 *   같은 저장소가 시중 9종을 재서 남긴 값은 이렇다:
 *
 *     최소 5 · p25 7 · **중앙값 10** · p75 12 · p90 29
 *
 *   20 은 p75(12)보다도 위다. 그런데 항목 라벨은 "한 권이 **시중 교재 분량**에 닿는다" 였다 —
 *   시장을 참칭하는 임계값이었다. 그 탓에 18단원짜리 권이 미달로 잡혔는데, 실제로는
 *   시중 중앙값의 1.8배다. `middle-choice.ts` 의 "중등 4지선다" 와 같은 종류의 결함이고,
 *   반증도 같은 자리(이 저장소의 실측 파일)에 있었다.
 *
 *   기준은 **중앙값**으로 둔다 — 그것이 "시중 교재 분량" 이라는 말의 뜻이다.
 */
export const MARKET_UNITS_PER_BOOK = spec.units.unitsPerBook

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
  // ⚠️ **자를 유형마다 갈라 댄다.** 장문(43~45)은 300어가 정상 규격이라, 짧은 유형의
  //   창(90~200어)으로 재면 멀쩡한 문항이 "규격 밖" 으로 잡힌다 — 실제로 장문을 처음
  //   실었을 때 이 검사가 14문항을 그렇게 세어 9/9 를 8/9 로 떨어뜨렸다.
  //   **검사가 틀린 것이지 문항이 틀린 것이 아니었다.**
  // ⚠️ **밴드도 함께 넘긴다.** 조립기는 학년 창으로 걸러 놓고 채점은 유형 창으로만 재면,
  //   두 자가 갈려 "조립기가 통과시킨 것을 채점기가 규격 밖으로 세는" 일이 생긴다.
  //   한 권은 한 밴드다(아래 `bands` 검사가 그것을 지킨다) — 첫 단원의 밴드를 쓴다.
  const volumeBand = units.length === 1 || new Set(units.map((u) => u.band)).size === 1
    ? units[0]?.band ?? null
    : null
  const outOfSpec = allItems.filter((i) => {
    const spec = itemWordSpec(i.type, volumeBand)
    return i.passage_words < spec.min || i.passage_words > spec.max
  })
  const longCount = allItems.filter((i) => LONG_ITEM_TYPES.has(i.type)).length
  auto.push({
    audience: 'learner',
    label: '지문 길이가 수능 규격이다',
    pass: outOfSpec.length === 0,
    detail:
      `${allItems.length}문항 중 규격 밖 ${outOfSpec.length} ` +
      `(짧은 유형 ${CSAT_ITEM_WORDS.min}~${CSAT_ITEM_WORDS.max}어` +
      (longCount ? ` · 장문 ${longCount}문항은 ${CSAT_LONG_ITEM_WORDS.min}~${CSAT_LONG_ITEM_WORDS.max}어` : '') +
      `)`,
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

  // ⚠️ 완전 중복 금지에서 **횟수 상한**으로 바뀌었다(`MAX_WORD_APPEARANCES`).
  //   완전 금지는 뒤 단원의 어휘를 말리고(실측 20단원 중 2개가 0개), 학습원칙 2
  //   (Spaced Repetition)와도 어긋난다 — 재등장은 결함이 아니라 설계다.
  const overCount = new Map<string, number>()
  for (const w of allWords) overCount.set(w, (overCount.get(w) ?? 0) + 1)
  const tooMany = [...overCount.entries()].filter(([, n]) => n > MAX_WORD_APPEARANCES)
  auto.push({
    audience: 'learner',
    label: `같은 낱말이 ${MAX_WORD_APPEARANCES}번을 넘지 않는다`,
    pass: tooMany.length === 0,
    detail:
      `어휘 ${allWords.length}개 · 서로 다른 ${uniqWords.size}개 · 상한 초과 ${tooMany.length}`,
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

  // ⚠️ 처음엔 `< 15` 로 판정했는데 **그 15에 근거가 없었다** — 내가 정한 숫자다.
  //   이 저장소에서 근거 없는 임계값을 세웠다 지운 적이 세 번 있어서, 여기서는
  //   **발주한 목표치와 비교**한다. 목표는 조합이 이미 알고 있는 값(`vocabCount`,
  //   기본 20)이고, 미달 단원 수를 그대로 보고한다 — 없는 기준을 만들지 않는다.
  //
  //   실측 근거(V5): 원글 35편의 밴드±1 어휘가 글당 평균 122개(최소 16 · 최대 546),
  //   밴드±1 총계 1,844개로 20단원×20개=400개의 4.6배다. **재고는 넉넉하다.**
  //   미달이 생기는 건 어휘가 적은 글이 여러 단원에 재등장하며 소진될 때다.
  // ⚠️ **목표를 데이터에서 끌어오면 "없음" 이 "고름" 으로 통과한다** (실측 2026-08-31).
  //   `target` 은 단원 중 최대 어휘 수다. V1 은 초등 저학년 3종(rhyme·word_meaning·
  //   spell_blank)만 실려 어휘가 **모든 단원에서 0** 인데, 그러면 목표도 0 이 되어
  //   `0 < 0` 이 거짓이라 미달이 0 건으로 잡힌다 — 화면에는 **"9/9 통과"** 가 뜬다.
  //   그 권에는 어휘 목록이 한 줄도 없다. **비어 있는 것과 고른 것은 다르다.**
  //   그래서 최대가 0 이면 고름을 논할 대상이 없다고 말하고 실패로 센다.
  const target = Math.max(...units.map((u) => u.vocabulary.length), 0)
  const belowTarget = units.filter((u) => u.vocabulary.length < target)
  const noVocabAtAll = target === 0
  auto.push({
    audience: 'teacher',
    label: '단원마다 어휘가 고르다',
    pass: !noVocabAtAll && belowTarget.length === 0,
    detail: noVocabAtAll
      ? `${units.length}단원 전부 어휘 0개 — 고를 것이 없다(어휘 목록이 실리지 않는 권이다)`
      : `${units.length}단원 중 목표(${target}개) 미달 ${belowTarget.length}` +
        (belowTarget.length
          ? ` — 최소 ${Math.min(...belowTarget.map((u) => u.vocabulary.length))}개`
          : ''),
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
    pass: units.length >= MARKET_UNITS_PER_BOOK.median,
    detail:
      `${units.length}/${MARKET_UNITS_PER_BOOK.median}단원 ` +
      `(시중 ${MARKET_UNITS_PER_BOOK.n}종 실측 중앙값 · p25 ${MARKET_UNITS_PER_BOOK.p25} · p75 ${MARKET_UNITS_PER_BOOK.p75})`,
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
