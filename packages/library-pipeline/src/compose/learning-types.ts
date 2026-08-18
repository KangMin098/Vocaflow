// packages/library-pipeline/src/compose/learning-types.ts
//
// ACP §20 재저작 — 학습 유형이 파이프라인을 가른다.
//
// 지금까지의 발주서는 `register × CEFR` 두 축이었다. 그 축은 **서가의 빈 칸**을 말할 뿐
// **학습자가 무엇을 하러 왔는지**는 말하지 않는다. 수능을 준비하는 학습자와 회화를 원하는
// 학습자에게 같은 글을 주면, 둘 다에게 조금씩 맞지 않는 글이 된다.
//
// 그래서 학습 유형(Track × Skill × V밴드)을 1급 축으로 올린다. 유형이 정해지면 나머지가
// 전부 따라 정해진다:
//
//   유형 → ① 어느 소스에서 사실을 모을지  ② 어떻게 쓸지(길이·문형·표현)  ③ 무엇을 붙일지(활동)
//
// 축 값은 지어내지 않았다 — 저장소 실측(2026-08-17):
//   Track  6 : shared_dictionary.track_levels 키
//   Skill  5 : shared_dictionary.skill_type
//   Domain 8 : shared_dictionary.domain_levels 키
//   V-Level  : VRL 0–11

import { COMPOSE_ACTIVITIES } from './activities'
import { FACT_SOURCES, planFactSources, type FactSourceSpec } from './sources'
import { GRADE_BANDS, bandForVLevel, type GradeBandKey } from './spine'

/** VRL 학습 트랙 — 학습자가 선언한 목표. user_profiles.target_track_levels 와 같은 어휘. */
export type LearningTrack =
  | 'csat_korean'
  | 'general_proficiency'
  | 'academic_english'
  | 'conversational'
  | 'business_english'
  | 'literary'

/** 어휘 기능 축 — 무엇을 어휘로 볼 것인가. shared_dictionary.skill_type 과 같은 어휘. */
export type LexicalSkill = 'single_word' | 'collocation' | 'polysemy' | 'idiom' | 'phrasal_verb'

/** 글 유형. library_articles.register CHECK 와 같은 어휘. */
export type Register = 'expository' | 'argumentative' | 'narrative' | 'news' | 'reference'

export interface ComposeConstraints {
  /** 목표 어수 — 트랙마다 다르다. 수능 지문은 짧고 비즈니스 리포트는 길다. */
  words: { min: number; max: number }
  /** 목표 평균 문장 길이(어절). syntax_score 와 대조된다. */
  avgSentenceWords: number
  /**
   * 작성 지시 — **drain 프롬프트에 그대로 들어간다**.
   * 여기 적힌 것이 곧 산출물의 성격이므로, 모호한 형용사가 아니라 검사 가능한 문장으로 쓴다.
   */
  directives: ReadonlyArray<string>
}

export interface LearningTypeSpec {
  track: LearningTrack
  label: string
  /** 재저작으로 만들 수 있는 유형인가. false 면 발주 자체가 서지 않는다. */
  composable: boolean
  /** 이 트랙 학습자가 읽어야 하는 글 유형 */
  registers: ReadonlyArray<Register>
  /** 목표 V밴드 (VRL 0–11) */
  vBand: { min: number; max: number }
  /** topic_corpus_sources.category_id — 이 트랙에 맞는 주제 */
  topics: ReadonlyArray<string>
  /** 강조할 어휘 기능 — 작성 지시와 어휘 선별에 함께 쓰인다 */
  skills: ReadonlyArray<LexicalSkill>
  compose: ComposeConstraints
  /** 결과물 — COMPOSE_ACTIVITIES 키. 트랙마다 붙는 활동이 다르다. */
  activities: ReadonlyArray<string>
  note: string
}

/**
 * 학습 유형 6종.
 *
 * ⚠ `literary` 는 **재저작으로 만들 수 없다**. 사실에는 저작권이 없지만 서사는 사실이 아니고,
 *   사실 원장에서 소설을 지어내면 그건 학습 자료가 아니라 창작이다. 그 자리는 LCP(PD 도서)가
 *   이미 채우고 있다 — 여기서 흉내 내면 두 파이프라인이 같은 것을 다르게 만든다.
 */
