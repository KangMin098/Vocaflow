// packages/library-pipeline/src/ingest-article/_helpers.ts
// ACP v1.0 Phase 19 — Shared RSS / HTML / fetch utilities for article ingesters.
//
// VOA / NASA / NIH / wikinews / the_conversation / simple_wikipedia 모두 동일 패턴
// (RSS/atom parsing + HTML→text + timeout fetch) 사용.
// 본 파일이 단일 출처 — 각 ingester 가 import.

const DEFAULT_TIMEOUT_MS = 15_000
const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

/**
 * Wikimedia 계열은 **위장 UA 를 보내면 안 된다.**
 *
 * 실측 2026-08-30 — 카테고리를 여러 페이지 걷기 시작하자마자 전부 429 로 막혔다.
 * 같은 순간 손으로 친 요청은 200 에 60건을 돌려줬다. 차이는 딱 하나, User-Agent 였다:
 *   Chrome 위장 → 429 / `Vocaflow/1.0 (probe)` → 200
 * Wikimedia 의 UA 정책은 API 클라이언트에 **식별 가능한 이름과 연락처**를 요구하고,
 * 브라우저를 사칭하는 UA 는 봇으로 보고 공격적으로 스로틀한다. 즉 이건 속도 문제가 아니라
 * **신원 문제**였다 — 간격만 늘렸으면 영영 못 고쳤다.
 */
const WIKIMEDIA_UA = 'Vocaflow/1.0 (https://vocaflow.app; hello@vocaflow.app) library-pipeline'

/** UA 정책을 적용할 호스트. 서브도메인까지 본다(en./simple./www.). */
const WIKIMEDIA_HOST_RE =
  /(^|\.)(wikipedia|wikivoyage|wikisource|wikibooks|wikinews|wikimedia|wiktionary)\.org$/i

/** 호스트에 맞는 UA. 알 수 없는 URL 은 기존 기본값을 그대로 쓴다(동작 변화 없음). */
export function userAgentFor(url: string): string {
  try {
    return WIKIMEDIA_HOST_RE.test(new URL(url).hostname) ? WIKIMEDIA_UA : DEFAULT_USER_AGENT
  } catch {
    return DEFAULT_USER_AGENT
  }
}

/** 재시도 대상 — 일시적인 것만. 404·403 은 재시도해도 같다. */
const RETRYABLE_STATUS = new Set([429, 503])
const MAX_ATTEMPTS = 3
/** Retry-After 를 그대로 믿지 않는다 — 몇 분짜리 값이 오면 배치가 통째로 멈춘다. */
const MAX_BACKOFF_MS = 20_000

function backoffMs(attempt: number, retryAfter: string | null): number {
  const hinted = retryAfter ? Number(retryAfter) * 1000 : NaN
  const base = Number.isFinite(hinted) && hinted > 0 ? hinted : 500 * 2 ** attempt
  return Math.min(base, MAX_BACKOFF_MS)
}

export interface RssListItem {
  /** GUID 또는 link 해시 — caller 가 source prefix 추가 */
  guid: string | null
  title: string
  url: string
  published_at: string | null
  /** 발행 시각의 출처. 피드가 퇴화해 주소에서 되찾았으면 `'url'` (하루 단위). */
  date_source?: 'feed' | 'url'
  /** plain-text 짧은 설명 (CDATA + HTML stripped + entity decoded, 최대 400자) */
  description: string
}

/**
 * 표준 RSS 2.0 / Atom feed XML 을 파싱하여 item 배열 반환.
 * <item> 또는 <entry> 모두 지원 — 단순 정규식 기반 (의존성 0).
 */
