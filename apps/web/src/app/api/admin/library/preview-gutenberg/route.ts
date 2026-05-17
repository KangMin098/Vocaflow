// apps/web/src/app/api/admin/library/preview-gutenberg/route.ts
// LCP v2.0 Phase 12 묶음 B — Gutenberg ID 미리보기 프록시
//
// GET /api/admin/library/preview-gutenberg?id={gutenberg_id}
//
// 응답:
//   200 { title, author, language, preview_text, source_url, fetched_at }
//   400 { error, message } — invalid id
//   401/403 { error, message } — 미인증/role 부적합
//   404 { error, message } — 책 미존재
//   504 { error, message } — Gutenberg timeout

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/auth/require-admin-api';

export const runtime = 'nodejs';
export const revalidate = 3600;

const GUTENBERG_TIMEOUT_MS = 10_000;
const PREVIEW_MAX_CHARS = 800;

interface PreviewResponse {
  source: 'gutenberg';
  source_id: string;
  title: string | null;
  author: string | null;
  author_birth_year: number | null;
  author_death_year: number | null;
  language: string | null;
  preview_text: string;
  source_url: string;
  fetched_at: string;
}

export async function GET(req: NextRequest) {
  const adminOrError = await requireAdminApi();
  if (adminOrError instanceof NextResponse) return adminOrError;

  const idParam = req.nextUrl.searchParams.get('id');
  if (!idParam || !/^\d{1,7}$/.test(idParam)) {
    return NextResponse.json(
      { error: 'BadRequest', message: 'Gutenberg ID는 1~7자리 숫자여야 합니다.' },
      { status: 400 },
    );
  }
  const id = idParam;

  try {
    const meta = await fetchGutenbergMetadata(id);
    if (!meta) {
      return NextResponse.json(
        { error: 'NotFound', message: `Gutenberg ID ${id}에 해당하는 책을 찾을 수 없습니다.` },
        { status: 404 },
      );
    }

    const previewText = await fetchGutenbergTextPreview(id);

    const response: PreviewResponse = {
      source: 'gutenberg',
      source_id: id,
      title: meta.title,
      author: meta.author,
      author_birth_year: meta.author_birth_year,
      author_death_year: meta.author_death_year,
      language: meta.language,
      preview_text: previewText ?? '(미리보기를 불러올 수 없습니다)',
      source_url: `https://www.gutenberg.org/ebooks/${id}`,
      fetched_at: new Date().toISOString(),
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown';
    if (message.includes('timeout') || message.includes('AbortError')) {
      return NextResponse.json(
        { error: 'GatewayTimeout', message: 'Gutenberg 응답이 늦어 미리보기를 가져오지 못했습니다.' },
        { status: 504 },
      );
    }
    console.error('[preview-gutenberg] fetch failed:', message);
    return NextResponse.json(
      { error: 'InternalError', message: '미리보기를 가져오는 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

interface GutenbergMeta {
  title: string | null;
  author: string | null;
  author_birth_year: number | null;
  author_death_year: number | null;
  language: string | null;
}

async function fetchGutenbergMetadata(id: string): Promise<GutenbergMeta | null> {
  const url = `https://www.gutenberg.org/ebooks/${id}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GUTENBERG_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Vocaflow LCP/1.0 (https://vocaflow.app)',
      },
      next: { revalidate: 3600 },
    });

    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const html = await res.text();

    const titleMatch =
      html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i) ||
      html.match(/<h1\s+itemprop="name">([^<]+)</i);
    const title = titleMatch?.[1]?.trim() ?? null;

    const authorMatch = html.match(/<a[^>]+rel="marcrel:aut"[^>]*>([^<]+)<\/a>/i);
    const authorRaw = authorMatch?.[1]?.trim() ?? null;
    const authorParsed = parseAuthorString(authorRaw);

    const langMatch = html.match(
      /<tr[^>]*>[\s\S]*?Language[\s\S]*?<td[^>]*>([^<]+)<\/td>/i,
    );
    const language = langMatch?.[1]?.trim() ?? null;

    if (!title) return null;

    return {
      title,
      author: authorParsed.name,
      author_birth_year: authorParsed.birth_year,
      author_death_year: authorParsed.death_year,
      language,
    };
  } finally {
    clearTimeout(timer);
  }
}

function parseAuthorString(raw: string | null): {
  name: string | null;
  birth_year: number | null;
  death_year: number | null;
} {
  if (!raw) return { name: null, birth_year: null, death_year: null };

  const yearMatch = raw.match(/(\d{1,4}\??)\s*[-–]\s*(\d{1,4}\??)/);
  let birthYear: number | null = null;
  let deathYear: number | null = null;
  let cleaned = raw;

  if (yearMatch) {
    const b = parseInt(yearMatch[1].replace('?', ''), 10);
    const d = parseInt(yearMatch[2].replace('?', ''), 10);
    birthYear = Number.isNaN(b) ? null : b;
    deathYear = Number.isNaN(d) ? null : d;
    cleaned = raw.replace(yearMatch[0], '').trim().replace(/,\s*$/, '').trim();
  }

  const parts = cleaned.split(',').map((s) => s.trim());
  let name: string | null;
  if (parts.length === 2) {
    name = `${parts[1]} ${parts[0]}`.trim();
  } else {
    name = cleaned || null;
  }

  return { name, birth_year: birthYear, death_year: deathYear };
}

async function fetchGutenbergTextPreview(id: string): Promise<string | null> {
  const candidates = [
    `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
    `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
  ];

  for (const url of candidates) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GUTENBERG_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Vocaflow LCP/1.0 (https://vocaflow.app)',
        },
      });
      clearTimeout(timer);
      if (!res.ok) continue;

      const reader = res.body?.getReader();
      if (!reader) continue;
      const decoder = new TextDecoder();
      let collected = '';
      while (collected.length < 3000) {
        const { done, value } = await reader.read();
        if (done) break;
        collected += decoder.decode(value, { stream: true });
      }
      reader.cancel();

      const startMarker = collected.match(/\*\*\*\s*START OF[^*]*\*\*\*/i);
      const stripped =
        startMarker && startMarker.index !== undefined
          ? collected.slice(startMarker.index + startMarker[0].length)
          : collected;

      const trimmed = stripped.trim().slice(0, PREVIEW_MAX_CHARS);
      const lastSpace = trimmed.lastIndexOf(' ');
      return (lastSpace > 600 ? trimmed.slice(0, lastSpace) : trimmed) + '…';
    } catch {
      clearTimeout(timer);
      continue;
    }
  }

  return null;
}
