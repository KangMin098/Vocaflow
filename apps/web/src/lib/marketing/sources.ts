// apps/web/src/lib/marketing/sources.ts
//
// 공개 화면 이름 흐름 띠(`SourceMarquee`)에 싣는 **실제 콘텐츠 출처** — 참조의 고객 로고 줄 자리(DD-68 · tines-mapping §21).
// 로고·고객사를 지어내지 않는다. 도서(lib/library 수집 소스)와 기사(lib/articles/source-map.ts 트랙 소스) 가운데
// 학습자가 이름을 알 만한 것만 적는다.
// 소스를 빼면(예: arXiv 삭제 2026-06-14) 여기서도 뺀다.

export const CONTENT_SOURCES: readonly string[] = [
  'Project Gutenberg',
  'Standard Ebooks',
  'LibriVox',
  'VOA',
  'NASA',
  'NIH',
  'eLife',
  'PLOS',
  'USGS',
  'NOAA',
  'Our World in Data',
  'The Conversation',
  'Wikipedia',
  'Wikisource',
  'OpenStax',
]
