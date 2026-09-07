// packages/library-pipeline/src/textbook/dossier.ts
//
// **권 서지 — 교재 한 권의 구성요소를 파이프라인이 만든다.**
//
// ── 왜 파이프라인인가 (2026-09-06) ──────────────────────────────────
// 학습자 상세면이 구성요소 **14축 중 1축**만 갖고 있었다(난이도 표시). 시중은 중앙값 5축
// 최다 8축이다(`apparatus.ts`). 없던 축을 화면에 손으로 적어 넣으면 그 순간
// **화면이 교재를 짓는 것**이 되고, 권이 일곱이니 일곱 번 손으로 적게 된다 —
// 한 권만 고쳐도 나머지 여섯이 어긋난다.
//
// 그래서 여기서 만든다. 이 파일은 **순수 함수**다: DB 를 읽지 않고, 재고 요약과
// 사다리 정보만 받아 구성요소를 낸다. 같은 입력이면 같은 책이 나온다.
//
// ── 지어내지 않는 것 ────────────────────────────────────────────────
// · **수치는 받은 것만 쓴다.** 해설 비율은 `explainedCount` 가 `null` 이면 아예 말하지 않는다
//   (0% 라고 적는 순간 거짓이 된다 — 못 센 것과 없는 것은 다르다).
// · **목차는 여기서 만들지 않는다.** 실제 단원 조합은 길이 게이트와 "한 단원의 문항은
//   서로 다른 글에서" 규칙을 더 걸기 때문에, 재고만으로 목차를 지으면 부풀려진다.
//   목차는 조판된 권(`render-volume.mjs`)에서만 나온다 — 그 축은 여기 없다.
// · **부가 자료는 실제로 있는 것만 적는다.** 음원·시험지처럼 없는 것을 적지 않는다.

import { buildColophon, type Colophon } from './brand'
import { COVER_BRAND, coverSpecOf, type CoverSpec } from './cover'
import { SERIES_BRAND, SERIES_SPINE, type SeriesRung } from './series'
// ⚠️ **분(分)이 두 개다.** 같은 이름의 상수가 두 파일에 있고 값이 다르다 —
// assemble-unit 2분(지문에 문항을 붙이는 모델) · compose-unit 3분(문항이 곧 지문인 모델).
// 어느 하나를 골라 단일 숫자로 인쇄하면 근거 없는 정밀함이 된다. 둘 다 받아 **범위**로 말한다.
import { MINUTES_PER_ITEM } from './assemble-unit'
import { DEFAULT_SLOTS, MINUTES_PER_ITEM as COMPOSE_MINUTES_PER_ITEM } from './compose-unit'
import { MARKET_UNITS_PER_BOOK } from './scorecard'

/**
 * 권마다 다른 **머리말**.
 *
 * ⚠️ 이 글은 사람이 읽는 산문이고, 생성기가 지어낼 수 있는 종류가 아니다. 그래서
 *   `SERIES_SPINE.rationale` 과 같은 자리에 **손으로 쓴 정본**을 둔다 — 다만 화면이 아니라
 *   여기에 둬서, 조판기(`render-volume.mjs`)와 상세면이 **같은 글**을 쓰게 한다.
 *
 * 규칙 셋:
 *   · 첫 문단은 **이 학년이 지금 겪는 일**에서 시작한다(제품 자랑이 아니라).
 *   · 둘째 문단은 **지문의 출처**를 밝힌다 — 검증할 수 없는 지문은 교재가 아니다.
 *   · 마지막 한 줄은 Lora italic 으로 앉는 "사람의 말투" 다(CLAUDE.md 철학 3).
 */
export interface PrefaceCopy {
  title: string
  paragraphs: readonly string[]
  closing: string
}

