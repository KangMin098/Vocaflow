// packages/library-pipeline/src/textbook/school-types.ts
//
// **초·중·고 내신 문항 유형 정본.** 수능 유형(`csat-types.ts`)의 상위 집합이다.
//
// ── 왜 별도 파일인가 ────────────────────────────────────────────────
// 밴드마다 **유형 체계의 축이 다르다.** 한 표에 뭉뚱그리면 커버리지가 거짓말이 된다.
//
//   초등     소리·낱말 단위. **지문이 없거나 한두 문장**이다.
//   중등     교과서 본문 기반. 객관식 + **서술형**(영작·어법 고쳐쓰기)이 섞인다.
//   고내신   교과서·부교재 지문 변형. 서술형 비중이 더 크다.
//   수능     지문 기반 객관식 5지선다 18유형(별도 파일).
//
// ── 이 표가 밝히는 것 (2026-08-21 조사) ─────────────────────────────
// 앞서 "초중급(V1~4) 단원 0개" 를 **재료 부족**으로 진단했는데, 그게 아닐 수 있다.
// **초·중등은 순서·삽입을 거의 쓰지 않는다** — 그 유형은 수능 지문 길이를 전제한다.
// 즉 유형을 잘못 적용하고 있었고, 밴드에 맞는 유형은 따로 있다.
//
// ⚠️ **내신은 유형이 아니라 출처로 정의된다.** 학교 시험은 본교 교과서 지문에서 나오고,
//   그 지문은 출판사 저작물이라 우리가 공급할 수 없다. 내신 대비는 **교사·학생이 지문을
//   넣는 경로(BYO)로만** 성립한다 — 이 저장소의 `/fit`·`/text/new` 가 그 자리다.
//
// 조사 출처:
//   https://www.yoons.com/mediaroom/magazine/id/1046  (중등 서·논술형)
//   https://www.edujin.co.kr/news/articleView.html?idxno=49058  (고교 서술형 8유형)
//   https://baby.tali.kr/phonics-sightwords-learning  (초등 파닉스·사이트워드)

import type { CsatGeneration } from './csat-types'

export type SchoolBand = 'elementary' | 'middle' | 'high_naesin'

/** 답을 어떻게 받는가. **채점 방식이 갈린다.** */
export type AnswerMode =
  /** 객관식 — 자동 채점된다. */
  | 'choice'
  /** 단답 — 정답 문자열 비교로 자동 채점이 가능하다. */
  | 'short'
  /** 서술형 — **사람이 채점한다.** 우리 채점 모델 밖이다. */
  | 'written'

/** 문항을 만들려면 무엇이 있어야 하는가. */
export type SourceNeed =
  /** 아무 지문이나. */
  | 'any'
  /** **본교 교과서** — 저작권상 우리가 공급할 수 없다. BYO 전용. */
  | 'own_textbook'
  /** 서사 지문. */
  | 'narrative'
  /** 그림·음원·도표 등 지문 밖 재료. */
  | 'media'
  /** 지문이 필요 없다(낱말·소리 단위). */
  | 'none'

export interface SchoolType {
  key: string
  band: SchoolBand
  label: string
  generation: CsatGeneration
  answerMode: AnswerMode
  sourceNeed: SourceNeed
  implemented: boolean
  note: string
}

