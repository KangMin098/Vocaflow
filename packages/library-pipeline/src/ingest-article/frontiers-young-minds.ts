// packages/library-pipeline/src/ingest-article/frontiers-young-minds.ts
//
// **Frontiers for Young Minds — 8~15세 대상 심사받는 과학지.** CC BY 4.0.
//
// ── 왜 이 소스인가 ───────────────────────────────────────────────────
// 학년 칸 재고를 재면 **중3 칸만 비어 있다**(실측 2026-09-05):
//
//     초3~4 40 · 초5~6 86 · 초6~중1 185 · 중1~2 130 · **중3 13**
//
// 그리고 채워진 칸들의 **시중 자리가 14.9~34.3** 이다 — 시중 지문 분포에서 아래쪽,
// 즉 **시중보다 쉬운 글만 모여 있다.** FrYM 은 둘을 함께 겨냥한다:
// 실측 FK 중앙 10.55(중3) · 심사물이라 어휘 밀도가 높다.
// 재고 기여도 실측(2026-09-07): **V≤4 재고의 7.2%** 가 frym 한 소스에서 나온다
// (발행 가능 119편 중 96편이 V≤4 · 전체 코퍼스는 V≤4 가 6.3%뿐).
//
// ── 메타는 Crossref · 본문은 `/full` ─────────────────────────────────
// 제목·DOI·발행일·라이선스는 Crossref 에서, **`content` 만** 글 페이지에서 받는다.
//   목록: https://api.crossref.org/journals/2296-6846/works  (ISSN 2296-6846)
//   본문: https://kids.frontiersin.org/articles/<DOI>/full   ← DOI 리다이렉트 종착
// ⚠️ `www.frontiersin.org/journals/young-minds/...` 는 **404** 다. `/xml/nlm`·`/pdf` 도 404 —
//   **`/full` 만 200** 이다(실측 8/8). 서버 렌더 HTML 이라 JS 실행이 필요 없다.
// source_id: "frym:<DOI>"
//
// ── ⚠️ 「본문을 가져오지 않는다」던 결정을 뒤집는다 (2026-09-07) ──────
// **그때 적혀 있던 것**(지우지 않고 남긴다 — 되돌리지 않게 하려고):
//
//   > ⚠️ **본문(full text)을 가져오지 않는다.** 초록만으로 지문이 되고, 본문은 훨씬 길어
//   >   발췌가 필요하며 그림·표 참조가 문장 안에 박혀 있다("Figure 1 shows…").
//   >   지문에 그림 참조가 남으면 학습자가 없는 그림을 찾는다.
//   >   ── 초록이 곧 지문 단위다: 이 학술지는 어린이 독자용이라 초록이 **완결된 한 편**으로
//   >   쓰인다("Have you ever followed a recipe…"). 그래서 발췌가 필요 없다(실측 132~152어).
//
// **왜 그렇게 정했나** — `scripts/textbook/kid-source-probe.mjs` 가 이 소스를 채택할 때
// **초록만 보고** 판단했다. 그 파일 스스로 「본문 길이는 재 봐야 안다」고 적어 두었는데
// 그 재기가 한 번도 일어나지 않았고, 세 전제(① 초록이 완결됐다 ② 본문은 발췌가 필요하다
// ③ 그림 참조가 문장에 박혀 있다)가 **측정 없이 결정으로 굳었다.**
//
// **무엇이 바뀌어 뒤집나** — 셋을 실제로 쟀다:
//
//   ① 초록은 완결되지 않는다. 적재된 **153편 전량이 98~165어**인데 그중 51%가
//      "In this article, we will explain…" 로 **예고하고 끝난다**. 2026-09-06 판정에서
//      **34편이 `fragmentary` 로 반려**됐다(전체 반려율 9.6% 대비 frym 22.2%).
//      **잘라내기로는 못 고친다** — 끝 문장을 지워도 창(100~200어)을 지키는 것은 34편 중 10편뿐.
//      반려된 6편의 전문을 읽어 보니 **6/6 모두 논지가 스스로 닫힌다.** 예고문은 초록에만 있다.
//   ② 본문은 편당 **1,163~2,118어**(실측 8편: 본문만 966~1,692어). 발췌가 필요한 것은 맞지만
//      그 발췌기(`textbook/excerpt.ts`)는 이미 있고, 100~200어 창이 편당 **7~13개** 나온다.
//      즉 ②는 「할 수 없다」가 아니라 「한 단계 더 있다」였다.
//   ③ 그림 참조는 **문장에 박혀 있지 않았다.** 실측 8편 31건 중 **30건이 괄호**
//      (`( Figure 1 )` · `( Figure 1A )`)이고, 캡션("Figure 1 - …")은 `<figure>`/`<figcaption>`
//      안에 있어 **구조로** 지워진다. 아래 §그림 참조 참고.
//
// ── 그림 참조를 어떻게 다루나 (본문에서 지운다 · 발췌 단계에 넘기지 않는다) ──
// 판단 기준은 지침 그대로 **「그림 없이도 문장이 성립하는가」**이고, 그 답이 마크업에 있다:
//
//   **괄호 참조는 성립한다.** "…go to different parts of the body ( Figure 1A )." 에서
//   괄호만 떼면 문장이 그대로 남는다. 괄호는 정의상 곁가지라 떼도 주어·서술어가 온전하다.
//   → **괄호만 지운다.**
//
//   **그림이 문장의 성분이면 성립하지 않는다.** "See Figure 1A to find your nearest forest:
//   X marks the spot!" 은 그림을 빼면 남는 것이 없다.
//   → 괄호를 먼저 지운 **뒤에도** 이름이 남아 있는 문장만 통째로 지운다.
//
// 순서가 중요하다. 문장 단위로 먼저 지우면 본문이 6~9% 날아가지만(앞선 조사 실측),
// 괄호를 먼저 지우면 문장 삭제는 **8편에서 1건**뿐이고 총 손실이 **0.73%**다
// (11,046 → 10,965어 · 잔존 참조 0). 발췌 단계에 넘기지 않는 이유는 그쪽이 문단 경계로만
// 자르기 때문이다 — 괄호는 문단 안에 있어 어느 창을 떼어도 따라온다.
//
// ── 초록은 `content` 에 넣지 않는다 ──────────────────────────────────
// `/full` 페이지의 맨 앞 `<div class="abstract">` 는 뒤따르는 본문의 **요약이자 예고**다.
// 두 가지 이유로 뺀다: ① 위 ①의 예고문이 바로 이 덩어리다 — 남기면 첫 발췌창이 다시
// `fragmentary` 가 된다. ② 본문과 겹쳐 어수를 부풀린다(PLOS 에서 같은 중복이 400편 중
// 393편, `word_count` 평균 6.2% 과대였다 — `plos-abstract-duplication.test.ts`).
// 초록은 목록의 `description` 으로 계속 쓴다 — 버리는 게 아니라 자리를 옮기는 것이다.
//
// ── 라이선스는 Crossref 가 글마다 준다 ───────────────────────────────
// `license[].URL` 에 `creativecommons.org/licenses/by/4.0` 이 들어온다.
// ⚠️ **"이 학술지는 CC BY 다" 로 뭉뚱그리지 않는다** — 글마다 확인하고,
//   못 읽으면 넣지 않는다. 같은 학술지에도 다른 라이선스가 섞일 수 있다.
//   (`/full` 페이지 본문에도 `creativecommons.org/licenses/by/4.0` 표기가 있지만
//    **판단 근거로 쓰지 않는다** — 페이지 문구는 학술지 공통 상용구일 수 있고,
//    글 단위 사실은 Crossref 쪽이다.)