const PREFACE: Readonly<Record<number, PrefaceCopy>> = {
  1: {
    title: '읽는 일이 즐거운 일로 남게',
    paragraphs: [
      '이 나이의 읽기는 속도가 아니라 **버릇**입니다. 하루에 한 쪽이라도 끝까지 읽어 본 아이가 다음 날에도 펼칩니다. 그래서 한 단원을 짧게 잡았습니다.',
      '지문은 지어내지 않았습니다. 공개 원문에서 가져와 이 학년이 읽을 수 있는 길이로 다듬은 것이고, 어디서 왔는지 지문마다 밝혀 두었습니다.',
    ],
    closing: '끝까지 읽은 날이 쌓이면, 그것이 실력입니다.',
  },
  2: {
    title: '낱말에서 문장으로 건너가는 자리',
    paragraphs: [
      '낱말을 아는 것과 문장을 읽는 것은 다른 일입니다. 이 권은 흩어진 낱말을 문장으로 세워 보게 합니다 — 정답이 원문이라 맞았는지 아닌지가 분명합니다.',
      '지문은 공개 원문에서 가져와 이 학년의 길이에 맞춘 것입니다. 출처는 지문마다 적혀 있습니다.',
    ],
    closing: '문장이 만들어지는 순간을 손으로 겪어 보는 것이 이 권의 목적입니다.',
  },
  3: {
    title: '문장이 길어져도 끊기지 않게',
    paragraphs: [
      '중학교에 들어오면 문장이 길어집니다. 길어진 문장에서 막히는 이유는 대개 낱말이 아니라 **어디서 끊어 읽을지**를 모르기 때문입니다.',
      '지문은 공개 원문에서 가져왔고, 이 학년의 길이 창에 맞춰 다듬었습니다. 출처를 감춘 지문은 검증할 수 없고, 검증할 수 없는 지문은 교재가 아니라 연습장입니다.',
    ],
    closing: '한 문장을 끝까지 밀고 나가는 힘이 다음 권의 바탕이 됩니다.',
  },
  4: {
    title: '읽고 나서 무엇이 남았는지 확인할 수 있는 책',
    paragraphs: [
      '중3은 어법이 처음으로 성적에 직접 반영되는 학년입니다. 그런데 어법을 따로 떼어 외우면 지문 안에서는 다시 안 보입니다. 이 책은 같은 규칙을 **고르게 하고, 또 쓰게** 합니다 — 학교 시험이 실제로 그렇게 내기 때문입니다.',
      '지문은 지어내지 않았습니다. 공개 원문에서 가져와 이 학년의 길이 창에 맞춘 것이고, 어디서 왔는지 지문마다 밝혀 두었습니다. 출처를 감춘 지문은 검증할 수 없고, 검증할 수 없는 지문은 교재가 아니라 연습장입니다.',
    ],
    closing: '틀린 문항은 지워지지 않고 남습니다. 틀린 자리가 곧 다음에 볼 자리입니다.',
  },
  5: {
    title: '수능 규격이 처음 열리는 권',
    paragraphs: [
      '고1의 학력평가는 수능과 같은 규격으로 냅니다. 이 권에서 글 순서와 문장 삽입이 열리는 이유가 그것입니다 — 지문이 90~200어 창에 들어오는 첫 계단이기 때문입니다.',
      '지문은 공개 원문에서 가져와 그 창에 맞춘 것입니다. 출처는 지문마다 적혀 있어 원문을 직접 확인할 수 있습니다.',
    ],
    closing: '규격을 먼저 몸에 익히면, 남은 것은 글을 읽는 일뿐입니다.',
  },
  6: {
    title: '글 전체를 봐야 풀리는 문항들',
    paragraphs: [
      '고2에서 더해지는 것은 흐름 무관입니다. 한 문장만 보고는 절대 풀 수 없고, 글 전체의 논지를 잡아야 답이 보입니다.',
      '지문은 공개 원문에서 가져왔습니다. 학술 원문이 섞이는 계단이라 논문 서식(서지 줄·구조 초록·통계 잔해)은 걸러 내고 실었습니다.',
    ],
    closing: '한 문단이 아니라 한 편을 읽는 눈이 여기서 만들어집니다.',
  },
  7: {
    title: '마지막 계단',
    paragraphs: [
      '수능 상위 문항이 어려운 이유는 낱말이 아니라 **문장 사이의 거리**입니다. 앞 문장과 뒤 문장이 멀수록, 그 사이를 잇는 근거를 스스로 세워야 합니다.',
      '지문은 공개 원문에서 가져왔고, 학술 서식은 전부 걷어 냈습니다. 출처는 지문마다 적혀 있습니다.',
    ],
    closing: '여기까지 왔다면, 남은 것은 시간을 재고 푸는 일뿐입니다.',
  },
}

/** 서지를 만들 때 화면이 이미 갖고 있는 값들. **여기서 DB 를 읽지 않는다.** */
export interface DossierInput {
  step: number
  /** 권 제목 — `SERIES_SPINE` 이 소유한다. */
  title: string
  schoolBand: string
  vLevels: readonly number[]
  /** 이 권이 쓰는 유형 열쇠. */
  types: readonly string[]
  /** 유형별 재고. */
  byType: Readonly<Record<string, number>>
  /** 이 권에 쓸 수 있는 문항 수. */
  itemCount: number
  /** 해설이 붙은 문항 수 — **못 셌으면 `null`.** 0 과 구별한다. */
  explainedCount: number | null
  /** 갈래별 문항 수. 빈 객체면 못 읽은 것이다. */
  bySource: Readonly<Record<string, number>>
  /** 발행일. 테스트가 고정할 수 있게 받는다. */
  issued?: Date
}

export interface DossierFeature {
  no: number
  title: string
  body: string
}

