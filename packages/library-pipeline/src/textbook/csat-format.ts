// packages/library-pipeline/src/textbook/csat-format.ts
//
// **DCP 문항을 수능 인쇄 형식으로 바꾼다.** 저장 형식도 학습 화면도 건드리지 않는다.
//
// ── 왜 변환인가 ──────────────────────────────────────────────────────
// DCP 의 저장 형식(`presented` · `remaining`)은 화면(`DcpItems.tsx`)과 채점
// RPC(`grade_dcp_item`)의 계약이다. 교재를 위해 그 스키마를 바꾸면 이미 돌고 있는
// 구문 연습이 깨진다. **같은 재료를 다르게 인쇄하면 된다.**
//
// ── 수능 실제 형식 ───────────────────────────────────────────────────
//
//   글의 순서   도입문이 주어지고 (A)(B)(C) 세 덩어리를 배열한다.
//               답지는 5개 — (A)-(B)-(C) 원순서는 빠진다(그게 답이면 문제가 안 된다).
//
//   문장 삽입   지문 문장 사이 ①~⑤ 다섯 자리 중 하나를 고른다.
//               ①은 **첫 문장 뒤**다 — 글 맨 앞에 넣는 선택지는 없다.
//
// ── 삽입은 6문장 문단에서만 정확히 맞는다 ────────────────────────────
// DCP 는 문단에서 문장 1개를 빼는데, 뺄 수 있는 위치가 1..n-1 이다(첫 문장은 도입이라
// 안 뺀다). n=6 이면 남은 5문장 뒤에 자리가 5곳 생기고 제거 위치 1~5 가 ①~⑤ 에 그대로
// 대응한다. **n=4·5 는 자리가 3·4곳이라 수능 형식이 아니다** — 교재에서는 뺀다.
//
//   실측(2026-08-21): 적격 문단 379개 중 4문장 160 · 5문장 122 · **6문장 97**.
//
// ⚠️ 이 제약을 지키지 않으면 자리 수가 문항마다 달라지고, 학습자는 실전에서 만나는
//   ①~⑤ 대신 ①~③ 을 연습하게 된다. 형식이 다르면 연습 효과가 반감된다.

/**
 * 학술 인용 잔해 — 교재 지문에 그대로 인쇄되면 안 되는 흔적.
 *
 * ── 실측 2026-08-21 ─────────────────────────────────────────────────
 * 문항 758개 중 **64개(8.4%)** 에 이런 잔해가 있었고 **전부 PLOS**(논문)였다.
 * 실물:
 *
 *     [넣을 문장] [] trained the model using a sample set and 71 features
 *
 * `[]` 는 논문의 `[12]` 같은 인용 번호에서 링크 텍스트만 사라진 자국이다(62건).
 * 나머지는 `[3]` 형태(2건)와 연도 괄호다.
 *
 * ⚠️ **어휘 난이도로는 논문을 못 가른다.** 고난도 어휘(V9+·미등재) 비율을 재 봤더니
 *   plos 13.6%(최소 8.4) 인데 wikipedia 23.5% · nasa 9.9% · usgs 8.7% 로 **분포가 겹친다.**
 *   지표를 세우려다 실측으로 기각했다. 확실히 잡히는 것은 이 패턴 하나뿐이다.
 */
const CITATION_RESIDUE = /\[\s*\]|\[\s*\d+\s*[,\-–]?\s*\d*\s*\]/

/**
 * **지문의 낱말 수 — 정의는 하나뿐이어야 한다.**
 *
 * 시장 창(`market-spec.json` 의 `passageWords` p10~p90)은 코퍼스에서
 * `/[A-Za-z][A-Za-z'-]*​/g` 로 세어 만들었다. 그 창으로 문항을 거르는 쪽도 **같은 자**로
 * 세야 한다 — 아니면 창은 A 로 그어 놓고 B 로 재는 셈이다.
 *
 * ⚠️ 실제로 그랬다 (실측 2026-09-01). 조합기(`volume-pool.mjs`)는 `split(/\s+/)` 로,
 *   벤치마크와 코퍼스는 이 정의로 세고 있었다. 두 값은 **양방향으로** 어긋난다:
 *
 *     `U.S. Supreme`   공백 2 · 낱말 3   (마침표가 낱말을 가른다)
 *     `125 tons`       공백 2 · 낱말 1   (숫자는 낱말이 아니다)
 *
 *   그래서 조합기가 "188어라 창(90~188) 안" 이라고 통과시킨 지문이 시장 자로는 194어였고,
 *   A6 미달 6건이 전부 그렇게 1~6어씩 넘긴 것들이었다. 규격을 어긴 것이 아니라
 *   **다른 자로 잰 것**이다.
 */