export function parseRssFeed(xml: string, nowMs: number = Date.now()): RssListItem[] {
  const items: RssListItem[] = []
  // RSS 2.0
  const rssItem = /<item\b[^>]*>([\s\S]*?)<\/item>/g
  // Atom
  const atomEntry = /<entry\b[^>]*>([\s\S]*?)<\/entry>/g

  const blocks: string[] = []
  let m: RegExpExecArray | null
  while ((m = rssItem.exec(xml)) !== null) blocks.push(m[1]!)
  while ((m = atomEntry.exec(xml)) !== null) blocks.push(m[1]!)

  for (const block of blocks) {
    const title = extractTag(block, 'title')
    // Atom 은 <link href="..."/>, RSS 는 <link>url</link>
    const link =
      extractTag(block, 'link') ?? block.match(/<link[^>]+href="([^"]+)"/i)?.[1] ?? null
    const guid = extractTag(block, 'guid') ?? extractTag(block, 'id') ?? null
    // RSS 2.0 = pubDate · Atom = published/updated · RSS 1.0(RDF) = dc:date.
    // ⚠ dc:date 를 안 보면 RDF 피드의 **모든 항목이 발행 시각 없음으로 버려진다**
    //   (2026-08-18 실측: DW 의 rss-en-all 137항목이 전부 그렇게 빠졌다).
    const pubDate =
      extractTag(block, 'pubDate') ??
      extractTag(block, 'published') ??
      extractTag(block, 'dc:date') ??
      extractTag(block, 'updated') ??
      null
    // v06.70 — The Conversation atom 의 <summary>(짧은 요약) vs <content>(풀 본문) 우선순위 수정.
    //   summary 우선 시 minDescriptionLen 가드 통과 못함 → content 가 있으면 우선.
    //   여러 후보 중 가장 긴 것 선택 (description/content/summary 모두 후보).
    const candidates = [
      extractTag(block, 'description'),
      extractTag(block, 'content'),
      extractTag(block, 'summary'),
    ].filter((s): s is string => typeof s === 'string' && s.length > 0)
    const desc = candidates.sort((a, b) => b.length - a.length)[0] ?? ''

    if (!link) continue
    items.push({
      guid,
      title: decodeEntities(title ?? '(제목 없음)').trim(),
      // URL 도 디코딩한다 — 안 하면 &amp; 가 남아 **같은 기사가 두 주소로 저장된다**
      //   (실측 2026-08-19: compose 후보 1,296건 중 90건이 이 이유의 중복).
      url: decodeEntities(link).trim(),
      published_at: safeDateISO(pubDate),
      // v06.70 — entity-encoded HTML(&lt;p&gt;...&lt;/p&gt;) 처리:
      //   decodeEntities 먼저 → stripTags. 이전 순서는 stripTags 가 entity 못 풀어 HTML 태그 잔존.
      description: stripTags(decodeEntities(desc)).replace(/\s+/g, ' ').trim().slice(0, 400),
    })
  }
  // 발행 시각이 퇴화한 피드는 주소에 박힌 날짜로 되살린다.
  //   되살릴 수 없는 항목은 그대로 둔다 — 거짓 시각이라도 없는 것보다 낫다(늦게 익을 뿐이다).
  if (degenerateDates(items, nowMs)) {
    for (const it of items) {
      const fromUrl = dateFromUrl(it.url, nowMs)
      if (fromUrl) {
        it.published_at = fromUrl
        it.date_source = 'url'
      }
    }
  }
  return items
}

/**
 * 피드가 **모든 항목에 같은 발행 시각**(= 피드를 만든 시각)을 찍고 있는가.
 *
 * 실측 2026-08-19: `feed.koreatimes.co.kr/k/allnews.xml` 37항목의 pubDate 가 전부
 * `Wed, 19 Aug 2026 02:32:03 GMT` 하나였다 — 우리가 받기 6분 전. 같은 시각 코리아헤럴드는
 * 50항목 중 45개가 서로 다른 분이었다. 즉 파서 탓이 아니라 그 피드의 결함이다.
 *
 * 못 보고 지나가면 조용히 두 가지가 망가진다:
 *   ① 발행 지연 48시간이 **우리가 처음 본 시각**부터 세어진다 — 사흘 전 기사도 이틀 더 묵는다.
 *   ② 같은 사건을 다룬 다른 매체 기사와 **함께 익지 않아** 독립 2계통이 성립하지 않는다.
 *      한국 매체끼리 국내 사건을 각자 보도해 2계통을 만드는 경로가 여기서 끊긴다.
 *
 * 정상 피드의 실측 최저가 87% 였으므로 **10% 이하만** 퇴화로 본다 — 그 사이는 넓게 비워 둔다.
 *
 * 표본이 얇을 때(5건 미만) 뭉침만으로는 단정하지 않는다. 기사 넷이 정말 같은 분에 나갔을 수도
 * 있기 때문이다. 대신 **근거를 하나 더 요구한다 — 그 시각이 지금과 붙어 있는가.** 피드를 만들며
 * 찍은 시각이면 우리가 받는 순간과 몇 분 차이가 안 난다. 이 갈래가 필요한 이유는 실측이다:
 * 코리아타임스 섹션 피드는 항목이 4~6건뿐이라(lifestyle 4 · entertainment 6) 건수 기준만으로는
 * **같은 결함을 가진 같은 발행사의 피드가 그냥 통과한다**(2026-08-19).
 */
