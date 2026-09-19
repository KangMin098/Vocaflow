// scripts/comic/pd/sources/discovery.mjs
//
// 검색 정교화 공용 층 — "무엇을 찾을지"를 어댑터마다 다시 짜지 않기 위한 것.
//
// 왜 필요했나(실측 2026-08-09):
//   초기 IA 검색은 `"<질의> AND mediatype:texts"` 한 줄이 전부였다. 결과가 이랬다 —
//     "classics illustrated" → Don Quixote 문고본(1955) · Sartor Resartus(1834) ·
//                              Strega Nona(2017, 저작권 살아 있음)
//   만화가 거의 없고, 심지어 **명백히 저작권이 살아 있는 자료가 상위에 올라왔다**.
//   PD 파이프라인의 발견 단계가 사용 불가 자료를 앞세우면 운영자의 시간이 그대로 낭비된다.
//
// 그렇다고 `collection:comics` 로 좁히면 더 나빠진다. 실측 116,891건 중 상위가
//   Batman 1940 (1-50) · The complete Daredevil collection · Spawn Issue 1 to 99
// 였다 — 사용자 업로드 저작권 침해물이다. **컬렉션이 곧 PD 보증은 아니다.**
//
// 그래서 두 가지를 나눈다:
//   ① 질의 구성(무엇을 검색할지)      → buildQuery
//   ② PD 위험 판정(무엇을 앞세울지)   → assessPdRisk
// 최종 PD 판정은 여전히 사람이 한다(발행 게이트가 DB 제약으로 강제). 여기서 하는 일은
// **사람이 봐야 할 순서를 정하는 것**뿐이다.

/**
 * 미국 PD 확정 연도 상한. **매년 1월 1일에 한 살 먹는다.**
 * 2026-01-01 부로 1930년 발행물이 PD 가 됐다.
 * 여기 한 곳만 고치면 힌트·위험도·프리셋이 함께 따라온다.
 */
export const PD_YEAR_CUTOFF = 1930

/** 1964년 이후 발행물은 저작권이 자동 갱신되어 갱신 조사 여지가 없다. */
export const RENEWAL_ERA_END = 1963

/**
 * @typedef {object} DiscoveryFilters
 * @property {string=}  collection  IA 컬렉션 키로 한정
 * @property {number=}  yearFrom
 * @property {number=}  yearTo
 * @property {number=}  minPages    표지 1장짜리 잡 항목 제거용
 * @property {'relevance'|'downloads'|'year-asc'|'year-desc'=} sort
 * @property {number=}  page        1-base
 */

/**
 * 제목에서 발행연도를 건진다.
 *
 * IA 의 `year`/`date` 필드는 만화 컬렉션에서 자주 비어 있는데(실측: fawcett-comics
 * 상위 6건 중 5건이 공백), 제목에는 "Whiz Comics 002 (1940-02)" 처럼 남아 있다.
 * 연도를 모르면 PD 판정이 통째로 '불명'이 되어 운영자가 일일이 원본을 열어야 한다.
 *
 * 오탐 방지: 만화 제목의 숫자는 대개 호수(002, 51)라 **4자리 + 인쇄물로 그럴듯한 범위**만
 * 받는다. 여러 개가 잡히면 가장 이른 것을 쓴다(재판본 연도가 뒤에 붙는 경우가 있다).
 */
export function yearFromTitle(title) {
  const now = new Date().getUTCFullYear()
  const years = String(title ?? '')
    .match(/\b(1[89]\d{2}|20[0-2]\d)\b/g)
    ?.map(Number)
    .filter((y) => y >= 1830 && y <= now)
  return years?.length ? Math.min(...years) : undefined
}

/** 사용자가 이미 필드 문법(`title:`, `creator:` …)을 썼다면 그대로 존중한다. */
function isFieldQuery(q) {
  return /\b[a-z_]+:\s*[^\s]/i.test(q)
}

/**
 * IA advancedsearch 질의 문자열을 만든다.
 *
 * 기본은 **제목 우선**이다. 전문 검색은 만화책 한 권의 OCR 전문에 걸려
 * 관련 없는 도서가 잔뜩 올라온다(위 실측). 만화는 제목으로 찾는 매체다.
 */
export function buildQuery(userQuery, filters = {}) {
  const q = String(userQuery ?? '').trim()
  const parts = []

  if (q) {
    parts.push(isFieldQuery(q) ? `(${q})` : `title:(${q})`)
  }
  parts.push('mediatype:texts')
  if (filters.collection) parts.push(`collection:${filters.collection}`)

  const from = filters.yearFrom
  const to = filters.yearTo
  if (from || to) {
    parts.push(`date:[${from ?? 1800}-01-01 TO ${to ?? 2100}-12-31]`)
  }
  return parts.join(' AND ')
}

