// packages/library-pipeline/src/compose/sources.ts
//
// ACP §20 재저작 — 사실 출처 레지스트리.
//
// ⚠ 기존 SOURCE_SPECS(ingest-article/_curation-spec.ts) 와 목적이 다르다. 헷갈리면 안 된다.
//
//   SOURCE_SPECS   : "이 소스의 **본문을 가져와 발행**해도 되는가" → 라이선스가 1차 판정 기준.
//   FACT_SOURCES   : "이 소스를 **사실의 증인**으로 삼아도 되는가" → 라이선스는 기준이 아니다.
//                    사실에는 저작권이 없으므로(§102(b)·Feist / 한국 저작권법 제7조 5호),
//                    상업 뉴스든 CC-BY-ND 든 **사실을 읽는 것 자체는 막히지 않는다**.
//
// 그래서 판정 축이 갈아끼워진다:
//   ① 1차성   — 사실의 원천인가(기관 스스로의 발표), 아니면 그것을 전한 보도인가.
//   ② 독립성  — 다른 출처와 취재 계통이 겹치지 않는가 (통신사 배급은 게이트가 접는다).
//   ③ 접근    — robots·요청 간격·본문 비보관을 지킬 수 있는가. **저작권과 별개 축**이며,
//                배제 사유가 아니라 지켜야 할 절차다 (compose/access.ts 가 강제).
//   ④ 주제    — 학습 지문으로 쓸 주제 축을 덮는가.
//
// ── 상업 뉴스에 대한 입장 (v06.39 정정) ────────────────────────────────
// 초판 레지스트리는 상업 뉴스를 "약관 위험" 을 이유로 통째로 제외했다. **틀린 판단이었다.**
//   · 모델 4 의 원형(Breaking News English · News in Levels)이 하는 일이 바로 여러 상업
//     뉴스를 읽고 사실만 뽑아 새로 쓰는 것이다. 그걸 빼면 남는 건 기관 발표 요약뿐이다.
//   · 약관·robots 는 저작권과 다른 축이고, **절차를 설계하면 지킬 수 있는 것**이다.
//     발행사가 스스로 배포용으로 내놓은 피드를 쓰고, robots 를 실제로 파싱해 따르고,
//     간격을 두고, 본문을 저장하지 않는다 — 마지막 항목은 이미 이 파이프라인의 기본 설계다.
//   · 그리고 직전 실측이 지목한 병목(교차 확인원이 VOA 한 곳)을 푸는 것이 정확히 이 층이다.
//
// ── 왜 이 층이 필요한가 (2026-08-17 실측) ──────────────────────────────
// topic_corpus_sources 의 활성 카테고리 19개 중 **11개가 재사용 불가 소스(TED ·
// CC BY-NC-ND)로만 덮여 있다**: health-* · people-education · people-feelings ·
// people-personal-qualities · work-and-business-* · sport 등.
// 즉 사람·사회·직업 주제 절반은 본문 수집으로 도달할 수 없고, 재저작만이 연다.

import { isSourceKey } from '../ingest-article/_curation-spec'

// ── 접근 규율 ────────────────────────────────────────────────────────

// ── ACP 와의 겹침 ────────────────────────────────────────────────────
//
// 사실 출처 14곳 중 **9곳이 ACP(본문 수집) 소스와 같다**
// (usgs·noaa·nasa·nih·elife·owid·voa·wikinews·wikipedia).
// 이건 실수가 아니지만, 규칙이 없으면 반드시 사고가 난다.
//
// **겹치는 것은 소스이지 산출물이 아니다.** 같은 기관이 두 파이프라인에서 서로 다른 역할을 한다:
//
//   ACP     — 그 소스의 **본문이 그 자체로 학습 지문**일 때. NOAA 기후 explainer, VOA 기사.
//   Compose — 그 소스가 **사건에 대한 사실을 제공**할 때. USGS 지진 속보, OWID 지표 발표.
//             이 자료들은 본문이 학습 지문감이 아니지만 사실의 1차 출처다.
//
// 갈림길에서의 판정 기준은 하나다:
//   **본문을 그대로 가져와 발행할 수 있으면 ACP 로 간다.**
//   재저작은 본문을 못 가져올 때(라이선스·문체·길이) 쓰는 우회로지, 더 나은 경로가 아니다.
//   PD 기관 글을 굳이 재저작하는 것은 그냥 가져오면 될 것에 LLM 비용과 게이트를 쓰는 일이다.
//
// 이 규칙을 어기면 생기는 두 가지 사고와, 그것을 막는 장치:
//   ① 같은 사건이 서가에 두 번 → **I17 서가 중복** 게이트(gates.ts)가 발행 시 잡는다.
//   ② 같은 URL 을 양쪽에서 처리 → 취재 시작 시 발행 이력을 조회해 막는다(Admin 액션).

