// apps/web/src/app/api/admin/library/preview-wikibooks/route.ts
// LCP v2.0 Phase 14 — Wikibooks title 미리보기 프록시
//
// GET /api/admin/library/preview-wikibooks?title={page_title}
//
// 응답:
//   200 { title, preview_text, source_url, license, fetched_at, subpage_count }
//   400 { error, message } — invalid title
//   401/403 { error, message } — 미인증/role 부적합
//   404 { error, message } — 페이지 미존재
//   504 { error, message } — Wikibooks timeout

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const revalidate = 3600

const WB_API = 'https://en.wikibooks.org/w/api.php'
const TIMEOUT_MS = 10_000
const PREVIEW_MAX_CHARS = 800
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

interface PreviewResponse {
  source: 'wikibooks'
  source_id: string
  title: string
  author: string
  author_birth_year: null
  author_death_year: null
  language: 'en'
  license: 'CC-BY-SA-3.0'
  preview_text: string
  source_url: string
  subpage_count: number
  fetched_at: string
}

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const raw = req.nextUrl.searchParams.get('title')
  if (!raw) {
    return NextResponse.json(
      { error: 'BadRequest', message: 'Wikibooks page title 이 필요합니다.' },
      { status: 400 },
    )
  }
  const title = raw.trim().replace(/\s+/g, '_')
  if (!/^[A-Za-z0-9_/().,:'\-]+$/.test(title) || title.length > 200) {
    return NextResponse.json(
      { error: 'BadRequest', message: '허용되지 않는 문자가 포함되어 있습니다.' },
      { status: 400 },
    )
  }

  try {
    const meta = await fetchMeta(title)
    if (!meta) {
      return NextResponse.json(
        {
          error: 'NotFound',
          message: `Wikibooks 에서 "${title}" 페이지를 찾을 수 없습니다.`,
        },
        { status: 404 },
      )
    }

    const [previewText, subpageCount] = await Promise.all([
      fetchPreview(title),
      title.includes('/') ? Promise.resolve(0) : countSubpages(title),
    ])

    const res: PreviewResponse = {
      source: 'wikibooks',
      source_id: title,
      title: meta.title,
      author: 'Wikibooks contributors',
      author_birth_year: null,
      author_death_year: null,
      language: 'en',
      license: 'CC-BY-SA-3.0',
      preview_text: previewText ?? '(미리보기를 불러올 수 없습니다)',
      source_url: `https://en.wikibooks.org/wiki/${title}`,
      subpage_count: subpageCount,
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
          message: 'Wikibooks 응답이 늦어 미리보기를 가져오지 못했습니다.',
        },
        { status: 504 },
      )
    }
    console.error('[preview-wikibooks] fetch failed:', message)
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
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      next: { revalidate: 3600 },
    })
  } finally {
    clearTimeout(t)
  }
}

async function fetchMeta(title: string): Promise<{ title: string } | null> {
  const url = `${WB_API}?action=query&format=json&prop=info&titles=${encodeURIComponent(title)}&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const j = (await res.json()) as {
    query?: {
      pages?: Record<string, { title?: string; missing?: '' }>
    }
  }
  const first = Object.values(j.query?.pages ?? {})[0]
  if (!first || first.missing !== undefined || !first.title) return null
  return { title: first.title }
}

async function fetchPreview(title: string): Promise<string | null> {
  const url = `${WB_API}?action=parse&format=json&page=${encodeURIComponent(title)}&prop=text&disablelimitreport=1&disableeditsection=1&disabletoc=1&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return null
  const j = (await res.json()) as {
    parse?: { text?: { '*'?: string } }
    error?: { code?: string }
  }
  const html = j.parse?.text?.['*']
  if (!html || j.error) return null
  const plain = stripHtml(html)
  if (plain.length === 0) return null
  const trimmed = plain.slice(0, PREVIEW_MAX_CHARS)
  const lastSpace = trimmed.lastIndexOf(' ')
  return (lastSpace > 600 ? trimmed.slice(0, lastSpace) : trimmed) + '…'
}

async function countSubpages(rootTitle: string): Promise<number> {
  const url = `${WB_API}?action=query&format=json&list=allpages&apprefix=${encodeURIComponent(`${rootTitle}/`)}&apnamespace=0&aplimit=50&origin=*`
  const res = await fetchWithTimeout(url)
  if (!res.ok) return 0
  const j = (await res.json()) as { query?: { allpages?: unknown[] } }
  return j.query?.allpages?.length ?? 0
}

function stripHtml(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(
    /<(?:div|table)[^>]*class="[^"]*(?:navigation|infobox|metadata|reference|toc|navbox|noprint|mw-editsection)[^"]*"[^>]*>[\s\S]*?<\/(?:div|table)>/gi,
    '',
  )
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, '')
  s = s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}