export const SCHOOL_TYPES: readonly SchoolType[] = [
  // ── 초등 — 지문이 없거나 한두 문장 ──────────────────────────────
  {
    key: 'phonics',
    band: 'elementary',
    label: '파닉스 (소리-철자)',
    generation: 'deterministic',
    answerMode: 'choice',
    sourceNeed: 'none',
    implemented: false,
    note: '같은 소리를 가진 낱말 고르기. 사전에 발음 정보가 있어야 하는데 `shared_dictionary` 에 없다.',
  },
  {
    key: 'sight_words',
    band: 'elementary',
    label: '사이트워드',
    generation: 'deterministic',
    answerMode: 'choice',
    sourceNeed: 'none',
    implemented: false,
    note: 'Dolch 목록(초등 저학년 약 130개)이 정본. v_level 0~2 어휘와 겹치므로 재료는 있다.',
  },
  {
    key: 'word_picture',
    band: 'elementary',
    label: '그림-낱말 연결',
    generation: 'external',
    answerMode: 'choice',
    sourceNeed: 'media',
    implemented: false,
    note: '낱말마다 그림이 필요하다. 저작권 없는 그림 세트가 없으면 성립하지 않는다.',
  },
  {
    key: 'listen_choose',
    band: 'elementary',
    label: '듣고 고르기',
    generation: 'external',
    answerMode: 'choice',
    sourceNeed: 'media',
    implemented: false,
    note: '음원이 필요하다. VOA 는 오디오가 있으나 초등 수준이 아니다.',
  },
  {
    key: 'spell_blank',
    band: 'elementary',
    label: '낱말 철자 완성',
    generation: 'deterministic',
    answerMode: 'short',
    sourceNeed: 'none',
    implemented: false,
    note: '낱말에서 글자를 지우고 채우게 한다. **정답이 하나로 확정**되고 재료는 사전에 다 있다.',
  },

  // ── 중등 — 교과서 본문 기반, 객관식 + 서술형 ─────────────────────
  {
    key: 'unit_vocab',
    band: 'middle',
    label: '본문 어휘 뜻',
    generation: 'deterministic',
    answerMode: 'choice',
    sourceNeed: 'any',
    implemented: false,
    note: '본문 낱말의 뜻 고르기. 오답은 같은 밴드의 다른 낱말 뜻이라 **결정론으로 만들 수 있다**.',
  },
  {
    key: 'unit_grammar',
    band: 'middle',
    label: '단원 문법',
    generation: 'deterministic',
    answerMode: 'choice',
    sourceNeed: 'any',
    implemented: false,
    note: '수일치·시제·조동사 등 규칙 기반. 수능 어법(29번)과 같은 생성기를 쓸 수 있다.',
  },
  {
    key: 'passage_comprehension',
    band: 'middle',
    label: '본문 내용 이해',
    generation: 'generative',
    answerMode: 'choice',
    sourceNeed: 'any',
    implemented: false,
    note: '오답이 "본문 사실을 한 군데 비튼 것" 이라 문장 변형으로 만들 여지가 있으나, 자연스러움이 관건이다.',
  },
  {
    key: 'word_order',
    band: 'middle',
    label: '영작 배열 (단어 힌트)',
    generation: 'deterministic',
    answerMode: 'short',
    sourceNeed: 'any',
    implemented: true,
    note:
      '`buildWordOrder` — 원문 문장의 어순을 섞으면 원문이 정답이다. 6~12어(실측 근거는 그 파일 주석). ' +
      '같은 낱말이 두 번 나오면 정답이 갈려 버리고, 문장 안 부호는 자리를 알려 줘서 버린다. ' +
      '첫 낱말 대문자도 답을 흘리므로 흔한 낱말이면 소문자로 내린다. ' +
      '실측 수율 **2,550/28,455 문장 = 9.0%** (2026-08-21).',
  },
  {
    key: 'blank_word',
    band: 'middle',
    label: '빈칸에 낱말 쓰기',
    generation: 'deterministic',
    answerMode: 'short',
    sourceNeed: 'any',
    implemented: false,
    note: '본문에서 낱말 하나를 지운다. 정답이 원문이라 확정된다.',
  },
  {
    key: 'grammar_fix',
    band: 'middle',
    label: '어법 틀린 것 고쳐 쓰기',
    generation: 'deterministic',
    answerMode: 'short',
    sourceNeed: 'any',
    implemented: false,
    note: '규칙으로 문장을 망가뜨리고 되돌리게 한다. 망가뜨린 쪽을 우리가 알므로 정답이 확정된다.',
  },

  // ── 고등 내신 — 교과서·부교재 지문 변형 ─────────────────────────
  {
    key: 'textbook_variant',
    band: 'high_naesin',
    label: '교과서 지문 변형',
    generation: 'deterministic',
    answerMode: 'choice',
    sourceNeed: 'own_textbook',
    implemented: false,
    note: '**우리가 공급할 수 없다** — 본교 교과서는 출판사 저작물이다. 교사·학생이 지문을 넣는 경로(BYO)에서만 성립한다.',
  },
  {
    key: 'written_composition',
    band: 'high_naesin',
    label: '서술형 영작',
    generation: 'generative',
    answerMode: 'written',
    sourceNeed: 'own_textbook',
    implemented: false,
    note: '**사람이 채점한다.** 자동 채점 모델 밖이라, 만들 수는 있어도 채점은 교사 몫이다.',
  },
  {
    key: 'write_topic',
    band: 'high_naesin',
    label: '주제·제목 영어로 쓰기',
    generation: 'generative',
    answerMode: 'written',
    sourceNeed: 'any',
    implemented: false,
    note: '낱말 수 제한을 두고 쓰게 한다. 정답이 여럿이라 채점이 사람 몫이다.',
  },
] as const

export interface SchoolCoverage {
  byBand: Record<SchoolBand, { total: number; implemented: number }>
  /** 자동 채점 가능한 것만 — 우리 파이프라인이 끝까지 다룰 수 있는 범위다. */
  autoGradable: { total: number; implemented: number }
  /** 결정론이고 자동 채점되며 지문 제약이 없는 것 — **가장 싸게 만들 수 있는 유형**. */
  cheapWins: SchoolType[]
  /** 저작권상 우리가 공급할 수 없는 것 — BYO 로만 가능하다. */
  byoOnly: SchoolType[]
}

export function measureSchoolCoverage(
  types: readonly SchoolType[] = SCHOOL_TYPES,
): SchoolCoverage {
  const byBand = {
    elementary: { total: 0, implemented: 0 },
    middle: { total: 0, implemented: 0 },
    high_naesin: { total: 0, implemented: 0 },
  }
  let autoTotal = 0
  let autoImpl = 0
  for (const t of types) {
    byBand[t.band].total++
    if (t.implemented) byBand[t.band].implemented++
    if (t.answerMode !== 'written') {
      autoTotal++
      if (t.implemented) autoImpl++
    }
  }
  return {
    byBand,
    autoGradable: { total: autoTotal, implemented: autoImpl },
    cheapWins: types.filter(
      (t) =>
        !t.implemented &&
        t.generation === 'deterministic' &&
        t.answerMode !== 'written' &&
        (t.sourceNeed === 'any' || t.sourceNeed === 'none'),
    ),
    byoOnly: types.filter((t) => t.sourceNeed === 'own_textbook'),
  }
}
