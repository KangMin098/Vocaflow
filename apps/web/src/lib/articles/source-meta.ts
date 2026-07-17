// apps/web/src/lib/articles/source-meta.ts
//
// ACP 소스 표시 메타 (라벨·색·분야·설명) — 학습자 노출용 단일 출처.
// ArticleCard(카드 배지)·SeriesInfoModal(출처별 상세)·SeriesDetail(소스주제별 그룹)·ScriptsBrowser(row 힌트) 공용.
//   · domain = 소스가 다루는 분야/주제 (소스주제별 한눈 라벨)
//   · blurb  = 이 소스가 무엇인지 한 줄 설명 (소스별 설명 · 학습자가 처음 봐도 이해)

export interface SourceMeta {
  /** 학습자용 정식 라벨 (예: "NASA", "The Conversation") */
  label: string
  /** 좁은 공간(row 힌트)용 짧은 라벨 */
  short: string
  /** 소스 액센트색 (배지 틴트) */
  color: string
  /** 다루는 분야/주제 (소스주제별 한눈 라벨) */
  domain: string
  /** 무엇인지 한 줄 설명 (소스별 설명) */
  blurb: string
}

export const SOURCE_META: Record<string, SourceMeta> = {
  voa: {
    label: 'VOA Learning English',
    short: 'VOA',
    color: '#2563EB',
    domain: '쉬운 뉴스',
    blurb: '미국의 소리 방송 — 느리고 또박또박한 영어로 전하는 생활·시사 뉴스.',
  },
  nasa: {
    label: 'NASA',
    short: 'NASA',
    color: '#7C3AED',
    domain: '우주·천문',
    blurb: '미국 항공우주국 — 우주 탐사·천문·지구 관측 소식.',
  },
  nih: {
    label: 'NIH',
    short: 'NIH',
    color: '#0E7490',
    domain: '건강·의학',
    blurb: '미국 국립보건원 — 건강·질병·의학 연구 소식.',
  },
  simple_wikipedia: {
    label: 'Simple Wikipedia',
    short: 'Simple Wiki',
    color: '#0F766E',
    domain: '기초 백과',
    blurb: '쉬운 영어 위키백과 — 통제된 기초 어휘로 쓴 백과 항목.',
  },
  wikinews: {
    label: 'Wikinews',
    short: 'Wikinews',
    color: '#B45309',
    domain: '시사',
    blurb: '위키뉴스 — 자원자가 쓰는 중립적 시각의 짧은 시사.',
  },
  the_conversation: {
    label: 'The Conversation',
    short: 'Conversation',
    color: '#15803D',
    domain: '학술 논평',
    blurb: '대학 연구자가 직접 쓰는 시사·학술 분석과 논평.',
  },
  owid: {
    label: 'Our World in Data',
    short: 'OWID',
    color: '#0891B2',
    domain: '데이터·통계',
    blurb: '옥스퍼드 연구팀 — 통계·그래프로 세계의 큰 흐름을 설명.',
  },
  factbook: {
    label: 'World Factbook',
    short: 'Factbook',
    color: '#57534E',
    domain: '국가 정보',
    blurb: '국가별 지리·인구·경제 사실을 정리한 자료집.',
  },
  elife: {
    label: 'eLife',
    short: 'eLife',
    color: '#BE185D',
    domain: '생명과학',
    blurb: '오픈액세스 생명과학 저널 — 최신 연구를 정리한 글.',
  },
  wikipedia: {
    label: 'Wikipedia',
    short: 'Wikipedia',
    color: '#3730A3',
    domain: '백과',
    blurb: '정식 위키백과 — 폭넓은 주제의 표준 백과 항목.',
  },
  plos: {
    label: 'PLOS',
    short: 'PLOS',
    color: '#0369A1',
    domain: '과학 연구',
    blurb: '오픈액세스 과학 저널 — 생명·의학·환경 연구.',
  },
  wikivoyage: {
    label: 'Wikivoyage',
    short: 'Wikivoyage',
    color: '#0D9488',
    domain: '여행',
    blurb: '위키 여행 가이드 — 도시·나라별 실용 여행 정보.',
  },
  usgs: {
    label: 'USGS',
    short: 'USGS',
    color: '#92400E',
    domain: '지질·지구',
    blurb: '미국 지질조사국 — 지진·화산·지질·자연재해.',
  },
  noaa: {
    label: 'NOAA Climate',
    short: 'NOAA',
    color: '#155E75',
    domain: '기후·해양',
    blurb: '미국 해양대기청 — 기후·기상·해양 변화 소식.',
  },
  rss: {
    label: 'RSS',
    short: 'RSS',
    color: '#D97706',
    domain: '일반',
    blurb: 'RSS 피드로 수집한 글.',
  },
}

/** 미등록 소스는 키를 그대로 라벨로 (회색 폴백). */
export function sourceMeta(key: string): SourceMeta {
  return SOURCE_META[key] ?? { label: key, short: key, color: 'var(--t3)', domain: '기타', blurb: '' }
}
