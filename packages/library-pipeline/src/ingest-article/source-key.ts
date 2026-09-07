// packages/library-pipeline/src/ingest-article/source-key.ts
//
// **중복 방지의 정본 — 목록기와 적재기가 같은 열쇠를 만들게 하는 한 벌.**
//
// ── 왜 이 파일이 생겼는가 (실측 2026-09-07) ─────────────────────────────
// 사용자 요구는 오래된 것이다: "같은 소스에서 원문을 추가로 확보할 때 이미 과거에
// 확보·제외한 것을 또 하지 않도록 체계를 가져야 함." 그 체계가 **세 곳에서 한 번도
// 작동한 적이 없었다** — 그리고 셋 다 오류를 내지 않았다.
//
//   Wikipedia │ 목록기 `wikipedia:<Title_slug>` vs 적재기 `wikipedia:<pageid>`
//             │ → `wikipedia-feed/route.ts` 의 `.in(source_id, …)` 이 **영구 0건**
//             │   (DB 92행이 전부 pageid 꼴이라 슬러그 열쇠는 하나도 안 맞는다)
//   VOA       │ 적재기 정규식 `/([a-z0-9-]+)\/?(?:\?|$)/` 이 `7886988.html` 에 안 맞아
//             │ **249행 전부 base36 해시**(`voa:ewolkz`). 목록기는 `voa:7886988`.
//             │ → seed_catalog 30행(전부 `voa:<숫자>`)과 articles 249행이 **한 건도 안 맞는다**
//   FrYM      │ 열쇠는 맞는데 **커서가 없다**. offset 루프가 매 실행 최신 창만 본다
//
// 열쇠가 갈린 것을 "고쳤다"고 말하려면 **두 벌을 한 벌로 만들어야** 한다. 한쪽만
// 고치면 다음 사람이 다른 쪽을 고쳐 또 갈린다 — 그래서 목록기도 적재기도 이 파일을
// 부르고, `source-key-contract.test.ts` 가 두 경로의 출력이 같은지를 잠근다.
//
// ── 규약 ────────────────────────────────────────────────────────────────
//   source_id = `<source>:<안정 식별자>` [ `#p<시작>-<끝>` ]
//
//   · **안정 식별자는 소스가 발급한 불변 값만 쓴다** — 제목·슬러그·URL 해시 금지.
//     제목은 이동(rename)으로 바뀌고, 슬러그는 편집으로 바뀌며, URL 해시는
//     추적 파라미터 하나에 달라진다. 셋 다 "같은 글"을 다른 글로 만든다.
//   · 유도할 수 없으면 **던진다.** 해시로 물러서면 249행 사고가 그대로 재현된다 —
//     빈 열쇠·가짜 열쇠는 다음 수확이 "이미 있음"으로 세어 **구멍이 영영 남는다.**
//   · 발췌본은 `#p<시작>-<끝>` 를 붙여 원본과 다른 행으로 dedup 한다
//     (`frym-ingest.mjs`·`storyweaver-ingest.mjs` 가 이미 쓰던 규칙을 정본화).

/** 이 파일이 열쇠를 책임지는 소스. 여기 없는 소스는 각자 기존 방식 그대로다(§미이관). */
export type GovernedSource = 'wikipedia' | 'voa' | 'frym'

export const GOVERNED_SOURCES: readonly GovernedSource[] = ['wikipedia', 'voa', 'frym'] as const

/**
 * ⚠️ **아직 이관하지 않은 곳 — 알고 남긴 것이지 못 본 것이 아니다.**
 *
 * `simple_wikipedia` 는 열쇠가 **세 갈래**다(2026-09-07 DB 실측):
 *   seed_catalog 34행 `simple_wikipedia:<Title_slug>` ·
 *   library_articles 99행 `<Title>#lead-trim`(`scripts/textbook/mediawiki-lead-ingest.mjs`) ·
 *   `ingestMediaWikiArticle` 은 `simple_wikipedia:<pageid>`.
 * 어느 쪽으로 모으든 백필 대상이 두 표에 걸쳐 있어 **별도 작업**이다. 여기에 적어 두는
 * 이유는 하나 — 목록에서 빠지면 다음 사람이 "이미 정리됐다"고 읽는다.
 */
export const UNGOVERNED_KNOWN_DIVERGENCE: Record<string, string> = {
  simple_wikipedia:
    'seed_catalog 34행(Title_slug) · articles 99행(Title#lead-trim) · 적재기(pageid) 3갈래 — 백필 설계 필요',
}