import type { RawArticle } from '../types-article'

import { fetchWithTimeout, htmlToPlainText } from './_helpers'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'

const CROSSREF = 'https://api.crossref.org/journals/2296-6846/works'

/** 본문 페이지. DOI 를 그대로 붙인다(슬래시 포함 — 인코딩하면 404 다). */
const FULLTEXT_BASE = 'https://kids.frontiersin.org/articles'

/**
 * 피드 = 정렬 축. Crossref 는 `rows` 를 한 번에 100까지 준다 — 그 이상은 `offset`.
 * 학술지가 1,977편이라 한 번에 다 받지 않는다.
 */
export const FRYM_FEEDS: Array<{ id: string; label: string; sort: string }> = [
  { id: 'recent', label: 'Frontiers for Young Minds — 최신', sort: 'published' },
  {
    id: 'cited',
    label: 'Frontiers for Young Minds — 많이 인용된 순',
    sort: 'is-referenced-by-count',
  },
]

export interface FrymListItem {
  source_id: string
  title: string
  url: string
  published_at: string | null
  description: string
  /** 글마다 확인한 라이선스 URL. **못 읽으면 null** — 뭉뚱그리지 않는다. */
  licenseUrl: string | null
  score?: ArticleScore
}

const PER_PAGE = 100

