// apps/web/src/lib/library/cover-image.ts
//
// 도서 원천 표지 이미지 URL 해결기 (서버 전용).
//
// 정책:
//   - Standard Ebooks: ebook 페이지 og:image — 항상 존재 · 일관된 고품질 아트 · CC0.
//       (단, 제목 타이포가 이미지에 박혀 있음 → 렌더 시 제목 오버레이 주의)
//   - Gutenberg: pg{id}.cover.medium.jpg 패턴 (id 로 도출) — 존재 불확실 → HEAD 200 확인 후만.
//       표지는 PD ebook 의 일부 (호스팅/사용 가능).
//   - 그 외(LibriVox 등): 표지 없음 → null (그라디언트 fallback).
//
// 이미지 파일은 저장하지 않음 — URL 만 저장하고 next/image 가 서버 캐시·webp·리사이즈.

import 'server-only'

const TIMEOUT_MS = 8_000
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

/** source/source_id → 표지 이미지 URL (없으면 null). */
export async function resolveCoverImageUrl(input: {
  source: string
  sourceId: string | null
}): Promise<string | null> {
  const { source, sourceId } = input
  if (!sourceId) return null
  try {
    if (source === 'gutenberg' && /^\d{1,7}$/.test(sourceId)) {
      const url = `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}.cover.medium.jpg`
      return (await isImageOk(url)) ? url : null
    }
    if (source === 'standard_ebooks') {
      return await standardEbooksOgImage(sourceId)
    }
  } catch {
    return null
  }
  return null
}

/** HEAD 요청으로 이미지 존재 + content-type 확인. */
async function isImageOk(url: string): Promise<boolean> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT },
      next: { revalidate: 604800 },
    })
    const ct = res.headers.get('content-type') ?? ''
    return res.ok && ct.startsWith('image')
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/** Standard Ebooks ebook 페이지에서 og:image 메타 추출. */
async function standardEbooksOgImage(slug: string): Promise<string | null> {
  if (!/^[a-z0-9_-]+(?:\/[a-z0-9_-]+)+$/.test(slug)) return null
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(`https://standardebooks.org/ebooks/${slug}`, {
      signal: ctrl.signal,
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html' },
      next: { revalidate: 604800 },
    })
    if (!res.ok) return null
    const html = await res.text()
    const m =
      html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
    let url = m?.[1] ?? null
    if (url && url.startsWith('/')) url = `https://standardebooks.org${url}`
    return url && url.startsWith('https://') ? url : null
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
