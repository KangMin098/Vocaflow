// packages/library-pipeline/src/ingest-article/voa.ts
// ACP v1.0 Phase 18 — VOA Learning English article ingester
//
// VOA Learning English: 미국의 소리 (U.S. federal government) — Public Domain.
// CEFR 3단계 등급 콘텐츠 (Level 1/2/3) 제공 — 학습 친화적 짧은 뉴스/스크립트.
//
// RSS feed:
//   https://learningenglish.voanews.com/api/zrgoqe$omp     (As It Is, Level 2-3)
//   https://learningenglish.voanews.com/api/zptp_e-p_t     (Science & Technology)
//   https://learningenglish.voanews.com/api/zjroyeuvy_     (Words and Their Stories, Level 3)
//   ... (각 카테고리별 RSS — VOA 가 RSS URL 직접 제공)
//
// source_id 형식: 'voa:<article_id>' — URL 끝 숫자 id (`/a/…/7886988.html` → `7886988`).
//   ⚠️ 2026-09-07 이전에는 적재기가 슬러그 정규식으로 뽑으려다 `.html` 에 안 맞아
//      **249행 전부 base36 해시**(`voa:ewolkz`)로 들어갔다. 목록기는 `voa:7886988` 을
//      만들고 있었으므로 seed_catalog(30행)와 articles(249행)가 **한 건도 안 맞았고**,
//      그래서 중복 차단이 한 번도 작동하지 않았다. 이제 양쪽 다 `sourceKey()` 를 부른다.
// MVP 동작: RSS 1개 카테고리 fetch → item N 개 → 각 item URL → HTML → transcript 추출

import type { RawArticle } from '../types-article'
import { applyArticleCurationSpec, type ArticleScore } from './_curation-spec'
import { safeDate, safeDateISO } from './_helpers'
import { sourceKey } from './source-key'

// VOA WAF 는 비브라우저 UA (curl/bot) 를 403 차단 → 일반 브라우저 UA 로 fetch.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
const FETCH_TIMEOUT_MS = 15_000
const MAX_ITEMS_PER_FEED = 20

/** VOA RSS feed 목록 — 카테고리별. id 는 admin UI 에서 선택.
 *  v06.44 — VOA endpoint 변경 (2026-06-14 확인):
 *    옛 /api/{slug} 형식 → 'Invalid url' 반환 (deprecated).
 *    새 /rss/?count=N&zoneid={N} 패턴 표준.
 *  zoneid 매핑 (main page navigation auto-discover):
 *    3521 = As It Is · 987 = Words & Their Stories · 1579 = Science & Tech
 *    952 = Lessons of the Day (Anna 시리즈 — Let's Learn English 대체)
 *  P2 — register gap 보강 2종 (zoneid 라이브 검증):
 *    1581 = American Stories (서사/narrative) · 955 = Health & Lifestyle (설명문/expository)
 */
/**
 * VOA 피드 목록.
 *
 * ⚠️ **`level` 을 텍스트 난이도로 쓰지 말 것.** 2026-08-20 에 그렇게 썼다가 틀렸다.
 *
 * VOA 의 Level 은 **프로그램 편성 등급**(대상 청취자·말하기 속도)이고, 글의 읽기 난이도가
 * 아니다. 실측하면 오히려 **뒤집혀 있다**:
 *
 *   VOA 선언   편수   평균 CEFR 지수(0=A1)   평균 어수   평균 통사점수
 *   Level 2     47          2.38              701          61.1
 *   Level 3     20          1.85            1,166          57.6
 *
 * 더 어렵다고 선언한 Level 3 이 텍스트로는 더 쉽다. 이유는 `american-stories` 가
 * **원문이 아니라 학습자용 각색**이기 때문이다:
 *
 *   "Our story today is called "The Purloined Letter." It was written by Edgar Allan Poe.
 *    Poe is generally known for his horror stories. ... The story is about a stolen letter."
 *
 * 문장이 짧고 낱말이 흔하다. 어려운 것은 문장이 아니라 **문학·문화 배경지식**인데,
 * 그건 우리가 재는 축이 아니다.
 *
 * 한때 이 `level` 을 정답표 삼아 CEFR 추정을 교차검증하는 모듈을 만들었다가, 위 실측을
 * 보고 **철회했다**(오탐 6/6). 같은 것을 다시 만들지 말 것 — 두 축은 비교 가능한 눈금이 아니다.
 */