/**
 * Crossref 초록은 JATS 조각으로 온다 — `<jats:p>` 같은 태그가 섞여 있다.
 * 태그를 지우고 엔티티를 되돌린다.
 *
 * **`content` 가 아니라 목록의 `description` 에 쓴다**(§초록은 `content` 에 넣지 않는다).
 */
export function frymAbstractText(abstract: string | null | undefined): string {
  return String(abstract ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, d: string) => String.fromCharCode(parseInt(d, 16)))
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** CC 라이선스 URL 만 고른다. 없으면 null — **짐작해서 붙이지 않는다.** */
export function frymLicenseUrl(license: Array<{ URL?: string }> | undefined): string | null {
  return (license ?? []).map((l) => l.URL).find((u) => u && /creativecommons\.org/.test(u)) ?? null
}

/** CC 라이선스 URL → 우리 표기. 모르는 꼴이면 null. */
export function frymLicenseCode(url: string | null): string | null {
  if (!url) return null
  const m = url.match(/creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i)
  if (!m) return null
  return `CC-${m[1]!.toUpperCase()}-${m[2]}`
}

interface CrossrefWork {
  DOI?: string
  title?: string[]
  URL?: string
  abstract?: string
  license?: Array<{ URL?: string }>
  published?: { 'date-parts'?: number[][] }
}

/** Crossref `date-parts` → ISO 날짜. 부분 날짜(연도만)도 받는다. */
export function frymPublishedAt(published: CrossrefWork['published']): string | null {
  const p = published?.['date-parts']?.[0]
  if (!p?.length) return null
  const [y, m = 1, d = 1] = p
  if (!y) return null
  const dt = new Date(Date.UTC(y, m - 1, d))
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString()
}

/** DOI → 본문 주소. **`/full` 만 200 이다**(§머리말). */
export function frymFullUrl(doi: string): string {
  return `${FULLTEXT_BASE}/${doi}/full`
}

/**
 * 균형 잡힌 `<div>` 잘라내기 — 여는 태그 위치에서 시작해 depth 0 이 되는 곳까지.
 *
 * ⚠️ **`indexOf('</div>')` 로 자르면 안 된다** — 본문 컨테이너 안에 `<div class="abstract">`
 *   같은 자식 div 가 있어 첫 닫는 태그는 자식의 것이다. 그렇게 자르면 초록만 남고
 *   본문이 통째로 사라진다(= 지금 고치려는 그 결함이 다른 얼굴로 돌아온다).
 */
function sliceBalancedDiv(html: string, openIndex: number): string | null {
  if (openIndex < 0) return null
  const tagRe = /<\/?div\b[^>]*>/gi
  tagRe.lastIndex = openIndex
  let depth = 0
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0][1] === '/') depth--
    else depth++
    if (depth === 0) return html.slice(openIndex, m.index + m[0].length)
  }
  return null
}

/**
 * `/full` 페이지에서 본문 컨테이너(`class="… fulltext-content"`)만 떼어 낸다.
 * 못 찾으면 null — **페이지 전체로 물러서지 않는다.** 그러면 머리글·관련 기사·
 * 심사위원 명단이 지문이 된다.
 */
export function frymFullTextContainer(html: string): string | null {
  const i = html.search(/<div[^>]*class="[^"]*\bfulltext-content\b[^"]*"[^>]*>/i)
  return sliceBalancedDiv(html, i)
}

/**
 * 지문이 아닌 후미. **첫 번째로 만나는 것에서 끊는다** — 순서가 글마다 다르기 때문이다
 * (실측: Glossary 가 Conflict of Interest 앞인 편도, `Acknowledgments` 가 그 사이에
 * 끼는 편도 있다). 뒤에서 찾아 지우면 사이에 낀 것을 놓친다.
 *
 * `AI Tool Statement` 는 2025년부터 붙기 시작한 상용구다 — 목록에 없으면
 * "The author(s) declared that Generative AI was not used…" 가 지문 끝에 남는다.
 */
