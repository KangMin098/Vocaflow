// packages/library-pipeline/src/ingest-article/frontiers.ts
//
// **Frontiers 성인 학술지(비-PMC 18종) — 교육·언어 칸을 직접 겨눈다.**
//
// ⚠️ **`frontiers-young-minds.ts`(FrYM) 와 다른 소스다.** 그쪽은 `kids.frontiersin.org` ·
//   ISSN 2296-6846 · 어린이 독자용이고 **`/xml/nlm` 이 404** 라 `/full` HTML 만 쓴다.
//   여기는 `www.frontiersin.org` 의 성인 학술지이고 **`/xml/nlm` 이 200**(JATS 전문)이다.
//   호스트·본문 형식·발췌 난이도가 모두 달라 **수확기를 공유할 수 없다.**
//   열쇠 접두어도 갈라 둔다(`frontiers:` vs `frym:`) — 안 그러면 두 재고가 섞인다.
//
// ── 왜 이 소스인가 (정찰 실측 2026-09-07 · docs/reports/source-probe/frontiers.md) ──
// 분류기(`lib-topic.mjs`)를 고쳐 오분류 23.6% → 8.3% 로 만든 뒤 소재 칸을 다시 재니
// **진짜 빈 칸 1위가 교육·언어**(배율 0.57 · 3단계 5만 기준 부족 1,464편)였다.
// PLOS 는 이 칸을 못 채우고(대응 주제 없음), PMC 500만 편도 못 채운다(의학교육뿐).
// Frontiers 의 **비-PMC 저널**에 교육·언어·사회 계열이 **12,618편** 있다:
//
//     Education 8,079 · Communication 2,288 · Political Science 1,478 ·
//     Human Dynamics 561 · Language Sciences 212     (PMC 수록률 0.4%)
//
// ── 2단 경로 — 목록은 Crossref, 본문은 Frontiers ─────────────────────
// Frontiers 자체에는 API 도 OAI-PMH 도 논문 사이트맵도 **없다**(정찰 §1 실측:
// `articles/sitemap-index.xml` 은 205개 `<loc>` 이 전부 PDF, 연도 파티션은 2024년 한 해만 200).
//
//     목록  https://api.crossref.org/journals/<ISSN>/works?cursor=*&rows=…
//     슬러그 https://www.frontiersin.org/articles/<DOI>/full  → 301 Location 에 슬러그
//     본문  https://www.frontiersin.org/journals/<슬러그>/articles/<DOI>/xml/nlm   (JATS)
//
// ⚠️ **저널 슬러그를 DOI 약칭에서 유추하지 않는다.** `fevo`→`ecology-and-evolution` ·
//   `fenvs`→`environmental-science` 처럼 규칙이 없다. 대신 **저널당 한 번** 301 을 받아
//   캐시한다(`resolveJournalSlug`) — 그러면 편당 GET 이 2 → 1 로 준다.
//   슬러그 없이 `www.frontiersin.org/articles/<DOI>/xml/nlm` 을 치면 **404** 다(실측).
//
// ── 파싱 함정 (전부 정찰 실측 · 넷 다 조용히 틀린 답을 낸다) ────────
//  1. **구조화 초록이 `<title>Introduction</title>` 을 재사용한다.** 문서 전체에서 첫
//     "Introduction" 절을 찾으면 초록의 **62어 조각**을 서론으로 집는다. → `<body>` 안만 본다.
//  2. **`<xref>` 를 통째로 지우면 문장이 무너진다.** 교육·사회 계열은 인용을 **문장 성분**
//     으로 쓴다 — `<xref>Wood et al. (1976)</xref>, who coined the term…` 에서 xref 를 지우면
//     `", who coined the term…"` 만 남는다. → **괄호 인용은 괄호째 지우고, 주어 자리 인용이
//     남은 문장은 통째로 버린다**(`stripJatsCitations`). 버린 문장 수를 세어 올려 보낸다.
//  3. **XML 엔티티가 살아 있다** — `&#x0025;`(%) · `&#x2019;`(’) · `&#x2013;`(–). 디코딩 필수.
//  4. **한자·키릴이 본문에 섞인다**(실측 `ritual propriety (li 礼)`). 비ASCII 비율 상한을 둔다.
//
// ── 그리고 하나 더: Frontiers 는 교열이 가볍다 ───────────────────────
// 발행본 **자체**에 깨진 문장이 있다(실측: `…lead to false crawls. which are instances…`
// — 마침표가 쉼표 자리에 있다). 우리 파서 탓이 아니다. 지문으로 쓰기 전 문장 단위 검사가
// PLOS 발췌보다 한 단계 더 필요하다 — 이 파일은 그 사실을 **기록만** 하고 고치지 않는다
// (고치면 원문 개작이 되고, 그 판단은 발췌·검수 단계의 몫이다).
//
// ── 라이선스는 항목별로 읽는다 ───────────────────────────────────────
// Europe PMC 실측으로 Front Psychol 50,844편 중 **260편(0.5%)이 `cc by-nc`** 다.
// "이 출판사는 CC BY" 로 뭉뚱그리면 그 260편이 섞여 들어온다. Crossref `license[].URL` 을
// 먼저 보고, **2016~2017년 옛 논문은 배열이 비어 있으므로** JATS `<permissions>` 로 물러선다.
// 통과는 **`cc by` · `cc0` 뿐**(정찰 §3).

