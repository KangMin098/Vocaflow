// apps/web/src/lib/library/source-urls.ts
// 도서 source 별 원본 URL 빌더 (8 source 매핑)
// admin curation 화면 — Curated Books 목록 + preview chapter list 의 외부 링크 생성.

const SOURCE_LABELS: Record<string, string> = {
  gutenberg: 'Project Gutenberg',
  standard_ebooks: 'Standard Ebooks',
  wikisource: 'Wikisource',
  simple_wikipedia: 'Simple Wikipedia',
  voa_learning: 'VOA Learning English',
  voa: 'VOA',
  openstax: 'OpenStax',
  wikibooks: 'Wikibooks',
  librivox: 'LibriVox',
  'librivox-audio': 'LibriVox Audio',
  lit2go: 'Lit2Go (USF)',
  manual: '직접 입력',
}

/** source 표시명 — UI 라벨용 */
export function sourceLabel(source: string): string {
  return SOURCE_LABELS[source] ?? source
}

/**
 * 도서 메인 페이지 URL.
 * sourceId 가 없거나 manual 이면 null.
 */
export function bookSourceUrl(source: string, sourceId: string | null): string | null {
  if (!sourceId) return null
  switch (source) {
    case 'gutenberg':
      return `https://www.gutenberg.org/ebooks/${sourceId}`
    case 'standard_ebooks':
      // sourceId 예: "lewis-carroll/alices-adventures-in-wonderland"
      return `https://standardebooks.org/ebooks/${sourceId}`
    case 'wikisource':
      return `https://en.wikisource.org/wiki/${encodeURIComponent(sourceId).replace(/%2F/g, '/')}`
    case 'simple_wikipedia':
      return `https://simple.wikipedia.org/wiki/${encodeURIComponent(sourceId).replace(/%2F/g, '/')}`
    case 'voa_learning':
    case 'voa':
      // sourceId 가 보통 path slug — 직접 prepend
      return sourceId.startsWith('http')
        ? sourceId
        : `https://learningenglish.voanews.com/a/${sourceId}`
    case 'openstax':
      return `https://openstax.org/details/books/${sourceId}`
    case 'wikibooks':
      return `https://en.wikibooks.org/wiki/${encodeURIComponent(sourceId).replace(/%2F/g, '/')}`
    case 'librivox':
    case 'librivox-audio':
      return sourceId.startsWith('http') ? sourceId : `https://librivox.org/${sourceId}`
    case 'lit2go': {
      // sourceId 형식: 'lit2go:{book-id}' 또는 '{book-id}' — prefix 제거 후 URL
      const id = sourceId.replace(/^lit2go:/, '')
      return `https://etc.usf.edu/lit2go/${id}/`
    }
    case 'manual':
    default:
      return null
  }
}

/**
 * 챕터별 원본 URL.
 * source 가 chapter 단위 URL 패턴을 가진 경우만 chapter-specific URL,
 * 나머지는 도서 메인 URL 반환 (사용자가 직접 anchor 로 이동).
 */
export function chapterSourceUrl(
  source: string,
  sourceId: string | null,
  chapterIdx: number,
  chapterTitle: string | null,
): string | null {
  const bookUrl = bookSourceUrl(source, sourceId)
  if (!bookUrl) return null

  switch (source) {
    case 'standard_ebooks': {
      // 정확한 챕터 URL 은 library_chapters_master.source_href (적재 시 TOC 매핑) 가 제공한다.
      // 여기는 그 매핑이 없을 때의 fallback — SE 챕터 URL 형식이 4종(파일분리/앵커/명명/중첩)이라
      //   /text/chapter-N 추측은 모음집·다권에서 404 를 낸다. 따라서 추측 대신 도서 목차(/text)로 보냄
      //   (절대 404 안 남 · 큐레이터가 목차에서 해당 장 1클릭). chapter_idx 는 미사용.
      void chapterIdx
      return `${bookUrl}/text`
    }
    case 'wikisource': {
      // chapter_title 이 있으면 sub-page, 없으면 도서 메인.
      if (chapterTitle) {
        const enc = encodeURIComponent(chapterTitle.replace(/ /g, '_')).replace(/%2F/g, '/')
        return `${bookUrl}/${enc}`
      }
      return bookUrl
    }
    case 'wikibooks': {
      if (chapterTitle) {
        const enc = encodeURIComponent(chapterTitle.replace(/ /g, '_')).replace(/%2F/g, '/')
        return `${bookUrl}/${enc}`
      }
      return bookUrl
    }
    case 'gutenberg':
      // Gutenberg 는 전권이 단일 HTML 1페이지. 카탈로그(/ebooks/{id}) 로는 본문에 못 감 →
      // 실제 읽기 HTML 을 반환 (Gutenberg "Read online now" 가 가리키는 canonical URL).
      // 챕터 앵커는 책마다 casing 불일치(#Chapter_I vs #CHAPTER_II)라 신뢰 불가 →
      // 챕터별 deep-link 없이 전권 페이지(curator 가 스크롤/검색으로 해당 장 확인).
      return sourceId
        ? `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}-images.html`
        : bookUrl
    case 'lit2go': {
      // Lit2Go: passage URL = /{book-id}/{passage-slug}/
      // chapter_title 이 있으면 slug 변환 (소문자/공백→하이픈), 없으면 book 메인.
      if (chapterTitle) {
        const slug = chapterTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
        if (slug) {
          const id = (sourceId ?? '').replace(/^lit2go:/, '')
          return `https://etc.usf.edu/lit2go/${id}/${slug}/`
        }
      }
      return bookUrl
    }
    case 'simple_wikipedia':
    case 'voa':
    case 'voa_learning':
    case 'openstax':
    case 'librivox':
    case 'librivox-audio':
    case 'manual':
    default:
      // 챕터 별도 페이지 없음 — 도서 메인 URL 반환.
      return bookUrl
  }
}
