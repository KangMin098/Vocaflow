// apps/web/src/app/api/admin/library/preview-librivox/route.ts
// LCP v2.0 Phase 16 — LibriVox book id 미리보기 프록시
//
// GET /api/admin/library/preview-librivox?id={book_id}
//
// 응답:
//   200 { title, author, preview_text, source_url, text_source_url, ... }
//   400 { error, message } — invalid id
//   401/403 { error, message } — 미인증/role 부적합
//   404 { error, message } — book 미존재 또는 text source 없음
//   504 { error, message } — LibriVox/text source timeout
//
// 특이사항:
//   LibriVox 는 텍스트 본문이 없고 url_text_source 가 외부 (Gutenberg 등) 를 가리킴.
//   미리보기 텍스트는 그 외부 URL 에서 best-effort 로 fetch.

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const revalidate = 3600

const LV_API = 'https://librivox.org/api/feed/audiobooks'
const TIMEOUT_MS = 12_000
const PREVIEW_MAX_CHARS = 800
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

interface LibriVoxAuthor {
  first_name?: string | null
  last_name?: string | null
  dob?: string | null
  dod?: string | null
}

interface LibriVoxBook {
  id: number | string
  title: string
  description?: string
  language?: string
  totaltime?: string
  url_text_source?: string | null
  url_librivox?: string | null
  authors?: LibriVoxAuthor[]
}

interface PreviewResponse {
  source: 'librivox'
  source_id: string
  title: string
  author: string | null
  author_birth_year: number | null
  author_death_year: number | null
  language: string
  license: 'PD'
  preview_text: string
  source_url: string
  text_source_url: string | null
  text_source_kind: 'gutenberg' | 'other' | 'none'
  totaltime: string | null
  fetched_at: string
}

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const raw = req.nextUrl.searchParams.get('id')
  if (!raw) {
    return NextResponse.json(
      { error: 'BadRequest', message: 'LibriVox id 가 필요합니다.' },
      { status: 400 },
    )
  }
  const id = raw.trim()
  if (!/^[A-Za-z0-9_\-]+$/.test(id) || id.length > 50) {
    return NextResponse.json(
      { error: 'BadRequest', message: '허용되지 않는 id 입니다.' },
      { status: 400 },
    )
  }

  try {
    const book = await fetchMeta(id)
    if (!book) {
      return NextResponse.json(
        { error: 'NotFound', message: `LibriVox book ${id} 을 찾을 수 없습니다.` },
        { status: 404 },
      )
    }

    const textSourceUrl = book.url_text_source?.trim() || null
    const textSourceKind: PreviewResponse['text_source_kind'] = !textSourceUrl
      ? 'none'
      : extractGutenbergId(textSourceUrl)
        ? 'gutenberg'
        : 'other'

    const previewText = textSourceUrl
      ? (await fetchTextPreview(textSourceUrl)) ??
        (book.description ? stripHtml(book.description).slice(0, PREVIEW_MAX_CHARS) : null)
      : book.description
        ? stripHtml(book.description).slice(0, PREVIEW_MAX_CHARS)
        : null

    const res: PreviewResponse = {
      source: 'librivox',
      source_id: id,
      title: book.title,
      author: formatAuthor(book.authors) ?? null,
      author_birth_year: parseYear(book.authors?.[0]?.dob) ?? null,
      author_death_year: parseYear(book.authors?.[0]?.dod) ?? null,
      language: book.language ?? 'en',
      license: 'PD',
      preview_text: previewText ?? '(미리보기를 불러올 수 없습니다)',
      source_url: book.url_librivox ?? `https://librivox.org/?p=${id}`,
      text_source_url: textSourceUrl,
      text_source_kind: textSourceKind,
      totaltime: book.totaltime ?? null,
      fetched_at: new Date().toISOString(),
    }

    return NextResponse.json(res, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    if (message.includes('timeout') || message.includes('AbortError')) {
      return NextResponse.json(
        {
          error: 'GatewayTimeout',
          message: 'LibriVox 응답이 늦어 미리보기를 가져오지 못했습니다.',
        },
        { status: 504 },
      )
    }
    console.error('[preview-librivox] fetch failed:', message)
    return NextResponse.json(
      { error: 'InternalError', message: '미리보기를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}

// ─── helpers ─────────────────────────────────────

async function fetchWithTimeout(url: string): Promise<Response> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/json, text/html, text/plain',
      },
      next: { revalidate: 3600 },
    })
  } finally {
    clearTimeout(t)
  }
}

async function fetchMeta(id: string): Promise<LibriVoxBook | null> {
  const url = `${LV_API}/?id=${encodeURIComponent(id)}&format=json`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = (await res.json()) as { books?: LibriVoxBook[] }
  return j.books?.[0] ?? null
}

async function fetchTextPreview(url: string): Promise<string | null> {
  try {
    const res = await fetchWithTimeout(url)
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    const buf = await res.arrayBuffer()
    // 미리보기는 앞 ~64KB 만 디코드 (전체 fetch 부담 회피)
    const slice = buf.byteLength > 65536 ? buf.slice(0, 65536) : buf
    const decoded = new TextDecoder('utf-8').decode(slice)
    const plain = ct.includes('html') ? stripHtml(decoded) : decoded
    if (plain.trim().length < 100) return null
    const trimmed = plain.trim().slice(0, PREVIEW_MAX_CHARS)
    const lastSpace = trimmed.lastIndexOf(' ')
    return (lastSpace > 600 ? trimmed.slice(0, lastSpace) : trimmed) + '…'
  } catch {
    return null
  }
}

function formatAuthor(authors: LibriVoxAuthor[] | undefined): string | undefined {
  if (!authors || authors.length === 0) return undefined
  const a = authors[0]!
  const parts = [a.first_name, a.last_name].filter(
    (s): s is string => typeof s === 'string' && s.trim().length > 0,
  )
  if (parts.length === 0) return undefined
  const name = parts.join(' ').trim()
  return authors.length > 1 ? `${name} et al.` : name
}

function parseYear(y: string | null | undefined): number | undefined {
  if (!y) return undefined
  const t = y.trim()
  if (!t) return undefined
  const n = parseInt(t, 10)
  if (Number.isNaN(n) || n > 2100 || n < -3000) return undefined
  return n
}

function extractGutenbergId(url: string): string | null {
  const m = url.match(
    /(?:^|\/\/)(?:www\.)?gutenberg\.org\/(?:ebooks|cache\/epub|files)\/(\d{1,7})\b/i,
  )
  return m?.[1] ?? null
}

function stripHtml(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<header[\s\S]*?<\/header>/gi, '')
  s = s.replace(/<footer[\s\S]*?<\/footer>/gi, '')
  s = s.replace(/<nav[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}