import type { RawArticle } from '../types-article'

import { fetchWithTimeout } from './_helpers'
import { sourceKey } from './source-key'

const CROSSREF = 'https://api.crossref.org'
const FRONTIERS = 'https://www.frontiersin.org'

/** Crossref polite pool. 연락처가 있으면 상류가 우리를 식별하고 먼저 알려 준다. */
const MAILTO = 'killerapp51@empal.com'

/**
 * **겨냥하는 저널 — PMC 밖에 있는 것만.**
 *
 * ⚠️ Plant Science(PMC 수록률 99.6%) · Sports(98.9%) · AI(97.7%) · Sociology(94.6%) 는
 *   **일부러 뺐다.** 그 넷은 나중에 PMC 수확기 하나로 라이선스·전문 링크까지 한 번에 오므로,
 *   여기서 편당 2 GET 을 쓰는 것은 같은 글을 비싸게 사는 짓이다.
 *
 * ⚠️ **Psychology(98.6%) 는 2026-09-08 에 그 원칙을 깨고 넣었다** — 원칙이 틀려서가 아니라
 *   기다릴 수 없어서다. 전수 집계가 3단계 부족을 **166편**으로 확정했고 그 전부가 심리·인지인데,
 *   PMC 수확기는 아직 없다. 없는 수확기를 기다리는 것보다 166편을 지금 채우는 편이 싸다.
 *   **대가는 미래로 미룬 것이지 없앤 것이 아니다** — PMC 를 켜는 날 (source, source_id) 중복
 *   판정은 소스가 달라 안 걸리므로, **DOI 정규화 후 겹침을 배제**해야 같은 글이 두 번 들어오지
 *   않는다. 그때 볼 것: library_articles 의 source='frontiers' 중 fpsyg · fnhum · fnbeh.
 *
 * `feed` 는 저널 약칭 = DOI 약칭 = 커서 파일 이름의 일부다. 셋을 같은 문자열로 두어
 * "이 저널을 어디까지 봤나" 를 파일 이름만 보고 알 수 있게 한다.
 */
export interface FrontiersJournal {
  /** 피드 id = DOI 약칭 (`feduc` · `fcomm` …) */
  id: string
  /** Crossref 목록 열쇠 */
  issn: string
  /** 사람이 읽는 이름 */
  label: string
  /** Crossref 실측 편수 (2026-09-07 정찰) — 우선순위 판단용이지 상한이 아니다 */
  crossref: number
  /** 이 저널이 주로 떨어지는 소재 칸. 몫 계산이 아니라 **왜 이 저널을 켰는지**의 기록이다 */
  aimsAt: string
  /**
   * `type:journal-article` 에 **덧붙일** Crossref 필터. 없으면 안 붙인다.
   *
   * ⚠️ 왜 필요한가 (실측 2026-09-08): fpsyg 1쪽 200편이 **라이선스 밖 177/177** 로 전멸했다.
   * 배선도 실행도 성공했는데 적재가 0 인, 이 저장소에서 열두 번째 「결과 0」이다. 원인은 게이트가
   * 아니라 **연식**이었다 — Crossref 커서는 정렬이 없어 **가장 오래된 예치부터** 주는데,
   * fpsyg 는 2010년 창간이라 초기 예치에 `license` 항목이 통째로 비어 있다(`[]`).
   * 게이트는 「짐작해 붙이지 않는다」가 원칙이므로 옳게 막은 것이고, 고칠 곳은 **목록 쪽**이다.
   * `has-license:true` 로 좁히면 53,148 → **42,526편**이고, 그 표본 200/200 이 CC BY 4.0 이었다.
   *
   * 저널마다 따로 두는 이유: 전 저널에 일괄로 붙이면 **열거 순서가 바뀌어** 이미 쌓인 커서 토큰이
   * 다른 집합을 가리킨다. 기존 저널(feduc 등)은 2016년 이후 창간이라 이 필터가 필요 없다.
   */
  crossrefFilter?: string
}

/**
 * 1회차 = 교육·언어 칸에 직결되는 다섯. 모자라면 2회차로 생태·환경·기후를 연다
 * (정찰 §나누기). 순서가 곧 우선순위다.
 */