export const VOA_FEEDS: Array<{ id: string; label: string; level: 1 | 2 | 3; url: string }> = [
  {
    id: 'as-it-is',
    label: 'As It Is (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=3521',
  },
  {
    id: 'words-and-their-stories',
    label: 'Words and Their Stories (Level 3)',
    level: 3,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=987',
  },
  {
    id: 'science-technology',
    label: 'Science & Technology (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=1579',
  },
  {
    // ⚠️ 2026-08-20 정정 — `Level 1` 도 `Let's Learn English` 도 **틀린 라벨이었다.**
    //   z/952 는 그날의 학습 자료 모음("Lessons of the Day")이고 실제 내용은 일반 피처다:
    //     Study Shows How Earth's Orbit Affects Ice Ages · The Goodyear Blimp ·
    //     The Golden Gate Bridge · Methods for Protecting Earth against an Asteroid Strike
    //   초급 강좌인 줄 알고 `level: 1` 을 달아 뒀는데, 실측 CEFR 은 B1 7 · B2 5 다.
    //
    //   교차검증기(`crossCheckDeclaredLevel`)가 이 5편을 "Level 1 인데 B2" 로 잡아 냈고,
    //   확인해 보니 **틀린 쪽은 추정이 아니라 우리 라벨**이었다. 그게 교차검증의 값이다.
    //
    //   `id` 는 그대로 둔다 — DB 의 `feed_id` 13행이 이 값을 가리키고 있어서, 바꾸면
    //   연결이 끊어지고 register 도 같이 날아간다. 라벨과 레벨만 사실에 맞춘다.
    id: 'lets-learn-english',
    label: 'Lessons of the Day (종합 피처 · z/952)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=952',
  },
  // P2 — register gap 보강: 서사(American Stories) + 설명문(Health & Lifestyle).
  //   둘 다 frozen archive (FEED_SPECS frozen:true). zoneid 라이브 검증 완료.
  {
    id: 'american-stories',
    label: 'American Stories (Level 3) — 단편 서사',
    level: 3,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=1581',
  },
  {
    id: 'health-lifestyle',
    label: 'Health & Lifestyle (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=955',
  },
  // 아래 둘은 2026-08-19 프로브로 확정한 것이다(`scripts/acp/feed-probe.mjs`).
  //   VOA 는 z-코드가 곧 RSS 라 스크래핑이 필요 없다 — 병목이 없는 쪽이다.
  //   ⚠️ 같이 검토한 z/1574(Technology Report)는 **넣지 않았다.** HTTP 200 이지만
  //     항목이 0이다. 200 을 받았다고 살아 있는 피드가 아니다.
  {
    id: 'education',
    // 실측 적합 73.3% · 부적합 0% — 후보 19개 중 2위. 한국 학습자 소재로 가장 좋은 축이다.
    label: 'Education (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=959',
  },
  {
    id: 'arts-culture',
    // 실측 적합 40.0% · 부적합 0%. 주간 프로그램이라 신선도는 낮지만 소재가 안전하다.
    label: 'Arts & Culture (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=986',
  },

  // ── 2026-08-20 · `/radio/programs` 인덱스에서 발굴 ────────────────────
  // 그 인덱스에 z-코드가 **20개**인데 우리는 8개만 쓰고 있었다. VOA 는 본문을 그대로
  // 쓸 수 있는 유일한 소스이므로(PD), 안 쓰는 피드는 그대로 공급 손실이다.
  //
  // 12개를 두드려 **본문 어수까지 재고** 5개만 배선했다. 나머지는 근거를 남긴다:
  //   z/1689 Podcast              본문 없음(오디오 전용) — 3건 전부 ingest 실패
  //   z/4716 Everyday Grammar Video · z/3619 English in a Minute · z/3620 News Words
  //                               RSS 는 30건인데 큐레이션 필터 통과 0 — 설명이 너무 짧다
  //   z/4691 English @ the Movies 본문 184어 — 학습 지문으로 쓰기엔 얇다
  //   z/5091 America's Presidents 3건 중 2건 ingest 실패 — 안정되면 다시 본다
  //   z/1574 Technology Report    HTTP 200 인데 항목 0 (두 번 확인)
  {
    id: 'everyday-grammar',
    // 실측 본문 916·1164·798어 · 부적합 0%. 문법 설명문이라 소재가 안전하다.
    label: 'Everyday Grammar (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=4456',
  },
  {
    id: 'ask-a-teacher',
    // 학습자 질문에 답하는 코너 — 부적합 0%. 실측 본문 490어.
    label: 'Ask a Teacher (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=5535',
  },
  {
    id: 'education-tips',
    // 실측 적합 50.0% · 부적합 0% — 발굴분 중 적합률 1위. 본문 381~1,043어.
    label: 'Education Tips (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=7468',
  },
  {
    id: 'all-about-america',
    // 미국 생활·문화 — 부적합 0%. 본문 388~679어로 짧아 진입 밴드에 맞는다.
    label: 'All About America (Level 2)',
    level: 2,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=8133',
  },
  {
    id: 'us-history',
    // 역사 서사 — 본문 594~1,120어. 부적합 3.3%(전쟁 소재가 간간이 섞인다).
    label: 'U.S. History (Level 3)',
    level: 3,
    url: 'https://learningenglish.voanews.com/rss/?count=20&zoneid=979',
  },
]

