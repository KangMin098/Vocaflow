// packages/library-pipeline/src/ingest-article/elife.ts
// ACP §18 확장 — eLife digest ingester (고품질 과학 설명 · CC-BY).
//
// 학습 가치: eLife 는 각 연구 논문마다 편집자가 **plain-language digest**(일반 독자용 요약)를
//   작성한다 — LLM 생성물이 아닌 인간 저작 균질 산문. 생명과학 최신 연구를 접근형 문체로 재서술.
//   register=expository(과학). CC-BY 4.0 → license_class=cc_by → 발행 허용(display_only 아님).
// 데이터: eLife API(JSON) — 기사 JSON 의 digest.content 만 추출(본문 body 는 C2 연구라 배제).
//   의존성 0(JSON) · HTML 스크래핑 없음.
//
// URL: 사람용 https://elifesciences.org/articles/<id> → 내부적으로 API 조회.
// source_id: "elife:<id>" (예: "elife:91060")

import type { RawArticle } from '../types-article'

import { decodeEntities, fetchWithTimeout, htmlToPlainText, safeDate } from './_helpers'

const ELIFE_API = 'https://api.elifesciences.org/articles'
const VOR_ACCEPT = 'application/vnd.elife.article-vor+json; version=8'
const LIST_ACCEPT = 'application/vnd.elife.article-list+json; version=1'

export interface ElifeListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
}

interface ElifeBlock {
  type?: string
  text?: string
}
interface ElifeArticleJson {
  id?: string
  title?: string
  authorLine?: string
  published?: string
  copyright?: { license?: string }
  digest?: { content?: ElifeBlock[] }
}
interface ElifeListJson {
  items?: Array<{ id: string; title?: string; published?: string; impactStatement?: string }>
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
}

/** 최근 eLife 기사 목록 (큐레이션 picker — digest 보유 여부는 단건 ingest 시 확정). */
export async function listElifeFeed(perPage = 20): Promise<ElifeListItem[]> {
  const res = await fetchWithTimeout(`${ELIFE_API}?per-page=${perPage}&order=desc`, {
    accept: LIST_ACCEPT,
  })
  if (!res.ok) throw new Error(`eLife list failed: ${res.status}`)
  const data = JSON.parse(await res.text()) as ElifeListJson
  return (data.items ?? [])
    .filter((it) => it.id && /^\d+$/.test(it.id))
    .map((it) => ({
      source_id: `elife:${it.id}`,
      title: stripTags(it.title ?? `eLife ${it.id}`),
      url: `https://elifesciences.org/articles/${it.id}`,
      published_at: it.published ?? null,
      description: stripTags(it.impactStatement ?? ''),
    }))
}

/** 단일 eLife 기사 → digest 산문 추출 (연구 본문 아님 — 접근형 요약만). */
export async function ingestElifeArticle(itemUrl: string): Promise<RawArticle> {
  const id = itemUrl.match(/(?:articles\/|elife:)(\d+)/)?.[1]
  if (!id) throw new Error(`eLife: article id 추출 실패 (${itemUrl})`)

  const res = await fetchWithTimeout(`${ELIFE_API}/${id}`, { accept: VOR_ACCEPT })
  if (!res.ok) throw new Error(`eLife fetch failed: ${res.status} (${id})`)
  let data: ElifeArticleJson
  try {
    data = JSON.parse(await res.text()) as ElifeArticleJson
  } catch {
    throw new Error(`eLife JSON 파싱 실패 (${id})`)
  }

  const blocks = data.digest?.content
  if (!blocks || blocks.length === 0) {
    throw new Error(`eLife: digest 없음 (${id}) — digest 보유 기사만 지원`)
  }
  const content = blocks
    .filter((b) => b.type === 'paragraph' && b.text)
    .map((b) => htmlToPlainText(b.text!))
    .join('\n\n')
    .trim()
  if (content.split(/\s+/).filter(Boolean).length < 150) {
    throw new Error(`eLife digest too short: ${content.length} chars (${id})`)
  }

  // 라이선스 — copyright.license (예: 'CC-BY-4.0'). digest 도 동일 라이선스.
  const license = (data.copyright?.license ?? 'CC-BY-4.0').toUpperCase()

  return {
    source: 'elife',
    source_id: `elife:${id}`,
    source_url: `https://elifesciences.org/articles/${id}`,
    title: stripTags(data.title ?? `eLife ${id}`),
    author: data.authorLine ? stripTags(data.authorLine) : 'eLife',
    language: 'en',
    license, // CC-BY-4.0 → cc_by → 발행 허용
    published_at: safeDate(data.published),
    content,
    estimated_cefr: null, // analyze 단계 실측
    audio_url: null,
    fetched_at: new Date(),
  }
}