/** 무엇을 통해 읽는가. 발행사가 배포 의도로 내놓은 경로일수록 위쪽. */
export type AccessBasis =
  /** 공개 API — 발행사가 명시적으로 제공 */
  | 'public-api'
  /** 발행사가 배포용으로 공개한 피드(RSS/Atom/사이트맵) */
  | 'publisher-feed'
  /** 일반 페이지 조회 — robots 확인이 반드시 선행 */
  | 'page-fetch'

export interface AccessPolicy {
  basis: AccessBasis
  /**
   * 수집 전 robots.txt 확인 필요 여부. `page-fetch` 는 항상 true.
   * false 는 "확인 안 해도 된다"가 아니라 "발행사가 배포를 의도한 공개 API" 라는 뜻이다.
   */
  robotsCheck: boolean
  /** 같은 호스트 최소 요청 간격(ms). robots Crawl-delay 가 더 크면 그쪽을 따른다. */
  minIntervalMs: number
  /**
   * 운영자가 이 발행사의 이용약관을 한 번 확인했는가.
   * **false 면 수집이 시작되지 않는다** — 코드가 대신 판단할 수 없는 유일한 항목이라
   * 사람이 확인하고 여기를 올린다. (확인 결과는 article_compose_sources 에 기록된다.)
   */
  termsReviewed: boolean
}

/** 본문 보관 정책 — 재저작 파이프라인 전체에서 단 하나의 값만 허용된다. */
export const BODY_RETENTION = 'none' as const

// ── 출처 ─────────────────────────────────────────────────────────────

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
  /** 새 어댑터 필요. 피드 주소·약관 확인이 선행돼야 한다. */
  | 'needs-adapter'

export interface FactSourceSpec {
  /** 출처 키 (기존 ACP SourceKey 와 겹치면 같은 기관을 가리킨다) */
  key: string
  /** 발행사 식별자 — I12 독립성 1차 판정 단위. 같은 publisher 는 절대 독립일 수 없다. */
  publisher: string
  tier: FactSourceTier
  wiring: FactSourceWiring
  access: AccessPolicy
  /**
   * 사건 발견원으로 쓰는가 — "이번 주에 무엇을 쓸지" 를 고르는 자리.
   * 기관 피드는 지진·기후보고서는 주지만 "지금 세상의 이야기" 는 주지 못한다.
   */
  discovery: boolean
  /**
   * 취재 계통 — 같은 계통끼리는 독립으로 보지 않는다.
   * 통신사 원고를 받아 쓰는 매체가 많아 발행사 이름만으로는 독립성이 판정되지 않는다
   * (지문 포함도 검사가 2차 방어선).
   */
  wire: string | null
  /** topic_corpus_sources.category_id 어휘 (새로 만들지 않고 기존 분류를 쓴다) */
  topics: ReadonlyArray<string>
  /**
   * 이 발행사에서 흔히 쓰이는 피드 경로 후보.
   *
   * **주소를 아는 것은 시스템의 일이라는 원칙의 구현**이다. 대형 발행사는 홈페이지에서
   * 자동 수집기를 막는 경우가 많아 autodiscovery 가 실패하는데, 피드 자체는 배포용이라
   * 열리는 경우가 흔하다. 그래서 홈페이지를 못 읽어도 여기부터 두드린다.
   *
   * ⚠ 이 값들은 **확정된 주소가 아니라 후보**다 — 열어서 항목이 파싱되는 것만 목록에 오르고,
   *   안 되면 사유와 함께 버려진다. 그래서 틀린 후보가 있어도 잘못된 피드가 등록되지 않는다.
   */
  feedHints?: ReadonlyArray<string>
  /**
   * 피드가 **다른 호스트에서** 서비스되는 경우의 허용 목록.
   *
   * 예: BBC 의 실제 피드는 `feeds.bbci.co.uk` 에 있는데 발행사 도메인은 `bbc.co.uk` 라
   * 상위 도메인조차 다르다. 호스트를 발행사 도메인으로만 검사하면 **발행사가 스스로 알린
   * 피드를 우리가 거부하는** 일이 생긴다(2026-08-17 설계 점검에서 발견).
   */
  feedHosts?: ReadonlyArray<string>
  /**
   * 본문을 실제로 읽을 수 있는가 — **실측으로 기록한다**(`termsReviewed` 와 같은 성격).
   *
   * 왜 필요한가: 발견 단계는 제목만 보고 "독립 2계통" 을 판정하는데, 그중 한 소스의 본문을
   * 못 읽으면 취재 단계에서 사실 원장을 못 채워 묶음이 통째로 무너진다. 실제로 Solar eclipse
   * 사건이 dw+npr 2계통으로 올라왔으나 NPR 은 45초 재시도에도 본문이 안 열려, BBC 를 급히
   * 찾아 대체해야 했다(2026-08-19).
   *
   * `blocked` 인 소스는 **교차확인 계통으로 세지 않는다** — 제목은 주지만 사실은 못 준다.
   * 값은 `scripts/compose/probe-body-access.mjs` 로 다시 재서 갱신한다.
   */
  bodyAccess?: 'ok' | 'blocked' | 'unknown'
  /** 왜 이 등급인지 — 판단 근거를 남긴다 */
  note: string
}

