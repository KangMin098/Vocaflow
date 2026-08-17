// packages/library-pipeline/src/compose/sources.test.ts
// ACP §20 — 사실 출처 레지스트리 회귀.
//
// 지키는 것 둘:
//   ① 발주 전에 실현 가능성을 먼저 묻는다 — 불가능한 주제로 발주가 나가면 수집·작성 비용을
//      다 쓴 뒤 I12 에서 버려진다.
//   ② 독립성은 발행사가 아니라 **취재 계통**으로 센다 — 통신사 원고를 받아 쓰는 매체를
//      여럿 넣어도 독립 출처는 늘지 않는다.

import { describe, expect, it } from 'vitest'

import {
  BODY_RETENTION,
  EXCLUDED_FACT_SOURCES,
  FACT_SOURCES,
  acpOverlap,
  allTopics,
  isAlsoAcpSource,
  isPublisherHost,
  feasibleTopics,
  isCollectable,
  lineOf,
  planFactSources,
  topicsUnlockedByPlanned,
} from './sources'

describe('FACT_SOURCES 레지스트리', () => {
  it('키와 spec.key 가 일치한다', () => {
    for (const [k, v] of Object.entries(FACT_SOURCES)) expect(v.key).toBe(k)
  })

  it('본문 보관 정책은 단 하나의 값만 갖는다', () => {
    expect(BODY_RETENTION).toBe('none')
  })

  it('상업 뉴스는 제외 목록이 아니라 채택 목록에 있다', () => {
    // v06.39 정정 — 초판은 약관을 이유로 통째로 뺐다. 모델 4 의 원형이 하는 일이
    // 바로 여러 상업 뉴스를 읽고 사실만 뽑는 것이므로 그건 요청을 좁힌 것이었다.
    const excluded = EXCLUDED_FACT_SOURCES.map((e) => e.key)
    expect(excluded).not.toContain('commercial-news')
    for (const k of ['ap', 'bbc', 'dw', 'koreaherald', 'cnn', 'npr', 'guardian']) {
      expect(FACT_SOURCES[k]).toBeDefined()
      expect(FACT_SOURCES[k]!.tier).toBe('corroborating')
    }
  })

  it('Reuters 는 실측 거절로 제외됐다 — 우회하지 않는다', () => {
    // 2026-08-17 실측: robots 가 `/` 전체를 막았다. 일부 경로가 아니라 전면 차단이라
    // 어떤 URL 도 읽을 수 없다. 규칙대로 목록에서 뺀다.
    expect(FACT_SOURCES['reuters']).toBeUndefined()
    const reason = EXCLUDED_FACT_SOURCES.find((e) => e.key === 'reuters')!.reason
    expect(reason).toContain('전면 차단')
    expect(reason).toContain('우회하지 않는다')
  })

  it('한 계통이 막혀도 무너지지 않도록 계통을 늘렸다', () => {
    // Reuters 가 빠지자 통신사 계통이 AP 하나만 남았다. 한 곳이 막히면 교차 확인이
    // 통째로 무너지는 구조라 지역·소유구조가 다른 발행사를 확충했다.
    const news = Object.values(FACT_SOURCES).filter((s) => !isAlsoAcpSource(s.key))
    expect(news.length).toBeGreaterThanOrEqual(10)
    // 미국·영국·독일·카타르·캐나다·호주·한국 — 계통이 한 나라에 쏠려 있지 않다
    const lines = new Set(news.map(lineOf))
    expect(lines.size).toBeGreaterThanOrEqual(10)
  })

  it('page-fetch 는 robots 확인이 강제된다', () => {
    for (const s of Object.values(FACT_SOURCES)) {
      if (s.access.basis === 'page-fetch') expect(s.access.robotsCheck).toBe(true)
    }
  })

  it('상업 발행사는 운영자 승인(2026-08-17) 후에도 런타임 게이트를 유지한다', () => {
    // termsReviewed 는 "운영자가 승인했다"는 기록이지 코드가 약관을 판정했다는 뜻이 아니다.
    // 기계로 확인되는 것(robots·간격)은 승인과 무관하게 매 수집마다 검사된다.
    for (const k of ['ap', 'bbc', 'dw', 'koreaherald', 'cnn', 'npr', 'guardian', 'yonhap']) {
      const s = FACT_SOURCES[k]!
      expect(s.access.termsReviewed).toBe(true)
      expect(isCollectable(s)).toBe(true)
      expect(s.access.robotsCheck).toBe(true)
      expect(s.access.minIntervalMs).toBeGreaterThanOrEqual(3_000)
      expect(s.access.basis).toBe('publisher-feed')
    }
  })

  it('제외 사유가 라이선스가 아니라 사실 출처 적합성으로 적혀 있다', () => {
    const ted = EXCLUDED_FACT_SOURCES.find((e) => e.key === 'ted')
    expect(ted!.reason).toContain('단일 출처')
    const agg = EXCLUDED_FACT_SOURCES.find((e) => e.key === 'aggregator')
    expect(agg!.reason).toContain('독립 출처가 아니다')
  })
})

