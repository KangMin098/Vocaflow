// packages/library-pipeline/src/compose/sources.ts
//
// ACP §20 재저작 — 사실 출처 레지스트리.
//
// ⚠ 기존 SOURCE_SPECS(ingest-article/_curation-spec.ts) 와 목적이 다르다. 헷갈리면 안 된다.
//
//   SOURCE_SPECS   : "이 소스의 **본문을 가져와 발행**해도 되는가" → 라이선스가 1차 판정 기준.
//   FACT_SOURCES   : "이 소스를 **사실의 증인**으로 삼아도 되는가" → 라이선스는 기준이 아니다.
//                    사실에는 저작권이 없으므로(§102(b)·Feist / 한국 저작권법 제7조 5호),
//                    CC-BY-ND 든 상업 뉴스든 **사실을 읽는 것 자체는 막히지 않는다**.
//
// 그래서 판정 축이 갈아끼워진다:
//   ① 1차성   — 사실의 원천인가(기관 스스로의 발표), 아니면 그것을 전한 보도인가.
//   ② 독립성  — 다른 출처와 취재 계통이 겹치지 않는가 (통신사 배급은 게이트가 접는다).
//   ③ 접근성  — 기계로 읽히는가, 그리고 **이용약관·robots 상 읽어도 되는가**.
//                이게 라이선스를 대신 들어온 축이다. 저작권과 완전히 별개 문제다.
//   ④ 주제    — 학습 지문으로 쓸 주제 축을 덮는가.
//
// ── 왜 이 층이 필요한가 (2026-08-17 실측) ──────────────────────────────
// topic_corpus_sources 의 활성 카테고리 19개 중 **11개가 재사용 불가 소스(TED ·
// CC BY-NC-ND)로만 덮여 있다**: health-* · people-education · people-feelings ·
// people-personal-qualities · work-and-business-* · sport · science-and-technology-computers ·
// the-natural-world-the-environment.
//
// 즉 **사람·사회·직업·건강 주제 절반은 본문 수집으로는 도달할 수 없다**. 남은 8개
// (지리·날씨·우주·생물·여행 등)는 이미 PD 기관 소스로 덮여 있어 아티클 서가가 포화된 쪽이다.
// 재저작이 여는 것은 "같은 주제를 한 겹 더"가 아니라 **닫혀 있던 주제 절반**이다.

/** 사실 출처 등급. */
export type FactSourceTier =
  /** 사실의 원천 — 기관이 스스로 발표한 것. 보도가 오히려 이것을 인용한다. */
  | 'primary'
  /** 교차 확인 — 사건을 독립적으로 취재해 전한 보도. I12 의 두 번째 독립 출처로 쓴다. */
  | 'corroborating'
  /**
   * 배경 사실 전용 — 사건이 아니라 맥락(개념·지명·역사)을 준다.
   * **독립 출처로 세지 않는다**: 백과는 보도를 인용해 쓰이므로 독립 취재가 아니고,
   * 이것을 두 번째 출처로 인정하면 실질 단일 출처인 글이 I12 를 통과해 버린다.
   */
  | 'background'

/** 배선 상태 — 이미 있는 어댑터를 재사용하는지, 새로 만들어야 하는지. */
export type FactSourceWiring =
  /** 저장소에 어댑터가 있고 실제로 수집된 실적이 있다. */
  | 'in-repo'
  /** 어댑터는 있으나 수집 실적 0 — 배선 점검 선행. */
  | 'in-repo-idle'
  /** 새 어댑터 필요. 엔드포인트·약관 확인이 선행돼야 한다. */
  | 'needs-adapter'

/**
 * 이용약관·robots 위험. **라이선스가 아니다** — 사실을 읽는 데 라이선스는 필요 없지만
 * 남의 서버를 긁는 데는 약관이 필요하다. 두 축을 한 칸에 적으면 반드시 혼동된다.
 */
export type TermsRisk =
  /** PD/CC 공개 자료 + 공개 API. 약관상 읽기가 명시적으로 허용된다. */
  | 'none'
  /** 읽기 전에 약관·robots 확인이 필요. 확인 전 수집 금지. */
  | 'check'