export const LEARNING_TYPES: Record<LearningTrack, LearningTypeSpec> = {
  csat_korean: {
    track: 'csat_korean',
    label: '수능 국내',
    composable: true,
    registers: ['expository', 'argumentative'],
    vBand: { min: 4, max: 8 },
    topics: [
      'the-natural-world-the-environment',
      'science-and-technology',
      'politics-and-society-social-issues',
      'the-natural-world-weather',
    ],
    skills: ['single_word', 'polysemy', 'collocation'],
    compose: {
      // 실제 수능 지문은 짧다. 현재 서가 평균(1,100어)으로 쓰면 유형 연습이 안 된다.
      words: { min: 130, max: 190 },
      avgSentenceWords: 22,
      directives: [
        '한 문단으로 쓴다. 주제문 → 근거 → 함의 순서로 논지를 전개한다.',
        '지시어(this·such·그것)로 앞 문장을 받아 문장 간 결속을 만든다 — 순서·삽입 문항의 단서가 된다.',
        '다의어를 문맥으로만 판별되게 쓴다. 같은 단어를 두 가지 뜻으로 쓰지는 않는다.',
        '수치·고유명사는 사실 카드에 있는 것만 쓴다.',
      ],
    },
    // 순서·삽입은 수능 문항 유형 그 자체다 (DCP 가 결정론으로 생성).
    activities: ['read', 'word_set', 'order', 'insert', 'gapfill', 'comprehension'],
    note: '가장 짧고 밀도 높은 유형. 지문 길이를 서가 평균으로 쓰면 유형 연습이 되지 않는다.',
  },

  general_proficiency: {
    track: 'general_proficiency',
    label: '일반 영어',
    composable: true,
    registers: ['news', 'expository'],
    vBand: { min: 1, max: 6 },
    topics: [
      'politics-and-society-social-issues',
      'science-and-technology',
      'health-health-and-fitness',
      'the-natural-world-weather',
    ],
    skills: ['single_word'],
    compose: {
      words: { min: 180, max: 320 },
      avgSentenceWords: 14,
      directives: [
        '한 문장에 한 가지 사실만 담는다.',
        '가장 흔한 어휘로 쓴다. 같은 뜻이면 짧은 단어를 고른다.',
        '수동태·관계절을 피하고 능동·평서문으로 쓴다.',
        '첫 문단에서 육하원칙(누가·언제·어디서·무엇)을 모두 밝힌다.',
      ],
    },
    activities: ['read', 'word_set', 'gapfill', 'spelling', 'dictation', 'shadowing', 'comprehension'],
    note: '진입 밴드(A1–A2)를 여는 유형. 외부 소스로는 채울 방법이 사실상 없는 자리다.',
  },

  academic_english: {
    track: 'academic_english',
    label: '학술 영어',
    composable: true,
    registers: ['expository', 'argumentative'],
    vBand: { min: 7, max: 11 },
    topics: ['science-and-technology', 'the-natural-world-the-environment'],
    skills: ['single_word', 'collocation'],
    compose: {
      words: { min: 250, max: 450 },
      avgSentenceWords: 24,
      directives: [
        '주장과 근거를 분리해 쓴다. 근거는 사실 카드의 수치로만 뒷받침한다.',
        '한정 표현(may·suggests·is associated with)으로 단정을 피한다 — 연구 문체의 핵심이다.',
        '학술 연어(conduct research·yield results·account for)를 자연스럽게 쓴다.',
        '1인칭·감탄·수사 의문을 쓰지 않는다.',
      ],
    },
    activities: ['read', 'word_set', 'order', 'insert', 'comprehension'],
    note: '가장 어려운 밴드. eLife·PLOS·OWID 의 연구 사실이 재료가 된다.',
  },

  conversational: {
    track: 'conversational',
    label: '생활 회화',
    composable: true,
    registers: ['news', 'narrative'],
    vBand: { min: 2, max: 6 },
    topics: ['sport', 'health-health-and-fitness', 'people-education', 'work-and-business-working-life'],
    skills: ['idiom', 'phrasal_verb', 'collocation'],
    compose: {
      words: { min: 150, max: 260 },
      avgSentenceWords: 12,
      directives: [
        '사람이 말하듯 쓴다. 축약형(it\'s·didn\'t)을 자연스럽게 쓴다.',
        '구동사와 일상 관용구를 3개 이상 문맥 안에서 쓴다 — 이 트랙의 학습 목표다.',
        '"그래서 어떻게 생각하는가" 로 이어질 수 있는 사건을 고른다.',
        '전문 용어를 쓰지 않는다. 필요하면 쉬운 말로 풀어 쓴다.',
      ],
    },
    // Engoo 모델 — 대화로 이어지는 것이 결과물의 목적이다.
    activities: ['read', 'word_set', 'dictation', 'shadowing', 'gapfill', 'discussion'],
    note: '소프트 뉴스(문화·스포츠·생활)가 재료. 속보성 시사보다 대화 유발성이 선정 기준이다.',
  },

  business_english: {
    track: 'business_english',
    label: '비즈니스 영어',
    composable: true,
    registers: ['news', 'expository'],
    vBand: { min: 5, max: 9 },
    topics: ['work-and-business-business', 'work-and-business-working-life', 'politics-and-society-social-issues'],
    skills: ['collocation', 'phrasal_verb', 'single_word'],
    compose: {
      words: { min: 200, max: 350 },
      avgSentenceWords: 18,
      directives: [
        '숫자를 앞세운다 — 규모·비율·기간이 첫 문단에 들어간다.',
        '비즈니스 연어(market share·operating profit·roll out·scale back)를 문맥 안에서 쓴다.',
        '주체를 분명히 한다(회사·기관 이름). 수동태로 행위자를 감추지 않는다.',
        '전망·추측은 출처를 밝힌 형태로만 쓴다.',
      ],
    },
    activities: ['read', 'word_set', 'gapfill', 'spelling', 'comprehension', 'discussion'],
    note: 'OWID 지표 + 통신사 경제 보도가 재료. 수치 사실(kind=figure)의 비중이 가장 높다.',
  },

  literary: {
    track: 'literary',
    label: '문학',
    composable: false,
    registers: ['narrative'],
    vBand: { min: 4, max: 9 },
    topics: [],
    skills: ['polysemy', 'idiom'],
    compose: {
      words: { min: 0, max: 0 },
      avgSentenceWords: 0,
      directives: [],
    },
    activities: [],
    note: '재저작 대상 아님 — 사실에는 저작권이 없지만 서사는 사실이 아니다. 사실 원장에서 소설을 지어내면 학습 자료가 아니라 창작이 된다. 이 자리는 LCP(PD 도서)가 이미 채우고 있다.',
  },
}