const BACK_MATTER =
  /^(?:conflicts?\s+of\s+interests?|acknowledge?ments?|references?|original\s+source\s+article|glossary|ai\s+tool\s+statement|author\s+contributions?|funding|supplementary\s+materials?|additional\s+information|further\s+reading)$/i

/** 제목 텍스트만 남긴다 — 안쪽 `<a>`·`<strong>` 과 엔티티를 걷어낸다. */
function headingLabel(inner: string): string {
  return inner
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[#a-z0-9]{1,8};/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 후미 절단. 자를 것이 없으면 원본 그대로 — **조용히 비우지 않는다.** */
export function frymCutBackMatter(containerHtml: string): string {
  const headRe = /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi
  let m: RegExpExecArray | null
  while ((m = headRe.exec(containerHtml)) !== null) {
    if (BACK_MATTER.test(headingLabel(m[2]!))) return containerHtml.slice(0, m.index)
  }
  // 소제목이 없는 판형에 대비한 두 번째 자물쇠 — 참고문헌 블록은 id 로도 붙어 있다.
  return containerHtml.replace(/<section[^>]*id="full-text-references"[\s\S]*$/i, '')
}

/**
 * 맨 앞 초록 블록 제거(§초록은 `content` 에 넣지 않는다).
 * 없으면 원본 그대로 — 판형이 바뀌어 초록이 사라져도 본문은 남아야 한다.
 */
export function frymDropAbstractBlock(containerHtml: string): string {
  const i = containerHtml.search(/<div[^>]*class="[^"]*\babstract\b[^"]*"[^>]*>/i)
  const block = sliceBalancedDiv(containerHtml, i)
  if (!block) return containerHtml
  return `${containerHtml.slice(0, i)}\n${containerHtml.slice(i + block.length)}`
}

/**
 * 괄호 그림 참조. `( Figure 1 )` · `(Figure 1A)` · `(Figures 1, 2)` · `(see Figure 3)`.
 * 앞의 공백까지 먹어야 "body ." 처럼 마침표 앞이 벌어지지 않는다.
 */
const FIGURE_PAREN =
  /[ \t]*\(\s*(?:see\s+)?Figures?\s*\d+[A-Za-z]?(?:\s*(?:,|and|&|–|-|to)\s*(?:Figures?\s*)?\d*[A-Za-z]?)*\s*\)/gi

/**
 * 다른 글로 보내는 괄호. "(See this young minds article)" — 학습자가 따라갈 수 없는 링크라
 * 그림 참조와 같은 종류다. **괄호 안이 통째로 안내문이고 `article` 로 끝날 때만** 지운다
 * (실측 8편 중 1편에 4건 · 좁게 잡아 본문 문장을 건드리지 않는다).
 */
const XREF_PAREN =
  /[ \t]*\(\s*(?:see|check\s+out|find\s+out\s+more\s+in|for\s+more\s+info,?\s+check\s+out|read\s+more\s+in|learn\s+more\s+in)\b[^)]{0,70}\barticles?\s*\)/gi

/** 이름이 붙은 그림 참조인가. `figure out`·`figures it out` 같은 동사는 걸리지 않는다. */
const FIGURE_NAMED = /\bFigures?\s*\d/i

/**
 * 그림 참조 제거 — **괄호 먼저, 그다음 남은 문장**(§그림 참조를 어떻게 다루나).
 * 순서를 뒤집으면 멀쩡한 문장이 함께 날아간다.
 */
export function frymStripFigureRefs(text: string): string {
  const withoutParens = text.replace(FIGURE_PAREN, '').replace(XREF_PAREN, '')
  return withoutParens
    .split('\n')
    .map((line) => {
      if (!FIGURE_NAMED.test(line)) return line
      // 괄호를 걷어낸 뒤에도 이름이 남았다 = 그림이 문장의 성분이다 → 그 문장만 버린다.
      const sentences = line.split(/(?<=[.!?])\s+/)
      return sentences.filter((s) => !FIGURE_NAMED.test(s)).join(' ')
    })
    .join('\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * `/full` 페이지 HTML → 지문 산문.
 *
 * 컨테이너를 못 찾으면 **빈 문자열**을 돌려준다 — 호출부가 「본문을 못 읽었다」로
 * 판단하게 두는 편이, 페이지 전체를 지문으로 삼는 것보다 낫다.
 */
export function frymFullTextContent(html: string): string {
  const container = frymFullTextContainer(html)
  if (!container) return ''
  const body = frymDropAbstractBlock(frymCutBackMatter(container))
  // 인용 표시 `[1]` `[2,3]` — 태그가 안에 끼어 있어 **평문화 전에** 지운다(PLOS 와 같은 자리).
  // ⚠️ **앞의 공백까지 먹는다.** 안 그러면 "…friends and family [7]!" 이 "family !" 로 남는다 —
  //   FrYM 은 인용 표시를 문장 끝 구두점 **바로 앞**에 두기 때문에 이 자국이 편마다 생긴다.
  // ⚠️ 여러 편을 한 괄호에 묶은 `[1, 3]` 은 **번호 사이에도 태그가 낀다**
  //   (`[<a>1</a>, <span id="ref3a"><a>3</a></span>]` — 실측). 태그를 건너뛰지 않는
  //   좁은 규칙은 이런 것만 남겨 두고, 남은 자국은 지문에서 「[1, 3]」으로 보인다.
  const withoutCitations = body.replace(
    /[ \t]*\[(?=[^\]]*\d)(?:<[^>]+>|[\s\d,;–—-])*\]/g,
    ''
  )
  // `htmlToPlainText` 가 `<figure>`·`<figcaption>` 을 구조로 걷어낸다 —
  //   "Figure 1 - A vampire bat runs on a treadmill…" 캡션이 여기서 사라진다.
  return frymStripFigureRefs(htmlToPlainText(withoutCitations))
}

/** 어수. `readability` 와 같은 세는 법. */
function countWords(t: string): number {
  return (t.match(/[A-Za-z][A-Za-z'-]*/g) || []).length
}

/**
 * 본문이 이보다 짧으면 「받았다」고 하지 않는다.
 *
 * 실측 본문(초록·후미 제외)이 **966~1,692어**라 400 은 한참 아래다. 판형이 바뀌어
 * 컨테이너가 초록만 남기는 날이 오면 여기서 걸려야 한다 — **짧은 값을 넣으면
 * 다음 수확이 그것을 「완료」로 세어 구멍이 영영 남는다.**
 */
const FULLTEXT_MIN_WORDS = 400

export async function listFrymFeed(feedId = 'recent', limit?: number): Promise<FrymListItem[]> {
  const feed = FRYM_FEEDS.find((f) => f.id === feedId)
  if (!feed) {
    throw new Error(
      `FrYM 피드 '${feedId}' 를 모른다. 쓸 수 있는 것: ${FRYM_FEEDS.map((f) => f.id).join(' · ')}`
    )
  }
  const want = limit ?? PER_PAGE
  const items: FrymListItem[] = []

  for (let offset = 0; items.length < want && offset < 2_000; offset += PER_PAGE) {
    const url =
      `${CROSSREF}?rows=${Math.min(want, PER_PAGE)}&offset=${offset}` +
      `&sort=${feed.sort}&order=desc&select=DOI,title,license,URL,abstract,published`
    // ⚠️ **Accept 를 명시해야 한다.** `fetchWithTimeout` 의 기본값이
    //   `application/rss+xml, …` 이라 Crossref 가 **406** 을 돌려준다(실측).
    //   같은 주소를 curl 은 받아 오는데 그건 curl 이 `*/*` 을 보내기 때문이다.
    const res = await fetchWithTimeout(url, { accept: 'application/json' })
    if (!res.ok) {
      if (items.length) break
      throw new Error(`FrYM Crossref list failed: ${res.status}`)
    }
    const json = (await res.json()) as { message?: { items?: CrossrefWork[] } }
    const got = json.message?.items ?? []
    if (!got.length) break

    for (const w of got) {
      if (!w.DOI) continue
      // 초록은 이제 지문이 아니라 **고르기 위한 설명**이다. 그래도 없으면 거른다 —
      // 초록조차 없는 항목은 정정문·사설 같은 비기사이기 쉽다(큐레이션이 이 값으로 채점한다).
      const abstract = frymAbstractText(w.abstract)
      if (!abstract) continue
      items.push({
        source_id: `frym:${w.DOI}`,
        title: (w.title ?? [])[0]?.replace(/\s+/g, ' ').trim() || '(제목 미상)',
        url: w.URL ?? `https://doi.org/${w.DOI}`,
        published_at: frymPublishedAt(w.published),
        description: abstract.slice(0, 300),
        licenseUrl: frymLicenseUrl(w.license),
      })
    }
  }

  return applyArticleCurationSpec(items.slice(0, want), 'frym', feedId, { maxItems: limit })
}

/**
 * DOI 로 한 편을 받는다. **메타는 Crossref · 본문은 `/full`**(§머리말).
 *
 * ⚠️ 목록에서 이미 메타를 받았지만 여기서 다시 받는다 — 적재 경로가 목록을 거치지 않고
 *   URL 하나로 불릴 수 있고(라우트의 `enqueue`), 그때도 같은 결과가 나와야 한다.
 *
 * ⚠️ **초록으로 물러서지 않는다.** 본문을 못 읽으면 던진다. 물러서면 지금 고치는 그 행
 *   (98~165어 예고문)이 조용히 다시 만들어지고, 다음 수확이 그것을 「이미 있음」으로 센다.
 *   못 받은 편은 세어서 말하는 편이 낫다 — 실측 8/8 성공이라 흔한 길도 아니다.
 */
export async function ingestFrymArticle(itemUrl: string): Promise<RawArticle> {
  const doi = itemUrl.match(/10\.3389\/frym\.[\d.]+/i)?.[0]
  if (!doi) throw new Error(`FrYM URL 에서 DOI 를 못 읽었다: ${itemUrl}`)

  const res = await fetchWithTimeout(
    // ⚠️ 단건 조회에는 `select` 를 붙이지 않는다 — **목록 전용 파라미터**라
    //   `/works/<doi>?select=…` 은 **400** 을 돌려준다(실측 8건 전부).
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { accept: 'application/json' }
  )
  if (!res.ok) throw new Error(`FrYM Crossref fetch failed: ${res.status} ${doi}`)
  const w = ((await res.json()) as { message?: CrossrefWork }).message
  if (!w) throw new Error(`FrYM Crossref 응답이 비었다: ${doi}`)

  const licenseUrl = frymLicenseUrl(w.license)
  const code = frymLicenseCode(licenseUrl)
  if (!code) {
    // **모르는 것을 허용으로 바꾸지 않는다.** 학술지 단위로 뭉뚱그리면 예외를 못 본다.
    throw new Error(`FrYM 라이선스를 글에서 확인하지 못했다: ${doi}`)
  }

  // 라이선스를 확인한 **뒤에** 본문을 받는다 — 쓸 수 없는 글을 받으러 가지 않는다.
  const fullUrl = frymFullUrl(doi)
  const page = await fetchWithTimeout(fullUrl, { accept: 'text/html' })
  if (!page.ok) throw new Error(`FrYM 본문 GET 실패: ${page.status} ${fullUrl}`)
  const content = frymFullTextContent(await page.text())
  const words = countWords(content)
  if (words < FULLTEXT_MIN_WORDS) {
    throw new Error(
      `FrYM 본문이 너무 짧다: ${words}어 (최소 ${FULLTEXT_MIN_WORDS}) ${doi} — ` +
        `판형이 바뀌었는지 ${fullUrl} 를 확인할 것`
    )
  }

  return {
    source: 'frym',
    source_id: `frym:${w.DOI ?? doi}`,
    // **사람이 읽는 주소는 본문 주소다.** Crossref 의 `URL` 은 doi.org 리다이렉트라
    //   출처 표기에서 한 번 더 튕긴다. 리다이렉트 종착을 그대로 적는다.
    source_url: fullUrl,
    title: (w.title ?? [])[0]?.replace(/\s+/g, ' ').trim() || '(제목 미상)',
    author: 'Frontiers for Young Minds',
    language: 'en',
    license: code,
    published_at: frymPublishedAt(w.published) ? new Date(frymPublishedAt(w.published)!) : null,
    content,
    // 8~15세 대상이지만 심사물이라 등급이 붙어 있지 않다 — analyze 가 판정한다.
    estimated_cefr: null,
    fetched_at: new Date(),
  }
}