export interface FactSourceSpec {
  /** 출처 키 (기존 ACP SourceKey 와 겹치면 같은 기관을 가리킨다) */
  key: string
  /** 발행사 식별자 — I12 독립성 1차 판정 단위. 같은 publisher 는 절대 독립일 수 없다. */
  publisher: string
  tier: FactSourceTier
  wiring: FactSourceWiring
  termsRisk: TermsRisk
  /** topic_corpus_sources.category_id 어휘 (새로 만들지 않고 기존 분류를 쓴다) */
  topics: ReadonlyArray<string>
  /** 왜 이 등급인지 — 판단 근거를 남긴다 */
  note: string
}

/**
 * 채택 출처.
 *
 * 원칙: **새 크롤러부터 만들지 않는다.** 재저작에 필요한 독립 출처 2곳은 이미
 * 저장소에 배선된 소스만으로 대부분 충족된다 — 기관 1차 발표(PD) + VOA(PD 뉴스).
 * 그래서 1단계 목록은 전부 `in-repo` 이고, 새 어댑터는 닫힌 주제를 열 때만 만든다.
 */
export const FACT_SOURCES: Record<string, FactSourceSpec> = {
  // ── 1차 사실원 (기관 발표) ─────────────────────────────────────────
  usgs: {
    key: 'usgs',
    publisher: 'usgs.gov',
    tier: 'primary',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['the-natural-world-geography'],
    note: '지진·화산·지질 — 사건의 계측 주체 자체. 보도가 USGS 수치를 인용하므로 1차성이 가장 높다.',
  },
  noaa: {
    key: 'noaa',
    publisher: 'climate.gov',
    tier: 'primary',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['the-natural-world-weather', 'the-natural-world-the-environment'],
    note: '기후·해양·대기. CSAT 최빈출 주제이며 the-environment 는 현재 재사용 소스가 0인 칸이다.',
  },
  nasa: {
    key: 'nasa',
    publisher: 'nasa.gov',
    tier: 'primary',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['time-and-space-space', 'science-and-technology'],
    note: '발사·관측·탐사. 사건 시각이 명확해 I15(48시간) 판정이 깔끔하다.',
  },
  nih: {
    key: 'nih',
    publisher: 'nih.gov',
    tier: 'primary',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['health-health-and-fitness', 'health-mental-health'],
    note: 'MedlinePlus 는 환자 대상 평이 문체라 사실 추출이 쉽다. health-* 두 칸은 현재 TED 로만 덮인 곳.',
  },
  elife: {
    key: 'elife',
    publisher: 'elifesciences.org',
    tier: 'primary',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['science-and-technology-scientific-research', 'science-and-technology-biology'],
    note: '편집자 저작 plain-language digest — 연구 사실이 이미 사실 카드에 가까운 형태로 정리돼 있다.',
  },
  owid: {
    key: 'owid',
    publisher: 'ourworldindata.org',
    tier: 'primary',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['politics-and-society-social-issues', 'work-and-business-business'],
    note: '지표·통계. 수치 사실(kind=figure)의 공급원으로, 사회·경제 주제에서 유일한 재사용 가능 1차원.',
  },

  // ── 교차 확인원 ────────────────────────────────────────────────────
  voa: {
    key: 'voa',
    publisher: 'voanews.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    termsRisk: 'none',
    // SOURCE_SPECS.voa.topicDomain(news·science·health·culture·language-learning) 을
    // topic_corpus 카테고리로 옮긴 것. 피드가 실제로 다루는 범위만 적는다.
    topics: [
      'communication-language',
      'politics-and-society-social-issues',
      'science-and-technology',
      'health-health-and-fitness',
      'the-natural-world-weather',
      'the-natural-world-the-environment',
    ],
    note: '미 연방 PD 뉴스 — **약관 위험이 0인 유일한 뉴스 교차원**. 이미 30편 배선돼 있고 문체가 평이해 사실 추출 오류가 적다. 6개 피드가 시사·과학·건강을 나눠 덮는다.',
  },
  wikinews: {
    key: 'wikinews',
    publisher: 'wikinews.org',
    tier: 'corroborating',
    wiring: 'in-repo-idle',
    termsRisk: 'none',
    topics: ['politics-and-society-social-issues'],
    note: '어댑터는 있으나 수집 실적 0행(2026-08-17 실측) — 교차원으로 쓰려면 배선 점검이 선행돼야 한다.',
  },
  wikipedia: {
    key: 'wikipedia',
    publisher: 'wikipedia.org',
    tier: 'background',
    wiring: 'in-repo',
    termsRisk: 'none',
    topics: ['*'],
    note: '개념·지명·역사 등 맥락 제공. 사건의 교차 확인원으로는 쓰지 않는다 — 백과는 보도를 인용해 쓰이므로 독립 취재가 아니다.',
  },
}