export function countPassageWords(text: string): number {
  return (String(text ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
}

/** 인용 잔해가 있으면 교재에 실을 수 없다. */
export function hasCitationResidue(text: string): boolean {
  return CITATION_RESIDUE.test(text)
}

/**
 * 산문이 아닌 자국 — 교재 지문으로 실을 수 없는 것.
 *
 * ── 실측 2026-08-21 ─────────────────────────────────────────────────
 * 어법 문항 표본을 눈으로 보다 발견했다. VOA Learning English 기사 끝에는 **용어풀이**가
 * 본문과 같은 문단으로 붙어 있다:
 *
 *     _____________________________________________________ stimulate – v.
 *     to make (something) more active implant – n.
 *
 * `generate-items.ts` 의 DCP 는 이런 보일러플레이트를 오래전부터 걸렀는데,
 * 나중에 만든 유형들(흐름무관·어휘·어법)이 그 필터를 안 물려받았다. 규칙이 한 파일에만
 * 있으면 다음에 만드는 사람이 또 빠뜨린다 — 그래서 인쇄 가능 판정을 여기 모은다.
 */
const NON_PROSE = /_{4,}|[–—-]\s*(?:v|n|adj|adv|prep|conj|pron)\.\s/i

/**
 * **논문의 뼈대** — 산문이 아니라 학술지의 서식이 그대로 남은 것.
 *
 * ── 실측 2026-09-06 ─────────────────────────────────────────────────
 * V7 드레인 몫을 손으로 채우다 **뽑은 것의 절반을 버렸다.** 눈으로 거르고 있었다는 뜻이다.
 * 재고를 세어 보니 상위 밴드는 대부분이 논문 초록이었다 — `Citation: ` 줄을 가진 원글이
 * **V6 11,831편 중 10,577(89%) · V7 2,531편 중 2,474(98%)**.
 *
 * 창 자르기가 대개 그 줄을 피하지만 늘 그렇지는 않다. 이미 만들어진 문항 중에도
 * 이런 것이 남아 있었다(지문을 가진 문항 기준):
 *
 *   구조 초록 표제어   V7 13/94 (13.8%) · V6 9/137 · V5 2/201
 *   `Abstract` 표제어  V7 20/94 (21.3%) · V6 14/137 · V5 이하 0
 *   통계 잔해          V7 13/94 (13.8%) · V6 5/137
 *
 * 실물: `Objective This study aimed to comprehensively analyze differentially expressed
 * genes (DEGs) …` · `Aims We aimed to assess a) whether using the digital intervention …`
 *
 * ⚠️ **오탐을 먼저 쟀다.** 학술 소스가 없는 V2~V4 지문 653개에 이 규칙을 걸어 **0건**이
 *   걸렸다. 표제어는 문장이 시작하는 자리에서만 보고(문장 안의 "the results showed" 는
 *   걸리지 않는다), 통계는 학술 서식에만 쓰이는 꼴만 본다.
 *
 * ── 기각한 지표: 약어 밀도 (실측 2026-09-06) ────────────────────────
 * 서식은 걸러도 **약어가 빽빽한 지문**(`blaNDM-1` · `MALDI-TOF-MS` · `XDR-Ab` · `NANPDB`)은
 * 그대로 통과한다. 약어스러운 토큰의 비율로 가를 수 있을 것 같아 지문 1,088개를 재 봤다:
 *
 *   V2 중앙 0.000 · p90 0.010 · **최대 0.175**      ← 상위 밴드보다 높다
 *   V7 중앙 0.026 · p90 0.102 · 최대 0.133
 *
 * 어느 문턱에서도 오탐이 0 이 아니었고(0.08 에서 5/653), 걸린 것이 전부 **멀쩡한 글**이었다 —
 * 지하철 차량명(`R160`·`R179`), 방송사(`NBC`·`HBO`), 짧은 동물 이야기. 반대로 문턱 위
 * 상위 밴드에는 **교재로 쓸 만한 글**이 섞여 있었다(`PrP lowering is effective against
 * prion disease …` 0.095 — 그날 실제로 문항으로 쓴 지문이다).
 *
 * 차이는 밀도가 아니라 **약어의 종류**다. `NBC` 는 누구나 알고 `blaNDM-1` 은 아니다.
 * 밀도로는 그 둘이 같아 보인다. 그래서 넣지 않는다 — 같은 이유로 어휘 난이도 지표도
 * 위에서 한 번 기각했다(§CITATION_RESIDUE 주석). **지표를 세우려다 실측으로 두 번 기각했다.**
 */
const ACADEMIC_APPARATUS = [
  // 논문 서지 — `Citation: Ma Z, Wu P, … PLoS One 21(3): e0340496.`
  /\bCitation:\s/,
  // 구조 초록 표제어가 문장 자리에 그대로 남은 것 — `Objective To evaluate …`
  /(?:^|\.\s)(?:Abstract|Objectives?|Methods?|Results?|Conclusions?|Backgrounds?|Findings?|Aims?)\s+[A-Z]/,
  // 통계 서식 — 신뢰구간·유의확률·회귀식·로그 단위
  /95\s*%\s*CI|\bP\s*[<=>]\s*0\.|\bp\s*[<=>]\s*0\.0|\by\s*=\s*\d*\.?\d+\s*x\b|\blg\s+IU\/mL/,
] as const

/** 논문 서식이 남아 있는가 — 남아 있으면 교재 지문으로 인쇄할 수 없다. */
export function hasAcademicApparatus(text: string): boolean {
  const s = String(text ?? '')
  return ACADEMIC_APPARATUS.some((re) => re.test(s))
}

/**
 * **기사 껍데기** — 본문이 아니라 웹 기사에 붙어 오는 것.
 *
 * ── 실측 2026-08-30 ─────────────────────────────────────────────────
 * 빈칸 드레인 청크(8편)를 직접 채우다 **3편이 문항이 안 되는 것**을 발견했다. 그래서
 * V5 대기열 전체를 재 봤다 — 창을 통과한 3,215편 중 `isPrintablePassage` 는 98.6%를
 * 통과시키는데, 실제로는 이런 것들이 그대로 들어와 있었다:
 *
 *   날짜 도장        160편 (5.0%)  "Aug 03, 2026"
 *   읽기시간 머리말   143편 (4.4%)  "5 Min Read"
 *   Q&A 표지        108편 (3.4%)  "Q What is lenacapavir … A Lenacapavir is …"
 *   크레딧            48편 (1.5%)  "Credits: NASA"
 *   캡션 나열         10편 (0.3%)  "Close Meeting a Crucial Need"
 *
 * 용어풀이(VOA)를 막은 것과 **같은 종류의 자국**이다 — 그때도 "표본을 눈으로 보다
 * 발견" 했고, 이번에도 그랬다. 규칙을 여기 모아 두는 이유가 그것이다.
 *
 * ⚠️ 본문에 정상적으로 나올 수 있는 표현은 넣지 않았다. 예컨대 `Q4`(분기)나
 *   문장 안의 `credit` 은 걸리지 않는다 — 대문자 라벨 꼴만 본다.
 *
 * ── 날짜 규칙 정정 2026-08-30 ────────────────────────────────────────
 * 처음 쓴 날짜 규칙은 **우연히** 동작하고 있었다. 온전한 달 이름 중 세 글자인 것은
 * `May` 뿐이라(`Apr\b` 는 "April" 에 안 걸린다), 학술지 앞장을 잡아낸 것은 그 앞장에
 * **5월 날짜가 우연히 있었을 때뿐**이었다. 그래서 규칙이 두 방향으로 다 틀려 있었다:
 *
 *   넓게 틀림 — 산문 속 날짜를 껍데기로 셌다
 *                "the May 18, 1980, eruption of Mount St. Helens" · 인물 생몰년
 *   좁게 틀림 — 5월이 없는 학술지 앞장을 통째로 놓쳤다
 *                "Received: December 17, 2024; Accepted: November 18, 2025"
 *
 * 원글 24,738편으로 옛 규칙과 새 규칙을 대조했다(다른 규칙이 이미 잡는 것은 빼고 —
 * 그것들은 판정이 갈리지 않는다): **새로 잡는 것 14,603편**(표본 전부 PLOS 앞장) ·
 * **놓아 주는 것 37편**(표본 전부 정상 산문). 그래서 날짜 자체가 아니라 **앞장 라벨**을
 * 본다. 약어 꼴 날짜 도장은 그대로 두되 `May` 만 뺐다 — 약어인지 온전한 달 이름인지
 * 구별할 수 없고, 구별 못 하는 것을 근거로 지문을 버리면 안 된다.
 */
const ARTICLE_CHROME = [
  /\b\d+\s*Min\s*Read\b/i,                                    // 읽기시간 머리말
  /\bCredits?:\s/i,                                            // 크레딧 라벨
  /\bImage credit\b|\bPhoto:\s/i,
  /\b(?:Received|Accepted|Submitted|Revised|Published)\s*:\s*[A-Z][a-z]+\s+\d{1,2},\s*\d{4}\b/, // 학술지 앞장
  /\bCopyright:\s*©/,                                          // 학술지 저작권 라벨
  /\b(?:Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept?|Oct|Nov|Dec)\s+\d{1,2},\s*\d{4}\b/, // 약어 날짜 도장 (May 제외)
  /(?:^|\s)Q\s+(?:What|How|Why|When|Who|Where)\b/,             // Q&A 표지
  /\b(?:Close|Read More|Share|Download|Print)\b\s+[A-Z]/,      // 캡션·버튼 나열
]

/** 기사 껍데기 자국이 있는가. */
export function hasArticleChrome(text: string): boolean {
  return ARTICLE_CHROME.some((re) => re.test(text))
}

/** 용어풀이·구분선 같은 비산문 자국이 있는가. */
/**
 * 학술 논문의 **절 이름 줄**. 원문에서는 자기 줄에 홀로 서 있다.
 *
 *     Abstract
 *     The coexistence of diverse microbial communities…
 *
 * 문장으로 자른 뒤 공백으로 다시 이으면 이렇게 붙는다:
 *
 *     "Abstract The coexistence of diverse microbial communities…"
 *
 * 실측 2026-08-31 — 절 이름이 붙은 문항 **28,652개**(V6 20,050 · V7 5,700 · V5 2,881).
 * 학술 소스가 없는 1~4단은 0이다.
 */
const SECTION_LABELS = [
  'Abstract', 'Introduction', 'Background', 'Methods', 'Method',
  'Materials and Methods', 'Results', 'Discussion', 'Conclusions', 'Conclusion',
  'Objectives', 'Objective', 'Aims', 'Aim', 'Findings', 'Significance',
  'Summary', 'Highlights', 'Keywords',
]

// ⚠️ **버리지 않고 지운다.** 절 이름이 있다고 지문을 버리면 상위 밴드 재고가 통째로 날아간다
//   (같은 규칙으로 원글을 거르면 24,738편 중 18,225편이 걸린다 — 실측).
//
// ⚠️ **문장을 여는 자리에서만** 지운다. 앞이 글 머리이거나 문장 끝 부호여야 하고,
//   뒤는 대문자로 시작하는 낱말이어야 한다. 그래서 "the Introduction Section" 처럼
//   문장 안에 든 낱말은 건드리지 않고, "Results were mixed" 도 뒤가 소문자라 남는다.
const SECTION_LABEL_RE = new RegExp(
  `(^|[.!?]\\s+)(?:${SECTION_LABELS.join('|')})\\s+(?=[A-Z])`,
  'g',
)

/** 홀로 선 절 이름을 떼어 낸다. 지문 자체는 그대로 남는다. */
export function stripSectionLabels(text: string): string {
  const s = String(text ?? '')
  if (!s) return s
  // 연달아 붙은 경우가 있다 — "Abstract Background The importance…".
  let out = s
  for (let i = 0; i < 3; i += 1) {
    const next = out.replace(SECTION_LABEL_RE, '$1')
    if (next === out) break
    out = next
  }
  return out.trim()
}


/**
 * 원문 뒤에 **글머리가 통째로 다시 붙어 있는 것**을 떼어 낸다.
 *
 * 학술 소스 수집기가 초록을 본문 앞과 뒤에 두 번 담는다. 순환 없는 측정(2026-08-31):
 * 원글 3,000편 표본 중 **1,048편(34.9%)** 이 첫 200자를 본문 뒤에서 그대로 반복한다.
 * 그 구간에서 자른 지문은 학습자가 **같은 문단을 두 번 읽게** 된다 —
 * V7 조판 지문 54개 중 7개(13%)가 그랬다.
 *
 * ⚠️ **꼬리가 글머리의 반복일 때만** 자른다. 자를 자리 뒤의 글이 이 지문의 **접두사와
 *   글자 그대로 같아야** 한다(`text.startsWith(tail)`). 새 내용이 이어지면 손대지 않는다 —
 *   "비슷해 보인다" 로 자르면 멀쩡한 뒷문단이 사라지고, 그건 조판물에서 안 보인다.
 */
export function dropRepeatedTail(text: string): string {
  const s = String(text ?? '').trim()
  if (s.length < 300) return s
  // 첫 문장을 자른다 — 너무 짧으면 우연히 겹치고, 너무 길면 못 찾는다.
  const m = /^[\s\S]{40,400}?[.!?](?=\s|$)/.exec(s)
  if (!m) return s
  const head = m[0]
  const idx = s.indexOf(head, head.length)
  if (idx <= 0) return s
  const tail = s.slice(idx).trim()
  if (!tail || !s.startsWith(tail)) return s
  return s.slice(0, idx).trim()
}


/**
 * 인쇄물의 **따옴표 모양을 한쪽으로 맞춘다.**
 *
 * 삼교 규칙 `apostrophe_style` 은 한 지문 안에 굽은 것과 곧은 것이 섞이면 걸린다.
 * 수집한 원문이 출처마다 달라 실제로 섞인다 — 실측 2026-08-31 V3 한 권에서 44지문 중
 * **6지문**이 이 이유로 걸렸다. 시중 교재는 한 권 안에서 모양이 흔들리지 않는다.
 *
 * ⚠️ 저장은 건드리지 않는다. 인쇄에 쓰는 사본에만 건다 — 그리고 **지문과 선택지에
 *   똑같이** 걸어야 한다. 한쪽만 바꾸면 `implication`(밑줄 구절)·`long_vocab`(바뀐 낱말)이
 *   지문에서 자기 구절을 못 찾아 문항이 성립하지 않는다.
 */
export function normalizeQuotes(text: string): string {
  // ⚠️ **곧은 아포스트로피만 바꾼다.** 처음에 큰따옴표까지 한쪽으로 모았더니
  //   `”quote”` 가 되어 오히려 틀린 조판이 됐다(여는 따옴표가 사라진다). 여는/닫는
  //   짝을 옳게 만들려면 문맥을 봐야 하는데, 그건 이 규칙이 요구하는 바가 아니다 —
  //   삼교가 잡는 것은 **한 지문 안에서 두 모양이 섞이는 것**이고, 곧은 것을 굽은 쪽으로
  //   맞추면 그 섞임이 사라진다. 이미 옳게 짝지은 `‘…’` 는 건드리지 않는다.
  return String(text ?? '').replace(/'/g, '’')
}

/**
 * **큰따옴표가 섞였을 때만** 곧은 것을 굽은 짝으로 바꾼다.
 *
 * 위 `normalizeQuotes` 가 아포스트로피만 건드리는 이유는 여는/닫는 짝을 모르면
 * `”quote”` 가 되기 때문이다. 하지만 **짝수 개면 짝을 안다** — 순서대로 여닫으면 된다.
 *
 * 걸리는 조건을 좁게 잡는다:
 *   · 이미 굽은 큰따옴표가 있을 때만 — 처음부터 곧은 것으로 통일된 글은 섞인 게 아니다.
 *   · 곧은 것이 짝수 개일 때만 — 홀수면 어느 쪽이 열린 것인지 알 수 없다.
 * 둘 다 아니면 원문 그대로 돌려준다. **모르면 안 고친다.**
 *
 * 실측 2026-08-31 — V4 `unit_vocab`(IPCC 6차 보고서)이 `굽은 “ ” 2개 · 곧은 " 2개` 로
 * 삼교 `quote_style` 에 걸렸다. 한 지문 안에서 따옴표 모양이 흔들리는 교재는 없다.
 */
export function pairStraightQuotes(text: string): string {
  const s = String(text ?? '')
  if (!/[“”]/.test(s)) return s
  const straight = (s.match(/"/g) ?? []).length
  if (straight === 0 || straight % 2 !== 0) return s
  let open = true
  return s.replace(/"/g, () => {
    const q = open ? '“' : '”'
    open = !open
    return q
  })
}

/**
 * 구두점 **앞의 공백**을 지운다 — 그리고 그 자리에서 겹친 구두점도 하나로 줄인다.
 *
 * PDF·XML 에서 뽑은 원문에 흔한 잡티다. 실측 2026-08-31 V6 한 권에서 5건
 * (`cultivars .` · `mapping , ` · `Lindenmayer , ,` · …). 시중 교재에는 없는 모양이라
 * 그대로 인쇄하면 **조판 사고**로 읽힌다.
 *
 * ⚠️ 말줄임표는 건드리지 않는다 — `… .` 처럼 보이는 자리가 실제로는 정상이다
 *   (`proofread.ts` 의 같은 규칙도 그래서 `..`·`…` 를 건너뛴다).
 */
export function stripSpaceBeforePunct(text: string): string {
  return String(text ?? '')
    .replace(/\s+([,;:!?])/g, '$1')
    .replace(/\s+\.(?![.…])/g, '.')
    .replace(/([,;:])\s*\1+/g, '$1')
}

/**
 * 글 **맨 앞에서** 똑같이 되풀이되는 낱말 하나를 지운다 — 절 제목이 본문에 눌어붙은 것이다.
 *
 * 실측 2026-08-31 — `Filming Filming began in August 2019.`(V3) ·
 * `APOD APOD Astronomy Picture of the Day`(V5). 앞의 것은 위키 절 제목이고 뒤의 것은
 * 사이트 머리글이다. `stripSectionLabels` 는 알려진 19개 라벨만 알아서 못 잡았다.
 *
 * ⚠️ **맨 앞에서만** 본다. 문장 가운데의 겹침은 실제 이름일 수 있다 —
 *   `Durand Durand`(Barbarella 악당)가 그래서 `proofread` 에서도 단정하지 않고 확인을 청한다.
 *   자리를 맨 앞으로 좁히면 그 위험이 사라진다: 제목이 눌어붙는 자리가 거기뿐이다.
 */
export function dropDuplicatedLeadWord(text: string): string {
  const s = String(text ?? '')
  const m = /^([A-Z][A-Za-z’'-]*)\s+\1\b/.exec(s)
  return m?.[1] ? s.slice(m[1].length + 1).trimStart() : s
}

/**
 * **괄호 짝이 안 맞는 지문** — 인용 안에서 잘려 나온 조각이다.
 *
 * 실측 2026-08-31 — V7 `irrelevant` 한 문항이 이런 문장으로 시작했다:
 *
 *     38887), particularly where the link between the criminal act and…
 *
 * 원문의 `(PMID 38887)` 을 문장 분리기가 가운데서 잘랐다. 닫는 괄호만 지우면
 * `38887, particularly where…` 가 남는데 그건 여전히 **중간부터 시작하는 문장**이다 —
 * 잡티가 아니라 **잘린 글**이라서 정규화로 덮으면 안 된다. 고르는 자리에서 막는다.
 *
 * ⚠️ 문장 하나가 아니라 **지문 전체**로 센다. 문장마다 세면 `(e.g.` 의 마침표에서
 *   갈린 두 조각이 둘 다 짝이 안 맞는 것으로 잡힌다 — `proofread.ts` 가 같은 이유로
 *   문장 단위 판정을 피한다.
 *
 * 재고 손실은 실측했다: 저장된 문항 약 7.6만 중 **544개(0.7%)**.
 * 손으로 쓴 유형(제목·요지·주제·빈칸)은 각 1개씩뿐이다.
 */
export function hasUnbalancedParens(text: string): boolean {
  const s = String(text ?? '')
  const open = (s.match(/\(/g) ?? []).length
  const close = (s.match(/\)/g) ?? []).length
  return open !== close
}

/**
 * **학교 교재에 실을 수 없는 소재.**
 *
 * ── 왜 있나 (실측 2026-08-31) ────────────────────────────────────────
 * V6 `content_match` 드레인 8편을 손으로 채우다 첫 편이 **낙태권 논쟁**이었다.
 * 문항으로는 아무 문제가 없다 — 지문도 규격에 맞고 선택지도 만들어진다. 그런데
 * **한국 학교 교재에는 실을 수 없는 글**이다. 검사기 아홉 개 중 이것을 보는 것이 없었다.
 *
 * 저장소 전체를 재 봤다: 원글 **1,042편**(V6 6.7% · V7 4.0% · V5 3.3% · V4 1.4%)이
 * 걸리고, 그 위에 문항 **25,316개**가 서 있다. 지문 손실은 밴드당 1.8~7.4% 로 감당된다.
 *
 * ⚠️ **이것은 주제에 대한 판단이 아니라 지면에 대한 판단이다.** 자살 예방 연구도
 *   HIV 역학도 좋은 글이다 — 다만 중·고등 영어 교재의 독해 지문으로 시중 어느 출판사도
 *   쓰지 않는다. 그래서 목록을 좁게 유지한다: 넓히면 전쟁사·선거제도·종교문화처럼
 *   교재가 **실제로 다루는** 소재까지 잘려 나간다.
 *
 * ⚠️ 정밀도를 표본으로 확인했다(12편 전수 육안) — `cell suicide`(세포자멸사) 같은
 *   생물학 용법은 표본에 없었다. 오탐이 나오면 낱말을 빼는 쪽으로 좁힌다.
 */
const SENSITIVE_TOPIC = [
  /\babortions?\b|\breproductive rights\b/i,
  /\bsuicide\b|\bself-harm\b/i,
  /\bsexual intercourse\b|\bpornograph|\bsex work\b|\bsexually explicit\b/i,
  /\billicit drugs?\b|\bdrug abuse\b|\bsubstance abuse\b|\bheroin\b|\bcocaine\b|\bmethamphetamine\b/i,
]

/** 학교 교재 지면에 올릴 수 없는 소재인가. */
export function hasSensitiveTopic(text: string): boolean {
  const s = String(text ?? '')
  return SENSITIVE_TOPIC.some((re) => re.test(s))
}

export function hasNonProse(text: string): boolean {
  return NON_PROSE.test(text) || hasArticleChrome(text)
}

/** 교재 지문으로 인쇄할 수 있는가 — 인용 잔해도 비산문 자국도 없어야 한다. */
export function isPrintablePassage(text: string): boolean {
  // ⚠️ **소재도 인쇄 가능 판정의 일부다.** 형식이 아무리 멀쩡해도 학교 교재에 못 싣는
  //   글이 있다(`hasSensitiveTopic`). 여기에 넣는 이유는 이 함수를 생성기 8곳과
  //   드레인 뽑기가 이미 공유하기 때문이다 — 한 자리에 두면 다음에 만드는 사람이
  //   빠뜨릴 수 없다. 게이트를 각자 들게 두면 반드시 한 곳이 빠진다(이 파일에 세 번 기록됨).
  return (
    !hasCitationResidue(text) &&
    !hasNonProse(text) &&
    !hasAcademicApparatus(text) &&
    !hasSensitiveTopic(text)
  )
}

/**
 * 문단에서 **규격에 맞는 연속 구간**을 잘라 낸다.
 *
 * ── 왜 필요한가 (2026-08-21 실측) ───────────────────────────────────
 * 문단을 통째로 지문으로 썼더니 **1,936문항이 규격 밖**이었다 —
 * 어법 78.6% · 어휘 58.2% · 순서 41.4% · 삽입 39.5%. 수능 지문은 90~200어인데
 * 우리 문단은 그보다 길다. 조판 단계에서 걸러지긴 하지만, 그러면 **재고 숫자가
 * 계속 거짓말을 한다** — 어법은 580개가 아니라 124개였다.
 *
 * 문단 전체를 버리는 대신 **연속한 문장 몇 개**를 잘라 쓴다. 잘라도 글은 이어진다.
 *
 * 창은 **가장 이른 자리부터** 찾는다 — 결정론이어야 같은 문단이 늘 같은 지문을 준다.
 * 문장 수 하한을 두는 이유는 유형마다 밑줄·자리 수가 정해져 있기 때문이다.
 *
 * @returns 맞는 구간이 없으면 null.
 */
export function selectPassageWindow(
  sentences: ReadonlyArray<string>,
  spec: { min: number; max: number },
  minSentences: number,
): string[] | null {
  const counts = sentences.map((s) => s.split(/\s+/).filter(Boolean).length)
  let best: { start: number; end: number; words: number } | null = null
  for (let start = 0; start < sentences.length; start++) {
    let words = 0
    for (let end = start; end < sentences.length; end++) {
      words += counts[end]!
      if (words > spec.max) break
      const n = end - start + 1
      if (n < minSentences || words < spec.min) continue
      // 가장 이른 시작 · 그중 가장 긴 구간(문장이 많을수록 밑줄을 퍼뜨릴 자리가 많다).
      if (!best || n > best.end - best.start + 1) best = { start, end, words }
    }
    if (best) break // 가장 이른 시작에서 찾았으면 거기서 끝낸다 — 멱등해야 한다.
  }
  return best ? sentences.slice(best.start, best.end + 1) : null
}

/** 수능 순서 문항 — 도입문 + (A)(B)(C) + 5지선다. */
export interface CsatOrderItem {
  kind: 'order'
  intro: string
  blocks: { label: 'A' | 'B' | 'C'; sentences: string[] }[]
  /** 답지 5개. 각각 라벨 배열(예: ['A','C','B']). 수능처럼 원순서는 빠진다. */
  choices: Array<Array<'A' | 'B' | 'C'>>
  /** 정답 번호 (1~5). */
  answer: number
}

/** 수능 삽입 문항 — 지문 + ①~⑤. */
export interface CsatInsertItem {
  kind: 'insert'
  /** 넣을 문장. */
  sentence: string
  /** 지문 문장들. 각 문장 뒤에 자리 번호가 붙는다 — `slots[i]` 는 `body[i]` 뒤. */
  body: string[]
  /** 자리 번호 1~5. */
  slots: number[]
  answer: number
}

/**
 * 삽입 문항 지문의 문장 수 범위.
 *
 * ── 2026-08-21 확장 ─────────────────────────────────────────────────
 * 처음엔 **정확히 5문장**만 받았다. 자리가 문장마다 하나씩 생겨 5곳이 되기 때문이다.
 * 그런데 **실제 수능 지문은 6~8문장이고 자리는 그중 5곳**이다 — 문장마다 번호가
 * 붙지 않는다.
 *
 * 5문장 고정이 얼마나 비쌌는지 재 봤다. `isEligible` 이 7문장 이상 문단을 통째로
 * 버리고 있었는데, 그중 길이 규격(90~200어)에 드는 것만 세도:
 *
 *   V4  새 삽입 원글 15 → **+7단원** (지금은 0단원)
 *   V5  새 삽입 원글 29 → **+14단원**
 *   V6  새 삽입 원글 19 → **+9단원**
 *
 * 19단원 → **42단원**. 1권 미달이 2권으로 바뀐다.
 */
export const CSAT_INSERT_BODY = { min: 5, max: 9 } as const

/** 수능 답지 자리 수 — ①~⑤. 지문이 길어도 자리는 다섯이다. */
export const CSAT_INSERT_SLOTS = 5

/** @deprecated `CSAT_INSERT_BODY.min` 을 쓸 것. 남겨 둔 이유는 회귀가 참조하기 때문. */
export const CSAT_INSERT_BODY_SENTENCES = 5

/**
 * 순서 문항으로 바꾼다.
 *
 * `presented[k] = 원문[source_order[k]]` 이므로 원문 순서를 먼저 복원한다.
 * 그다음 첫 문장을 도입으로 떼고, 나머지를 세 덩어리로 나눠 라벨을 섞는다.
 */
export function toCsatOrder(
  presented: ReadonlyArray<string>,
  sourceOrder: ReadonlyArray<number>,
): CsatOrderItem | null {
  const n = presented.length
  if (n < 4 || n !== sourceOrder.length) return null
  // 인용 잔해가 있으면 교재에 실을 수 없다 — 변환 자체를 막는다.
  if (hasCitationResidue(presented.join(' '))) return null

  // 원문 복원 — 원문[i] 는 presented 에서 sourceOrder 가 i 인 자리에 있다.
  const original: string[] = new Array(n)
  for (let k = 0; k < n; k++) original[sourceOrder[k]!] = presented[k]!
  if (original.some((s) => s === undefined)) return null

  const intro = original[0]!
  const rest = original.slice(1)

  // 세 덩어리로 나눈다 — 앞쪽 덩어리가 더 길게(4→1,1,1 / 5→2,1,1 / 6→2,2,1).
  const sizes = splitIntoThree(rest.length)
  if (!sizes) return null
  const chunks: string[][] = []
  let at = 0
  for (const size of sizes) {
    chunks.push(rest.slice(at, at + size))
    at += size
  }

  // 라벨을 섞는다 — 원문 순서가 (A)(B)(C) 이면 문제가 성립하지 않는다.
  //   결정론이어야 같은 지문이 늘 같은 문항이 된다(멱등). 그래서 내용으로 seed 를 만든다.
  const rot = 1 + (hash(intro + rest.join('')) % 5) // 1~5 — 항등(0) 제외
  const perms = ORDER_PERMS // 5개, (A)(B)(C) 원순서 없음
  const answerPerm = perms[rot - 1]!

  // answerPerm 이 "정답 배열" 이다. 즉 라벨 L 이 answerPerm 의 i 번째면 chunks[i] 가 L 이다.
  const blocks: CsatOrderItem['blocks'] = []
  for (const label of ['A', 'B', 'C'] as const) {
    const pos = answerPerm.indexOf(label)
    blocks.push({ label, sentences: chunks[pos]! })
  }

  return {
    kind: 'order',
    intro,
    blocks,
    choices: perms.map((p) => [...p]),
    answer: rot,
  }
}

/**
 * 삽입 문항으로 바꾼다. **자리가 5곳이 아니면 null** — 교재에 실을 수 없다.
 */
export function toCsatInsert(
  remaining: ReadonlyArray<string>,
  insertSentence: string,
  position: number,
): CsatInsertItem | null {
  const n = remaining.length
  if (n < CSAT_INSERT_BODY.min || n > CSAT_INSERT_BODY.max) return null
  if (hasCitationResidue(remaining.join(' ') + ' ' + insertSentence)) return null
  // position 은 원문에서 뺀 문장의 자리다(1..n). "remaining[position-1] 뒤" 를 뜻한다.
  if (position < 1 || position > n) return null
  const slots = pickSlots(n, position)
  return {
    kind: 'insert',
    sentence: insertSentence,
    body: [...remaining],
    slots,
    answer: slots.indexOf(position) + 1,
  }
}

/**
 * 자리 5곳을 고른다 — **정답을 반드시 포함**하고 나머지는 지문에 고르게 퍼뜨린다.
 *
 * 정답만 외따로 떨어져 있으면 위치만 보고 찍을 수 있으므로, 후보를 균등 간격으로
 * 잡은 뒤 정답을 끼워 넣는다. 결정론이라 같은 지문은 늘 같은 자리를 얻는다.
 */
export function pickSlots(bodySentences: number, answer: number): number[] {
  const picked = new Set<number>([answer])
  for (let k = 0; k < CSAT_INSERT_SLOTS && picked.size < CSAT_INSERT_SLOTS; k++) {
    picked.add(1 + Math.round((k * (bodySentences - 1)) / (CSAT_INSERT_SLOTS - 1)))
  }
  for (let i = 1; i <= bodySentences && picked.size < CSAT_INSERT_SLOTS; i++) picked.add(i)
  return [...picked].sort((a, b) => a - b)
}

/** 수능 답지 5개 — 3! 순열에서 원순서 (A)(B)(C) 를 뺀 것. 실제 시험지와 같은 나열이다. */
export const ORDER_PERMS: ReadonlyArray<ReadonlyArray<'A' | 'B' | 'C'>> = [
  ['A', 'C', 'B'],
  ['B', 'A', 'C'],
  ['B', 'C', 'A'],
  ['C', 'A', 'B'],
  ['C', 'B', 'A'],
]

/** n 문장을 세 덩어리로. 앞쪽이 더 길다 — 논지 전개상 도입 뒤가 두껍다. */
export function splitIntoThree(n: number): [number, number, number] | null {
  if (n < 3) return null
  const base = Math.floor(n / 3)
  const extra = n % 3
  return [base + (extra > 0 ? 1 : 0), base + (extra > 1 ? 1 : 0), base]
}

/** 결정론 해시 — 같은 지문이면 늘 같은 문항이 나와야 한다(멱등). */
function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}