/** 소스가 준 원자료 중 **안정 식별자를 유도할 수 있는 것만** 받는다. */
export interface StableIdInput {
  /** 기사 URL (VOA article id · FrYM DOI 를 여기서 뽑는다) */
  url?: string | null
  /** MediaWiki pageid — 제목이 바뀌어도 불변 */
  pageid?: number | string | null
  /** Crossref DOI */
  doi?: string | null
  /** RSS guid (VOA 의 대체 경로) */
  guid?: string | null
}

/** 발췌 범위. `start` 는 0-index 시작 문단, `end` 는 끝(배타) — `excerptForBand` 와 같은 뜻. */
export interface ExcerptRange {
  start: number
  end: number
}

/** 열쇠의 **모양**. 백필·회귀·DB 점검이 같은 정규식을 본다. */
export const SOURCE_KEY_SHAPE: Record<GovernedSource, RegExp> = {
  wikipedia: /^wikipedia:[0-9]+$/,
  voa: /^voa:[0-9]{4,}$/,
  // DOI 는 소문자 · `#p<a>-<b>` 발췌 접미어 허용
  frym: /^frym:10\.3389\/frym\.[0-9][0-9.]*[0-9](?:#p[0-9]+-[0-9]+)?$/,
}

type Extractor = (raw: StableIdInput) => string | null

/** VOA URL 끝 숫자 article id. `/a/…/7886988.html` → `7886988`. 67,316개 전부 고유(실측). */
function voaArticleId(s: string | null | undefined): string | null {
  if (!s) return null
  return s.match(/\/([0-9]{4,})\.html?(?:[?#].*)?$/)?.[1] ?? null
}

const EXTRACTORS: Record<GovernedSource, Extractor> = {
  // pageid 만. 제목 슬러그로 물러서지 않는다 — 그 물러섬이 이 파일이 생긴 이유다.
  wikipedia: (raw) => {
    const id = raw.pageid
    if (id == null) return null
    const s = String(id).trim()
    return /^[0-9]+$/.test(s) ? s : null
  },
  // URL 우선, 없으면 guid. 둘 다 없으면 null — 해시 대체 없음.
  voa: (raw) => voaArticleId(raw.url) ?? voaArticleId(raw.guid),
  // DOI 우선, 없으면 URL 에서 캔다(`https://doi.org/10.3389/frym.2023.1055909`).
  frym: (raw) => {
    const doi = (raw.doi ?? '').trim() || (raw.url ?? '').match(/10\.3389\/frym\.[\d.]+/i)?.[0] || ''
    const clean = doi.toLowerCase().replace(/[).,;]+$/, '')
    return /^10\.3389\/frym\.[0-9][0-9.]*[0-9]$/.test(clean) ? clean : null
  },
}

/**
 * 안정 식별자(접두어 없는 뒷부분). 유도 못 하면 **던진다.**
 *
 * 던지는 쪽이 조용히 해시를 만드는 것보다 싸다 — 해시는 오류 없이 통과한 뒤
 * 중복 검사를 영구 무력화하고, 그 사실은 249행이 쌓인 뒤에야 드러난다.
 */
export function stableId(source: GovernedSource, raw: StableIdInput): string {
  const got = EXTRACTORS[source](raw)
  if (!got) {
    throw new Error(
      `sourceKey(${source}): 안정 식별자를 유도하지 못했다 — ` +
        `${JSON.stringify({ url: raw.url ?? null, pageid: raw.pageid ?? null, doi: raw.doi ?? null })}. ` +
        `해시로 물러서지 않는다(중복 검사가 영구 0건이 된다).`,
    )
  }
  return got
}

/**
 * `source_id` 전체. **목록기와 적재기가 둘 다 이것을 부른다.**
 *
 * @param excerpt 발췌본이면 문단 범위 — `#p<start+1>-<end>` 로 붙는다(기존 표기 유지).
 */
export function sourceKey(
  source: GovernedSource,
  raw: StableIdInput,
  excerpt?: ExcerptRange | null,
): string {
  const base = `${source}:${stableId(source, raw)}`
  if (!excerpt) return base
  return `${base}#p${excerpt.start + 1}-${excerpt.end}`
}

/** 이미 만들어진 열쇠가 규약 모양인가. 백필 스크립트와 회귀가 같은 판정을 쓰게 한다. */
export function isCanonicalSourceKey(source: GovernedSource, key: string): boolean {
  return SOURCE_KEY_SHAPE[source].test(key)
}

/** 열쇠에서 발췌 접미어를 뗀 원본 열쇠. `frym:10.3389/…#p3-6` → `frym:10.3389/…` */
export function baseSourceKey(key: string): string {
  return key.replace(/#p[0-9]+-[0-9]+$/, '')
}
