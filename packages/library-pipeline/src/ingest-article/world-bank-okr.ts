// packages/library-pipeline/src/ingest-article/world-bank-okr.ts
//
// **World Bank Open Knowledge Repository (OKR) 목록기 + 평문 추출기.**
//
// ── 왜 이 소스인가 (실측 2026-09-07) ─────────────────────────────────
// 분류기(`lib-topic.mjs`) 수정 후 다시 잰 소재 칸에서 **사회·경제 배율 0.686** 이 2위
// 빈 칸이었다(`docs/reports/topic-gap.json`). 개발경제·사회과학을 대량으로 주는 곳은
// 정찰 25갈래 중 **여기 하나**다(Pew·Brookings·RAND·WB Blogs 는 전부 저작권 유보 —
// `docs/reports/source-probe/policy-institutes.md` §1).
//
// ── 이 소스의 결정적 이점: PDF 옆에 `.txt` 형제 파일이 있다 ──────────
// ORIGINAL 번들에 `<이름>.pdf` 와 `<이름>.txt` 가 같이 온다. **PDF 파싱기를 짜지 않는다.**
// 실측 100건 중 `dc:format` 에 `text/plain` 이 있는 것 74건.
//
// ── ⚠️ 그런데 그 평문은 「선형 읽기 순서」가 아니다 (실측 8편) ────────
// DOAB 정찰이 같은 날 찾은 것과 **같은 함정이 여기에도 있다.** 「챕터 표제 + 300낱말」로
// 자르면 다른 단이 섞인다. OKR `.txt` 에서 실제로 확인한 비선형 요소 넷:
//
//   ① **두 단 초록이 줄 단위로 교차한다.** WPS4733 첫 쪽 —
//      `"The present study uses the GIDD, a CGE-        main cause being increasing skill premia."`
//      왼쪽 단과 오른쪽 단이 **한 줄에** 들어 있다. 공백을 접으면 문장이 뒤섞인다.
//   ② **각주가 쪽 중간에 끼어든다.** 본문 → `1 Most of the discrepancies…` → 본문.
//      쪽 단위로 자르지 않으면 각주가 지문 한복판에 박힌다.
//   ③ **러닝헤더·쪽번호**가 매 쪽 경계에 낀다(`ON THE MEASUREMENT OF…`, `7`).
//   ④ **판권면·감사의 말·목차**가 앞 10~20%를 차지한다(보고서형은 더 길다).
//
// 그래서 추출 단위를 **연속 산문 런**(run of continuous prose)으로 잡는다 —
// 「끊기지 않고 이어지는 산문 줄의 최대 구간」. 끊는 신호가 하나라도 나오면 런을 닫는다.
// `\f`(쪽 넘김)는 **무조건 런을 닫는다** — ②③ 이 전부 쪽 경계에 살기 때문이다.
// 한 쪽이 400~500어라 창(134~173어)은 쪽 안에서 충분히 잡힌다(실측 최상 런 306~419어).
//
// ── 라이선스는 **내려받기 전에** 항목별로 거른다 ─────────────────────
// `dc:rights` 가 항목마다 온다. 표기가 네 가지로 갈려 있어(`CC BY 3.0 IGO` ·
// `http://…/by/3.0/igo` · `https://…/by/3.0/igo/` · 대소문자) 문자열 비교로는 절반을 놓친다.
// **`by-nc`·`by-nd` 를 먼저 떨어뜨린 뒤** `licenses/by/` 를 본다(`by-nc` 도 `by` 를 담는다).
//
// ── ⚠️ robots.txt (실측 2026-09-07) ──────────────────────────────────
// `https://openknowledge.worldbank.org/robots.txt` 는 DSpace 기본값 그대로이고
// `User-agent: *` 아래 **`Disallow: /server/oai/`** 와 `Crawl-delay: 10` 이 있다.
// (AI 크롤러 지목 차단·Content-Signal 은 **없다**. `/bitstreams/…/download` 는 Disallow 대상이 아니다.)
// 정찰 리포트는 이 줄을 적지 않았다 — 여기 적어 둔다. 수확기는
//   · UA 로 신원을 밝히고
//   · 요청 간격 기본값을 **10초**(Crawl-delay 준수)로 두며
//   · 이 판단이 **결정 사안**임을 로그에 찍는다.
// 넘지 않기로 정하면 남는 경로는 DSpace REST(`/server/api` 는 Allow 가 아니라 Disallow 지만
// `/server/api/core/bitstreams/` 는 Allow)와 사이트맵이다 — 목록을 만들 수단이 사라지므로
// **소스 자체가 반려**가 된다. 사용자 결정 전까지 `--commit` 은 사람이 직접 붙인다.