export const FRONTIERS_JOURNALS: readonly FrontiersJournal[] = [
  { id: 'feduc', issn: '2504-284X', label: 'Frontiers in Education', crossref: 8079, aimsAt: '교육·언어' },
  { id: 'fcomm', issn: '2297-900X', label: 'Frontiers in Communication', crossref: 2288, aimsAt: '교육·언어' },
  { id: 'fpos', issn: '2673-3145', label: 'Frontiers in Political Science', crossref: 1478, aimsAt: '사회·경제' },
  { id: 'fhumd', issn: '2673-2726', label: 'Frontiers in Human Dynamics', crossref: 561, aimsAt: '사회·경제' },
  { id: 'flang', issn: '2813-4605', label: 'Frontiers in Language Sciences', crossref: 212, aimsAt: '교육·언어' },
  // ── 1회차 보강: 심리·인지 (2026-09-08) ──
  // 주제 재분류 백필(27,128편)이 끝나 `topic-gap` 이 전수 집계로 돌기 시작하자 병목이 바뀌었다 —
  // 「기술·매체」로 알던 것은 표본 아티팩트였고, 실제 병목은 **심리·인지**(배율 0.69 · 재고 6,944)다.
  // 3단계 5만 기준 부족은 **166편**이고 그 166편이 전부 이 칸이라, 이 저널 하나로 닫힌다.
  // ⚠️ **PMC 중복 주의** — 정찰 실측으로 Frontiers in Psychology 는 **98.6% 가 PMC 에도 있다.**
  //   지금은 PMC 수확기가 없어 충돌이 없지만, PMC 를 켜는 날 **DOI 로 겹침을 배제**해야 한다.
  //   `(source, source_id)` 중복 판정은 소스가 다르면 안 걸린다 — 같은 글이 두 번 들어온다.
  { id: 'fpsyg', issn: '1664-1078', label: 'Frontiers in Psychology', crossref: 53148, aimsAt: '심리·인지', crossrefFilter: 'has-license:true' },
  { id: 'fnhum', issn: '1662-5161', label: 'Frontiers in Human Neuroscience', crossref: 13873, aimsAt: '심리·인지', crossrefFilter: 'has-license:true' },
  { id: 'fnbeh', issn: '1662-5153', label: 'Frontiers in Behavioral Neuroscience', crossref: 5328, aimsAt: '심리·인지', crossrefFilter: 'has-license:true' },
  // ── 2회차 (교육·언어가 차고도 몫이 남으면) ──
  { id: 'fevo', issn: '2296-701X', label: 'Frontiers in Ecology and Evolution', crossref: 6201, aimsAt: '과학·자연' },
  { id: 'fenvs', issn: '2296-665X', label: 'Frontiers in Environmental Science', crossref: 8445, aimsAt: '과학·자연' },
  { id: 'fclim', issn: '2624-9553', label: 'Frontiers in Climate', crossref: 1260, aimsAt: '과학·자연' },
]

export function frontiersJournal(id: string): FrontiersJournal | null {
  return FRONTIERS_JOURNALS.find((j) => j.id === id) ?? null
}

/** 등록부·회귀가 같은 목록을 본다. */
export const FRONTIERS_FEEDS = FRONTIERS_JOURNALS.map((j) => ({ id: j.id, label: j.label }))

// ═══════════════════════════════════════════════════════════════════
// 목록 — Crossref cursor
// ═══════════════════════════════════════════════════════════════════

/** Crossref 가 한 번에 주는 최대. 그 이상 요청하면 조용히 줄여서 준다. */
const PER_PAGE = 500

export interface FrontiersListItem {
  /** `frontiers:<소문자 DOI>` — **적재기와 같은 함수**가 만든다 */
  source_id: string
  doi: string
  title: string
  url: string
  published_at: string | null
  /** Crossref 가 준 라이선스 URL. **없으면 null** — 짐작해 붙이지 않는다(옛 논문은 비어 있다) */
  licenseUrl: string | null
  /** Crossref `type` — `journal-article` 만 통과시킨다 */
  type: string
}

/**
 * 목록 URL 1페이지분. **순수 함수** — 커서가 실제로 URL 에 실리는지를 네트워크 없이 잠근다.
 *
 * ⚠️ **정렬을 붙이지 않는다.** Crossref 는 날짜 정렬과 커서를 함께 쓰면 HTTP 400 이다
 *   (`{"type":"sort-criteria-incompatible-with-cursor"}` — 실측 2026-09-07). 그리고 붙일
 *   이유도 없다: 정렬 없는 커서 열거는 **완전 순서**라 2026-08-16 IA 사고(정렬 없는
 *   offset 페이지네이션 → 214건 중복 + 동수 누락)가 구조적으로 재현되지 않는다.
 */
