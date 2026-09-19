// apps/web/src/lib/library/media-form.ts
//
// 매체 형식(media form) 축 — "이건 어떤 **종류의 인쇄물**인가".
//
// ── 왜 필요한가 (실측 2026-08-17) ────────────────────────────────────
// 도서는 표지 이미지를 갖는다(`library_books.cover_url` 401건). 그런데 그 밖의 자료는
// **이모지 한 글자**가 정체성을 전부 담당하고 있었다(`source-map.ts` 의 🔊 📖 🔬 📰 🗣 📊 📚).
// `library_articles` 162건에는 이미지 컬럼이 아예 없고, `texts` 277건도 없다.
// 그래서 학습자 화면에서 신문 기사·매거진 에세이·백과 항목·대본이 **전부 같은 색 사각형**으로 보였다.
//
// ── 왜 일러스트가 아니라 활자·괘선인가 (조사 근거) ──────────────────
// 편집 디자인에서 매체 정체성은 그림이 아니라 **활자 규약과 괘선**이 만든다.
//   · The Guardian 디자인 시스템(Source): 색은 저널리즘 **섹션(pillar)** 축으로 쓰고,
//     매체감은 서체 역할 분리(Titlepiece 브랜드 / Headline / Text Egyptian 본문)와
//     rules·borders 로 만든다.
//   · 시나리오(screenplay)는 **프로토콜**이다 — 12pt Courier 고정폭, `INT./EXT. 장소 - DAY`
//     슬러그라인, 중앙 정렬 대문자 인물명. 형식 자체가 한눈에 "대본" 으로 읽힌다.
//   · 신문은 제호(nameplate)·단 괘선(column rules)·발행지 표기(dateline)가 문법이다.
// 결론: 유형별 **그림 자산을 만들지 않는다**(401+162+277+969건에 아트를 붙일 수 없다).
// 각 매체의 실제 조판 문법을 절차적으로 재현한다 — 자산 0, 유형 식별은 즉각.
//
// ── 왜 학습 트랙과 별도 축인가 ──────────────────────────────────────
// `source-map.ts` 의 `TrackKey`(listen/easy/topic/news/argue/data/reference)는 **학습 목적**
// 묶음이다. 매체 형식은 **출판물 종류**다. 상관은 있지만 같지 않다 —
// `topic` 한 트랙에 기관 보도자료(NASA)와 학술지(eLife/PLOS)가 함께 들어 있고,
// 둘은 읽는 법이 다르다. 색은 트랙 액센트 토큰을 그대로 재사용해 팔레트를 늘리지 않는다.
//
// ── 접근성 (BBC GEL 패턴) ───────────────────────────────────────────
// GEL 은 매체 표시를 이미지 영역 안에 두면서 `aria-hidden="true"` 로 가리고,
// **제목 뒤에 시각적으로 숨긴 텍스트**로 같은 정보를 준다(제목보다 먼저 읽히면 안 되므로).
// 여기서도 같은 규칙을 따른다 — `mediaFormSrLabel()` 이 그 문장을 만든다.
// CLAUDE.md "색상만으로 정보 전달 금지" 도 이것으로 함께 지켜진다(형태 + 라벨 + 텍스트 대안).

/** 매체 형식. 실제 보유 데이터에서 도출했다 — 콘텐츠가 0건인 형식은 만들지 않는다. */
export type MediaForm =
  | 'script' // 대본 — texts (사용자·큐레이션 스크립트)
  | 'newspaper' // 신문 기사 — register='news'
  | 'magazine' // 매거진 에세이·해설 — the_conversation, owid
  | 'journal' // 학술지 — plos, elife
  | 'reference' // 백과·연감 — simple_wikipedia, wikipedia, factbook, wikivoyage
  | 'bulletin' // 기관 보도자료 — nasa, usgs, noaa, nih
  | 'lesson' // 방송 어학 강의(음성 동반) — voa
  | 'book' // 도서 — library_books (표지 이미지가 우선)
  | 'comic' // 만화 — pd_comic_issues (표지 이미지가 우선)

export interface MediaFormSpec {
  form: MediaForm
  /** 화면 라벨 (짧게 — 카드 위 칩) */
  label: string
  /** 스크린리더 문장에 쓰는 명사 */
  srNoun: string
  /** 액센트 CSS 변수 — 트랙 토큰 재사용(새 색 추가 금지) */
  accent: string
  /** 이 형식의 조판 문법 한 줄 — 표지 렌더러가 무엇을 그리는지의 근거 */
  grammar: string
}

/**
 * 형식별 명세. `accent` 는 전부 기존 `--track-*` 토큰이라 다크모드가 이미 뒤집혀 있다
 * (globals.css 에서 테마별로 재정의 — 라이트 원색은 다크에서 2.8~3.2:1 로 미달이라).
 */
