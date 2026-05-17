// apps/web/src/app/api/admin/library/preview-openstax/route.ts
// LCP v2.0 Phase 17 — OpenStax book slug 미리보기

import { NextResponse, type NextRequest } from 'next/server'

import { requireAdminApi } from '@/lib/auth/require-admin-api'

export const runtime = 'nodejs'
export const revalidate = 3600

const OS_CMS = 'https://openstax.org/apps/cms/api/v2/pages'
const TIMEOUT_MS = 12_000
const PREVIEW_MAX_CHARS = 800
const USER_AGENT = 'Vocaflow-LCP/2.0 (research; https://vocaflow.app)'

interface PreviewResponse {
  source: 'openstax'
  source_id: string
  title: string
  author: string
  author_birth_year: null
  author_death_year: null
  language: string
  license: string
  preview_text: string
  source_url: string
  chapter_count: number
  fetched_at: string
}

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi()
  if (adminOrError instanceof NextResponse) return adminOrError

  const raw = req.nextUrl.searchParams.get('slug')
  if (!raw) {
    return NextResponse.json(
      { error: 'BadRequest', message: 'OpenStax book slug 가 필요합니다.' },
      { status: 400 },
    )
  }
  const slug = raw.trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug) || slug.length > 100) {
    return NextResponse.json(
      { error: 'BadRequest', message: '허용되지 않는 슬러그입니다.' },
      { status: 400 },
    )
  }

  try {
    // 1) slug → page id
    const listUrl = `${OS_CMS}/?type=books.Book&slug=${encodeURIComponent(slug)}&fields=title,slug,language,license_name`
    const listRes = await fetchWithTimeout(listUrl)
    if (!listRes.ok) throw new Error(`HTTP ${listRes.status}`)
    const listJson = (await listRes.json()) as {
      items?: Array<{ id: number; title: string }>
    }
    const item = listJson.items?.[0]
    if (!item) {
      return NextResponse.json(
        { error: 'NotFound', message: `OpenStax 에서 "${slug}" 책을 찾을 수 없습니다.` },
        { status: 404 },
      )
    }

    // 2) 상세 (description, license, TOC)
    const detailUrl = `${OS_CMS}/${item.id}/`
    const detailRes = await fetchWithTimeout(detailUrl)
    if (!detailRes.ok) throw new Error(`HTTP ${detailRes.status}`)
    const detail = (await detailRes.json()) as {
      title: string
      language?: string
      license_name?: string
      license_version?: string
      description?: string
      table_of_contents?: unknown
    }

    const chapterCount = countTocChapters(detail.table_of_contents)
    const previewText =
      stripHtml(detail.description ?? '').slice(0, PREVIEW_MAX_CHARS) ||
      `${item.title} — OpenStax 교과서 (${chapterCount} 챕터 추정).`

    const res: PreviewResponse = {
      source: 'openstax',
      source_id: slug,
      title: item.title,
      author: 'OpenStax (Rice University)',
      author_birth_year: null,
      author_death_year: null,
      language: detail.language ?? 'en',
      license: formatLicense(detail.license_name, detail.license_version),
      preview_text: previewText,
      source_url: `https://openstax.org/books/${slug}`,
      chapter_count: chapterCount,
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
          message: 'OpenStax 응답이 늦어 미리보기를 가져오지 못했습니다.',
        },
        { status: 504 },
      )
    }
    console.error('[preview-openstax] fetch failed:', message)
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

interface TocNode {
  type?: string
  slug?: string
  title?: string
  contents?: TocNode[]
}

function countTocChapters(toc: unknown): number {
  const root: TocNode[] = Array.isArray(toc)
    ? (toc as TocNode[])
    : ((toc as { contents?: TocNode[] })?.contents ?? [])
  let count = 0
  const visit = (list: TocNode[]): void => {
    for (const n of list) {
      const isChapter = n.type === 'chapter' || n.type === 'page' || !n.type
      if (isChapter && n.slug && n.title) count++
      if (n.contents && n.contents.length > 0) visit(n.contents)
    }
  }
  visit(root)
  return count
}

function formatLicense(name: string | undefined, version: string | undefined): string {
  if (!name) return 'CC-BY-4.0'
  const lower = name.toLowerCase()
  if (lower.includes('attribution') && !lower.includes('non')) {
    return version ? `CC-BY-${version}` : 'CC-BY-4.0'
  }
  return name
}

function stripHtml(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|div)>/gi, '\n')
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