describe('ACP 와의 겹침 — 규칙이 있어야 사고가 안 난다', () => {
  it('9곳이 두 파이프라인에 함께 있다 (실수가 아니라 역할 분리)', () => {
    expect(acpOverlap()).toEqual([
      'elife',
      'nasa',
      'nih',
      'noaa',
      'owid',
      'usgs',
      'voa',
      'wikinews',
      'wikipedia',
    ])
  })

  it('Compose 전용은 전부 상업 뉴스 — ACP 는 본문을 못 가져오는 곳이다', () => {
    const composeOnly = Object.keys(FACT_SOURCES).filter((k) => !isAlsoAcpSource(k)).sort()
    expect(composeOnly).toEqual([
      'abcnet',
      'abcnews',
      'aljazeera',
      'ap',
      'bbc',
      'cbc',
      'cnn',
      'dw',
      'guardian',
      'koreaherald',
      'koreatimes',
      'npr',
      'washingtonpost',
      'yonhap',
    ])
  })

  it('워싱턴포스트는 예측으로 빼지 않는다 — 판단은 실행이 한다', () => {
    // 초판에서 "유료벽 때문에" 제외했는데 그건 측정이 아니라 예측이었다.
    // 피드는 제목+요약을 주므로 발견·교차 확인에 쓸 수 있는 경우가 많고,
    // 본문이 정말 안 열리면 취재 시작 단계에서 사유와 함께 걸러진다.
    expect(FACT_SOURCES['washingtonpost']).toBeDefined()
    expect(EXCLUDED_FACT_SOURCES.map((e) => e.key)).not.toContain('washingtonpost')
  })

  it('지역이 한쪽에 쏠려 있지 않다', () => {
    // 미국·영국·독일·카타르·캐나다·호주·일본·한국 — 같은 사건도 서술이 달라
    // 교차 확인의 값이 커진다.
    const news = Object.keys(FACT_SOURCES).filter((k) => !isAlsoAcpSource(k))
    for (const k of ['bbc', 'dw', 'aljazeera', 'cbc', 'abcnet', 'yonhap']) {
      expect(news).toContain(k)
    }
  })

  it('겹침 판정을 손으로 적지 않고 ACP 레지스트리에 물어본다', () => {
    // 하드코딩했다면 한쪽이 늘어날 때 조용히 어긋난다.
    expect(isAlsoAcpSource('noaa')).toBe(true)
    expect(isAlsoAcpSource('reuters')).toBe(false)
    expect(isAlsoAcpSource('없는소스')).toBe(false)
  })
})

describe('isPublisherHost — 피드가 다른 호스트에 있어도 거부하지 않는다', () => {
  it('발행사 도메인과 하위 도메인은 인정', () => {
    const bbc = FACT_SOURCES['bbc']!
    expect(isPublisherHost(bbc, 'bbc.co.uk')).toBe(true)
    expect(isPublisherHost(bbc, 'www.bbc.co.uk')).toBe(true)
  })

  it('BBC 실제 피드 호스트(feeds.bbci.co.uk)를 인정한다', () => {
    // 상위 도메인부터 다르다(bbci vs bbc). 발행사 도메인만 검사하면
    // **발행사가 스스로 알린 피드를 우리가 거부한다** — 2026-08-17 설계 점검에서 발견.
    expect(isPublisherHost(FACT_SOURCES['bbc']!, 'feeds.bbci.co.uk')).toBe(true)
  })

  it('피드 전용 호스트를 가진 발행사들이 등록돼 있다', () => {
    for (const [k, host] of [
      ['cnn', 'rss.cnn.com'],
      ['npr', 'feeds.npr.org'],
      ['washingtonpost', 'feeds.washingtonpost.com'],
    ] as const) {
      expect(isPublisherHost(FACT_SOURCES[k]!, host)).toBe(true)
    }
  })

  it('무관한 호스트는 여전히 거부한다', () => {
    expect(isPublisherHost(FACT_SOURCES['bbc']!, 'evil.example')).toBe(false)
    // 접미사만 같은 호스트로 우회하는 것도 막는다
    expect(isPublisherHost(FACT_SOURCES['bbc']!, 'notbbc.co.uk')).toBe(false)
  })
})

describe('취재 계통 — 독립성은 발행사가 아니라 계통으로 센다', () => {
  it('통신사 소속은 wire 로 묶이고, 자체 취재 매체는 자기 자신이 계통이다', () => {
    expect(lineOf(FACT_SOURCES['ap']!)).toBe('ap')
    expect(lineOf(FACT_SOURCES['yonhap']!)).toBe('yonhap')
    expect(lineOf(FACT_SOURCES['bbc']!)).toBe('bbc.co.uk')
  })

  it('같은 계통만 여럿이면 독립 2개가 안 된다', () => {
    // 가상의 재게재 매체 — 발행사는 다르지만 wire 가 같다.
    const syndicated = { ...FACT_SOURCES['ap']!, key: 'localpaper', publisher: 'local.example' }
    const lines = new Set([FACT_SOURCES['ap']!, syndicated].map(lineOf))
    expect(lines.size).toBe(1)
  })
})