export const MEDIA_FORMS: Record<MediaForm, MediaFormSpec> = {
  script: {
    form: 'script',
    label: '대본',
    srNoun: '대본',
    accent: 'var(--track-topic)',
    grammar: '고정폭 슬러그라인(INT./EXT. · 장소 · DAY) + 중앙 정렬 대문자 인물명',
  },
  newspaper: {
    form: 'newspaper',
    label: '신문',
    srNoun: '신문 기사',
    accent: 'var(--track-news)',
    grammar: '제호 괘선 + 다단 칼럼 괘선 + 발행지 표기(dateline)',
  },
  magazine: {
    form: 'magazine',
    label: '매거진',
    srNoun: '매거진 기사',
    accent: 'var(--track-argue)',
    grammar: '대형 디스플레이 이니셜 + 도련 띠(bleed band) + 하단 폴리오',
  },
  journal: {
    form: 'journal',
    label: '학술지',
    srNoun: '학술 논문',
    accent: 'var(--track-data)',
    grammar: '초록 괘선 + 도판 캡션 격자',
  },
  reference: {
    form: 'reference',
    label: '백과',
    srNoun: '백과 항목',
    accent: 'var(--track-easy)',
    grammar: '색인 탭 + 표제어 행 + 도판 자리',
  },
  bulletin: {
    form: 'bulletin',
    label: '기관 발표',
    srNoun: '기관 보도자료',
    accent: 'var(--track-reference)',
    grammar: '기관 인장 링 + 릴리스 날짜줄',
  },
  lesson: {
    form: 'lesson',
    label: '어학 강의',
    srNoun: '음성 어학 강의',
    accent: 'var(--track-listen)',
    grammar: '파형 바 + 재생 눈금',
  },
  book: {
    form: 'book',
    label: '도서',
    srNoun: '도서',
    accent: 'var(--p)',
    grammar: '표지 이미지 우선 — 없으면 제목 해시 그라디언트(book-cover.ts)',
  },
  comic: {
    form: 'comic',
    label: '만화',
    srNoun: '만화',
    accent: 'var(--track-topic)',
    grammar: '표지 이미지 우선 — 없으면 컷 격자',
  },
}

/** 소스 → 형식. `register` 가 형식을 뒤집는 경우가 있어(아래) 단독으로 쓰지 않는다. */
const SOURCE_FORM: Record<string, MediaForm> = {
  voa: 'lesson',
  simple_wikipedia: 'reference',
  wikipedia: 'reference',
  factbook: 'reference',
  wikivoyage: 'reference',
  the_conversation: 'magazine',
  owid: 'magazine',
  plos: 'journal',
  elife: 'journal',
  nasa: 'bulletin',
  usgs: 'bulletin',
  noaa: 'bulletin',
  nih: 'bulletin',
  wikinews: 'newspaper',
  original: 'magazine',
}

export interface ResolveInput {
  /** 어느 테이블에서 왔는가 — 도서·만화는 표지 이미지가 우선이라 먼저 갈린다. */
  kind?: 'book' | 'comic' | 'text' | 'article'
  source?: string | null
  /** library_articles.register — 'news' 는 소스와 무관하게 신문 조판으로 읽힌다. */
  register?: string | null
  /** 음성이 딸린 글은 강의 형식으로 본다(듣기 자산이 있으면 읽는 법이 달라진다). */
  hasAudio?: boolean
}

/**
 * 형식 판정. **순서가 규칙이다** — 위에서 확정되면 아래는 보지 않는다.
 *
 * `register='news'` 를 소스보다 먼저 보는 이유: 같은 소스가 해설과 단신을 함께 낸다
 * (실측 — VOA 는 'As It Is'(news) 와 'Words and Their Stories'(expository) 를 같이 준다).
 * 소스로만 판정하면 단신이 어학 강의 표지를 달고 나온다.
 */
export function resolveMediaForm(input: ResolveInput): MediaForm {
  if (input.kind === 'book') return 'book'
  if (input.kind === 'comic') return 'comic'
  if (input.kind === 'text') return 'script'
  if (input.register === 'news') return 'newspaper'
  const bySource = input.source ? SOURCE_FORM[input.source] : undefined
  if (bySource) return bySource
  // 소스를 모를 때 음성 유무가 남은 단서다.
  if (input.hasAudio) return 'lesson'
  // 최후 기본값은 'magazine' — 가장 중립적인 산문 조판이라 오인 비용이 가장 작다
  // (백과/학술지 표지를 잘못 달면 "사전인가?" 로 읽혀 기대가 어긋난다).
  return 'magazine'
}

export function mediaFormSpec(form: MediaForm): MediaFormSpec {
  return MEDIA_FORMS[form]
}

/**
 * 소스 묶음(학습 트랙)의 **대표 형식**. 트랙은 형식을 섞을 수 있다 —
 * `topic` 한 트랙에 기관 보도자료(NASA·USGS·NOAA)와 학술지(eLife·PLOS)가 함께 있다.
 * 최빈값을 쓰고, 동수면 `sources` 순서가 앞선 것을 택한다(입력 순서가 결정적이라 표지가 흔들리지 않는다).
 */
export function dominantMediaForm(sources: readonly string[]): MediaForm {
  const tally = new Map<MediaForm, number>()
  for (const s of sources) {
    const f = SOURCE_FORM[s]
    if (f) tally.set(f, (tally.get(f) ?? 0) + 1)
  }
  if (tally.size === 0) return 'magazine'
  let best: MediaForm = 'magazine'
  let bestN = -1
  // 동수 처리를 입력 순서에 묶기 위해 sources 를 다시 훑는다(Map 삽입 순서 의존을 피한다).
  for (const s of sources) {
    const f = SOURCE_FORM[s]
    if (!f) continue
    const n = tally.get(f) ?? 0
    if (n > bestN) {
      best = f
      bestN = n
    }
  }
  return best
}

/**
 * 제목 뒤에 붙일 스크린리더 문장 (BBC GEL 패턴).
 * 시각 표시는 `aria-hidden` 이므로 **이 문장이 유일한 텍스트 대안**이다 — 비우면 안 된다.
 */
export function mediaFormSrLabel(form: MediaForm, extra?: { readingMinutes?: number | null }): string {
  const noun = MEDIA_FORMS[form].srNoun
  const m = extra?.readingMinutes
  return m && m > 0 ? `${noun}, 읽는 시간 약 ${m}분` : noun
}