// ═══════════════════════════════════════════════════════════════════════
// 사이트맵 경로 — **아카이브의 나머지 98.6% 로 가는 유일한 문.**
//
// RSS 는 `?count=` 한 방이고 **200 이 하드 천장**이다(그 위를 요청하면 오류가 아니라
// 기본값 20 으로 조용히 되돌아간다 — 실측 2026-09-07). 그래서 14 피드를 다 걷어도
// 이론 상한 2,800 · 실측 936 이고, 아카이브 67,316편의 **1.4%** 만 보인다.
//
// `robots.txt` 가 사이트맵을 스스로 광고하고, 같은 파일이 `/*?p=*`(목록 페이지네이션)와
// `/s?k=*`(검색)를 **금지**한다. 즉 사이트맵은 허용된 유일한 대량 경로다.
//
// ⚠️ 사이트맵은 **전수 열거**라 페이지 개념이 없다 — 2026-08-16 IA 사고(정렬 없는
//   페이지 넘김으로 214건 중복 + 동수 누락)가 구조적으로 불가능하다. 4 요청 · 1.4MB.
// ⚠️ UA 필수. 봇 UA 는 WAF 가 403 한다(`USER_AGENT` 상수를 그대로 쓴다).
// ═══════════════════════════════════════════════════════════════════════

/** 기사 URL 을 담은 사이트맵 4개(gzip). `videos`(8,364)·`sections`(126)는 지문이 아니다. */
export const VOA_ARTICLE_SITEMAPS: readonly string[] = [1, 2, 3, 4].map(
  (n) => `https://learningenglish.voanews.com/sitemap_428_${n}.xml.gz`,
)

export interface VoaSitemapEntry {
  /** 안정 식별자 붙은 열쇠 — `sourceKey('voa', …)` 와 **같은 함수**가 만든다 */
  source_id: string
  url: string
  /** `<lastmod>` — 표본에서 JSON-LD `datePublished` 와 일치했다 */
  lastmod: string | null
}

/**
 * 사이트맵 XML(압축 해제 후) → 항목. **gunzip 은 부르는 쪽 몫이다**
 * (이 패키지는 Next.js 앱도 import 하므로 `node:zlib` 를 들이지 않는다).
 *
 * 열쇠를 못 뽑는 `<url>` 은 **버리고 센다** — 해시로 채우면 그 쪽이 매 실행 새 글이 된다.
 */
export function parseVoaSitemapXml(xml: string): { entries: VoaSitemapEntry[]; skipped: number } {
  const entries: VoaSitemapEntry[] = []
  let skipped = 0
  const re = /<url>([\s\S]*?)<\/url>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const block = m[1]!
    const loc = extractTag(block, 'loc')
    if (!loc) continue
    const url = decodeEntities(loc).trim()
    let source_id: string
    try {
      source_id = sourceKey('voa', { url })
    } catch {
      skipped++
      continue
    }
    entries.push({ source_id, url, lastmod: extractTag(block, 'lastmod') ?? null })
  }
  return { entries, skipped }
}

/**
 * JSON-LD `articleSection` → 우리 `feed_id`.
 *
 * ⚠️ **`feed_id` 를 NULL 로 두면 안 된다.** `resolveArticleRegister(source, feed_id)` 가
 *   피드별 register 를 못 찾고 소스 기본값('news')으로 떨어진다 — 2026-08-20 에 37편이
 *   그렇게 들어갔다. 사이트맵 경로에는 RSS 가 없으므로 섹션명이 그 자리를 대신한다.
 *
 * 이미 배선된 RSS 피드와 **같은 id 로 모은다** — 코너가 같은데 id 가 갈리면 register 표와
 * 피드별 집계가 두 갈래가 된다. 표에 없는 코너는 슬러그로 만든다(`voaFeedIdForSection`).
 */