import { fetchWithTimeout } from './_helpers'
import { sourceKey } from './source-key'

// ═══════════════════════════════════════════════════════════════════
// 1. 피드
// ═══════════════════════════════════════════════════════════════════

/**
 * OKR 피드 — OAI-PMH `set` 이 아니라 **`dc:type` 후처리**로 가른다.
 *
 * ⚠️ setSpec 은 주제가 아니라 운영 태그다(한 항목에 45개가 붙어 온다 — 실측
 *   `10986/19190`: `Fix_PRWPs_DOIs` · `test_new_filter` · `Aptara` …).
 *   set 으로 겨냥하면 「무엇을 받았는지」를 설명할 수 없다.
 *
 * `working-paper` 를 1차로 두는 근거: 정찰 표본 CC BY 77건 중 `Working Paper` 31건이
 * 가장 지문에 가까웠고(통념 제시 → 반박 → 물음), `Report` 는 앞 15~20%가
 * 감사의 말·인명 나열이었다(`policy-institutes.md` §2-7).
 */
export const WORLD_BANK_FEEDS: Array<{ id: string; label: string; types: readonly string[] }> = [
  { id: 'working-paper', label: 'Working Paper (논증형 · 1차)', types: ['working paper'] },
  { id: 'journal-article', label: 'Journal Article', types: ['journal article'] },
  { id: 'report', label: 'Report · Brief · Policy Note (2차 — 앞머리 잡음 많음)', types: ['report', 'brief', 'policy note'] },
  { id: 'all', label: '전체 (유형 무관)', types: [] },
]

const OAI = 'https://openknowledge.worldbank.org/server/oai/request'

/**
 * **신원을 밝힌다.** `_helpers` 의 기본 UA 는 Chrome 위장인데, robots.txt 가
 * `/server/oai/` 를 막아 둔 곳에 위장 UA 로 가는 것은 두 번 잘못이다 —
 * 상대가 우리를 알아보고 막거나 허락할 수 있어야 한다(Wikimedia 때 배운 것과 같다).
 */
const OKR_UA = 'Vocaflow/1.0 (https://vocaflow.app; hello@vocaflow.app) library-pipeline'

// ═══════════════════════════════════════════════════════════════════
// 2. 라이선스 판정
// ═══════════════════════════════════════════════════════════════════

/** `dc:rights` 여러 값을 합쳐 판정. **NC/ND 를 먼저 떨어뜨린다.** */
export function worldBankLicense(rights: readonly string[]): {
  ok: boolean
  label: string
  reason: 'cc_by' | 'nc' | 'nd' | 'reserved' | 'missing'
} {
  const joined = rights.join(' ').toLowerCase()
  if (!joined.trim()) return { ok: false, label: '(없음)', reason: 'missing' }
  // ⚠️ 순서가 전부다 — `by-nc` 도 `by` 를 담는다. NC/ND 를 먼저 본다.
  if (/by-nc-nd|by-nd/.test(joined)) return { ok: false, label: 'CC BY-ND 계열', reason: 'nd' }
  if (/by-nc/.test(joined)) return { ok: false, label: 'CC BY-NC 계열', reason: 'nc' }
  if (/cc\s*by|licenses\/by\//.test(joined)) {
    const igo = /igo/.test(joined)
    return { ok: true, label: igo ? 'CC BY 3.0 IGO' : 'CC BY', reason: 'cc_by' }
  }
  return { ok: false, label: rights[0] ?? '(미상)', reason: 'reserved' }
}

/** `dc:language` 값들이 영어인가. `English,en_US` · `EN` · `en` 이 섞여 온다(실측). */
export function isEnglish(langs: readonly string[]): boolean {
  const j = langs.join(' ').toLowerCase()
  if (!j.trim()) return false
  return /\ben\b|\ben[_-]|english/.test(j)
}

// ═══════════════════════════════════════════════════════════════════
// 3. OAI-PMH 목록 (metadataPrefix=xoai — 비트스트림 주소가 함께 온다)
// ═══════════════════════════════════════════════════════════════════