// ── 유형 → 소스 ──────────────────────────────────────────────────────

export interface TypeSourcePlan {
  track: LearningTrack
  /** 이 유형의 주제 중 지금 발주 가능한 것 */
  feasibleTopics: string[]
  /** 막힌 주제와 사유 */
  blockedTopics: Array<{ topic: string; blocker: string }>
  /** 실제로 쓸 수 있는 출처 (중복 제거) */
  sources: FactSourceSpec[]
  /** 발주가 가능한가 */
  feasible: boolean
  blocker: string | null
}

/**
 * 학습 유형 → 쓸 수 있는 소스.
 *
 * 유형의 주제 목록을 소스 레지스트리에 물어 교집합을 낸다. 하나라도 발주 가능한 주제가
 * 있으면 그 유형은 성립한다 — 주제 전부가 열려 있을 필요는 없다.
 */
export function sourcesForType(track: LearningTrack): TypeSourcePlan {
  const spec = LEARNING_TYPES[track]
  if (!spec.composable) {
    return {
      track,
      feasibleTopics: [],
      blockedTopics: [],
      sources: [],
      feasible: false,
      blocker: `${spec.label}: 재저작 대상이 아니다 — ${spec.note}`,
    }
  }

  const feasibleTopics: string[] = []
  const blockedTopics: Array<{ topic: string; blocker: string }> = []
  const byKey = new Map<string, FactSourceSpec>()

  for (const topic of spec.topics) {
    const plan = planFactSources(topic)
    if (plan.feasible) {
      feasibleTopics.push(topic)
      for (const s of [...plan.primary, ...plan.corroborating]) byKey.set(s.key, s)
    } else {
      blockedTopics.push({ topic, blocker: plan.blocker ?? '알 수 없음' })
    }
  }

  return {
    track,
    feasibleTopics,
    blockedTopics,
    sources: [...byKey.values()],
    feasible: feasibleTopics.length > 0,
    blocker:
      feasibleTopics.length > 0
        ? null
        : `${spec.label}: 이 유형의 주제 ${spec.topics.length}개가 모두 막혀 있다 (교차 확인원 부족)`,
  }
}

// ── 발주서 ───────────────────────────────────────────────────────────

/** drain 작업 1건의 사양. article_compose_jobs 행이 되고, 그대로 프롬프트가 된다. */
export interface ComposeJobSpec {
  track: LearningTrack
  /**
   * 학령 밴드 — 어휘 스파인(V축) 위에서 이 발주가 서는 구간.
   *
   * 유형(track)에서 파생되며 새 결정이 아니다. 발주에 실어 두는 이유는, 같은 사실 원장에서
   * 초·중·고 판을 파생시킬 때 **드레인이 어느 어휘 범위로 써야 하는지**를 알아야 하기 때문이다.
   * 지금은 정보로만 싣고 어휘를 강제하지 않는다 — 임계는 분포를 본 뒤에 정한다(spine.ts 참조).
   */
  gradeBand: GradeBandKey
  register: Register
  /** 목표 V-Level (유형 vBand 안) */
  targetVLevel: number
  skillFocus: LexicalSkill
  words: { min: number; max: number }
  avgSentenceWords: number
  directives: ReadonlyArray<string>
  /** 발행 후 붙일 활동 */
  activities: ReadonlyArray<string>
}

