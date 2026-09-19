// apps/web/src/lib/comic/format.ts
// CCP "구성 방식(포맷/레이아웃)" SSoT — 화풍(그림체)과 분리된 별도 축.
//   구성 방식 = 컷을 어떻게 배치하고 어떻게 읽는가(세로 스크롤 vs 페이지 넘김) + 컷 종횡비.
//   화풍(comic_styles.art_prompt·palette)과 독립. 리더 모드·생성 컷 비율·탭 그룹핑의 근거.
//   클라이언트/서버 공용(순수 상수) — 서버 의존 없음.

export type ComicFormat = 'webtoon' | 'manhwa-page' | 'manga-page' | 'comic-page' | 'graphic-novel'

export interface FormatMeta {
  key: ComicFormat
  label: string          // 관리자/학습자 표기
  reader: 'scroll' | 'page' // 리더 기본 읽는 방식
  aspect: 'tall' | 'grid' | 'cinematic' // 생성 컷 종횡비 성향
  layout: string         // 레이아웃 한 줄 설명
  blurb: string          // 구성 방식 설명(관리자 그룹 헤더)
}

// 사용자 모델(웹툰=세로스크롤 / 만화=페이지 넘김)에 맞춘 매핑. webtoon 만 scroll, 나머지는 page.
export const FORMAT_META: Record<ComicFormat, FormatMeta> = {
  webtoon: {
    key: 'webtoon', label: '웹툰', reader: 'scroll', aspect: 'tall',
    layout: '세로 무한 스크롤 · 1열', blurb: '세로로 긴 컷을 스크롤로 내려 읽는 모바일 구성. 컷 사이 여백으로 호흡을 만든다.',
  },
  'manhwa-page': {
    key: 'manhwa-page', label: '만화(스크롤)', reader: 'scroll', aspect: 'tall',
    layout: '세로 스크롤 · 회화적 컷', blurb: '회화적 대형 컷을 세로로 읽는 구성. 웹툰형이나 그림 밀도가 높다.',
  },
  'manga-page': {
    key: 'manga-page', label: '만화(페이지)', reader: 'page', aspect: 'grid',
    layout: '페이지 넘김 · 컷 그리드', blurb: '페이지당 여러 컷을 그리드로 배치해 한 페이지씩 넘겨 읽는 구성.',
  },
  'comic-page': {
    key: 'comic-page', label: '코믹북(페이지)', reader: 'page', aspect: 'grid',
    layout: '페이지 넘김 · 컷 그리드', blurb: '페이지 단위로 컷을 배치하고 넘겨 읽는 서구 코믹북 구성.',
  },
  'graphic-novel': {
    key: 'graphic-novel', label: '그래픽노블', reader: 'page', aspect: 'cinematic',
    layout: '페이지 넘김 · 대형 시네마틱 컷', blurb: '적은 수의 큰 컷을 넘겨 읽는 시네마틱·문학적 구성.',
  },
}

export const FORMAT_ORDER: ComicFormat[] = ['webtoon', 'manhwa-page', 'manga-page', 'comic-page', 'graphic-novel']

export function formatMeta(f?: string | null): FormatMeta {
  return FORMAT_META[(f as ComicFormat)] ?? FORMAT_META['comic-page']
}

/** 포맷 → 리더 기본 읽는 방식('scroll'|'page'). 저장된 사용자 선택이 우선. */
export function defaultReaderMode(f?: string | null): 'scroll' | 'page' {
  return formatMeta(f).reader
}
