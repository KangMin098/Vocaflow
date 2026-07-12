// apps/web/src/lib/articles/source-meta.ts
//
// ACP 소스 표시 메타 (라벨·색·짧은 라벨) — 학습자 노출용 단일 출처.
// ArticleCard(카드 배지)·SeriesDetail(출처 칩)·ScriptsBrowser(row 출처 힌트) 공용.
// 이전엔 ArticleCard 안에 하드코딩돼 있어 시리즈 화면에서 재사용 불가였음(v06.239 추출).

export interface SourceMeta {
  /** 학습자용 정식 라벨 (예: "NASA", "The Conversation") */
  label: string
  /** 좁은 공간(row 힌트)용 짧은 라벨 */
  short: string
  /** 소스 액센트색 (배지 틴트) */
  color: string
}

export const SOURCE_META: Record<string, SourceMeta> = {
  voa: { label: 'VOA Learning English', short: 'VOA', color: '#2563EB' },
  nasa: { label: 'NASA', short: 'NASA', color: '#7C3AED' },
  nih: { label: 'NIH', short: 'NIH', color: '#0E7490' },
  simple_wikipedia: { label: 'Simple Wikipedia', short: 'Simple Wiki', color: '#0F766E' },
  wikinews: { label: 'Wikinews', short: 'Wikinews', color: '#B45309' },
  the_conversation: { label: 'The Conversation', short: 'Conversation', color: '#15803D' },
  owid: { label: 'Our World in Data', short: 'OWID', color: '#0891B2' },
  factbook: { label: 'World Factbook', short: 'Factbook', color: '#57534E' },
  elife: { label: 'eLife', short: 'eLife', color: '#BE185D' },
  wikipedia: { label: 'Wikipedia', short: 'Wikipedia', color: '#3730A3' },
  plos: { label: 'PLOS', short: 'PLOS', color: '#0369A1' },
  wikivoyage: { label: 'Wikivoyage', short: 'Wikivoyage', color: '#0D9488' },
  usgs: { label: 'USGS', short: 'USGS', color: '#92400E' },
  noaa: { label: 'NOAA Climate', short: 'NOAA', color: '#155E75' },
  rss: { label: 'RSS', short: 'RSS', color: '#D97706' },
}

/** 미등록 소스는 키를 그대로 라벨로 (회색 폴백). */
export function sourceMeta(key: string): SourceMeta {
  return SOURCE_META[key] ?? { label: key, short: key, color: 'var(--t3)' }
}