const PD_ACCESS: AccessPolicy = {
  basis: 'public-api',
  robotsCheck: false,
  minIntervalMs: 1_000,
  termsReviewed: true,
}

/**
 * 상업 발행사 기본 접근 정책 — 배포용 피드 + robots 확인 + 넉넉한 간격.
 *
 * `termsReviewed: true` 는 **운영자가 2026-08-17 에 수집을 승인했다는 기록**이지
 * 코드가 약관을 읽고 판정했다는 뜻이 아니다. 이 구분을 흐리면 안 된다.
 * 기계로 확인되는 부분(robots·경로·간격)은 수집할 때마다 `CrawlGate` 가 매번 검사하며,
 * robots 를 못 가져오면 그 발행사는 그 실행에서 통째로 건너뛴다.
 *
 * 발행사가 우리 UA 를 403 으로 거절하면 그것도 답이다 — 우회하지 않고 목록에서 뺀다.
 */
function newsAccess(over: Partial<AccessPolicy> = {}): AccessPolicy {
  return {
    basis: 'publisher-feed',
    robotsCheck: true,
    minIntervalMs: 3_000,
    termsReviewed: true,
    ...over,
  }
}

/**
 * 채택 출처.
 *
 * 층이 셋이다: 기관 1차원(PD·이미 배선) · PD 뉴스 교차원 · **상업 뉴스 교차원/발견원**.
 * 앞의 둘만으로는 발주 가능 주제가 5개뿐이었다 — 세 번째 층이 그 벽을 연다.
 */
