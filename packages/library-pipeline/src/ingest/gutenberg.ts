// packages/library-pipeline/src/ingest/gutenberg.ts
// LCP v2.0 — Gutenberg API ingester
// 라이선스: PD-US (저자 사후 70년 경과 책만 KR 노출 — copyright_safe_in_kr 트리거가 자동 판정)

import type { RawBook } from '../types'

const GUTENBERG_TXT_URL = (id: string): string =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`

const GUTENBERG_RDF_URL = (id: string): string =>
  `https://www.gutenberg.org/cache/epub/${id}/pg${id}.rdf`

const USER_AGENT = 'Vocaflow-LCP/2.0 (research)'

interface GutenbergMeta {
  title: string
  author?: string
  author_birth_year?: number
  author_death_year?: number
  language: string
  license: string
}

/**
 * Gutenberg book ID 로 raw 본문 + 메타 가져오기.
 * Rate limit: 60초당 5건 권장 (호출자 책임).
 *
 * @param bookId Gutenberg ID (예: '1342' = Pride and Prejudice)
 * @returns RawBook (Stage S3 NORMALIZE 입력)
 */
export async function ingestFromGutenberg(bookId: string): Promise<RawBook> {
  if (!/^\d+$/.test(bookId)) {
    throw new Error(`Invalid Gutenberg ID: ${bookId}`)
  }

  // 1. RDF 메타 가져오기
  const rdfRes = await fetch(GUTENBERG_RDF_URL(bookId), {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!rdfRes.ok) {
    throw new Error(`Gutenberg RDF fetch failed: ${rdfRes.status}`)
  }
  const rdfXml = await rdfRes.text()
  const meta = parseRdfMeta(rdfXml)

  // 2. 본문 가져오기
  const txtRes = await fetch(GUTENBERG_TXT_URL(bookId), {
    headers: { 'User-Agent': USER_AGENT },
  })
  if (!txtRes.ok) {
    throw new Error(`Gutenberg TXT fetch failed: ${txtRes.status}`)
  }
  const raw_content = await txtRes.text()

  // 3. UTF-8 BOM 제거
  const cleaned = raw_content.replace(/^﻿/, '')

  return {
    source: 'gutenberg',
    source_id: bookId,
    source_url: GUTENBERG_TXT_URL(bookId),
    title: meta.title,
    ...(meta.author !== undefined && { author: meta.author }),
    ...(meta.author_birth_year !== undefined && {
      author_birth_year: meta.author_birth_year,
    }),
    ...(meta.author_death_year !== undefined && {
      author_death_year: meta.author_death_year,
    }),
    language: meta.language,
    license: meta.license,
    raw_content: cleaned,
    fetched_at: new Date(),
  }
}

/**
 * Gutenberg RDF/XML 에서 메타 파싱 (정규식 — 단순 케이스).
 * 복잡한 책 (다중 저자, 논픽션 컬렉션 등) 은 fast-xml-parser 도입 권장 (Phase 4.1).
 */
function parseRdfMeta(rdfXml: string): GutenbergMeta {
  const get = (re: RegExp): string | undefined => {
    const m = rdfXml.match(re)
    return m?.[1]?.trim()
  }

  const title = get(/<dcterms:title>([^<]+)<\/dcterms:title>/)
  const author = get(/<pgterms:name>([^<]+)<\/pgterms:name>/)
  const birth = get(/<pgterms:birthdate[^>]*>(\d+)<\/pgterms:birthdate>/)
  const death = get(/<pgterms:deathdate[^>]*>(\d+)<\/pgterms:deathdate>/)
  const language =
    get(/<dcterms:language>[^<]*<rdf:value[^>]*>([^<]+)<\/rdf:value>/) ?? 'en'
  const rights =
    get(/<dcterms:rights>([^<]+)<\/dcterms:rights>/) ??
    'Public domain in the USA.'

  if (!title) {
    throw new Error('Gutenberg RDF: title not found')
  }

  return {
    title,
    ...(author !== undefined && { author }),
    ...(birth !== undefined && { author_birth_year: parseInt(birth, 10) }),
    ...(death !== undefined && { author_death_year: parseInt(death, 10) }),
    language,
    license: rights,
  }
}