function degenerateDates(items: ReadonlyArray<RssListItem>, nowMs: number = Date.now()): boolean {
  const dated = items.filter((i) => i.published_at)
  if (dated.length < 2) return false
  const stamps = dated.map((i) => new Date(i.published_at!).getTime())
  const distinct = new Set(dated.map((i) => i.published_at!.slice(0, 16)))
  if (distinct.size > Math.max(1, Math.floor(dated.length * 0.1))) return false
  if (dated.length >= 5) return true
  // 얇은 표본 — 뭉친 그 시각이 지금으로부터 30분 안이면 피드를 만든 시각으로 본다.
  return Math.abs(nowMs - Math.max(...stamps)) <= 30 * 60_000
}

/**
 * 주소에 박힌 발행일 되찾기 — `/20260819/` · `/2026/08/19/` · `/2026-08-19/`.
 *
 * **하루 단위이므로 그날의 끝(23:59:59.999Z)을 돌려준다.** 시작이 아니다.
 * 발행 지연 게이트(I15)는 "사건 후 48시간" 을 요구하는데 실제 발행 시각은 그날 어딘가다.
 * 끝으로 잡으면 우리가 세는 경과 시간이 실제보다 **짧게** 나와 절대 일찍 풀리지 않는다.
 * 시작(00:00)으로 잡으면 최대 24시간 일찍 풀린다 — 그쪽이 위험하다.
 *
 * 내일 이후와 1990년 이전은 거절한다 — 주소에 우연히 섞인 숫자다.
 */
export function dateFromUrl(url: string, nowMs: number = Date.now()): string | null {
  const patterns = [
    /\/(\d{4})(\d{2})(\d{2})(?:\/|$|\?)/,
    /\/(\d{4})\/(\d{2})\/(\d{2})(?:\/|$|\?)/,
    /\/(\d{4})-(\d{2})-(\d{2})(?:\/|$|\?)/,
  ]
  for (const re of patterns) {
    const m = url.match(re)
    if (!m) continue
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    if (y < 1990 || mo < 1 || mo > 12 || d < 1 || d > 31) continue
    const back = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999))
    // 2026-02-31 같은 조합은 다음 달로 굴러간다 — 그런 건 날짜가 아니다.
    if (back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) continue
    if (back.getTime() > nowMs + 86_400_000) continue
    // **오늘 날짜면 그날의 끝은 아직 오지 않았다.** 그대로 두면 미래 시각이 저장돼
    //   화면에서 자료 오류처럼 보이고 숙성도 하루 더 밀린다. 지금으로 자른다 —
    //   방금 받아 온 글이므로 발행은 늦어도 지금이고, 잘라도 여전히 상한이다.
    return new Date(Math.min(back.getTime(), nowMs)).toISOString()
  }
  return null
}

/**
 * 안전한 날짜 파싱 — `new Date(s)` 가 **Invalid Date**(truthy)를 만들 수 있어,
 * 이후 `.toISOString()` 이 "Invalid time value" 로 throw 되는 것을 차단.
 * 파싱 불가/빈 값이면 null 반환.
 */
export function safeDate(s: string | null | undefined): Date | null {
  if (!s || !s.trim()) return null
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? null : d
}

/** 안전한 날짜 → ISO 문자열. 파싱 불가면 null (toISOString throw 차단). */
export function safeDateISO(s: string | null | undefined): string | null {
  return safeDate(s)?.toISOString() ?? null
}

/** HTML <tag> 내용 추출 (CDATA + 일반 텍스트 지원). 첫 매치만. */
export function extractTag(block: string, tag: string): string | undefined {
  const re = new RegExp(
    `<${tag}(?:\\s[^>]*)?>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`,
    'i',
  )
  const m = block.match(re)
  return (m?.[1] ?? m?.[2])?.trim()
}

/** 여러 패턴 중 첫 매치 반환. */
export function extractFirst(html: string, patterns: RegExp[]): string | undefined {
  for (const re of patterns) {
    const m = html.match(re)
    if (m?.[1]) return m[1]
  }
  return undefined
}

export function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

/**
 * HTML 엔티티 디코딩.
 *
 * **안정될 때까지 반복한다(최대 3회)** — 이중 인코딩된 피드가 있다. NPR 은 제목을
 * `&amp;apos;` 로 내보내서 1회 디코딩으로는 `&apos;` 가 그대로 남는다(실측 2026-08-19).
 * 무한 반복을 막기 위해 횟수를 묶고, 더 안 바뀌면 즉시 멈춘다.
 */
export function decodeEntities(s: string): string {
  let out = s
  for (let i = 0; i < 3; i++) {
    const next = decodeOnce(out)
    if (next === out) break
    out = next
  }
  return out
}