export const FACT_SOURCES: Record<string, FactSourceSpec> = {
  // ── 1차 사실원 (기관 발표 · PD · 기배선) ───────────────────────────
  usgs: {
    key: 'usgs',
    publisher: 'usgs.gov',
    tier: 'primary',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: true,
    wire: null,
    topics: ['the-natural-world-geography'],
    bodyAccess: 'ok',
    note: '지진·화산·지질 — 사건의 계측 주체 자체. 보도가 USGS 수치를 인용하므로 1차성이 가장 높다.',
  },
  noaa: {
    key: 'noaa',
    publisher: 'climate.gov',
    tier: 'primary',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: true,
    wire: null,
    topics: ['the-natural-world-weather', 'the-natural-world-the-environment'],
    bodyAccess: 'ok',
    note: '기후·해양·대기. CSAT 최빈출 주제이며 the-environment 는 재사용 소스가 0인 칸이다.',
  },
  nasa: {
    key: 'nasa',
    publisher: 'nasa.gov',
    tier: 'primary',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: true,
    wire: null,
    topics: ['time-and-space-space', 'science-and-technology'],
    bodyAccess: 'ok',
    note: '발사·관측·탐사. 사건 시각이 명확해 I15(48시간) 판정이 깔끔하다.',
  },
  nih: {
    key: 'nih',
    publisher: 'nih.gov',
    tier: 'primary',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: false,
    wire: null,
    topics: ['health-health-and-fitness', 'health-mental-health'],
    bodyAccess: 'ok',
    note: 'MedlinePlus 는 환자 대상 평이 문체라 사실 추출이 쉽다. health-* 두 칸은 TED 로만 덮인 곳.',
  },
  elife: {
    key: 'elife',
    publisher: 'elifesciences.org',
    tier: 'primary',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: false,
    wire: null,
    topics: ['science-and-technology-scientific-research', 'science-and-technology-biology'],
    bodyAccess: 'ok',
    note: '편집자 저작 plain-language digest — 연구 사실이 이미 사실 카드에 가까운 형태로 정리돼 있다.',
  },
  owid: {
    key: 'owid',
    publisher: 'ourworldindata.org',
    tier: 'primary',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: false,
    wire: null,
    topics: ['politics-and-society-social-issues', 'work-and-business-business'],
    bodyAccess: 'ok',
    note: '지표·통계. 수치 사실(kind=figure)의 공급원으로, 사회·경제 주제의 1차원.',
  },

  // ── PD 뉴스 교차원 (기배선) ────────────────────────────────────────
  voa: {
    key: 'voa',
    publisher: 'voanews.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: true,
    wire: null,
    topics: [
      'communication-language',
      'politics-and-society-social-issues',
      'science-and-technology',
      'health-health-and-fitness',
      'the-natural-world-weather',
      'the-natural-world-the-environment',
    ],
    bodyAccess: 'ok',
    note: '미 연방 PD 뉴스 — 약관 위험이 0이고 이미 30편 배선. 문체가 평이해 사실 추출 오류가 적다.',
  },
  wikinews: {
    key: 'wikinews',
    publisher: 'wikinews.org',
    tier: 'corroborating',
    wiring: 'in-repo-idle',
    access: PD_ACCESS,
    discovery: false,
    wire: null,
    topics: ['politics-and-society-social-issues'],
    bodyAccess: 'ok',
    note: '어댑터는 있으나 수집 실적 0행(2026-08-17 실측) — 교차원으로 쓰려면 배선 점검이 선행돼야 한다.',
  },

  // ── 상업 뉴스 (발견원 + 교차원) ────────────────────────────────────
  // 발행사 선정 기준은 인지도가 아니라 **취재 계통의 다양성**이다. 통신사 한 곳에서
  // 나온 원고를 여러 매체에서 받아 봐야 독립 출처가 늘지 않는다(collapseSyndication 이 접는다).
  // 그래서 통신사 · 공영방송 · 한국 매체를 계통이 겹치지 않게 섞는다.
  //
  // 어댑터는 발행사별로 만들지 않는다 — compose/news-feed.ts 가 표준 RSS/Atom 을 읽는
  // 범용 수집기이므로 `wiring: 'in-repo'` 다. 발행사마다 달라지는 것은 **피드 주소뿐**이고,
  // 그건 코드가 아니라 운영자가 등록한다(article_compose_feeds).
  // 그래서 수집이 실제로 일어나려면 세 가지가 모두 있어야 한다:
  //   ① 운영자 승인(termsReviewed)  ② 등록된 피드 주소  ③ 매 수집 시 robots 통과.
  // ⚠ Reuters 는 제외했다 — 2026-08-17 실측에서 robots.txt 가 우리 수집기에게 `/` 전체를
  //   막았다. 일부 경로가 아니라 전면 차단이므로 어떤 URL 도 읽을 수 없고, 사실 증인으로도
  //   쓸 수 없다. 우회는 하지 않는다는 것이 이 파이프라인의 규칙이므로 목록에서 뺀다.
  //   (통신사 계통은 AP 가 대신한다.)
  ap: {
    key: 'ap',
    publisher: 'apnews.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    // 2026-08-18 실측 — AP 는 홈페이지에서 `/index.rss` 를 알리는데 **자기 robots 가 그 경로를
    // 막는다**. hub 경로는 전부 404. 즉 쓸 수 있는 발견 피드가 없다.
    // 다만 Reuters 와 달리 전면 차단은 아니라서, 다른 경로로 얻은 기사 URL 을 **사실 증인**
    // 으로 읽는 것은 가능하다. 그래서 목록에는 남기되 발견원에서만 뺀다.
    discovery: false,
    wire: 'ap',
    topics: ['politics-and-society-social-issues', 'the-natural-world-the-environment', 'sport'],
    bodyAccess: 'ok',
    note: '미국 통신사. 발견 피드는 없다(자기 robots 가 자기 피드를 막고 hub 경로는 404). 사실 증인으로만 쓴다.',
  },
  bbc: {
    key: 'bbc',
    publisher: 'bbc.co.uk',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'science-and-technology',
      'health-health-and-fitness',
      'the-natural-world-the-environment',
      'sport',
    ],
    feedHosts: ['feeds.bbci.co.uk'],
    feedHints: [
      '/news/rss.xml',
      '/news/world/rss.xml',
      '/news/science_and_environment/rss.xml',
      '/news/health/rss.xml',
      '/news/business/rss.xml',
    ],
    bodyAccess: 'ok',
    note: '영국 공영방송. 자체 취재 비중이 높고 주제 폭이 넓어 통신사와 다른 각도의 확인을 준다.',
  },
  dw: {
    key: 'dw',
    publisher: 'dw.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: false,
    wire: null,
    topics: ['politics-and-society-social-issues', 'work-and-business-working-life', 'people-education'],
    // 2026-08-18 실측: DW 피드는 apex 가 아니라 rss.dw.com 에 있다(138항목 확인).
    feedHosts: ['rss.dw.com'],
    feedHints: ['https://rss.dw.com/rdf/rss-en-all', 'https://rss.dw.com/atom/rss-en-all'],
    bodyAccess: 'ok',
    note: '독일 공영 국제방송. 유럽 시각 + 영미권과 다른 취재 계통. people-education 을 덮는 몇 안 되는 후보.',
  },
  koreaherald: {
    key: 'koreaherald',
    publisher: 'koreaherald.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: ['politics-and-society-social-issues', 'people-education', 'work-and-business-working-life'],
    feedHints: ['/rss/020000000000.xml', '/rss/010000000000.xml', '/common/rss_xml.php', '/rss'],
    bodyAccess: 'ok',
    note: '한국 영자지 — 학습자에게 맥락이 가까운 사건을 영어로 확인할 수 있다. 국내 주제에서 영미 매체가 못 주는 각도.',
  },

  // ── 계통 확충 (2026-08-17) ────────────────────────────────────────
  // 초판 5곳은 너무 적었다. Reuters 가 전면 차단으로 빠지자 통신사 계통이 AP 하나만
  // 남았고, 한 곳이 막히면 교차 확인이 통째로 무너지는 구조가 됐다.
  // 발행사는 인지도가 아니라 **취재 계통·지역·소유구조가 겹치지 않는 순서**로 고른다.
  cnn: {
    key: 'cnn',
    publisher: 'cnn.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'science-and-technology',
      'health-health-and-fitness',
      'the-natural-world-the-environment',
      'sport',
    ],
    feedHosts: ['rss.cnn.com'],
    feedHints: ['/services/rss/', '/rss/edition.rss', '/rss/edition_world.rss'],
    bodyAccess: 'ok',
    note: '미국 상업 방송. 자체 취재 비중이 높고 주제 폭이 넓다.',
  },
  abcnews: {
    key: 'abcnews',
    publisher: 'abcnews.go.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'health-health-and-fitness',
      'science-and-technology',
      'the-natural-world-the-environment',
    ],
    feedHints: ['/abcnews/topstories', '/abcnews/internationalheadlines', '/abcnews/usheadlines'],
    bodyAccess: 'ok',
    note: '미국 상업 방송(ABC News). CNN·NPR 과 편집 계통이 달라 미국 내 교차 확인에 쓴다.',
  },
  washingtonpost: {
    key: 'washingtonpost',
    publisher: 'washingtonpost.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'the-natural-world-the-environment',
      'science-and-technology',
      'work-and-business-business',
    ],
    // 2026-08-18 실측: apex 는 연결이 끊기고, 피드는 feeds.washingtonpost.com 에서 열린다.
    feedHosts: ['feeds.washingtonpost.com'],
    feedHints: [
      'https://feeds.washingtonpost.com/rss/world',
      'https://feeds.washingtonpost.com/rss/national',
    ],
    // 초판에서 "유료벽 때문에" 제외했는데 그건 **측정이 아니라 예측**이었다.
    // 피드는 제목+요약을 주므로 사건 발견과 사실 교차 확인에는 쓸 수 있는 경우가 많다.
    // 실제로 본문이 안 열리면 취재 시작 단계에서 사유와 함께 걸러진다 — 미리 뺄 이유가 없다.
    bodyAccess: 'blocked',
    note: '미국 일간. 유료벽이 있어 본문이 안 열릴 수 있으나, 그 판단은 실행이 하지 예측이 하지 않는다.',
  },
  npr: {
    key: 'npr',
    publisher: 'npr.org',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'science-and-technology',
      'health-health-and-fitness',
      'people-education',
    ],
    // 2026-08-18 실측: npr.org 는 robots 조회가 실패하고, 피드는 feeds.npr.org 에 있다.
    feedHosts: ['feeds.npr.org'],
    feedHints: ['https://feeds.npr.org/1001/rss.xml', 'https://feeds.npr.org/1004/rss.xml'],
    bodyAccess: 'blocked',
    note: '미국 공영 라디오. 문체가 평이하고 교육·사회 주제가 두터워 학습 지문 재료로 좋다.',
  },
  guardian: {
    key: 'guardian',
    publisher: 'theguardian.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'the-natural-world-the-environment',
      'science-and-technology',
      'work-and-business-business',
      'sport',
    ],
    feedHints: ['/international/rss', '/world/rss', '/environment/rss', '/science/rss'],
    bodyAccess: 'ok',
    note: '영국 일간. 환경·사회 보도가 두텁고 피드를 섹션별로 공개한다.',
  },
  aljazeera: {
    key: 'aljazeera',
    publisher: 'aljazeera.com',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: ['politics-and-society-social-issues', 'the-natural-world-the-environment'],
    feedHints: ['/xml/rss/all.xml', '/rss'],
    bodyAccess: 'ok',
    note: '카타르 국제방송. 영미권과 다른 시각 — 같은 사건의 서술이 달라 교차 확인의 값이 크다.',
  },
  cbc: {
    key: 'cbc',
    publisher: 'cbc.ca',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'science-and-technology',
      'the-natural-world-the-environment',
      'health-health-and-fitness',
    ],
    feedHints: ['/webfeed/rss/rss-world', '/webfeed/rss/rss-topstories', '/cmlink/rss-topstories'],
    // ⚠ 2026-08-18 실측: 개발 환경에서 cbc.ca 로의 연결 자체가 실패했다(robots·피드 모두).
    //   차단인지 망 문제인지 여기서는 구별할 수 없어 **제거하지 않았다** — 운영 환경에서는
    //   열릴 수 있고, 안 열리면 화면이 사유와 함께 알려 준다.
    bodyAccess: 'ok',
    note: '캐나다 공영방송. 미·영과 또 다른 계통이라 통신사 의존을 줄인다. (개발 환경에서는 연결 실패 — 운영 환경에서 재확인 필요)',
  },
  abcnet: {
    key: 'abcnet',
    publisher: 'abc.net.au',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: [
      'politics-and-society-social-issues',
      'the-natural-world-the-environment',
      'science-and-technology',
      'sport',
    ],
    feedHints: ['/news/feed/51120/rss.xml', '/news/feed/45910/rss.xml', '/news/feed/1948/rss.xml'],
    bodyAccess: 'ok',
    note: '호주 공영방송. 남반구 기후·환경 사건에서 북반구 매체가 못 주는 각도.',
  },
  yonhap: {
    key: 'yonhap',
    publisher: 'en.yna.co.kr',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: 'yonhap',
    topics: ['politics-and-society-social-issues', 'work-and-business-business', 'sport'],
    feedHints: ['/RSS/news.xml', '/RSS/northkorea.xml', '/rss/news.xml'],
    bodyAccess: 'ok',
    note: '한국 통신사 영문. 국내 사건을 영어로 확인하는 1차 계통 — 한국 매체 다수가 이 원고를 받아 쓰므로 wire 표시가 필수다.',
  },
  koreatimes: {
    key: 'koreatimes',
    publisher: 'koreatimes.co.kr',
    tier: 'corroborating',
    wiring: 'in-repo',
    access: newsAccess(),
    discovery: true,
    wire: null,
    topics: ['politics-and-society-social-issues', 'people-education', 'work-and-business-working-life'],
    // 2026-08-18 실측: 홈페이지가 feed.koreatimes.co.kr 를 알린다(별도 호스트).
    feedHosts: ['feed.koreatimes.co.kr'],
    feedHints: ['https://feed.koreatimes.co.kr/k/allnews.xml'],
    bodyAccess: 'ok',
    note: '한국 영자지. Korea Herald 와 다른 편집 계통이라 국내 주제에서 독립 2계통을 만들 수 있다.',
  },

  // ── 배경 ──────────────────────────────────────────────────────────
  wikipedia: {
    key: 'wikipedia',
    publisher: 'wikipedia.org',
    tier: 'background',
    wiring: 'in-repo',
    access: PD_ACCESS,
    discovery: false,
    wire: null,
    topics: ['*'],
    bodyAccess: 'ok',
    note: '개념·지명·역사 등 맥락 제공. 사건의 교차 확인원으로는 쓰지 않는다 — 백과는 보도를 인용해 쓰이므로 독립 취재가 아니다.',
  },
}