/** IA sort 파라미터로 변환. */
export function sortParam(sort) {
  switch (sort) {
    case 'downloads':
      return 'downloads desc'
    case 'year-asc':
      return 'date asc'
    case 'year-desc':
      return 'date desc'
    default:
      return '' // relevance
  }
}

/**
 * 컬렉션 신호로 PD 위험도를 가른다.
 *
 * IA 컬렉션은 크게 두 부류다:
 *   · 큐레이션 컬렉션 (`fawcett-comics` 등) — 사서/자원봉사자가 PD 확인 후 모은 것
 *   · 사용자 업로드 (`opensource`, `community`, `folkscanomy` …) — **무검증**
 * 후자에 저작권 침해물이 섞인다(실측: Batman·Spawn·Daredevil 이 collection:comics 상위).
 */
const CURATED_HINTS = [
  /^fawcett-/,
  /^pub_/,
  /^sim_/,
  /^classic/,
  /^usgovernment/,
  /^smithsonian/,
  /^library_of_congress/,
]
const USER_UPLOAD = new Set([
  'opensource',
  'opensource_media',
  'community',
  'community_media',
  'folkscanomy',
  'additional_collections',
  'comics', // 큐레이션처럼 보이지만 실측상 사용자 업로드가 지배적
])

/**
 * @returns {{ level: 'ok'|'caution'|'high', curated: boolean, reason: string }}
 *   ok      — 연도상 PD 확정 + 큐레이션 컬렉션
 *   caution — 사람이 갱신 기록을 확인해야 함
 *   high    — 저작권 존속 가능성이 높아 **목록 상단에 두면 안 됨**
 */
export function assessPdRisk(item) {
  const cols = [].concat(item?.raw?.collection ?? []).map((c) => String(c).toLowerCase())
  const year = item?.publishedYear
  const curated = cols.some((c) => CURATED_HINTS.some((re) => re.test(c)))
  const userUploaded = cols.some((c) => USER_UPLOAD.has(c))

  if (year && year > RENEWAL_ERA_END) {
    return { level: 'high', curated, reason: `${year}년 — 저작권 자동 갱신 대상` }
  }
  if (!year) {
    return {
      level: userUploaded && !curated ? 'high' : 'caution',
      curated,
      reason:
        userUploaded && !curated
          ? '발행연도 불명 + 무검증 업로드 컬렉션 — 출처 확인 전 사용 금지'
          : '발행연도 불명 — 원본에서 확인 필요',
    }
  }
  if (year <= PD_YEAR_CUTOFF) {
    return curated
      ? { level: 'ok', curated, reason: `${year}년 · 큐레이션 컬렉션` }
      : { level: 'caution', curated, reason: `${year}년 PD 확정이나 스캔 출처 미검증` }
  }
  // 1931~1963 — 골든에이지 만화의 절대다수가 여기 있다. 전부 '갱신 확인 필요'라
  // 등급만으로는 갈리지 않으므로, 큐레이션 여부를 같은 등급 안의 우선순위로 쓴다.
  return {
    level: userUploaded && !curated ? 'high' : 'caution',
    curated,
    reason:
      userUploaded && !curated
        ? `${year}년 + 무검증 업로드 — 갱신 기록·출처 모두 확인 필요`
        : curated
          ? `${year}년 · 큐레이션 컬렉션 — 갱신 여부만 확인하면 됨`
          : `${year}년 — 저작권 갱신 여부 확인 필요`,
  }
}

/**
 * 위험도 순 정렬 — 쓸 수 있는 것을 위로.
 * 같은 등급 안에서는 **큐레이션 컬렉션 우선**, 그 다음은 원래 순서(관련도)를 유지한다.
 * 골든에이지 만화는 대부분 같은 'caution' 이라 등급만으로는 줄이 서지 않는다.
 */
export function rankByPdRisk(items) {
  const w = { ok: 0, caution: 1, high: 2 }
  return items
    .map((it, i) => ({ it, i, r: assessPdRisk(it) }))
    .sort(
      (a, b) =>
        w[a.r.level] - w[b.r.level] ||
        Number(Boolean(b.r.curated)) - Number(Boolean(a.r.curated)) ||
        a.i - b.i,
    )
    .map(({ it, r }) => ({
      ...it,
      pdRisk: r.level,
      pdRiskReason: r.reason,
      pdCurated: Boolean(r.curated),
    }))
}