export const VOA_SECTION_TO_FEED: Readonly<Record<string, string>> = {
  'as it is': 'as-it-is',
  'science & technology': 'science-technology',
  'science and technology': 'science-technology',
  'words and their stories': 'words-and-their-stories',
  'lessons of the day': 'lets-learn-english',
  'american stories': 'american-stories',
  'health & lifestyle': 'health-lifestyle',
  education: 'education',
  'arts & culture': 'arts-culture',
  'everyday grammar': 'everyday-grammar',
  'ask a teacher': 'ask-a-teacher',
  'education tips': 'education-tips',
  'all about america': 'all-about-america',
  'u.s. history': 'us-history',
  'us history': 'us-history',
}

/**
 * 옛 아카이브(대략 2012년 이전)는 `articleSection` 이 **비어서 온다** — 그 시절 코너는
 * 제목 앞머리에 대문자로 붙어 있다:
 *
 *   `THIS IS AMERICA - February 11, 2002: VOA's 60th Anniversary`
 *   `PEOPLE IN AMERICA - March 17, 2002: Langston Hughes, Part Two`
 *   `IN THE NEWS - August 4, 2001: New FBI Director`
 *
 * ⚠️ 이걸 안 읽으면 옛 글이 전부 `voa-unsectioned` 로 들어가고, register 가
 *   소스 기본값 `news` 로 떨어진다 — **인물 전기가 시사 뉴스로 안내된다.**
 *   실측 2026-09-07: 첫 회차 적재분의 **36%** 가 그 자리였다.
 */