export interface DossierPlanDay {
  /** 요일 라벨. */
  day: string
  /** 이 날 할 일 — 비는 날은 `null`. */
  task: string | null
  note: string
}

export interface DossierPlanWeek {
  label: string
  days: readonly DossierPlanDay[]
}

export interface DossierEntry {
  label: string
  detail: string
}

export interface VolumeDossier {
  brand: string
  cover: CoverSpec
  preface: PrefaceCopy
  features: readonly DossierFeature[]
  studyPlan: {
    weeks: readonly DossierPlanWeek[]
    /** 계획표가 세운 단원 수 — 시장 중앙값을 따른다. */
    units: number
    minutesPerUnit: [number, number]
  }
  colophon: Colophon
  appendix: readonly DossierEntry[]
  extras: readonly DossierEntry[]
  difficulty: {
    step: number
    totalSteps: number
    schoolBand: string
    vLevels: readonly number[]
    /** 사다리 일곱 단 라벨 — 앞뒤 권을 함께 보여 준다. */
    rungs: readonly { step: number; schoolBand: string; current: boolean }[]
  }
}

/**
 * 한 단원에 **인쇄되는** 문항 수 — 뼈대 슬롯의 합(순서 2 + 삽입 2 = 4).
 *
 * ⚠️ `rung-mix.ts` 의 `ITEMS_PER_UNIT`(6)와 **다른 수**다. 그쪽은 생성형 2문항을 더한
 *   설계상의 단원 크기이고, 이쪽은 조판물과 상세면이 실제로 세는 수다. 이름을 같게 두면
 *   화면이 6 을 적고 책이 4 를 찍는 어긋남이 조용히 생긴다.
 */
export const SKELETON_ITEMS_PER_UNIT: number = Object.values(DEFAULT_SLOTS).reduce((a, b) => a + b, 0)

/**
 * 이 권의 **특징 넷**.
 *
 * ⚠️ 넷을 고정으로 적지 않는다 — 권마다 유형 구성과 재고가 달라서, 같은 문장을 일곱 번
 *   쓰면 여섯 번은 거짓이 된다. 재고에서 참인 것만 고른다.
 */
function buildFeatures(input: DossierInput): DossierFeature[] {
  const out: DossierFeature[] = []
  const minutes: [number, number] = [
    SKELETON_ITEMS_PER_UNIT * MINUTES_PER_ITEM,
    SKELETON_ITEMS_PER_UNIT * COMPOSE_MINUTES_PER_ITEM,
  ]

  out.push({
    no: out.length + 1,
    title: `한 단원 = 문항 ${SKELETON_ITEMS_PER_UNIT}개`,
    body: `약 ${minutes[0]}~${minutes[1]}분이면 한 단원이 끝납니다. 짧게 잡은 이유는 하루에 끝낼 수 있어야 다음 날에도 펼치기 때문입니다.`,
  })

  out.push({
    no: out.length + 1,
    title: '한 단원의 문항은 서로 다른 글에서',
    body: '같은 글을 네 번 묻는 것은 네 번 읽는 것이 아니라 한 번 읽고 세 번 기억하는 일입니다. 그래서 한 단원 안에서 지문이 겹치지 않게 짭니다.',
  })

  // 해설 — **못 셌으면 말하지 않는다.**
  if (input.explainedCount !== null && input.itemCount > 0) {
    const pct = Math.round((input.explainedCount / input.itemCount) * 100)
    out.push({
      no: out.length + 1,
      title: pct >= 100 ? '해설이 전부 붙습니다' : `해설이 붙은 문항 ${pct}%`,
      body:
        '정답 근거와 오답이 왜 틀렸는지를 함께 답니다. 맞은 문항도 왜 맞았는지 확인할 수 있어야 다음에 또 맞습니다.' +
        (pct >= 100 ? '' : ' 나머지는 근거를 지문에서 확정하지 못해 싣지 않았습니다 — 지어내지 않습니다.'),
    })
  }

  // 출처 — **못 읽었으면 말하지 않는다**(빈 객체).
  const sources = Object.keys(input.bySource)
  if (sources.length > 0) {
    out.push({
      no: out.length + 1,
      title: '지문마다 출처를 밝힙니다',
      body: '공개 원문에서 가져와 학습용으로 편집했고, 어디서 왔는지 각 지문 아래에 적습니다. 원문을 직접 확인할 수 있습니다.',
    })
  }

  return out
}

/**
 * 2주 계획표.
 *
 * ⚠️ **비는 날을 남긴다.** 빈칸이 있어야 한 번 빠져도 계획을 버리지 않는다 —
 *   7일을 꽉 채운 계획표는 이틀째에 버려진다.
 */