/**
 * 학습 유형 + 목표 레벨 → 발주 사양.
 *
 * V-Level 이 유형 밴드를 벗어나면 **밴드로 자르지 않고 거부한다** — 조용히 보정하면
 * "수능 유형인데 V2" 같은 발주가 성공한 것처럼 보이고, 산출물이 어느 쪽에도 안 맞는다.
 */
export function buildJobSpec(
  track: LearningTrack,
  targetVLevel: number,
  opts: { register?: Register; skillFocus?: LexicalSkill } = {},
): ComposeJobSpec | { error: string } {
  const spec = LEARNING_TYPES[track]
  if (!spec.composable) return { error: `${spec.label} 은 재저작 대상이 아니다` }
  if (targetVLevel < spec.vBand.min || targetVLevel > spec.vBand.max) {
    return {
      error: `V${targetVLevel} 는 ${spec.label} 밴드(V${spec.vBand.min}–V${spec.vBand.max}) 밖이다. 밴드 안의 레벨을 지정하거나 다른 유형을 고른다.`,
    }
  }
  const register = opts.register ?? spec.registers[0]!
  if (!spec.registers.includes(register)) {
    return { error: `${spec.label} 은 ${register} 를 쓰지 않는다 (${spec.registers.join('·')})` }
  }
  // 학령은 **이 판의 목표 레벨**에서 나온다 — 같은 유형이 학령별 N판을 서기 위한 전제다.
  //   유형의 밴드 전체로 정하면 V2 발주와 V5 발주가 같은 학령으로 뭉개진다.
  const band = bandForVLevel(targetVLevel)
  const skillFocus = opts.skillFocus ?? spec.skills[0]!
  if (!spec.skills.includes(skillFocus)) {
    return { error: `${spec.label} 의 어휘 기능은 ${spec.skills.join('·')} 이다` }
  }

  return {
    track,
    gradeBand: band,
    register,
    targetVLevel,
    skillFocus,
    words: spec.compose.words,
    avgSentenceWords: spec.compose.avgSentenceWords,
    // 유형 지시 + 학령 지시. 학령 규칙(안전성·문단 단위)은 유형이 아니라 밴드가 갖는다.
    //   중복은 걸러 낸다 — 프롬프트에 같은 말이 두 번 들어가면 지시가 아니라 잡음이다.
    directives: [...new Set([...spec.compose.directives, ...GRADE_BANDS[band].directives])],
    activities: spec.activities,
  }
}

/** 발주 사양 → drain 프롬프트에 넣을 사람 읽는 사양서. */
export function renderJobBrief(job: ComposeJobSpec): string {
  const spec = LEARNING_TYPES[job.track]
  const acts = job.activities
    .map((k) => COMPOSE_ACTIVITIES[k]?.label ?? k)
    .join(' · ')
  return [
    `[학습 유형] ${spec.label} (${job.track})`,
    `[글 유형] ${job.register}`,
    `[목표] V${job.targetVLevel} · ${job.words.min}~${job.words.max}어 · 평균 문장 ${job.avgSentenceWords}어절`,
    `[어휘 기능] ${job.skillFocus}`,
    '[작성 지시]',
    ...job.directives.map((d) => `  - ${d}`),
    `[발행 후 활동] ${acts}`,
  ].join('\n')
}

/** 지금 발주 가능한 학습 유형 (소스가 받쳐 주는 것만). */
export function composableTracks(): LearningTrack[] {
  return (Object.keys(LEARNING_TYPES) as LearningTrack[]).filter((t) => sourcesForType(t).feasible)
}

/** 유형별 소스 커버리지 요약 — Admin ① 소스 화면의 표시원. */
export function trackCoverage(): Array<{
  track: LearningTrack
  label: string
  feasible: boolean
  topics: string
  sources: string
}> {
  return (Object.keys(LEARNING_TYPES) as LearningTrack[]).map((t) => {
    const plan = sourcesForType(t)
    return {
      track: t,
      label: LEARNING_TYPES[t].label,
      feasible: plan.feasible,
      topics: `${plan.feasibleTopics.length}/${LEARNING_TYPES[t].topics.length}`,
      sources: plan.sources.map((s) => s.key).sort().join(', ') || '—',
    }
  })
}

/** 레지스트리 정합 — 활동 키가 실제로 존재하는지(오타 방지). */
export function validateLearningTypes(): string[] {
  const errors: string[] = []
  for (const [track, spec] of Object.entries(LEARNING_TYPES)) {
    for (const a of spec.activities) {
      if (!COMPOSE_ACTIVITIES[a]) errors.push(`${track}: 알 수 없는 활동 '${a}'`)
    }
    for (const t of spec.topics) {
      const known = Object.values(FACT_SOURCES).some((s) => s.topics.includes(t) || s.topics.includes('*'))
      if (!known) errors.push(`${track}: 어떤 소스도 덮지 않는 주제 '${t}'`)
    }
  }
  return errors
}