const VOA_TITLE_CORNER_RE = /^([A-Z][A-Z'&.\s]{3,40}?)\s*[-–—:]\s/

/** 코너를 정하는 정본 — 섹션이 먼저, 없으면 제목 앞머리. **절대 빈 값을 돌려주지 않는다.** */
export function voaFeedIdFor(section: string | null | undefined, title: string | null | undefined): string {
  const bySection = voaFeedIdForSection(section)
  if (bySection !== 'voa-unsectioned') return bySection
  const corner = (title ?? '').match(VOA_TITLE_CORNER_RE)?.[1]?.trim()
  return corner ? voaFeedIdForSection(corner) : 'voa-unsectioned'
}

/** 표에 없는 코너는 슬러그. 섹션이 비면 `voa-unsectioned`(NULL 로 두지 않는다). */
export function voaFeedIdForSection(section: string | null | undefined): string {
  const key = (section ?? '').trim().toLowerCase()
  if (!key) return 'voa-unsectioned'
  const mapped = VOA_SECTION_TO_FEED[key]
  if (mapped) return mapped
  const slug = key
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '')
  return slug || 'voa-unsectioned'
}

/**
 * 지문으로 쓸 수 없는 코너 — **정의·문법 설명을 나열하는 사전 항목**이다.
 *
 * 실측 판정(정찰 §7): `Words and Their Stories` 는 학습자 브랜드가 가장 뚜렷한데
 * **지문으로는 가장 못 쓴다**(관용구 정의 나열 → `reference`). 같은 결의 코너를 함께 뺀다.
 * ⚠️ 이것은 **난이도 판정이 아니다** — VOA 의 Level 축은 취득 불가이고 실측에서 뒤집혀 있었다.
 */
export function isVoaReferencePiece(feedId: string, title: string): boolean {
  if (VOA_REFERENCE_SECTIONS.includes(feedId)) return true
  // ⚠️ 옛 아카이브는 `articleSection` 이 코너가 아니라 `learningenglish` 로 뭉뚱그려 온다
  //   (실측: id 608067 「Words and Their Stories: In the Red」의 섹션이 `learningenglish`).
  //   섹션만 보면 사전 항목이 지문으로 들어온다 — 그 시절 코너는 **제목 앞머리**에 있다.
  const t = title.trim().toLowerCase()
  if (VOA_REFERENCE_TITLE_PREFIXES.some((p) => t.startsWith(p))) return true
  // 옛 아카이브의 코너는 제목 **가운데**에 오기도 한다:
  //   `November 4, 2001 - Slangman: Old Slang ('Little Red Riding Hood')` (속어 뜻풀이 나열).
  return VOA_REFERENCE_TITLE_MARKERS.some((p) => t.includes(p))
}

/** 제목 어디에 있어도 사전 항목으로 보는 표지. 앞머리 표기가 아닌 코너용. */
export const VOA_REFERENCE_TITLE_MARKERS: readonly string[] = ['slangman:', 'wordmaster:']

/** 옛 아카이브가 코너를 제목 앞에 붙이던 표기(`Words and Their Stories: …`). 소문자 비교. */
export const VOA_REFERENCE_TITLE_PREFIXES: readonly string[] = [
  'words and their stories',
  'everyday grammar',
  'ask a teacher',
  'english in a minute',
  'how to pronounce',
  'news words',
  'english @ the movies',
  "english at the movies",
]

export const VOA_REFERENCE_SECTIONS: readonly string[] = [
  'words-and-their-stories',
  'everyday-grammar',
  'ask-a-teacher',
  'english-in-a-minute',
  'how-to-pronounce',
  'news-words',
  'english-at-the-movies',
  // ⚠️ `lets-learn-english`(Lessons of the Day)는 **빼지 않는다.** 이름은 강좌처럼 보이지만
  //   실제 내용은 일반 피처다(실측 CEFR B1 7 · B2 5). 2026-08-20 에 이름만 보고 `level: 1`
  //   을 달았다가 틀린 자리이므로, 같은 실수를 배제 목록에서 반복하지 않는다.
]

/**
 * RSS feed 의 최근 article N개 가져오기 (메타만 — 본문은 별도 fetch).
 * v06.41 — 큐레이션 spec 적용: 필터 + score + sort + top N (_curation-spec.ts)
 */
export interface VoaListItem {
  source_id: string // voa:<guid>
  title: string
  url: string
  published_at: string | null
  description: string
  /** 학습 친화도 score (0~1) + breakdown — v06.41 큐레이션 spec */
  score?: ArticleScore
  /** v06.45 — audio 보유 여부 (LCP 연계). VOA Learning English 는 학습 정체성으로 100% true */
  has_audio?: boolean
}

/**
 * VOA RSS 는 창 크기가 **URL 파라미터**다 — `?count=N`.
 * 배선된 URL 은 전부 `count=20` 이라, 그 뒤가 있는데도 20편이 전부인 것처럼 보였다.
 * 실측 2026-08-30: `count=200` → item 200개(응답 200 OK). 상한은 우리가 정한 것이었다.
 */
export function voaFeedUrlWithCount(feedUrl: string, count: number): string {
  try {
    const u = new URL(feedUrl)
    if (!u.searchParams.has('count')) return feedUrl
    u.searchParams.set('count', String(count))
    return u.toString()
  } catch {
    return feedUrl
  }
}

/**
 * @param limit 이 피드에서 돌려받을 최대 편수. **예전에는 받아 놓고 버렸다**(`void _limit`).
 *   그래서 큐레이션 spec 의 `maxItems`(대개 15)가 언제나 최종 상한이었고, RSS 를
 *   `count=200` 으로 불러도 15편으로 잘렸다. 지금은 이 값이 실제 상한이 된다.
 *
 *   ⚠️ 기본값을 두지 않는다. `MAX_ITEMS_PER_FEED`(20)를 기본으로 넣으면 spec 의 15 보다
 *   커서 **아무도 요청하지 않은 동작 변화**가 생긴다. 생략하면 spec 그대로다.
 */
export async function listVoaFeed(
  feedUrl: string,
  feedId: string = 'as-it-is',
  limit?: number,
): Promise<VoaListItem[]> {
  const res = await fetchWithTimeout(feedUrl)
  if (!res.ok) {
    throw new Error(`VOA RSS fetch failed: ${res.status}`)
  }
  const xml = await res.text()
  const raw = parseRssItems(xml)
  // v06.45 — VOA Learning English 는 모두 audio 가 article HTML 에 존재 (학습 정체성).
  //          list 단계에서 RSS 만으로는 확정 불가하지만 has_audio=true 휴리스틱.
  const withAudio = raw.map((it) => ({ ...it, has_audio: true }))
  return applyArticleCurationSpec(withAudio, 'voa', feedId, { maxItems: limit })
}

/**
 * class 에 주어진 단어를 가진 첫 <div> 를 div 중첩을 세어 균형 있게 추출 (inner HTML).
 * 중첩 div(오디오 플레이어 등)로 시작하는 컨테이너를 non-greedy 정규식이 첫 `</div></div>`
 * 에서 잘라내던 문제 해결 — 매칭 div 의 진짜 짝을 찾아 컨테이너 전체를 반환.
 */
function extractDivByClass(html: string, className: string): string | null {
  const open = new RegExp(`<div[^>]*\\bclass="[^"]*\\b${className}\\b[^"]*"[^>]*>`, 'i').exec(html)
  if (!open) return null
  const start = open.index + open[0].length
  const tagRe = /<\/?div\b[^>]*>/gi
  tagRe.lastIndex = start
  let depth = 1
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(html)) !== null) {
    if (m[0].startsWith('</')) {
      depth -= 1
      if (depth === 0) return html.slice(start, m.index)
    } else {
      depth += 1
    }
  }
  return html.slice(start) // 짝 없으면 끝까지 (안전 폴백)
}

