// apps/web/src/lib/library/cover-image.ts
//
// 도서 원천 표지 이미지 URL 해결기 (서버 전용).
//
// 정책:
//   - Standard Ebooks: ebook 페이지 og:image — 항상 존재 · 일관된 고품질 아트 · CC0.
//       (단, 제목 타이포가 이미지에 박혀 있음 → 렌더 시 제목 오버레이 주의)
//   - Gutenberg: pg{id}.cover.large.jpg → 없으면 medium (id 로 도출) — HEAD 200 확인 후만.
//       표지는 PD ebook 의 일부 (호스팅/사용 가능).
//   - 그 외(LibriVox 등): 표지 없음 → null (그라디언트 fallback).
//
// ⚠️ **씨앗이 먼저다** (v06.142). 시드 수집기(seed-fetchers)가 목록 페이지에서 이미 표지 URL을
// 뽑아 `library_seed_catalog.cover_url` 에 넣어 둔다. 그런데 승격 단계는 그 값을 무시하고
// 원천 사이트에 다시 요청했고, 그 요청은 best-effort(try/catch + warn)라 실패하면 조용히
// 표지 없는 책이 발행됐다 — 실측 2026-08-15: 발행 13권 중 8권 무표지, 그중 7권은
// **시드에 표지 URL 이 이미 있었다.** DB 에 있는 값을 두고 네트워크에 의존할 이유가 없다.
// → `resolveCoverImageUrlWithSeed()` 를 쓸 것. 순수 네트워크 해석은 그 폴백일 뿐이다.
//
// 이미지 파일은 저장하지 않음 — URL 만 저장하고 next/image 가 서버 캐시·webp·리사이즈.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

const TIMEOUT_MS = 8_000
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

/**
 * 시드 조회용 클라이언트.
 *
 * 구조적 인터페이스로 좁게 받으려다 실패했다 — supabase-js 의 `PostgrestBuilder` 는
 * thenable 이지 `Promise` 가 아니라서 구조 매칭이 깨지고, 제네릭이 깊어 TS2589
 * (excessively deep) 까지 났다. 실제 타입을 그대로 받는 편이 정직하고 단순하다.
 */
export type SeedCoverClient = SupabaseClient<any, any, any>

/**
 * 표지 URL 해결 — **시드 우선, 네트워크 폴백**.
 *
 * 이 함수가 정본이다. 승격(process/dev-process)·백필 전부 이것을 쓴다.
 * 시드에 값이 있으면 네트워크를 아예 타지 않으므로 대량 드레인에서 원천 사이트
 * 스로틀·타임아웃에 표지가 통째로 날아가던 실패가 사라진다.
 */
export async function resolveCoverImageUrlWithSeed(
  client: SeedCoverClient,
  input: { source: string; sourceId: string | null },
): Promise<{ url: string | null; via: 'seed' | 'origin' | 'none' | 'seed-dead' }> {
  const { source, sourceId } = input
  if (!sourceId) return { url: null, via: 'none' }

  let seeded: string | undefined
  try {
    const { data } = await client
      .from('library_seed_catalog')
      .select('cover_url')
      .eq('source', source)
      .eq('source_id', sourceId)
      .maybeSingle()
    seeded = data?.cover_url?.trim() || undefined
  } catch {
    // 시드 조회 실패는 치명적이지 않다 — 원천 해석으로 내려간다.
  }

  // ⚠️ **시드를 검증 없이 믿으면 안 된다** (실측 2026-08-15).
  //   SE 가 표지 URL 스킴을 바꿨다: 예전 `covers/<slug>-<빌드해시>-cover@2x.jpg` →
  //   지금 `covers/<slug>/<긴해시>/cover@2x.jpg`. 시드 1,450건 중 **1,369건(94%)** 이
  //   예전 스킴(전부 같은 `f5fe576e`)으로 굳어 있고 전부 404 다.
  //   검증 없이 넣었더니 발행 7권이 "표지 없음(그라디언트 폴백)" 에서 **검은 박스**로
  //   더 나빠졌다 — 죽은 URL 은 표지가 없는 것보다 나쁘다.
  //   HEAD 한 번(주간 캐시)이면 가려진다. 정확성이 무-네트워크보다 우선이다.
  if (seeded) {
    if (await isImageOk(seeded)) return { url: seeded, via: 'seed' }
    const fallback = await resolveCoverImageUrl({ source, sourceId })
    return { url: fallback, via: fallback ? 'origin' : 'seed-dead' }
  }

  const url = await resolveCoverImageUrl({ source, sourceId })
  return { url, via: url ? 'origin' : 'none' }
}

/** source/source_id → 표지 이미지 URL (없으면 null). 원천 사이트에 직접 묻는다. */
export async function resolveCoverImageUrl(input: {
  source: string
  sourceId: string | null
}): Promise<string | null> {
  const { source, sourceId } = input
  if (!sourceId) return null
  try {
    if (source === 'gutenberg' && /^\d{1,7}$/.test(sourceId)) {
      // large 우선 — medium 은 실측 200px 대(200x281·200x299)라 3:4 카드(2x DPI 400px)에서 흐리다.
      // large 가 없는 책이 있어 존재 확인 후 medium 으로 내려간다.
      const base = `https://www.gutenberg.org/cache/epub/${sourceId}/pg${sourceId}.cover`
      for (const size of ['large', 'medium'] as const) {
        const url = `${base}.${size}.jpg`
        if (await isImageOk(url)) return url
      }
      return null
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