export interface WorldBankListItem {
  /** `worldbank:10986/6318` — 발췌 접미어는 적재기가 붙인다 */
  source_id: string
  /** `10986/6318` */
  handle: string
  title: string
  url: string
  published_at: string | null
  authors: string[]
  types: string[]
  license: string
  /** ORIGINAL 번들의 `.txt` 다운로드 주소. 없으면 null → 건너뛴다(PDF 를 받지 않는다) */
  textUrl: string | null
  textBytes: number
}

/** xoai 레코드에서 필드 하나 뽑기. `<field name="x">v</field>` 는 중첩 안 한다. */
function fields(block: string, name: string): string[] {
  const re = new RegExp(`<field name="${name}">([^<]*)</field>`, 'g')
  return [...block.matchAll(re)].map((m) => decodeXml(m[1] ?? '').trim()).filter(Boolean)
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

/** `<element name="X">…</element>` 한 덩어리 (첫 매치, 균형 맞춤). */
function element(block: string, name: string): string | null {
  const open = block.indexOf(`<element name="${name}">`)
  if (open < 0) return null
  let i = open
  let depth = 0
  const re = /<element\b[^>]*>|<\/element>/g
  re.lastIndex = open
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) {
    if (m[0].startsWith('</')) depth--
    else depth++
    i = m.index + m[0].length
    if (depth === 0) return block.slice(open, i)
  }
  return null
}

/** dc 요소 하나의 값들 — xoai 는 `<element name="dc"><element name="title">…<field name="value">` 꼴이다. */
function dcValues(record: string, name: string): string[] {
  const dc = element(record, 'dc')
  if (!dc) return []
  const el = element(dc, name)
  if (!el) return []
  return fields(el, 'value')
}

/**
 * xoai 가 주는 주소 → **REST content 주소**.
 *
 * ⚠️ xoai 는 프런트엔드 경로(`/bitstreams/<uuid>/download`)를 준다. 실측 2026-09-07:
 *   그 경로가 **500 을 돌려준다**(같은 uuid 로 REST 는 200 + 정상 본문). 정찰 때는 되던
 *   경로라 「배선 성공 · 실행 성공 · 결과 0」이 됐다 — 14편 전부 `bitstream 500`.
 *   덤으로 robots.txt 가 **`Allow: /server/api/core/bitstreams/`** 를 명시한다(프런트
 *   경로는 명시가 없다). 즉 이쪽이 더 안전하고 더 잘 된다.
 */