/**
 * 기사 쪽의 JSON-LD(`<script type="application/ld+json">`) — **VOA 메타의 정본.**
 *
 * ⚠️ 왜 정본인가 (실측 2026-09-07): `<meta>` 쪽은 두 군데가 틀려 있었고 **둘 다 조용했다.**
 *   ① `article:published_time` 메타는 **아예 없다**(28개 메타 전수 확인).
 *   ② `og:title` 은 있지만 속성 순서가 `content` 먼저다 —
 *      `<meta content="…" property="og:title">`. `property` 를 먼저 요구한 정규식은 안 맞는다.
 *   JSON-LD 는 `headline`·`datePublished`·`articleSection` 을 기사마다 정확히 준다.
 */
export function voaJsonLd(html: string): Record<string, unknown> | null {
  const re = /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    let parsed: unknown
    try {
      parsed = JSON.parse(m[1]!)
    } catch {
      continue
    }
    const candidates = Array.isArray(parsed) ? parsed : [parsed]
    for (const c of candidates) {
      if (c && typeof c === 'object' && ('headline' in c || 'datePublished' in c)) {
        return c as Record<string, unknown>
      }
    }
  }
  return null
}

function ldString(ld: Record<string, unknown> | null, key: string): string | undefined {
  const v = ld?.[key]
  return typeof v === 'string' && v.trim() ? v.trim() : undefined
}

/** JSON-LD `author` — 문자열이거나 `{name}` 객체이거나 그 배열이다. */
export function voaAuthorName(ld: Record<string, unknown> | null): string | undefined {
  const raw = ld?.author
  const first = Array.isArray(raw) ? raw[0] : raw
  if (typeof first === 'string') return first.trim() || undefined
  if (first && typeof first === 'object' && typeof (first as { name?: unknown }).name === 'string') {
    return ((first as { name: string }).name).trim() || undefined
  }
  return undefined
}

/**
 * `<meta>` 를 **속성 순서에 상관없이** 읽는다.
 *
 * VOA 는 `content` 를 먼저 쓴다. 순서를 고정한 정규식은 오류를 내지 않고 그냥 안 맞으므로,
 * 뒤에 놓인 폴백이 조용히 일을 하게 된다 — 그게 발행일 236행 NULL 의 경로였다.
 */
function metaContent(html: string, key: string): string | undefined {
  const re = /<meta\b([^>]*)>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const attrs = m[1]!
    const name = attrs.match(/\b(?:property|name)\s*=\s*"([^"]*)"/i)?.[1]
    if (name?.toLowerCase() !== key.toLowerCase()) continue
    const content = attrs.match(/\bcontent\s*=\s*"([^"]*)"/i)?.[1]
    if (content) return content
  }
  return undefined
}

/** 적재기가 돌려주는 한 벌 — 본문(RawArticle) + 분류 축(`articleSection`). */
export interface VoaParsedArticle {
  article: RawArticle
  /**
   * JSON-LD `articleSection` — **난이도가 아니라 문종·소재 축**이다.
   * (VOA 의 Level 1/2/3 은 취득 불가이며, 실측에서 뒤집혀 있었다. 위 `VOA_FEEDS` 주석 참조.)
   */
  articleSection: string | null
}

/**
 * 단일 VOA article fetch — RawArticle 반환 (ACP 파이프라인 입력).
 */
export async function ingestVoaArticle(itemUrl: string, hintLevel?: 1 | 2 | 3): Promise<RawArticle> {
  return (await fetchVoaArticle(itemUrl, hintLevel)).article
}

/** `ingestVoaArticle` 과 같은 일 + `articleSection` 을 함께 돌려준다(사이트맵 수확기용). */
export async function fetchVoaArticle(
  itemUrl: string,
  hintLevel?: 1 | 2 | 3,
): Promise<VoaParsedArticle> {
  const res = await fetchWithTimeout(itemUrl, { Accept: 'text/html' })
  if (!res.ok) throw new Error(`VOA article fetch failed: ${res.status} ${itemUrl}`)
  return parseVoaArticle(await res.text(), itemUrl, hintLevel)
}