function decodeOnce(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    // hex 수치 엔티티(&#x27; 등) — 이게 없어 owid/voa 제목에 &#x27; 잔존했음(v06.208 수정)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

/** Article body HTML → plain text (script/style/figure/aside 제거 + 줄바꿈 보존). */
export function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  // ⚠️ `<figcaption>` 을 따로 뗀다 — **`<figure>` 안에 있다는 보장이 없다.**
  //   NASA 는 `</figure>` **뒤**에 형제로 둔다(실측 2026-08-21):
  //     …</a></figure><figcaption class="hds-caption …">Cindy Evans during an Artemis II …</figcaption>
  //   그래서 위 줄이 못 잡고 캡션이 본문 문장으로 들어갔다. 캡션은 마침표까지 있어
  //   문장처럼 보이지만 정형동사가 없어 순서·삽입 문항의 재료가 되면 안 된다.
  //
  //   ⚠️ 이것을 **문장 필터로 고치려다 실패했다** — "정형동사 없는 명사구" 판정은
  //   품사 태거 없이는 정밀도가 안 나온다(실측: 가장 좁은 규칙조차 표본 8개 중 실제 캡션 2개,
  //   가장 넓은 규칙은 25,843문장 중 24.3%를 잡는데 대부분이 멀쩡한 문장이었다).
  //   구조로 잡을 수 있는 것을 추론으로 잡으려 하면 안 된다. `scripts/textbook/caption-probe.mjs`.
  s = s.replace(/<figcaption\b[\s\S]*?<\/figcaption>/gi, '\n')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '\n')
  s = s.replace(/<nav\b[\s\S]*?<\/nav>/gi, '')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return (
    s
      // ⚠️ 개행 정규화가 맨 앞 — HTTP 응답 HTML 은 CRLF 인 경우가 많고, 그러면 아래 `\n` 규칙이
      //   전부 no-op 이 된다(같은 결함이 normalize/reflow.ts 에 있었다: 구텐베르크 전권 무효화).
      .replace(/\r\n?/g, '\n')
      // `<pre>`·하드랩된 본문에서 넘어온 줄 끝 하이픈 재결합 + soft hyphen 제거
      .replace(/­/g, '')
      .replace(/(\p{L})[-‐‑][ \t]*\n[ \t]*(\p{L})/gu, '$1$2')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+/g, ' ')
      .trim()
  )
}

export function hashString(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * ACP §18 §4-C — 텍스트 어휘 노이즈 비율 (0~1, numeric(4,3)).
 *   noise = (수식기호 + LaTeX + 인용마커 [n] + URL + sub/superscript) / 전체 토큰.
 * LaTeX·수식·인용 오염 탐지 — 0.08 초과 시 어휘 파이프라인 탈락(읽기용만).
 */
export function computeLexicalNoise(text: string): number {
  if (!text) return 0
  const tokens = text.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let noise = 0
  for (const t of tokens) {
    if (
      /[∑∫√∞≤≥≈×÷±→←∂∇µλσθαβγπΔΩ]/.test(t) || // 수식 기호
      /\\[a-zA-Z]{2,}/.test(t) || // LaTeX 명령 (\alpha \frac)
      /\$[^$]*\$/.test(t) || // inline math $...$
      /^\[\d+(?:[,–-]\d+)*\]$/.test(t) || // 인용 [12] [3,4]
      /^https?:\/\//.test(t) || // URL
      /\^\{|_\{|\\\(|\\\)/.test(t) // sub/superscript, \( \)
    ) {
      noise++
    }
  }
  return Math.round((noise / tokens.length) * 1000) / 1000
}

/** Abort-friendly fetch with timeout + browser-like User-Agent. */
export async function fetchWithTimeout(
  url: string,
  options: {
    timeoutMs?: number
    accept?: string
    extraHeaders?: Record<string, string>
  } = {},
): Promise<Response> {
  let last: Response | null = null
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': userAgentFor(url),
          Accept: options.accept ?? 'application/rss+xml, application/xml, text/xml, text/html',
          ...options.extraHeaders,
        },
      })
      // 일시적 거절만 물러섰다 다시 친다. 마지막 시도의 응답은 그대로 돌려줘
      // 호출부가 지금까지처럼 status 를 보고 판단하게 둔다(동작 변화 없음).
      if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_ATTEMPTS - 1) return res
      last = res
    } finally {
      clearTimeout(timer)
    }
    await new Promise((r) => setTimeout(r, backoffMs(attempt, last?.headers.get('retry-after') ?? null)))
  }
  // 도달하지 않는다(마지막 시도에서 반환). 타입을 위해 남긴다.
  return last as Response
}