export function buildFrontiersListUrl(feedId: string, rows: number, cursor: string | null = null): string {
  const j = frontiersJournal(feedId)
  if (!j) {
    throw new Error(
      `Frontiers 저널 '${feedId}' 를 모른다. 쓸 수 있는 것: ${FRONTIERS_JOURNALS.map((x) => x.id).join(' · ')}`,
    )
  }
  const params = new URLSearchParams({
    rows: String(Math.min(Math.max(rows, 1), PER_PAGE)),
    select: 'DOI,title,license,type,created,published,container-title',
    filter: j.crossrefFilter ? `type:journal-article,${j.crossrefFilter}` : 'type:journal-article',
    cursor: cursor ?? '*',
    mailto: MAILTO,
  })
  return `${CROSSREF}/journals/${j.issn}/works?${params.toString()}`
}

interface CrossrefWork {
  DOI?: string
  title?: string[]
  type?: string
  license?: Array<{ URL?: string }>
  published?: { 'date-parts'?: number[][] }
  created?: { 'date-time'?: string }
}

/** CC 라이선스 URL 만 고른다. 없으면 null — **짐작해서 붙이지 않는다.** */
export function frontiersLicenseUrl(license: Array<{ URL?: string }> | undefined): string | null {
  return (license ?? []).map((l) => l.URL).find((u) => u && /creativecommons\.org/.test(u)) ?? null
}

/**
 * 통과시킬 라이선스인가 — **`cc by` 와 `cc0` 뿐.**
 *
 * NC 는 소수(0.5%)지만 섞여 온다. ND 는 관측되지 않았으나 목록에 없으면 자동으로 막힌다.
 * SA 도 막는다 — 파생물(단어세트·문항)에 같은 라이선스를 물려야 해서 우리 배포 조건과 충돌한다.
 */
export function frontiersLicenseAllowed(url: string | null): boolean {
  if (!url) return false
  const u = url.toLowerCase()
  if (/creativecommons\.org\/publicdomain\/zero\//.test(u)) return true
  return /creativecommons\.org\/licenses\/by\/[\d.]+/.test(u)
}

/** CC 라이선스 URL → 우리 표기. 모르는 꼴이면 null. */
export function frontiersLicenseCode(url: string | null): string | null {
  if (!url) return null
  if (/publicdomain\/zero\/([\d.]+)/i.test(url)) return 'CC0-1.0'
  const m = url.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i)
  return m ? `CC-${m[1]!.toUpperCase()}-${m[2]}` : null
}

