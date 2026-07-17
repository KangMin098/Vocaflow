// packages/library-pipeline/src/ingest-article/factbook.ts
// ACP §18 확장 — CIA World Factbook ingester (reference register 공백 보강).
//
// 학습 가치: 국가 개요(Background) = reference/expository 산문. B1~B2. CSAT 지문의
//   설명·참고 유형과 정합. 발행 가능 register 매트릭스에서 유일하게 비어 있던 reference 칸을
//   **발행 가능**(public_domain = 파생 자유) 콘텐츠로 채운다.
// 라이선스: U.S. Government Public Domain (CIA 저작물) → license_class=public_domain →
//   display_only 아님(단어세트 발행 허용).
// 데이터: factbook.json (커뮤니티 PD 덤프) — 국가별 구조화 JSON. HTML 스크래핑 없이
//   Introduction/Background 산문 필드만 추출(의존성 0). 나머지 필드(목록·표·약어)는
//   lexical_noise 를 높이므로 본문에서 제외.
//
// URL: https://raw.githubusercontent.com/factbook/factbook.json/master/<region>/<code>.json
// source_id: "factbook:<code>" (예: "factbook:ks" = South Korea)

import type { RawArticle } from '../types-article'

import { decodeEntities, fetchWithTimeout, htmlToPlainText } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const FACTBOOK_BASE = 'https://raw.githubusercontent.com/factbook/factbook.json/master'

export interface FactbookCountry {
  region: string
  code: string
  name: string
}

/** 큐레이션 후보 — Background 산문이 충실한 주요국 (region/code 실측 200 검증). */
export const FACTBOOK_COUNTRIES: ReadonlyArray<FactbookCountry> = [
  { region: 'east-n-southeast-asia', code: 'ks', name: 'South Korea' },
  { region: 'east-n-southeast-asia', code: 'ja', name: 'Japan' },
  { region: 'east-n-southeast-asia', code: 'ch', name: 'China' },
  { region: 'east-n-southeast-asia', code: 'id', name: 'Indonesia' },
  { region: 'east-n-southeast-asia', code: 'vm', name: 'Vietnam' },
  { region: 'east-n-southeast-asia', code: 'th', name: 'Thailand' },
  { region: 'south-asia', code: 'in', name: 'India' },
  { region: 'south-asia', code: 'pk', name: 'Pakistan' },
  { region: 'north-america', code: 'us', name: 'United States' },
  { region: 'north-america', code: 'ca', name: 'Canada' },
  { region: 'north-america', code: 'mx', name: 'Mexico' },
  { region: 'south-america', code: 'br', name: 'Brazil' },
  { region: 'south-america', code: 'ar', name: 'Argentina' },
  { region: 'south-america', code: 'co', name: 'Colombia' },
  { region: 'europe', code: 'uk', name: 'United Kingdom' },
  { region: 'europe', code: 'fr', name: 'France' },
  { region: 'europe', code: 'gm', name: 'Germany' },
  { region: 'europe', code: 'it', name: 'Italy' },
  { region: 'europe', code: 'sp', name: 'Spain' },
  { region: 'europe', code: 'pl', name: 'Poland' },
  { region: 'europe', code: 'sw', name: 'Sweden' },
  { region: 'europe', code: 'nl', name: 'Netherlands' },
  { region: 'europe', code: 'gr', name: 'Greece' },
  { region: 'central-asia', code: 'rs', name: 'Russia' },
  { region: 'central-asia', code: 'kz', name: 'Kazakhstan' },
  { region: 'africa', code: 'eg', name: 'Egypt' },
  { region: 'africa', code: 'sf', name: 'South Africa' },
  { region: 'africa', code: 'ni', name: 'Nigeria' },
  { region: 'africa', code: 'ke', name: 'Kenya' },
  { region: 'middle-east', code: 'sa', name: 'Saudi Arabia' },
  { region: 'middle-east', code: 'tu', name: 'Turkey' },
  { region: 'middle-east', code: 'is', name: 'Israel' },
  { region: 'middle-east', code: 'ir', name: 'Iran' },
  { region: 'australia-oceania', code: 'as', name: 'Australia' },
  { region: 'australia-oceania', code: 'nz', name: 'New Zealand' },
]

export interface FactbookListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  score?: ArticleScore
}

export function factbookUrl(region: string, code: string): string {
  return `${FACTBOOK_BASE}/${region}/${code}.json`
}

/** 후보 국가 목록 (정적 — 큐레이션 picker). RSS 아님 → 네트워크 fetch 없음. 대량 GET 위해 스코어 부여. */
export function listFactbookFeed(): Array<FactbookListItem & { score: ArticleScore }> {
  const raw: FactbookListItem[] = FACTBOOK_COUNTRIES.map((c) => ({
    source_id: `factbook:${c.code}`,
    title: c.name,
    url: factbookUrl(c.region, c.code),
    published_at: null,
    description: `${c.name} — CIA World Factbook 국가 개요 (Background · reference · B1–B2)`,
  }))
  return applyArticleCurationSpec(raw, 'factbook', 'all')
}

// factbook.json 구조 (필요 필드만) — {text: string} 중첩.
interface FbText {
  text?: string
}
interface FactbookJson {
  Introduction?: { Background?: FbText }
  Government?: { ['Country name']?: { ['conventional short form']?: FbText } }
}

/** 단일 Factbook 국가 JSON fetch → Background 산문 추출. */
export async function ingestFactbookArticle(itemUrl: string): Promise<RawArticle> {
  const res = await fetchWithTimeout(itemUrl, { accept: 'application/json' })
  if (!res.ok) throw new Error(`Factbook fetch failed: ${res.status} ${itemUrl}`)
  let data: FactbookJson
  try {
    data = JSON.parse(await res.text()) as FactbookJson
  } catch {
    throw new Error(`Factbook JSON 파싱 실패: ${itemUrl}`)
  }

  // 본문 = Introduction/Background (유일한 충실 산문 필드). HTML(<p><br><strong>) 제거.
  const bgHtml = data.Introduction?.Background?.text
  if (!bgHtml || typeof bgHtml !== 'string') {
    throw new Error(`Factbook: Introduction/Background 없음 (${itemUrl})`)
  }
  const content = htmlToPlainText(bgHtml)
  if (content.trim().length < 200) {
    throw new Error(`Factbook Background too short: ${content.trim().length} chars`)
  }

  // code = URL 마지막 세그먼트. 제목 = 국가명(conventional short form), 없으면 code.
  const code = itemUrl.match(/\/([a-z]{2})\.json$/i)?.[1] ?? 'xx'
  const shortForm = data.Government?.['Country name']?.['conventional short form']?.text
  const title =
    shortForm && typeof shortForm === 'string' && shortForm.toLowerCase() !== 'none'
      ? decodeEntities(shortForm).trim()
      : `Factbook ${code.toUpperCase()}`

  return {
    source: 'factbook',
    source_id: `factbook:${code}`,
    source_url: itemUrl,
    title,
    author: 'CIA World Factbook',
    language: 'en',
    license: 'Public Domain (US Government)', // → license_class=public_domain → 발행 허용
    published_at: null, // 국가 덤프 — per-fetch 발행일 무의미
    content,
    estimated_cefr: null, // analyze 단계 실측
    audio_url: null,
    fetched_at: new Date(),
  }
}