export function toRestContentUrl(url: string): string {
  const uuid = url.match(/\/bitstreams\/([0-9a-f-]{36})\//i)?.[1]
  if (!uuid) return url
  return `https://openknowledge.worldbank.org/server/api/core/bitstreams/${uuid}/content`
}

/** ORIGINAL 번들의 첫 `.txt` 비트스트림. LICENSE·THUMBNAIL 번들은 보지 않는다. */
export function originalTextBitstream(record: string): { url: string; bytes: number } | null {
  const bundles = element(record, 'bundles')
  if (!bundles) return null
  for (const b of bundles.match(/<element name="bundle">[\s\S]*?<\/element>\s*<\/element>/g) ?? []) {
    if (!/<field name="name">ORIGINAL<\/field>/.test(b)) continue
    for (const s of b.match(/<element name="bitstream">[\s\S]*?<\/element>/g) ?? []) {
      const name = fields(s, 'name')[0] ?? ''
      const url = fields(s, 'url')[0] ?? ''
      if (!/\.txt$/i.test(name) || !url) continue
      return { url: toRestContentUrl(url), bytes: Number(fields(s, 'size')[0] ?? 0) }
    }
  }
  return null
}

export function buildWorldBankListUrl(token: string | null, from?: string | null): string {
  const u = new URL(OAI)
  u.searchParams.set('verb', 'ListRecords')
  if (token) {
    // ⚠️ resumptionToken 은 **단독으로만** 보낸다 — 다른 인자를 같이 보내면 OAI 는 badArgument 다.
    u.searchParams.set('resumptionToken', token)
    return u.toString()
  }
  u.searchParams.set('metadataPrefix', 'xoai')
  if (from) u.searchParams.set('from', from)
  return u.toString()
}

export interface WorldBankPage {
  items: WorldBankListItem[]
  /** 다음 페이지 토큰. null = 끝 */
  nextCursor: string | null
  /** 상류가 말한 총 레코드 수 (첫 페이지에만 온다) */
  completeListSize: number | null
  /** 이 페이지에서 라이선스·언어·평문 유무로 떨어뜨린 수 — 수율을 보이려면 세야 한다 */
  dropped: { nc: number; nd: number; reserved: number; missing: number; notEnglish: number; noText: number; type: number }
}

/**
 * 한 페이지(100건)를 받아 **내려받기 전에** 거른다.
 *
 * 순서가 중요하다 — 라이선스 → 언어 → 유형 → 평문 유무. 평문 유무를 먼저 보면
 * 못 쓸 라이선스의 평문 유무를 세게 되고, 그 수가 「확보 가능」으로 보고된다.
 */
export async function listWorldBankFeedPage(
  feedId: string = 'working-paper',
  token: string | null = null,
  opts: { from?: string | null; timeoutMs?: number } = {},
): Promise<WorldBankPage> {
  const feed = WORLD_BANK_FEEDS.find((f) => f.id === feedId) ?? WORLD_BANK_FEEDS[0]!
  const res = await fetchWithTimeout(buildWorldBankListUrl(token, opts.from), {
    timeoutMs: opts.timeoutMs ?? 90_000,
    accept: 'application/xml, text/xml',
    extraHeaders: { 'User-Agent': OKR_UA },
  })
  if (!res.ok) throw new Error(`World Bank OAI ${res.status}`)
  const xml = await res.text()

  const rt = xml.match(/<resumptionToken[^>]*>([^<]*)<\/resumptionToken>/)
  const size = xml.match(/completeListSize="(\d+)"/)?.[1]
  const items: WorldBankListItem[] = []
  const dropped = { nc: 0, nd: 0, reserved: 0, missing: 0, notEnglish: 0, noText: 0, type: 0 }

  for (const record of xml.match(/<record>[\s\S]*?<\/record>/g) ?? []) {
    const handle = record.match(/<identifier>oai:openknowledge\.worldbank\.org:(10986\/\d+)<\/identifier>/)?.[1]
    if (!handle) continue

    const lic = worldBankLicense(dcValues(record, 'rights'))
    if (!lic.ok) {
      dropped[lic.reason === 'cc_by' ? 'reserved' : lic.reason]++
      continue
    }
    if (!isEnglish(dcValues(record, 'language'))) {
      dropped.notEnglish++
      continue
    }
    const types = dcValues(record, 'type')
    if (feed.types.length && !types.some((t) => feed.types.includes(t.toLowerCase()))) {
      dropped.type++
      continue
    }
    const txt = originalTextBitstream(record)
    if (!txt) {
      dropped.noText++
      continue
    }

    const dates = dcValues(record, 'date')
    // ⚠️ `dc:date` 는 **적재 시각이 먼저** 온다(2014-08-01T17:03:45Z). 발행일은 `2003-01` 꼴로
    //   뒤에 붙는다. 첫 값을 쓰면 2003년 논문이 전부 2014년 발행으로 기록된다.
    const published = dates.find((d) => /^\d{4}(-\d{2})?(-\d{2})?$/.test(d)) ?? null

    items.push({
      source_id: sourceKey('worldbank', { guid: `oai:openknowledge.worldbank.org:${handle}` }),
      handle,
      title: (dcValues(record, 'title')[0] ?? '').replace(/\s+/g, ' ').trim(),
      url: `https://hdl.handle.net/${handle}`,
      published_at: published,
      authors: dcValues(record, 'contributor').concat(dcValues(record, 'creator')).slice(0, 6),
      types,
      license: lic.label,
      textUrl: txt.url,
      textBytes: txt.bytes,
    })
  }

  // ⚠️ 토큰이 **빈 문자열**로 오면 그것이 끝이다(OAI 규약). null 과 구분해 다뤄야
  //   `token && …` 같은 검사가 조용히 첫 페이지를 다시 받지 않는다.
  const next = rt?.[1]?.trim() ? rt[1]!.trim() : null
  return { items, nextCursor: next, completeListSize: size ? Number(size) : null, dropped }
}

/**
 * 첫 페이지만 보는 얕은 목록 — 화면·정찰용. 깊이 캘 때는 `listWorldBankFeedPage` 를
 * 커서와 함께 쓴다(등록부 `worldbank` 항목이 그 커서 파일을 가리킨다).
 */
export async function listWorldBankFeed(
  feedId: string = 'working-paper',
  limit: number = 20,
): Promise<WorldBankListItem[]> {
  const { items } = await listWorldBankFeedPage(feedId, null)
  return items.slice(0, limit)
}

/** `.txt` 비트스트림을 받는다. 인코딩이 섞여 있어 U+FFFD 가 남는데, 그 줄은 추출기가 끊는다. */
export async function fetchWorldBankText(url: string, timeoutMs = 120_000): Promise<string> {
  const res = await fetchWithTimeout(url, {
    timeoutMs,
    accept: 'text/plain, */*',
    extraHeaders: { 'User-Agent': OKR_UA },
  })
  if (!res.ok) throw new Error(`bitstream ${res.status}`)
  return await res.text()
}

// ═══════════════════════════════════════════════════════════════════
// 4. 연속 산문 런 추출기
// ═══════════════════════════════════════════════════════════════════

/** 두 단 교차·표: 줄 **안쪽**에 4칸 이상 공백이 있고 양쪽에 글자가 있다 */
const COLUMN = /\S {4,}\S/
const URLISH = /https?:\/\/|www\.|\S+@\S+\.\S/
// ⚠️ `\b` 를 통째 뒤에 붙이면 `Source:` 가 안 걸린다 — `:` 뒤의 공백에는 낱말 경계가 없다.
//   낱말형과 「낱말 + 콜론」형을 따로 쓴다(회귀가 이 함정을 잠근다).
const CAPTION = /^\s*(?:(?:table|figure|fig\.|chart|box|annex|appendix|exhibit|map)\b|(?:sources?|notes?|statlink)\s*:)/i
/** 참고문헌·인용 서지 */
const REFISH = /^\s*[A-Z][A-Za-z'’-]+,\s+[A-Z]\.|\(\d{4}[a-z]?\)|\bet al\.|\bpp\.\s*\d|\bVol\.\s*\d/
const BULLET = /^\s*([•▪·○●]|[-–—]\s|\(?[ivxlcdm]{1,4}\)|\(?[a-z]\)|\d{1,2}\.\s)/i
/** 각주 블록의 첫 줄 — 작은 숫자 + 본문 (WPS4733 의 `1 Most of the discrepancies…`) */
const FOOTNOTE = /^\s{0,10}\d{1,3}\s+[A-Z(]/
/** 숫자·로마자·구분선만 있는 줄 */
const NUMBER_ONLY = /^[\s\dixvlcdm.,;:|()[\]/_–—-]*$/i
/**
 * 그런 줄이 **쪽번호인가 각주 번호인가**를 들여쓰기로 가른다.
 *
 * ⚠️ 이 구분이 없으면 각주가 본문에 붙는다(회귀가 잡은 실제 사고). WPS4733 실측 —
 *   쪽번호는 오른쪽 끝(들여쓰기 90칸 이상)에, 각주 번호 `1` 은 **왼쪽 끝**(0칸)에 있다.
 *   왼쪽 끝 숫자는 각주·절 번호이므로 **런을 끊고**, 멀리 있는 숫자는 쪽번호이므로 버린다.
 */
const PAGE_NUMBER_INDENT = 8

export type LineKind = 'prose' | 'break' | 'skip' | 'blank'

/** 줄 한 개의 판정. **런을 끊는 것과 버리는 것을 구분한다.** */
export function classifyLine(line: string): LineKind {
  const t = line.trim()
  if (!t) return 'blank'
  if (NUMBER_ONLY.test(t)) {
    return (line.match(/^ */)?.[0].length ?? 0) >= PAGE_NUMBER_INDENT ? 'skip' : 'break'
  }
  if (t.includes('�')) return 'break' // 인코딩 깨짐 — 낱말이 망가진 자리
  if (COLUMN.test(line)) return 'break'
  if (URLISH.test(t)) return 'break'
  if (CAPTION.test(t)) return 'break'
  if (BULLET.test(t)) return 'break'
  if (FOOTNOTE.test(line)) return 'break'
  if (REFISH.test(t)) return 'break'
  const digits = (t.match(/\d/g) ?? []).length
  if (digits / t.length > 0.08) return 'break'
  const letters = (t.match(/[A-Za-z]/g) ?? []).length
  if (letters / t.length < 0.6) return 'break'
  const upper = (t.match(/[A-Z]/g) ?? []).length
  if (letters > 8 && upper / letters > 0.6) return 'break' // 러닝헤더·대문자 표제
  if (t.length < 45 && !/[.?!,;:”"’']$/.test(t)) return 'break' // 소제목
  return 'prose'
}

function joinLines(lines: string[]): string {
  let s = ''
  for (const l of lines) {
    const t = l.trim()
    if (!t) {
      s += '\n'
      continue
    }
    const tail = s.trimEnd()
    // 줄 끝 하이픈은 낱말이 잘린 것이다 — 붙여야 `informa- tion` 이 안 생긴다.
    if (/[a-z][-‐-‑]$/.test(tail)) s = tail.slice(0, -1) + t
    else s += (s && !s.endsWith('\n') ? ' ' : '') + t
  }
  return s.replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim()
}

/**
 * 런의 양 끝을 **문장 경계로 자른다.**
 *
 * ⚠️ 없으면 쪽 첫 줄의 문장 조각(`"reforms in the tax system, some policy changes…"`)이
 *   지문 첫 문장이 된다 — 창 채점은 통과하는데 사람이 읽으면 시작이 없다.
 */
export function trimToSentences(s: string): string {
  let t = s.trim()
  // 소문자로 시작하면 앞 문장이 잘린 것이다 — 첫 종결부호 **다음** 문장부터 쓴다.
  //   ⚠️ 「첫 대문자까지 버린다」로 하면 안 된다. 조각 안의 고유명사(`…the GIDD, a CGE-`)가
  //   문장 시작으로 오인돼 조각이 그대로 남는다.
  if (/^[a-z]/.test(t)) {
    const m = t.match(/[.?!]["'”’)\]]?\s+(?=[A-Z"'“(])/)
    if (!m || m.index == null) return ''
    t = t.slice(m.index + m[0].length)
  }
  const last = Math.max(t.lastIndexOf('.'), t.lastIndexOf('?'), t.lastIndexOf('!'))
  if (last < 0) return ''
  return t.slice(0, last + 1).trim()
}

export interface ProseRun {
  /** 0-index 쪽 번호(`\f` 기준). `source_id` 발췌 접미어가 된다 */
  page: number
  words: number
  text: string
}

/**
 * **연속 산문 런** — 「끊기지 않고 이어지는 산문 줄의 최대 구간」.
 *
 * `\f`(쪽 넘김)에서 무조건 닫는다. 각주·러닝헤더·쪽번호가 전부 쪽 경계에 살기 때문이다.
 * 쪽 안에서도 두 단 교차·표·서지·불릿이 나오면 닫는다.
 *
 * @param minWords 런 최소 낱말 (기본 120 — 창 하한 134 를 문장 다듬기로 잃는 몫을 감안)
 */
export function proseRuns(raw: string, minWords = 120): ProseRun[] {
  const text = String(raw).replace(/\r/g, '')
  const out: ProseRun[] = []
  text.split('\f').forEach((page, pageIndex) => {
    let cur: string[] = []
    let blanks = 0
    const flush = () => {
      if (cur.length) {
        const joined = trimToSentences(joinLines(cur))
        const words = (joined.match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
        if (words >= minWords) out.push({ page: pageIndex, words, text: joined })
      }
      cur = []
    }
    for (const line of page.split('\n')) {
      const kind = classifyLine(line)
      if (kind === 'break') {
        flush()
        blanks = 0
        continue
      }
      if (kind === 'skip') continue
      if (kind === 'blank') {
        blanks++
        // 빈 줄 4개 이상 = 절 경계. 그 아래는 다른 이야기다.
        if (blanks >= 4) flush()
        else if (cur.length) cur.push('')
        continue
      }
      blanks = 0
      cur.push(line)
    }
    flush()
  })
  return out
}

/** 런 하나의 `source_id` — 쪽 범위를 발췌 접미어로 남긴다(`worldbank:10986/6318#p20-20`). */
export function runSourceKey(handle: string, run: ProseRun): string {
  return sourceKey(
    'worldbank',
    { guid: `oai:openknowledge.worldbank.org:${handle}` },
    { start: run.page, end: run.page + 1 },
  )
}