function buildStudyPlan(units: number): VolumeDossier['studyPlan'] {
  const weekdays = ['월', '화', '수', '목', '금', '토', '일']
  const weeks: DossierPlanWeek[] = []
  let unit = 1

  for (let w = 0; w < 2; w += 1) {
    const days: DossierPlanDay[] = []
    for (let d = 0; d < 7; d += 1) {
      const isReviewDay = d === 4 // 금요일
      const isRest = w === 0 && d >= 5 // 첫 주 주말은 메우는 날
      if (isReviewDay) {
        days.push({
          day: weekdays[d]!,
          task: `복습 ${w + 1}`,
          note: `UNIT ${Math.max(1, unit - 4)}–${Math.max(1, unit - 1)} 다시 보기`,
        })
        continue
      }
      if (isRest) {
        days.push({ day: weekdays[d]!, task: null, note: d === 5 ? '밀린 날 메우기' : '쉬는 날' })
        continue
      }
      if (unit > units) {
        days.push({ day: weekdays[d]!, task: null, note: '밀린 날 메우기' })
        continue
      }
      days.push({ day: weekdays[d]!, task: `UNIT ${String(unit).padStart(2, '0')}`, note: `문항 ${SKELETON_ITEMS_PER_UNIT}` })
      unit += 1
    }
    weeks.push({ label: `${w + 1}주차`, days })
  }

  return {
    weeks,
    units,
    minutesPerUnit: [SKELETON_ITEMS_PER_UNIT * MINUTES_PER_ITEM, SKELETON_ITEMS_PER_UNIT * COMPOSE_MINUTES_PER_ITEM],
  }
}

/**
 * 권 서지를 만든다.
 *
 * @param input 화면이 이미 갖고 있는 재고 요약 — 여기서 DB 를 다시 읽지 않는다.
 */
export function buildDossier(input: DossierInput): VolumeDossier {
  const rung: Pick<SeriesRung, 'step' | 'schoolBand' | 'volumeTitle'> = {
    step: input.step,
    schoolBand: input.schoolBand,
    volumeTitle: input.title,
  }

  const preface =
    PREFACE[input.step] ??
    // 사다리에 없는 권은 **비워 두지 않고** 시리즈 공통 문장을 쓴다 — 빈 머리말은
    // "아직 안 썼다" 로 읽히고, 그것은 상품이 아니다.
    PREFACE[4]!

  // 판권의 검수 수치는 **조판이 실제로 돌린 결과**여야 한다. 상세면은 그 결과를 갖고
  // 있지 않으므로 **0/0 을 적지 않고** 문장으로만 남긴다(`buildColophon` 이 처리).
  const colophon = buildColophon({
    title: input.title,
    step: input.step,
    schoolBand: input.schoolBand,
    vLevel: input.vLevels[0] ?? 0,
    issued: input.issued,
    autoPassed: 0,
    autoTotal: 0,
  })

  const appendix: DossierEntry[] = []
  const sourceKeys = Object.keys(input.bySource).filter((k) => (input.bySource[k] ?? 0) > 0)
  if (sourceKeys.length > 0) {
    appendix.push({
      label: '지문 출처 일람',
      detail: `${sourceKeys.length}개 갈래 — 각 지문 아래에 원문 출처를 적습니다.`,
    })
  }
  appendix.push({
    label: '학습 계획표',
    detail: `${MARKET_UNITS_PER_BOOK.median}단원을 2주에 나눈 기본안. 밀린 날을 메우는 자리를 비워 두었습니다.`,
  })

  const extras: DossierEntry[] = []
  extras.push({
    label: '틀린 낱말이 단어장으로',
    detail: '지문에서 막힌 낱말이 그대로 복습 카드가 됩니다 — 옮겨 적을 일이 없습니다.',
  })
  extras.push({
    label: '오늘의 학습과 이어짐',
    detail: '담아 두면 오늘의 학습이 이 권의 수준에서 먼저 문항을 고릅니다.',
  })
  if (input.explainedCount !== null && input.explainedCount > 0) {
    extras.push({
      label: '해설 열람',
      detail: '푼 직후 정답 근거와 오답 이유를 그 자리에서 봅니다 — 별책을 따로 찾지 않습니다.',
    })
  }

  const rungs = SERIES_SPINE.map((r) => ({
    step: r.step,
    schoolBand: r.schoolBand,
    current: r.step === input.step,
  }))

  return {
    brand: COVER_BRAND || SERIES_BRAND,
    cover: coverSpecOf(rung, COVER_BRAND, SERIES_SPINE.length, false),
    preface,
    features: buildFeatures(input),
    studyPlan: buildStudyPlan(MARKET_UNITS_PER_BOOK.median),
    colophon,
    appendix,
    extras,
    difficulty: {
      step: input.step,
      totalSteps: SERIES_SPINE.length,
      schoolBand: input.schoolBand,
      vLevels: input.vLevels,
      rungs,
    },
  }
}
