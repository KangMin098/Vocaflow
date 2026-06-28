// packages/library-pipeline/src/ingest-article/openstax.ts
// ACP §19 (설계 · v06.97) — OpenStax CNXML 교재 모듈 ingester (프로토타입).
//
// 소스 구조 (github.com/openstax/osbooks-* · 실측 검증 2026-06-28):
//   collections/<book>.collection.xml  — 책 TOC + <md:license url> (라이선스 권위 출처)
//   modules/m<id>/index.cnxml          — 모듈(섹션) 본문 (CNXML XML)
//   media/                             — 그림 (어휘 파이프라인 무관)
//
// ⚠️ 라이선스 게이트: OpenStax 현행 표준 = CC-BY-NC-SA 4.0 (NonCommercial).
//   §18 acp_classify_license 가 NC → 'restricted' (copyright_safe=false) 차단.
//   본 ingester 는 collection 메타의 실 라이선스를 읽어 license 필드에 그대로 담는다
//   — 가정하지 않음. CC-BY(비-NC) 책만 게이트 통과. NC 책은 DB INSERT 시 차단됨(의도).
//   상업적 사용 commitment 라는 비즈니스 결정 전까지 NC 책 ingest 는 게이트가 막는다.
//
// CNXML → prose 추출: <para>/<section><title>/<list><item>/<term>/<emphasis> 유지,
//   MathML(<m:math>)·<figure>/<media>/<image>·<exercise>·<equation> 제거 (lexical_noise 원천).

import type { RawArticle } from '../types-article'

import { fetchWithTimeout, decodeEntities } from './_helpers'

const RAW_BASE = 'https://raw.githubusercontent.com/openstax'
const GH_API = 'https://api.github.com/repos/openstax'

export interface OpenStaxModuleRef {
  /** osbooks-* repo 이름 (예: 'osbooks-biology-bundle') */
  repo: string
  /** 모듈 폴더 id (예: 'm45417') — collection 의 <col:module document="..."> 값 */
  moduleId: string
  /** 라이선스 권위 출처가 될 collection 파일명 (예: 'biology-2e.collection.xml'). 생략 시 첫 collection 자동 탐색 */
  collectionFile?: string
  /** repo 기본 브랜치 (기본 main) */
  branch?: string
}

/** collection.xml 첫 파일명 자동 탐색 (collectionFile 미지정 시). */
async function resolveCollectionFile(repo: string): Promise<string> {
  const res = await fetchWithTimeout(`${GH_API}/${repo}/contents/collections`, {
    accept: 'application/vnd.github+json',
  })
  if (!res.ok) throw new Error(`openstax: collections 목록 실패 ${res.status} (${repo})`)
  const entries = (await res.json()) as Array<{ name?: string }>
  const coll = entries.find((e) => (e.name ?? '').endsWith('.collection.xml'))
  if (!coll?.name) throw new Error(`openstax: ${repo} 에 collection.xml 없음`)
  return coll.name
}

/** collection.xml 의 <md:license url="..."> 에서 라이선스 문자열 도출 (권위 출처). */
function licenseFromCollection(collectionXml: string): { license: string; title: string } {
  const urlMatch = collectionXml.match(/<md:license\s+url="([^"]+)"/i)
  const url = urlMatch?.[1] ?? ''
  const title =
    collectionXml.match(/<md:title>\s*([\s\S]*?)\s*<\/md:title>/i)?.[1]?.trim() ?? 'OpenStax'

  // CC URL → §18 acp_classify_license 가 인식하는 라이선스 코드로 정규화.
  const slug = url.match(/licenses\/([a-z-]+)\//i)?.[1]?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    by: 'CC-BY-4.0',
    'by-sa': 'CC-BY-SA-4.0',
    'by-nd': 'CC-BY-ND-4.0',
    'by-nc': 'CC-BY-NC-4.0',
    'by-nc-sa': 'CC-BY-NC-SA-4.0',
    'by-nc-nd': 'CC-BY-NC-ND-4.0',
  }
  return { license: map[slug] ?? (url || 'unknown'), title: decodeEntities(title) }
}

/**
 * CNXML 모듈 본문 → plain text.
 * 어휘 노이즈 원천(수식/그림/연습문제)을 제거하고 산문만 남긴다.
 */