/** Crossref `date-parts` → ISO 날짜. 부분 날짜(연도만)도 받는다. */
export function frontiersPublishedAt(published: CrossrefWork['published']): string | null {
  const p = published?.['date-parts']?.[0]
  if (!p?.length) return null
  const [y, m = 1, d = 1] = p
  if (!y) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

/**
 * **지문이 될 수 없는 유형은 제목 접두어로 뺀다.**
 *
 * Crossref `type` 은 이것들도 전부 `journal-article` 이라 걸러 주지 못한다.
 * 정찰 표본(2025년 이후 최근 500편 × 4저널) 기준 **약 6%** 가 여기 걸린다.
 */
const NON_ARTICLE_TITLE =
  /^\s*(?:editorial|corrigendum|correction|erratum|retraction|retracted|expression of concern|grand challenge|book review|commentary on|response to|reply to|addendum)\b[:\s]/i

export function frontiersIsResearchTitle(title: string): boolean {
  return !NON_ARTICLE_TITLE.test(title)
}

/** 한 페이지 + 다음 커서. `nextCursor === null` 이면 **정말로** 끝이다. */
export async function listFrontiersFeedPage(
  feedId: string,
  rows = 100,
  cursor: string | null = null,
): Promise<{ items: FrontiersListItem[]; nextCursor: string | null; total: number }> {
  // ⚠️ **Accept 를 명시해야 한다.** `fetchWithTimeout` 의 기본값이 `application/rss+xml, …`
  //   이라 Crossref 가 **406** 을 돌려준다(FrYM 에서 실측한 것과 같은 함정).
  const res = await fetchWithTimeout(buildFrontiersListUrl(feedId, rows, cursor), {
    accept: 'application/json',
    timeoutMs: 60_000,
  })
  if (!res.ok) throw new Error(`Frontiers Crossref list failed: ${res.status} (${feedId})`)
  const json = (await res.json()) as {
    message?: { items?: CrossrefWork[]; 'next-cursor'?: string; 'total-results'?: number }
  }
  const got = json.message?.items ?? []
  const items: FrontiersListItem[] = []
  for (const w of got) {
    if (!w.DOI) continue
    const title = (w.title ?? [])[0]?.replace(/\s+/g, ' ').trim() ?? ''
    if (!title) continue
    items.push({
      source_id: sourceKey('frontiers', { doi: w.DOI }),
      doi: w.DOI.toLowerCase(),
      title,
      url: `https://doi.org/${w.DOI}`,
      published_at: frontiersPublishedAt(w.published) ?? w.created?.['date-time'] ?? null,
      licenseUrl: frontiersLicenseUrl(w.license),
      type: w.type ?? 'journal-article',
    })
  }
  // **항목 0 을 끝으로 본다.** 토큰만 보고 돌면 안 끝난다(FrYM 회귀가 잡던 그 함정).
  return {
    items,
    nextCursor: got.length === 0 ? null : (json.message?.['next-cursor'] ?? null),
    total: json.message?.['total-results'] ?? 0,
  }
}

/** 편의 래퍼 — 한 페이지만. 등록부 회귀가 `list…Feed` 를 찾는 이름이기도 하다. */
export async function listFrontiersFeed(feedId = 'feduc', limit = 100): Promise<FrontiersListItem[]> {
  const { items } = await listFrontiersFeedPage(feedId, limit, null)
  return items
}

// ═══════════════════════════════════════════════════════════════════
// 슬러그 — 저널당 한 번만 산다
// ═══════════════════════════════════════════════════════════════════

/** 저널 약칭 → URL 슬러그. 프로세스 수명 동안만 산다(저널당 1개라 늘지 않는다). */
const slugCache = new Map<string, string>()

/** `10.3389/feduc.2026.1949299` → `feduc`. 못 읽으면 null. */
export function frontiersAbbrev(doi: string): string | null {
  return doi.toLowerCase().match(/^10\.3389\/([a-z]+)\./)?.[1] ?? null
}

/**
 * DOI → 저널 슬러그. **저널마다 한 번**만 네트워크를 쓴다.
 *
 * ⚠️ doi.org 는 슬러그 없는 주소(`/articles/<DOI>/full`)로 보낸다 — 거기서 **한 번 더**
 *   301 이 나면서 `/journals/<슬러그>/…` 가 붙는다. 그래서 doi.org 를 건너뛰고
 *   `www.frontiersin.org/articles/<DOI>/full` 을 직접 쳐서 Location 만 읽는다(본문 미수신).
 *   실측: doi.org 왕복 4.2초 vs 이 경로 1회 301.
 */
export async function resolveFrontiersSlug(doi: string): Promise<string | null> {
  const abbrev = frontiersAbbrev(doi)
  if (!abbrev) return null
  const cached = slugCache.get(abbrev)
  if (cached) return cached

  const res = await fetch(`${FRONTIERS}/articles/${doi}/full`, {
    redirect: 'manual',
    headers: { 'User-Agent': 'Vocaflow/1.0 (+https://vocaflow.app; CSAT source harvest)' },
  })
  const loc = res.headers.get('location') ?? ''
  const slug = loc.match(/\/journals\/([a-z0-9-]+)\/articles\//i)?.[1] ?? null
  if (slug) slugCache.set(abbrev, slug)
  return slug
}

/** 캐시를 미리 채운다 — 테스트와 배치 시작점에서 쓴다. */
export function primeFrontiersSlug(abbrev: string, slug: string): void {
  slugCache.set(abbrev, slug)
}

export function frontiersXmlUrl(slug: string, doi: string): string {
  return `${FRONTIERS}/journals/${slug}/articles/${doi}/xml/nlm`
}

// ═══════════════════════════════════════════════════════════════════
// JATS 파싱
// ═══════════════════════════════════════════════════════════════════

/** XML 엔티티 → 문자. 16진·10진 수치 참조가 대부분이다(`&#x2019;` 등). */
export function decodeXmlEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&amp;/gi, '&')
}

/** 여는 태그 위치에서 시작해 depth 0 이 되는 곳까지 — 자식 동명 태그에 속지 않는다. */
function sliceBalanced(xml: string, tag: string, openIndex: number): string | null {
  if (openIndex < 0) return null
  const re = new RegExp(`<${tag}\\b[^>]*?(/)?>|</${tag}>`, 'gi')
  re.lastIndex = openIndex
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    if (m[0].startsWith('</')) depth--
    else if (!m[1]) depth++
    else continue // 자기완결 태그
    if (depth === 0) return xml.slice(openIndex, m.index + m[0].length)
  }
  return null
}

/**
 * **`<body>` 안만 떼어 낸다** — 함정 1.
 *
 * 구조화 초록이 `<title>Introduction</title>` 을 재사용하므로 문서 전체를 훑으면
 * 초록의 62어 조각을 서론으로 집는다. 못 찾으면 null — **문서 전체로 물러서지 않는다.**
 */
export function frontiersBodyXml(xml: string): string | null {
  return sliceBalanced(xml, 'body', xml.search(/<body\b[^>]*>/i))
}

/** 지문이 될 수 없는 구조 — 통째로 지운다. 캡션은 `<fig>`/`<table-wrap>` 안에 있다. */
const DROP_BLOCKS = [
  'fig',
  'fig-group',
  'table-wrap',
  'table-wrap-group',
  'disp-formula',
  'disp-formula-group',
  'inline-formula',
  'supplementary-material',
  'boxed-text',
  'media',
  'graphic',
  'list',
  'def-list',
  'array',
  'code',
  'chem-struct-wrap',
]

