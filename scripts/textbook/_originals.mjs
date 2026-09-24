// scripts/textbook/_originals.mjs
//
// **원천 먼저 — 수집기가 조각보다 원천(책·챕터·문서 한 편 전체)을 먼저 담는다.**
//
// ── 왜 (실측 2026-09-24) ─────────────────────────────────────────────
// 보관 판정은 원천 단위다(docs/source-check/criteria.md §1 「파생물은 원천이 아니다」 ·
// scripts/csat/gate-rules.mjs `derivativeKind`). 그런데 수집기 다섯이 **수집 단계에서 자른 조각만**
// 담고 원천은 담지 않았다 — europe_pmc 1,300 중 1,211(`#p1-2`) · space_place 59 중 54 ·
// storyweaver 136 중 77 · simple_wikipedia `#lead` 59 · frym 152(초록만). 판정자는 조각을 받아
// 「원천 불완전」과 씨름했고, frym-ingest 는 창에 드는 조각이 없으면 **원천까지 버렸다**(§0 위반).
//
// 규칙:
//   ① 원천 행을 먼저 담는다 — 열쇠는 `#…` 없는 원본 열쇠, status 'queued', 전문, `csat_fit.rights`.
//   ② 조각(발췌·도입부·초록)은 그다음, 원한다면 — `csat_fit.derived_from = { id, source_id, kind }`.
//   ③ 창에 드는 조각이 없어도 원천은 담는다. 조각만 건너뛴다.
//
// 빈 본문은 넣지 않는다 — 넣으면 다음 수확이 「이미 있음」으로 세어 구멍이 영영 남는다.
// 이 모듈은 쓰기 여부를 스스로 정하지 않는다. 부르는 쪽이 `commit` 을 넘긴다(기본 dry-run).

const { rightsTag } = await import('../../packages/library-pipeline/src/ingest-article/rights-tag.ts')

/** 파생 종류 — `csat_fit.derived_from.kind`. gate-rules `derivativeKind` 가 그대로 돌려준다. */
export const DERIVED_KINDS = new Set(['lead', 'paragraphs', 'excerpt', 'abstract', 'adapt'])

export const countWords = (s) => String(s ?? '').split(/\s+/).filter(Boolean).length

/** `RawArticle` 에서 권리 표지. 수집기가 아는 근거(`license_evidence`)만 적는다. */
export function rightsOf(article, evidence = null) {
  const published = article.published_at
  const publishedIso =
    published instanceof Date
      ? (Number.isNaN(published.getTime()) ? null : published.toISOString())
      : (published ?? null)
  return rightsTag({
    license: article.license ?? null,
    licenseEvidence: evidence ?? article.license_evidence ?? 'page',
    author: article.author ?? null,
    publishedAt: publishedIso,
    sourceUrl: article.source_url ?? null,
  })
}

/** `(source, source_id)` 한 행. **오류를 삼키지 않는다** — 못 물어본 것을 「없다」로 세면 중복이 들어간다. */
export async function findRow(db, source, sourceId) {
  const { data, error } = await db
    .from('library_articles')
    .select('id, source_id, updated_at, csat_fit')
    .eq('source', source)
    .eq('source_id', sourceId)
    .maybeSingle()
  if (error) throw new Error(`조회 실패 ${source}/${sourceId}: ${error.message}`)
  return data ?? null
}

/** 조각이 가리킬 원천. dry-run 이라 원천 id 가 아직 없으면 null — 없는 id 를 적지 않는다. */
export function derivedFromOf(parent, kind) {
  if (!parent?.id) return null
  if (!DERIVED_KINDS.has(kind)) throw new Error(`알 수 없는 파생 종류: ${kind}`)
  return { id: parent.id, source_id: parent.source_id, kind }
}

/**
 * 원천 행을 보장한다. 있으면 그 행, 없으면 (commit 일 때만) 넣는다.
 *
 * @returns {{ id: string|null, source_id: string, status: 'existed'|'inserted'|'planned'|'empty', words: number }}
 */
export async function ensureOriginal(db, {
  article,
  sourceId = article.source_id,
  title = article.title,
  feedId = null,
  feedLabel = null,
  licenseEvidence = null,
}, { commit }) {
  const content = String(article.content ?? '').trim()
  const words = countWords(content)
  const found = await findRow(db, article.source, sourceId)
  if (found) return { id: found.id, source_id: sourceId, status: 'existed', words }
  if (!words) return { id: null, source_id: sourceId, status: 'empty', words }
  if (!commit) return { id: null, source_id: sourceId, status: 'planned', words }

  const published = article.published_at
  const publishedIso =
    published instanceof Date
      ? (Number.isNaN(published.getTime()) ? null : published.toISOString())
      : (published ?? null)
  const { data, error } = await db
    .from('library_articles')
    .insert({
      source: article.source,
      source_id: sourceId,
      title,
      author: article.author ?? null,
      source_url: article.source_url,
      published_at: publishedIso,
      license: article.license,
      content,
      status: 'queued',
      feed_id: feedId,
      feed_label: feedLabel,
      // 새 행이라 덮을 키가 없다 — 권리 표지 하나만 적는다.
      csat_fit: { rights: rightsOf(article, licenseEvidence) },
    })
    .select('id')
    .single()
  if (error) throw new Error(`원천 INSERT 실패 ${sourceId}: ${error.message}`)
  return { id: data.id, source_id: sourceId, status: 'inserted', words }
}

/** 조각 행의 `csat_fit` — 권리 표지 + 원천 연결(원천 id 가 있을 때만). */
export function fragmentCsatFit(article, parent, kind, licenseEvidence = null) {
  const fit = { rights: rightsOf(article, licenseEvidence) }
  const df = derivedFromOf(parent, kind)
  if (df) fit.derived_from = df
  return fit
}

/**
 * 이미 있는 조각 행에 `csat_fit.derived_from` 을 **합친다**(다른 키를 덮지 않는다).
 * `updated_at` 으로 CAS — 그 사이 누가 고쳤으면 쓰지 않고 'conflict' 를 돌려준다.
 *
 * ⚠️ 이 갱신은 `updated_at` 을 올린다 → 그 행의 `csat_source_eligibility` 캐시가 낡는다
 *   (DB 함수가 source_updated_at = updated_at 을 요구). 부르는 쪽이 id 를 모아
 *   `scripts/textbook/source-policy-refresh.mjs --ids-file` 로 캐시를 다시 채워야 한다.
 *
 * @returns {'linked'|'already'|'conflict'|'planned'}
 */
export async function linkDerived(db, child, derivedFrom, { commit }) {
  const cur = child.csat_fit?.derived_from
  if (cur && cur.id === derivedFrom.id && cur.kind === derivedFrom.kind) return 'already'
  if (!commit) return 'planned'
  const next = { ...(child.csat_fit ?? {}), derived_from: derivedFrom }
  const { data, error } = await db
    .from('library_articles')
    .update({ csat_fit: next })
    .eq('id', child.id)
    .eq('updated_at', child.updated_at)
    .select('id')
  if (error) throw new Error(`연결 실패 ${child.id}: ${error.message}`)
  return data?.length ? 'linked' : 'conflict'
}