describe('planFactSources', () => {
  it('기후 주제는 1차원(NOAA) + 교차원(VOA) 으로 지금 발주 가능', () => {
    const p = planFactSources('the-natural-world-weather')
    expect(p.primary.map((s) => s.key)).toContain('noaa')
    expect(p.corroborating.map((s) => s.key)).toContain('voa')
    expect(p.independentLines).toBeGreaterThanOrEqual(2)
    expect(p.feasible).toBe(true)
    expect(p.blocker).toBeNull()
  })

  it('1차원만 있고 교차원이 없으면 발주하지 않는다', () => {
    const p = planFactSources('time-and-space-space')
    expect(p.primary.map((s) => s.key)).toEqual(['nasa'])
    expect(p.feasible).toBe(false)
    expect(p.blocker).toContain('교차 확인원이 없다')
  })

  it('Wikipedia 는 모든 주제를 덮지만 독립 출처로 세지 않는다', () => {
    // 지질은 1차원(USGS)만 있고 어느 뉴스도 상시로 다루지 않는다 —
    // 백과를 교차원으로 인정했다면 여기가 통과해 버렸을 자리다.
    const p = planFactSources('the-natural-world-geography')
    expect(p.background.map((s) => s.key)).toContain('wikipedia')
    expect(p.corroborating).toEqual([])
    expect(p.independentLines).toBe(1) // usgs 하나
    expect(p.feasible).toBe(false)
    expect(p.blocker).toContain('교차 확인원이 없다')
  })

  it('1차원이 없어도 독립 계통 2개 이상의 보도가 있으면 성립한다', () => {
    // sport 는 기관 1차원이 없다. AP·BBC 두 계통만으로 발주가 선다 —
    // 이게 상업 뉴스 층이 여는 자리다.
    const p = planFactSources('sport')
    expect(p.primary).toEqual([])
    expect(p.corroborating.map((s) => s.key).sort()).toEqual([
      'abcnet',
      'ap',
      'bbc',
      'cnn',
      'guardian',
      'yonhap',
    ])
    expect(p.independentLines).toBe(6)
    expect(p.feasible).toBe(true)
  })

  it('수집 실적 0인 소스(wikinews)는 기본 계획에서 빠진다', () => {
    const base = planFactSources('politics-and-society-social-issues')
    const idle = planFactSources('politics-and-society-social-issues', { includeIdle: true })
    expect(base.corroborating.map((s) => s.key)).not.toContain('wikinews')
    expect(idle.corroborating.map((s) => s.key)).toContain('wikinews')
  })

  it('발견원과 교차원을 따로 돌려준다', () => {
    const p = planFactSources('politics-and-society-social-issues', { includePlanned: true })
    expect(p.discovery.map((s) => s.key)).toContain('bbc')
    expect(p.discovery.map((s) => s.key)).not.toContain('owid') // 지표는 사건을 발견해 주지 않는다
    // AP 는 교차원으로는 남지만 발견원에서는 빠진다 — 자기 robots 가 자기 피드를 막는다.
    expect(p.corroborating.map((s) => s.key)).toContain('ap')
    expect(p.discovery.map((s) => s.key)).not.toContain('ap')
  })
})

describe('feasibleTopics — 능력 스냅샷', () => {
  it('발주 가능 주제 = 9개 (상업 뉴스 승인 후 · PD 만일 때는 5개였다)', () => {
    expect(feasibleTopics()).toEqual([
      'health-health-and-fitness',
      'people-education', // ← 상업 뉴스가 연 칸. TED(재사용 불가)로만 덮여 있었다
      'politics-and-society-social-issues',
      'science-and-technology',
      'sport', // ←
      'the-natural-world-the-environment',
      'the-natural-world-weather',
      'work-and-business-business', // ←
      'work-and-business-working-life', // ←
    ])
  })

  it('아직 배선 대기 중인 소스는 없다 — 계획과 현재가 같다', () => {
    expect(topicsUnlockedByPlanned()).toEqual([])
  })

  it('그래도 못 여는 칸이 남는다 — 과장하지 않는다', () => {
    // 상업 뉴스를 다 배선해도 6칸은 막혀 있다. 뉴스가 그 주제를 일상적으로 다루지 않거나
    // (전문 연구·지질), 1차원만 있고 보도 각도가 없어서다. 숫자를 맞추려고 소스의 주제
    // 목록을 부풀리면 그 순간 이 레지스트리는 계획서가 아니라 희망사항이 된다.
    const still = allTopics().filter((t) => !planFactSources(t, { includePlanned: true }).feasible)
    expect(still).toEqual([
      'communication-language',
      'health-mental-health',
      'science-and-technology-biology',
      'science-and-technology-scientific-research',
      'the-natural-world-geography',
      'time-and-space-space',
    ])
  })
})