/**
 * 명시적 제외 — "쓸 수 있는데 안 쓰는" 것들. 이유를 남기지 않으면 반드시 다시 논의된다.
 */
export const EXCLUDED_FACT_SOURCES: ReadonlyArray<{ key: string; reason: string }> = [
  {
    key: 'ted',
    reason:
      'topic_corpus 에서 사람·직업 주제를 유일하게 덮고 있어 후보로 떠오르지만, 강연 1건은 **단일 출처**라 I12 를 통과할 수 없고 가치의 대부분이 화자 고유의 표현·구성이라 사실만 남기면 남는 게 적다. 라이선스(CC BY-NC-ND) 때문이 아니라 사실 출처로서 부적합하다.',
  },
  {
    key: 'commercial-news',
    reason:
      '사실을 읽는 것 자체는 저작권 문제가 아니지만 이용약관·robots 가 별개 축으로 걸린다. PD/CC 교차원(VOA·Wikinews)으로 I12 가 충족되는 한 약관 위험을 살 이유가 없다.',
  },
  {
    key: 'social-media',
    reason: '사실 검증 경로가 없다. 교차 확인의 전제(독립적으로 취재됐다)가 성립하지 않는다.',
  },
]

// ── 취재 계획 ────────────────────────────────────────────────────────

export interface FactSourcePlan {
  /** 이 주제의 1차 사실원 후보 */
  primary: FactSourceSpec[]
  /** 이 주제의 교차 확인원 후보 */
  corroborating: FactSourceSpec[]
  /** 맥락 제공원 — 독립성 계산에 넣지 않는다 */
  background: FactSourceSpec[]
  /** primary+corroborating 의 서로 다른 publisher 수 — I12(독립 2곳)의 상한 */
  independentPublishers: number
  /** 지금 배선된 소스만으로 발주가 가능한가 */
  feasible: boolean
  /** feasible=false 일 때 무엇이 부족한지 */
  blocker: string | null
}

/** 이 주제를 덮는 소스인가. `'*'` 는 모든 주제(배경 사실용). */
function covers(spec: FactSourceSpec, category: string): boolean {
  return spec.topics.includes('*') || spec.topics.includes(category)
}

/**
 * 주제 카테고리 → 취재 계획.
 *
 * `feasible=false` 면 **발주를 내면 안 된다** — 수집을 시작해도 I12 에서 반드시 막히므로,
 * 모델 호출 비용만 쓰고 초안이 버려진다. 발주 화면이 이 값을 먼저 물어야 하는 이유다.
 */
export function planFactSources(
  category: string,
  opts: { includeIdle?: boolean } = {},
): FactSourcePlan {
  const ready = Object.values(FACT_SOURCES).filter(
    (s) =>
      covers(s, category) &&
      (opts.includeIdle ? s.wiring !== 'needs-adapter' : s.wiring === 'in-repo'),
  )

  const primary = ready.filter((s) => s.tier === 'primary')
  const corroborating = ready.filter((s) => s.tier === 'corroborating')
  const background = ready.filter((s) => s.tier === 'background')
  // 맥락 제공원은 독립성에 기여하지 않는다 (위 FactSourceTier 주석).
  const independentPublishers = new Set(
    [...primary, ...corroborating].map((s) => s.publisher),
  ).size

  let blocker: string | null = null
  if (primary.length === 0) {
    blocker = `1차 사실원이 없다 (${category}). 기관 발표 없이 보도만으로 쓰면 그 보도의 선택·배열을 옮기게 된다.`
  } else if (corroborating.length === 0) {
    blocker = `교차 확인원이 없다 (${category}). 1차 발표만으로는 사건이 독립적으로 확인되지 않는다.`
  } else if (independentPublishers < 2) {
    blocker = `독립 발행사가 ${independentPublishers}곳뿐이다 (${category}). I12 는 2곳을 요구한다.`
  }

  return {
    primary,
    corroborating,
    background,
    independentPublishers,
    feasible: blocker === null,
    blocker,
  }
}

/** 지금 발주 가능한 주제 목록 (발주 화면의 선택지 원천). */
export function feasibleTopics(): string[] {
  const all = new Set<string>()
  for (const s of Object.values(FACT_SOURCES)) {
    for (const t of s.topics) if (t !== '*') all.add(t)
  }
  return [...all].filter((t) => planFactSources(t).feasible).sort()
}