/**
 * 이미 받아 둔 HTML 에서 기사를 뽑는다 — **네트워크를 타지 않는다.**
 *
 * 사이트맵 수확기는 쪽을 한 번만 받아 여기에 넘긴다(두 번 받으면 3만 쪽에 대해
 * 남의 서버를 두 배로 친다). 회귀도 고정 HTML 로 이 함수를 직접 부른다.
 */
export function parseVoaArticle(
  html: string,
  itemUrl: string,
  hintLevel?: 1 | 2 | 3,
): VoaParsedArticle {
  const ld = voaJsonLd(html)

  // 정본은 JSON-LD. 메타·<title> 은 폴백이다(그 반대로 두었던 것이 이번에 고친 결함).
  const title =
    ldString(ld, 'headline') ??
    ldString(ld, 'name') ??
    metaContent(html, 'og:title') ??
    metaContent(html, 'title') ??
    html.match(/<title>([^<]+?)(?:\s*\|\s*VOA)?<\/title>/i)?.[1] ??
    '(제목 미상)'

  const publishedAt =
    ldString(ld, 'datePublished') ??
    metaContent(html, 'article:published_time') ??
    // ⚠️ `<time datetime>` 값은 엔티티가 살아 있다(`2019-06-30T22:02:29&#x2B;00:00`).
    //   그대로 `new Date()` 에 넣으면 Invalid Date 다 — 236행이 그렇게 NULL 이 됐다.
    decodeEntities(html.match(/<time[^>]*datetime="([^"]+)"/i)?.[1] ?? '')

  const articleSection = ldString(ld, 'articleSection') ?? null

  // VOA 본문: <div class="wsw"> 컨테이너를 div 중첩 균형으로 추출.
  //   wsw 가 오디오 플레이어 div 로 시작해서, 기존 non-greedy `</div></div>` 정규식은
  //   첫 블록(~100자)에서 끊겨 본문(transcript) 22개 단락을 통째로 놓쳤음 → "too short" 오발.
  //   균형 추출 후 <p> transcript 우선(플레이어/캡션 잡음 배제), 빈약하면 컨테이너 전체.
  // wsw 컨테이너가 있어야 transcript 기사. <article>/whole-html 폴백은 클립(transcript 없는
  //   오디오/비디오)에서 nav·footer chrome 을 본문으로 긁으므로 쓰지 않음 — 없으면 reject.
  const containerHtml = extractDivByClass(html, 'wsw')
  if (!containerHtml) {
    throw new Error('VOA article has no transcript body (no wsw container — audio/video clip?)')
  }
  const paraText = htmlToPlainText(
    [...containerHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => m[1] ?? '').join('\n'),
  )
  const content = (paraText.trim().length >= 200 ? paraText : htmlToPlainText(containerHtml))
    .replace(/no media source currently available\.?/gi, '') // VOA 오디오 플레이어 boilerplate
    .replace(/[ \t ]+/g, ' ')
    .trim()

  if (content.length < 200) {
    throw new Error(`VOA article body too short: ${content.length} chars`)
  }

  // source_id — **목록기와 같은 함수**. 여기서 유도 못 하면 던진다(해시 대체 없음):
  //   해시는 오류 없이 통과한 뒤 중복 검사를 영구 무력화한다. 못 넣는 편이 싸다.
  const sourceId = sourceKey('voa', { url: itemUrl })

  // v06.45 — audio_url 추출 (LCP librivox_audio 와 동일 연계 패턴):
  //   VOA Learning English = 학습 정체성으로 거의 100% audio (transcript + voice).
  //   우선순위: <audio src="..."> → voa-audio.voanews.eu/*.mp3 → 일반 mp3.
  const audioUrl =
    html.match(/<audio[^>]+src="(https?:[^"]+\.mp3[^"]*)"/i)?.[1] ??
    html.match(/(https?:\/\/voa-audio\.voanews\.eu\/[^\s<>"']+\.mp3[^\s<>"']*)/i)?.[1] ??
    html.match(/(https?:[^\s<>"']+\.mp3[^\s<>"']*)/i)?.[1] ??
    null

  return {
    article: {
      source: 'voa',
      source_id: sourceId,
      source_url: itemUrl,
      title: decodeEntities(title).trim(),
      // JSON-LD 의 author 는 객체(`{"@type":"Person","name":"…"}`)다. 이름만 꺼낸다.
      //   ⚠️ 통신사 혼입 판별에 쓰는 값이므로 없는 것을 있는 것처럼 만들지 않는다 —
      //     `VOA Learning English` 상수 폴백은 값이 아예 없을 때만이다.
      author: voaAuthorName(ld) ?? 'VOA Learning English',
      language: 'en',
      license: 'PD-Government',
      published_at: safeDate(publishedAt),
      content,
      estimated_cefr: hintLevel ? VOA_LEVEL_TO_CEFR[hintLevel] : null,
      audio_url: audioUrl,
      fetched_at: new Date(),
    },
    articleSection: articleSection ? decodeEntities(articleSection).trim() : null,
  }
}

const VOA_LEVEL_TO_CEFR: Record<1 | 2 | 3, string> = {
  1: 'A2',
  2: 'B1',
  3: 'B2',
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function parseRssItems(xml: string): VoaListItem[] {
  const items: VoaListItem[] = []
  /** 안정 식별자를 못 뽑아 버린 item. **0 이 아니면 판형이 바뀐 것이다** — 조용히 넘기지 않는다. */
  let skippedNoId = 0
  const itemRe = /<item\b[^>]*>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null) {
    const block = m[1]!
    const title = extractTag(block, 'title')
    const link = extractTag(block, 'link')
    const guid = extractTag(block, 'guid')
    const pubDate = extractTag(block, 'pubDate')
    const desc = extractTag(block, 'description')

    if (!link) continue
    // 열쇠는 **적재기와 같은 함수**가 만든다(`sourceKey`). 예전에는 여기와 적재기가
    //   서로 다른 정규식을 들고 있었고, 둘이 갈린 것을 아무도 몰랐다.
    // 유도 못 하는 item 은 **버리고 센다** — 해시로 채우면 그 item 이 매 실행 새 글이 된다.
    let sourceId: string
    try {
      sourceId = sourceKey('voa', { url: link.trim(), guid })
    } catch {
      skippedNoId++
      continue
    }
    items.push({
      source_id: sourceId,
      title: decodeEntities(title ?? '(제목 없음)').trim(),
      url: link.trim(),
      published_at: safeDateISO(pubDate),
      description: decodeEntities(stripTags(desc ?? '')).trim().slice(0, 400),
    })
  }
  if (skippedNoId > 0) {
    console.warn(
      `[voa] article id 를 못 읽어 ${skippedNoId}건을 버렸다 — URL 판형(/a/…/<숫자>.html)이 바뀌었는지 볼 것`,
    )
  }
  return items
}

function extractTag(block: string, tag: string): string | undefined {
  // CDATA 와 일반 텍스트 모두 지원
  const re = new RegExp(`<${tag}>\\s*(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))\\s*</${tag}>`, 'i')
  const m = block.match(re)
  return (m?.[1] ?? m?.[2])?.trim()
}

// `extractFirst` 는 2026-09-07 에 지웠다 — 유일한 호출처가 「순서 고정 메타 정규식 목록」
//   이었고, 그 목록의 첫 두 줄이 실제 HTML 과 안 맞아 **폴백이 조용히 일을 하고 있었다.**
//   지금은 JSON-LD 가 정본이고 메타는 `metaContent()` 가 속성 순서와 무관하게 읽는다.

// `slugFromGuid` · `hashString` 은 2026-09-07 에 지웠다 — **되살리지 말 것.**
//   이 둘이 열쇠의 대체 경로였고, 그 대체가 249행을 base36 해시로 만들어 중복 검사를
//   영구 무력화했다. 열쇠는 `sourceKey('voa', …)` 한 곳에서만 만든다.

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, '')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    // hex 수치 엔티티(&#x27; 등) — _helpers.ts decodeEntities 와 동일(로컬 중복, v06.208 hex 보강)
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
}

function htmlToPlainText(html: string): string {
  let s = html
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '')
  s = s.replace(/<figure\b[\s\S]*?<\/figure>/gi, '\n')
  s = s.replace(/<aside\b[\s\S]*?<\/aside>/gi, '\n')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(?:p|h[1-6]|li|tr|div|section|article)>/gi, '\n')
  s = s.replace(/<h([1-6])[^>]*>/gi, '\n\n')
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]+/g, ' ').trim()
}

async function fetchWithTimeout(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'application/rss+xml, application/xml, text/xml, text/html',
        ...extraHeaders,
      },
    })
  } finally {
    clearTimeout(timer)
  }
}