/**
 * **`<back>` 가 아니라 `<body>` 안에 있는 후미** — 실측으로만 알 수 있던 것.
 *
 * 2016~2019년 Frontiers JATS 는 「Author Contributions」·「Conflict of Interest Statement」를
 * `<back>` 이 아니라 **`<body>` 의 마지막 `<sec>`** 로 넣는다. `<body>` 만 떼어 오는 것으로는
 * 안 걸러진다 — 실측 `10.3389/feduc.2016.00002` 지문 끝에
 * "GL led the Better Communication Research Programme…" 와 "The authors declare that the
 * research was conducted in the absence of any commercial…" 가 그대로 남았다.
 *
 * ⚠️ **위치가 아니라 제목으로 자른다.** harvest-plos 의 `cleanBody` 는 평문이라 "뒷 40%
 *   안의 첫 표식" 으로 자를 수밖에 없었지만, 여기는 구조가 있다. 제목으로 고르면
 *   본문 중간에 「Acknowledgments」를 인용한 글이 통째로 날아가는 사고가 없다.
 */
const BACK_MATTER_TITLE =
  /^(?:author(?:'s|s'|s)? (?:contributions?|notes?|disclaimer)|contribution to the field|conflicts? of interests?(?: statement)?|competing interests?|declarations? of (?:conflicting )?interests?|acknowledge?ments?|funding(?: statement)?|data availability(?: statement)?|ethics statement|ethical (?:approval|statement|considerations?)|supplementary materials?|abbreviations|references?|publisher'?s note|generative ai statement|ai tool statement|glossary|nomenclature|appendix\b.*|corrigendum|informed consent statement)$/i

function sectionTitle(secXml: string): string {
  const m = secXml.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)
  return m
    ? decodeXmlEntities(m[1]!.replace(/<[^>]+>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim()
    : ''
}

export function dropBackMatterSecs(bodyXml: string): string {
  let s = bodyXml
  for (let guard = 0; guard < 60; guard++) {
    let cut = -1
    let len = 0
    const re = /<sec\b[^>]*>/gi
    let m: RegExpExecArray | null
    while ((m = re.exec(s)) !== null) {
      const block = sliceBalanced(s, 'sec', m.index)
      if (!block) continue
      if (BACK_MATTER_TITLE.test(sectionTitle(block))) {
        cut = m.index
        len = block.length
        break
      }
    }
    if (cut < 0) return s
    s = s.slice(0, cut) + ' ' + s.slice(cut + len)
  }
  return s
}

function dropBlocks(xml: string): string {
  let s = dropBackMatterSecs(xml)
  for (const tag of DROP_BLOCKS) {
    // 자기완결형(`<graphic …/>`) 과 짝 있는 것 둘 다.
    s = s.replace(new RegExp(`<${tag}\\b[^>]*/>`, 'gi'), ' ')
    let guard = 0
    for (;;) {
      const i = s.search(new RegExp(`<${tag}\\b[^>]*>`, 'i'))
      if (i < 0 || guard++ > 200) break
      const block = sliceBalanced(s, tag, i)
      if (!block) break
      s = s.slice(0, i) + ' ' + s.slice(i + block.length)
    }
  }
  // 절 제목·번호는 문장이 아니다. 남기면 창 탐색이 "3 Results The mean…" 을 문장으로 센다.
  s = s.replace(/<title\b[^>]*>[\s\S]*?<\/title>/gi, ' ')
  s = s.replace(/<label\b[^>]*>[\s\S]*?<\/label>/gi, ' ')
  s = s.replace(/<caption\b[^>]*>[\s\S]*?<\/caption>/gi, ' ')
  return s
}

/** 인용 자리를 표시하는 문자. 본문에 나올 수 없는 제어문자라 오탐이 없다. */
const XREF_MARK = ''

export interface CitationStripResult {
  text: string
  /** 괄호째 지운 인용 묶음 수 */
  parenRemoved: number
  /** **주어 자리 인용 때문에 버린 문장 수** — 이 값이 이 소스의 피해량이다 */
  sentencesDropped: number
}

/**
 * **인용 제거 — 괄호 먼저, 그다음 남은 문장**(함정 2).
 *
 * 순서가 전부다. 문장 단위로 먼저 지우면 괄호 인용을 단 글이 통째로 날아가고,
 * 괄호를 먼저 지우면 실제로 못 살리는 문장만 남는다.
 *
 *   `Theory (<xref>Sweller, 1988</xref>) supplies…`  → 괄호 제거 → 문장 그대로 산다
 *   `<xref>Wood et al. (1976)</xref>, who coined…`   → 괄호 아님 → **그 문장을 버린다**
 *
 * ⚠️ **xref 안에 괄호가 들어 있다**(`Fisher and Frey (2008)`). 그래서 괄호 짝을 세기 전에
 *   xref 를 **표시 한 글자로 먼저 치환**한다 — 안 그러면 `\([^()]*\)` 가 안쪽 괄호에서 끊긴다.
 *
 * 버린 문장 수를 돌려주는 이유: 정찰이 이 손실을 **별도 작업**으로 남겨 뒀다.
 * 고치는 대신 **세어서 보고**할 수 있어야 한다(SUMMARY §5).
 */
export function stripJatsCitations(xml: string): CitationStripResult {
  // ① xref 를 표시로 바꾼다 — 안의 괄호까지 함께 사라진다.
  let s = xml.replace(/<xref\b[^>]*>[\s\S]*?<\/xref>/gi, XREF_MARK)
  s = s.replace(/<xref\b[^>]*\/>/gi, XREF_MARK)

  // ② 표시를 품은 괄호 묶음을 통째로 지운다. 앞 공백까지 먹어야 "supplies ." 가 안 생긴다.
  let parenRemoved = 0
  const parenRe = new RegExp(`[ \\t]*\\(\\s*[^()]*${XREF_MARK}[^()]*\\)`, 'g')
  for (let pass = 0; pass < 4; pass++) {
    const before = s
    s = s.replace(parenRe, () => {
      parenRemoved++
      return ''
    })
    if (s === before) break
  }
  // 대괄호 인용(`[12]`)도 같은 자리에서 지운다 — Frontiers 는 저널마다 표기가 다르다.
  s = s.replace(/[ \t]*\[(?=[^\]]*\d)[\d,;\s–—-]*\]/g, '')

  return { text: s, parenRemoved, sentencesDropped: 0 }
}

/** 문장 나누기 — 닫는 따옴표·괄호가 마침표 뒤에 오는 경우까지 본다. */
function splitSentences(p: string): string[] {
  return p.split(/(?<=[.!?][)"'”’»]?)\s+/)
}

/** 남은 인라인 태그를 걷어내고 엔티티를 되돌린다. */
function inlineToText(s: string): string {
  return decodeXmlEntities(s.replace(/<[^>]+>/g, ' '))
    .replace(/[ \t ]+/g, ' ')
    .trim()
}

export interface FrontiersBodyResult {
  /** 문단 사이를 빈 줄로 나눈 산문. 빈 문자열 = 본문을 못 읽었다 */
  text: string
  /** 문단 수 */
  paragraphs: number
  /** 괄호째 지운 인용 묶음 */
  parenRemoved: number
  /** **주어 자리 인용 때문에 버린 문장 수** */
  sentencesDropped: number
  /** 버리기 전 문장 수 — 피해율의 분모 */
  sentencesTotal: number
  /** 비ASCII 문자 비율 (한자·키릴 혼입 탐지) */
  nonAsciiRatio: number
}

/**
 * JATS 전문 XML → 지문 산문.
 *
 * 못 읽으면 `text: ''` — 호출부가 「본문을 못 받았다」로 판단하게 둔다.
 * **짧은 값을 넣으면 다음 수확이 그것을 「완료」로 세어 구멍이 영영 남는다.**
 */
export function frontiersBodyText(xml: string): FrontiersBodyResult {
  const empty: FrontiersBodyResult = {
    text: '',
    paragraphs: 0,
    parenRemoved: 0,
    sentencesDropped: 0,
    sentencesTotal: 0,
    nonAsciiRatio: 0,
  }
  const body = frontiersBodyXml(xml)
  if (!body) return empty

  const cleaned = stripJatsCitations(dropBlocks(body))
  const paras: string[] = []
  let sentencesDropped = 0
  let sentencesTotal = 0

  for (const m of cleaned.text.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)) {
    const raw = inlineToText(m[1] ?? '')
    if (!raw) continue
    const sents = splitSentences(raw)
    sentencesTotal += sents.length
    const kept = sents.filter((s) => {
      if (!s.includes(XREF_MARK)) return true
      sentencesDropped++
      return false
    })
    const p = kept
      .join(' ')
      .replace(/\s+([.,;:!?])/g, '$1')
      .replace(/\(\s*\)/g, '')
      .replace(/\s{2,}/g, ' ')
      .trim()
    // 표시가 하나도 안 남게 한다 — 남으면 지문에 제어문자가 실린다.
    const safe = p.replace(new RegExp(XREF_MARK, 'g'), '').trim()
    if (safe.length >= 40) paras.push(safe)
  }

  const text = paras.join('\n\n')
  const nonAscii = (text.match(/[^\x00-\x7F]/g) ?? []).length
  return {
    text,
    paragraphs: paras.length,
    parenRemoved: cleaned.parenRemoved,
    sentencesDropped,
    sentencesTotal,
    nonAsciiRatio: text.length ? nonAscii / text.length : 0,
  }
}

/**
 * JATS `<permissions>` 에서 라이선스 URL. Crossref 가 비었을 때의 **유일한** 근거다
 * (2016~2017년 논문은 Crossref `license[]` 가 비어 있다 — 정찰 §3 실측).
 */
export function frontiersJatsLicenseUrl(xml: string): string | null {
  const perm = sliceBalanced(xml, 'permissions', xml.search(/<permissions\b[^>]*>/i)) ?? ''
  const ref = perm.match(/<ali:license_ref[^>]*>([^<]+)<\/ali:license_ref>/i)?.[1]
  if (ref) return ref.trim()
  const href = perm.match(/xlink:href="([^"]*creativecommons\.org[^"]*)"/i)?.[1]
  return href ?? null
}

/** JATS 제목. Crossref 제목과 다를 때가 있어 **본문 쪽을 믿는다**(발행본이 정본). */
export function frontiersJatsTitle(xml: string): string | null {
  const t = xml.match(/<article-title\b[^>]*>([\s\S]*?)<\/article-title>/i)?.[1]
  return t ? inlineToText(t) : null
}

// ═══════════════════════════════════════════════════════════════════
// 적재기
// ═══════════════════════════════════════════════════════════════════

/**
 * 본문이 이보다 짧으면 「받았다」고 하지 않는다. 실측 서론만 300~450어이고 전문은
 * 수천 어다 — 판형이 바뀌어 초록만 남는 날이 오면 여기서 걸려야 한다.
 */
export const FRONTIERS_MIN_WORDS = 400

/** 비ASCII 상한. 한자·키릴이 섞인 글은 지문으로 못 쓴다(실측 `ritual propriety (li 礼)`). */
export const FRONTIERS_MAX_NON_ASCII = 0.02

export interface FrontiersFetched {
  doi: string
  title: string
  url: string
  content: string
  licenseUrl: string | null
  body: FrontiersBodyResult
  words: number
}

/**
 * DOI 하나 → 본문. **네트워크 2회**(슬러그 미캐시일 때) 또는 **1회**(캐시 적중).
 *
 * 던지지 않고 `null` 을 돌려주는 경우: 404 · `<body>` 없음 · 본문이 너무 짧음.
 * 셋 다 "이 글은 못 쓴다" 이지 배치를 세울 이유가 아니다.
 */
export async function fetchFrontiersArticle(
  doi: string,
  opts: { crossrefLicenseUrl?: string | null; title?: string } = {},
): Promise<FrontiersFetched | null> {
  const lower = doi.toLowerCase()
  const slug = await resolveFrontiersSlug(lower)
  if (!slug) return null
  const url = frontiersXmlUrl(slug, lower)
  const res = await fetchWithTimeout(url, { accept: 'application/xml, text/xml', timeoutMs: 60_000 })
  if (!res.ok) return null
  const xml = await res.text()
  const body = frontiersBodyText(xml)
  if (!body.text) return null

  const licenseUrl = opts.crossrefLicenseUrl ?? frontiersJatsLicenseUrl(xml)
  const title = frontiersJatsTitle(xml) ?? opts.title ?? ''
  const words = (body.text.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
  return {
    doi: lower,
    title,
    url: `${FRONTIERS}/journals/${slug}/articles/${lower}/full`,
    content: body.text,
    licenseUrl,
    body,
    words,
  }
}

/**
 * `RawArticle` 로. 다른 어댑터와 같은 모양을 지킨다 — 열쇠는 `sourceKey` 한 벌.
 *
 * ⚠️ `source: 'frontiers'` 는 `library_articles_source_check` 가 열려 있어야 들어간다.
 *   마이그레이션 `20260907190000_frontiers_source.sql`.
 */
export async function ingestFrontiersArticle(doiOrUrl: string): Promise<RawArticle> {
  const doi = doiOrUrl.match(/10\.3389\/[a-z]+\.[\d.]+[\d]/i)?.[0]
  if (!doi) throw new Error(`Frontiers DOI 를 못 읽었다: ${doiOrUrl}`)
  const got = await fetchFrontiersArticle(doi)
  if (!got) throw new Error(`Frontiers 본문을 못 받았다: ${doi}`)
  if (got.words < FRONTIERS_MIN_WORDS) {
    throw new Error(`Frontiers 본문이 너무 짧다(${got.words}어 < ${FRONTIERS_MIN_WORDS}): ${doi}`)
  }
  if (!frontiersLicenseAllowed(got.licenseUrl)) {
    throw new Error(`Frontiers 라이선스가 통과 목록 밖이다(${got.licenseUrl ?? '없음'}): ${doi}`)
  }
  return {
    source: 'frontiers',
    source_id: sourceKey('frontiers', { doi: got.doi }),
    title: got.title || '(제목 미상)',
    source_url: got.url,
    language: 'en',
    license: frontiersLicenseCode(got.licenseUrl) ?? 'CC-BY-4.0',
    published_at: null,
    content: got.content,
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