/** 명시적 제외 — "쓸 수 있는데 안 쓰는" 것들. 이유를 남기지 않으면 반드시 다시 논의된다. */
export const EXCLUDED_FACT_SOURCES: ReadonlyArray<{ key: string; reason: string }> = [
  {
    key: 'reuters',
    reason:
      '2026-08-17 실측 — robots.txt 가 우리 수집기에게 `/` 전체를 막았다. 일부 경로가 아니라 전면 차단이라 어떤 URL 도 읽을 수 없다. 브라우저인 척 우회하지 않는다는 것이 이 파이프라인의 규칙이므로 목록에서 뺀다. 통신사 계통은 AP·연합뉴스가 대신한다.',
  },
  {
    key: 'nhk',
    reason:
      '2026-08-18 실측 — 열리는 피드(`/rss/news/cat0.xml`)가 **일본어**이고 영어 피드 경로는 404 였다. 아시아 계통을 늘리려 넣었으나 영어 사실 출처라는 전제를 못 채운다. MBC 를 뺀 것과 같은 이유다.',
  },
  {
    key: 'mbc',
    reason:
      '한국어 방송이라 영어 사실 출처로 쓸 수 없다. 국내 사건의 영어 계통은 연합뉴스 영문·Korea Herald·Korea Times 가 맡는다.',
  },
  {
    key: 'ted',
    reason:
      'topic_corpus 에서 사람·직업 주제를 유일하게 덮고 있어 후보로 떠오르지만, 강연 1건은 **단일 출처**라 I12 를 통과할 수 없고 가치의 대부분이 화자 고유의 표현·구성이라 사실만 남기면 남는 게 적다. 라이선스(CC BY-NC-ND) 때문이 아니라 사실 출처로서 부적합하다.',
  },
  {
    key: 'social-media',
    reason: '사실 검증 경로가 없다. 교차 확인의 전제(독립적으로 취재됐다)가 성립하지 않는다.',
  },
  {
    key: 'aggregator',
    reason:
      '뉴스 애그리게이터·포털은 남의 원고를 모아 둔 곳이라 독립 출처가 아니다. 원 발행사를 직접 읽는다.',
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
  /** 사건 발견원 후보 — 무엇을 쓸지 고르는 자리 */
  discovery: FactSourceSpec[]
  /** 서로 다른 **취재 계통** 수 — I12(독립 2곳)의 상한. wire 가 같으면 하나로 센다. */
  independentLines: number
  /** 지금 쓸 수 있는 소스만으로 발주가 가능한가 */
  feasible: boolean
  /** feasible=false 일 때 무엇이 부족한지 */
  blocker: string | null
}

/**
 * ACP(본문 수집)에도 등록된 소스인가.
 *
 * 하드코딩하지 않고 ACP 레지스트리에 물어본다 — 손으로 적으면 한쪽이 늘어날 때 조용히 어긋난다.
 */
export function isAlsoAcpSource(key: string): boolean {
  return isSourceKey(key)
}

// ── 소스 역할 — ACP 와 Compose 의 경계 ───────────────────────────────
//
// 두 파이프라인이 같은 소스를 두고 다투는 것처럼 보였으나, 실측하면 **실제 겹침은 0건**이다
// (2026-08-18: ACP 발행 81편의 소스는 compose 후보 0 · compose 후보 852건의 소스는 ACP 발행 0).
// 자연스럽게 갈린 이유가 있고, 그 이유를 규칙으로 굳힌다.
//
//   **라이선스가 있으면 그대로 준다. 없으면 사실만 가져와 우리가 쓴다.**
//
// 라이선스가 있는데 재저작하는 것은 순손실이다 — 원어민이 쓴 좋은 문장을 버리고, 게이트 6종
// 비용을 치르고, 결과물은 더 나빠진다. 반대로 라이선스 없이 본문을 가져오면 침해다.
// 그래서 `supply` 와 `collect` 를 **한 소스가 겸할 수 없게** 한다.

export type SourceRole =
  /** ACP 가 본문을 그대로 가져다 발행한다 (라이선스 보유) */
  | 'supply'
  /** Compose 가 피드를 걷어 사건을 발견한다 (라이선스 없음 — 사실만 쓴다) */
  | 'collect'
  /** 사실 교차확인에만 쓴다. 수집 대상은 아니다 */
  | 'corroborate'

/**
 * 소스의 역할 — **손으로 적지 않고 기존 사실에서 파생한다.**
 * 별도 필드로 두면 반드시 다른 필드와 어긋난다(이 저장소가 여러 번 겪은 실패다).
 */
export function rolesOf(spec: FactSourceSpec): SourceRole[] {
  const roles: SourceRole[] = []
  // ACP 에 어댑터가 있다 = 그 소스를 본문째 쓸 권리를 이미 확보했다는 뜻이다.
  //   반대로 라이선스가 없으면 쓸 방법이 사실 수집뿐이다 — 그래서 둘은 배타이자 전부다.
  //   ⚠ `discovery`(사건 발견원인가)로 판정하면 안 된다. 그건 "무엇을 쓸지 고르는 자리"를
  //   가리키는 별개 축이고, 교차확인 전용으로 걷는 소스(dw — 실측 후보 152건)가 조용히
  //   수집 불가가 된다. 실제로 그렇게 한 번 끊어 봤다.
  if (isAlsoAcpSource(spec.key)) roles.push('supply')
  else roles.push('collect')
  // 배경 전용(백과)은 독립 취재가 아니므로 교차확인 출처로 세지 않는다.
  if (spec.tier !== 'background') roles.push('corroborate')
  return roles
}

/**
 * 금지 조합을 어긴 소스 목록. 비어 있어야 한다.
 *
 * `rolesOf` 가 `else if` 로 배타를 강제하므로 정상적으로는 비지만, 파생 규칙이 바뀌었을 때
 * 조용히 겸직이 생기는 것을 막는 감시선이다.
 */
export function roleViolations(): string[] {
  const bad: string[] = []
  for (const spec of Object.values(FACT_SOURCES)) {
    const r = rolesOf(spec)
    if (r.includes('supply') && r.includes('collect')) {
      bad.push(`${spec.key}: supply 와 collect 를 겸한다 — 라이선스가 있으면 재저작하지 않는다`)
    }
  }
  return bad
}

/** 이 소스에서 피드를 걷어도 되는가 — 역할이 `collect` 일 때만. */
export function isCollectRole(spec: FactSourceSpec): boolean {
  return rolesOf(spec).includes('collect')
}

/**
 * **피드를 걷어도 되는가** — 수집 경로 전용 판정.
 *
 * ⚠️ (사실 출처로 쓸 수 있는가)과 **다른 질문**이다. 둘을 하나로 합쳤다가
 * ACP 공급원(nasa·noaa·usgs·wikipedia)이 **교차확인 출처에서까지 빠졌다** — 주제 커버리지가
 * 통째로 무너졌다. NASA 페이지가 뉴스 기사의 수치를 뒷받침하는 것은 완전히 정상이고,
 * 막아야 하는 것은 NASA **피드를 걷어 사건을 발견하는 것**뿐이다(그건 ACP 가 할 일이다).
 *
 * 본문이 안 열리는 소스(`bodyAccess: 'blocked'`)도 여기서 막는다 — 이건 취향이 아니라 산술이다.
 * 발행은 **읽을 수 있는 독립 2계통**을 요구하는데 blocked 는 그 둘 중 하나가 될 수 없으므로,
 * 그 피드를 걷어 봐야 사건 후보만 늘고 발행은 한 건도 늘지 않는다. 실측(2026-08-19, 30일):
 * npr·washingtonpost 후보 64건 · **기여 0건**. 반면 교차확인 자격(`isCollectable`)은 건드리지
 * 않는다 — 제목·요약으로 사실을 대조하는 쓰임까지 막을 이유는 없다.
 */
export function isFeedCollectable(spec: FactSourceSpec): boolean {
  return isCollectRole(spec) && isCollectable(spec) && spec.bodyAccess !== 'blocked'
}


/** 두 파이프라인에 함께 있는 소스 (Admin ① 소스 화면 표시원). */
export function acpOverlap(): string[] {
  return Object.keys(FACT_SOURCES).filter(isAlsoAcpSource).sort()
}

/** 이 주제를 덮는 소스인가. `'*'` 는 모든 주제(배경 사실용). */
function covers(spec: FactSourceSpec, category: string): boolean {
  return spec.topics.includes('*') || spec.topics.includes(category)
}

/**
 * 이 호스트가 그 발행사의 것인가.
 *
 * 발행사 도메인의 하위 도메인이거나, `feedHosts` 에 명시된 피드 전용 호스트면 인정한다.
 * 발행사 도메인만으로 검사하면 **발행사가 스스로 알린 피드를 우리가 거부한다**
 * (BBC 의 피드는 `feeds.bbci.co.uk` — 상위 도메인부터 다르다).
 */
export function isPublisherHost(spec: FactSourceSpec, host: string): boolean {
  const h = host.toLowerCase()
  const pub = spec.publisher.toLowerCase()
  if (h === pub || h.endsWith(`.${pub}`)) return true
  return (spec.feedHosts ?? []).some((f) => {
    const fh = f.toLowerCase()
    return h === fh || h.endsWith(`.${fh}`)
  })
}

/** 취재 계통 식별자 — wire 가 있으면 그것, 없으면 발행사 자신이 하나의 계통이다. */
export function lineOf(spec: FactSourceSpec): string {
  return spec.wire ?? spec.publisher.toLowerCase()
}

/** 지금 이 소스로 수집을 시작해도 되는가 (약관 확인 + 배선). */
export function isCollectable(spec: FactSourceSpec): boolean {
  return spec.wiring === 'in-repo' && spec.access.termsReviewed
}

export interface PlanOptions {
  /** 수집 실적 0인 소스(in-repo-idle)도 후보에 넣는다 */
  includeIdle?: boolean
  /** 어댑터·약관 확인이 남은 소스까지 넣는다 — "배선하면 무엇이 열리는가" 를 볼 때 */
  includePlanned?: boolean
}

/**
 * 주제 카테고리 → 취재 계획.
 *
 * `feasible=false` 면 **발주를 내면 안 된다** — 수집을 시작해도 I12 에서 반드시 막히므로,
 * 모델 호출 비용만 쓰고 초안이 버려진다. 발주 화면이 이 값을 먼저 물어야 하는 이유다.
 */
export function planFactSources(category: string, opts: PlanOptions = {}): FactSourcePlan {
  const usable = Object.values(FACT_SOURCES).filter((s) => {
    if (!covers(s, category)) return false
    if (opts.includePlanned) return true
    if (opts.includeIdle) return s.wiring !== 'needs-adapter'
    return isCollectable(s)
  })

  const primary = usable.filter((s) => s.tier === 'primary')
  const corroborating = usable.filter((s) => s.tier === 'corroborating')
  const background = usable.filter((s) => s.tier === 'background')
  const discovery = usable.filter((s) => s.discovery)
  // 맥락 제공원은 독립성에 기여하지 않는다. 같은 통신사 계통은 하나로 센다.
  const independentLines = new Set([...primary, ...corroborating].map(lineOf)).size

  let blocker: string | null = null
  if (primary.length === 0 && corroborating.length < 2) {
    blocker = `1차 사실원이 없고 교차원도 ${corroborating.length}곳뿐이다 (${category}). 기관 발표 없이 보도 한 편으로 쓰면 그 보도의 선택·배열을 옮기게 된다.`
  } else if (corroborating.length === 0) {
    blocker = `교차 확인원이 없다 (${category}). 1차 발표만으로는 사건이 독립적으로 확인되지 않는다.`
  } else if (independentLines < 2) {
    blocker = `독립 취재 계통이 ${independentLines}개뿐이다 (${category}). I12 는 2개를 요구한다 — 같은 통신사 원고는 하나로 센다.`
  }

  return {
    primary,
    corroborating,
    background,
    discovery,
    independentLines,
    feasible: blocker === null,
    blocker,
  }
}

/** 레지스트리에 등장하는 모든 주제(배경 전용 `*` 제외). */
export function allTopics(): string[] {
  const all = new Set<string>()
  for (const s of Object.values(FACT_SOURCES)) {
    for (const t of s.topics) if (t !== '*') all.add(t)
  }
  return [...all].sort()
}

/** 지금 발주 가능한 주제 목록 (발주 화면의 선택지 원천). */
export function feasibleTopics(opts: PlanOptions = {}): string[] {
  return allTopics().filter((t) => planFactSources(t, opts).feasible)
}

/**
 * 상업 뉴스를 배선하면 몇 개 주제가 열리는가 — 투자 판단용.
 * 지금 가능한 주제와, 계획된 소스까지 포함했을 때 가능한 주제의 차집합.
 */
export function topicsUnlockedByPlanned(): string[] {
  const now = new Set(feasibleTopics())
  return feasibleTopics({ includePlanned: true }).filter((t) => !now.has(t))
}