export function cnxmlToPlainText(cnxml: string): string {
  // 1) <content>...</content> 만 (metadata / abstract 제외)
  const content = cnxml.match(/<content\b[^>]*>([\s\S]*?)<\/content>/i)?.[1] ?? cnxml

  let s = content
  // 2) MathML — 가장 큰 노이즈 (네임스페이스 prefix 유무 모두)
  s = s.replace(/<(?:[a-z]+:)?math\b[\s\S]*?<\/(?:[a-z]+:)?math>/gi, ' ')
  // 3) 그림 / 미디어 / 이미지
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  s = s.replace(/<media\b[\s\S]*?<\/media>/gi, ' ')
  s = s.replace(/<image\b[^>]*\/?>/gi, ' ')
  // 4) 연습문제 / 풀이 / 수식 블록 (산문 아님)
  s = s.replace(/<exercise\b[\s\S]*?<\/exercise>/gi, '\n')
  s = s.replace(/<solution\b[\s\S]*?<\/solution>/gi, ' ')
  s = s.replace(/<equation\b[\s\S]*?<\/equation>/gi, ' ')
  s = s.replace(/<code\b[\s\S]*?<\/code>/gi, ' ')
  // 5) 상호참조 링크 (<link target-id=".."/>) — 본문 텍스트 없음
  s = s.replace(/<link\b[^>]*\/?>/gi, ' ')
  s = s.replace(/<\/link>/gi, ' ')
  // 6) 블록 종료 → 줄바꿈 (문단 경계 보존)
  s = s.replace(/<\/(?:para|title|item|section|note|caption)>/gi, '\n')
  // 7) 나머지 모든 태그 제거 (<term>/<emphasis>/<sup>/<sub> 등 inline — 내부 텍스트 유지)
  s = s.replace(/<[^>]+>/g, '')
  // 8) 엔티티 디코드 + 공백 정규화
  s = decodeEntities(s)
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * OpenStax CNXML 모듈 → RawArticle (프로토타입).
 *
 * 라이선스는 collection 메타에서 읽어 그대로 담는다(가정 X). NC 책은 DB 게이트가 차단.
 *
 * @example
 *   await ingestOpenStaxModule({ repo: 'osbooks-biology-bundle', moduleId: 'm45417' })
 */
export async function ingestOpenStaxModule(ref: OpenStaxModuleRef): Promise<RawArticle> {
  const branch = ref.branch ?? 'main'
  const collectionFile = ref.collectionFile ?? (await resolveCollectionFile(ref.repo))

  // 1) collection.xml — 라이선스 권위 출처 + 책 제목
  const collRes = await fetchWithTimeout(
    `${RAW_BASE}/${ref.repo}/${branch}/collections/${collectionFile}`,
    { accept: 'application/xml' },
  )
  if (!collRes.ok) {
    throw new Error(`openstax: collection fetch 실패 ${collRes.status} (${collectionFile})`)
  }
  const { license, title: bookTitle } = licenseFromCollection(await collRes.text())

  // 2) module index.cnxml — 본문
  const modRes = await fetchWithTimeout(
    `${RAW_BASE}/${ref.repo}/${branch}/modules/${ref.moduleId}/index.cnxml`,
    { accept: 'application/xml' },
  )
  if (!modRes.ok) {
    throw new Error(`openstax: module fetch 실패 ${modRes.status} (${ref.moduleId})`)
  }
  const cnxml = await modRes.text()

  const moduleTitle =
    cnxml.match(/<title>\s*([\s\S]*?)\s*<\/title>/i)?.[1]?.trim() ?? ref.moduleId
  const content = cnxmlToPlainText(cnxml)
  if (content.length < 400) {
    throw new Error(`openstax body too short: ${content.length} chars (${ref.moduleId})`)
  }

  return {
    source: 'openstax',
    source_id: `openstax:${ref.repo}:${ref.moduleId}`,
    source_url: `${RAW_BASE}/${ref.repo}/${branch}/modules/${ref.moduleId}/index.cnxml`,
    title: `${decodeEntities(bookTitle)} — ${decodeEntities(moduleTitle)}`,
    author: 'OpenStax (Rice University)',
    language: 'en',
    license, // collection 메타 그대로 — 게이트가 NC 차단/CC-BY 통과 결정
    published_at: null, // 교재 = 지속 개정
    content,
    estimated_cefr: 'C1', // 대학 교재 = 학술 (analyze 단계 재측정)
    fetched_at: new Date(),
  }
}
