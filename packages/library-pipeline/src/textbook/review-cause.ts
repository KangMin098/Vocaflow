// packages/library-pipeline/src/textbook/review-cause.ts
//
// **3인 검수가 막은 사유를 계열로 접는다 — 「무엇을 고치면 몇 개가 풀리나」에 답한다.**
//
// ── 왜 필요한가 (실측 2026-09-13) ────────────────────────────────────
// DB 실측: 지면 문항 172개가 3인 검수를 받았고 **전원 pass 는 9개(5.2%)** 다.
// 남은 163개가 차단인데, 화면은 그 수만 말하고 **왜**는 말하지 않는다. 그 상태에서
// 관리자가 할 수 있는 판단은 「163개를 하나씩 고친다」뿐이고, 그건 아무도 안 한다.
//
// 그런데 막은 사유 **947건**을 읽어 보면 같은 말이 되풀이된다:
//
//   "제목이 본문 첫 문장으로 추출됐다"        ← 지문 추출
//   "\"Explanation:\" 라벨이 지문에 인쇄된다"  ← 지문 추출
//   "a.m. 의 마침표가 문장을 쪼갰다"           ← 지문 추출
//   "the others 가 누구를 받는지 지문 안에 없다" ← 자립성
//   "밑줄 ① 이 정답의 원본 낱말 그 자체다"     ← 문항 생성
//   "고정 복합어 utility scores 의 한쪽을 갈아 끼웠다" ← 문항 생성
//
// 즉 163개의 서로 다른 문제가 아니라 **몇 개의 공정 결함**이 163번 나타난 것이다.
// 계열로 접으면 「추출을 고치면 N개가 풀린다」를 셀 수 있다.
//
// ⚠️⚠️ **이것은 문자열 휴리스틱이지 의미 판정이 아니다.** 이 저장소는 같은 성격의 자
//   (기출 함정 라벨 병합)에서 이미 그것을 명시했다 — 과잉 병합이 원리적으로 남는다.
//   그래서 이 모듈은 세 가지를 지킨다:
//     ① 못 맞히면 `unknown` 이다. **가까운 계열에 밀어 넣지 않는다** — 밀어 넣으면
//        「추출만 고치면 된다」는 거짓 확신이 생기고, 고친 뒤에도 차단이 안 줄어든다.
//     ② 여러 계열에 걸리면 **그 사실을 함께 낸다**(`matched`). 하나로 접는 것은 보고용이지
//        판정이 아니다.
//     ③ 규칙마다 **그 규칙이 나온 실제 사유 문장**을 주석에 남긴다. 근거 없는 규칙은
//        다음 사람이 못 고친다.
//
// 순수 함수다 — DB 도 파일도 안 읽는다.

/**
 * 차단 사유의 계열.
 *
 * 순서가 곧 **뿌리 우선순위**다. 한 사유가 여러 계열에 걸릴 때 앞의 것을 고른다 —
 * 「밑줄 ①이 지문 제목에 있다」는 밑줄 이야기처럼 보이지만 고칠 곳은 **추출**이다.
 * 겉에 드러난 증상이 아니라 **고쳐야 할 공정**으로 접는 것이 이 자의 목적이다.
 */
export const REVIEW_CAUSES = [
  'extraction',
  'standalone',
  'level_fit',
  'sensitive',
  'item_build',
  'distractor',
  'answer',
  'explanation',
  'type_fit',
] as const

export type ReviewCause = (typeof REVIEW_CAUSES)[number] | 'unknown'

/** 계열 하나의 사람 이름과 고칠 자리. 화면·리포트가 그대로 쓴다. */
export const CAUSE_LABEL: Record<ReviewCause, { label: string; fixes: string }> = {
  extraction: { label: '지문 추출', fixes: '원문에서 지문을 떼는 단계 — 제목·라벨·문장 분할·인용 경계' },
  standalone: { label: '자립성', fixes: '그 한 편만 읽고 이해되는가 — 선행사·화자·약어·앞 문단 참조' },
  level_fit: { label: '학년 적합', fixes: '원문 적격 — 그 학년의 어휘창·소재·문체 안에 있는가' },
  sensitive: { label: '소재 부적절', fixes: '지문 교체로만 풀린다 — 편향·비하·학습자에게 맞지 않는 소재' },
  item_build: { label: '문항 생성', fixes: '밑줄 자리와 치환 낱말을 고르는 규칙' },
  distractor: { label: '오답 설계', fixes: '오답 넷이 서로 다른 이유로 틀리는가 — 매력과 배타성' },
  answer: { label: '정답 성립', fixes: '정답이 유일한가 — 근거가 지면 안에 있는가' },
  explanation: { label: '해설', fixes: '해설이 실제 정답 자리를 가리키는가' },
  type_fit: { label: '유형 적합', fixes: '그 유형이 묻기로 한 축을 실제로 묻는가' },
  unknown: { label: '미분류', fixes: '규칙이 못 맞혔다 — 읽고 규칙을 늘리거나 그대로 둔다' },
}

/**
 * 계열마다의 표지.
 *
 * ⚠️ **넓은 낱말을 쓰지 않는다.** 「없다」·「근거」 같은 말은 947건 대부분에 들어 있어
 *   무엇이든 잡는다. 그러면 `unknown` 이 0 이 되고, 0 이 된 순간 이 자는 아무것도
 *   말하지 않는 자가 된다(전부 맞혔다고 보고하지만 실제로는 아무것도 안 가렸다).
 */
const RULES: ReadonlyArray<{ cause: Exclude<ReviewCause, 'unknown'>; re: RegExp; from: string }> = [
  // ── 지문 추출 ──────────────────────────────────────────────────────
  { cause: 'extraction', re: /제목이 (본문|전부 본문)|제목이 지문|지문 제목|제목 (안|속)에 있|눌어붙/, from: '"제목이 전부 본문에 눌어붙었다"' },
  { cause: 'extraction', re: /라벨(이|을).{0,20}(지문에|인쇄|읽는다|일부로)|변수(명| 라벨)|표의 (두 )?행|표를 줄바꿈|이어붙인/, from: '"원문 논문의 변수 라벨이 본문에 남았다"' },
  { cause: 'extraction', re: /(인쇄 )?잔해|방주|Sidenote/, from: '"인쇄 잔해가 그대로 남았다 — [Sidenote: …"' },
  { cause: 'extraction', re: /문장(이|을)? ?(분할|쪼갰|쪼개)|분할이 (깨|약어|지면)|마침표가 문장|분할이 지면에/, from: '"a.m. 의 마침표가 문장을 쪼갰다"' },
  { cause: 'extraction', re: /따옴표만|인용부호가|블록 경계|인용 표시가 없다|접합 문장/, from: '"(C) 는 여는 따옴표만, (A) 는 닫는 따옴표만 있다"' },
  { cause: 'extraction', re: /조각이(고|다)|무관한 .{0,10}조각|한 문장으로 묶었다|에서 끊겨|에서 잘렸|잘린 (문장|조각)|문장이 잘렸|소실(됐|된)|원문 오류/, from: '"마지막 문장이 잘렸다 — 수식 기호가 소실됐다"' },

  { cause: 'extraction', re: /깨진 문장|완결되지 않|답 없는 질문|자기소개|오탈자로 읽/, from: '지면에 깨진 문장이 인쇄된다 — 학습자는 오탈자로 읽는다' },
  // ── 자립성 ────────────────────────────────────────────────────────
  { cause: 'standalone', re: /선행사|지시 대상이 없|지시가 닿을/, from: '"(C)의 the task 도 선행사가 지문에 없다"' },
  { cause: 'standalone', re: /지문 밖|지면 밖|앞 문단|앞 단락|원작을 아는|원논문|잘려 나간 앞부분/, from: '"근거가 지문 밖(원논문의 모형 설정)에 있다"' },
  { cause: 'standalone', re: /화자(가|를|는).{0,24}(없다|바뀐|바뀌|모른|못 가른|미상|알 수 없)/, from: '"화자가 중간에 바뀌어 누가 말하는지 학습자가 못 가른다"' },
  { cause: 'standalone', re: /약어.{0,24}(없다|풀리지|뜻)|한 번도 풀리지|어디에서도 풀리지/, from: '"지문을 떠받치는 약어 \"CS\" 가 한 번도 풀리지 않는다"' },

  { cause: 'standalone', re: /선행 맥락|지시 대상 없이|무엇의 .{0,8}인지|누구인지 .{0,12}없|풀이 없이/, from: '첫 문장이 선행 맥락 없이 시작해 무엇의 aspects 인지가 지문 안에 없다' },
  // ── 학년 적합 (원문 적격) ──────────────────────────────────────────
  { cause: 'level_fit', re: /창(을|이)? ?(밖|넘)|창 밖|어휘창|학년 밖|범위를 넘|크게 넘|V-Level ?\d+ 창/, from: '"고1 창 밖 어휘가 지문 해석을 좌우한다"' },
  { cause: 'level_fit', re: /고d(이|가) 읽을|읽을 수 있는 글이 아니|산문이 아니다|글의 형태가 아니|교육과정의/, from: '"고1이 읽을 수 있는 글이 아니다"' },

  { cause: 'level_fit', re: /세계 밖|호흡이 과|읽는 부담|\d{2}낱말|관계절을 .{0,6}겹|도치 가정법|이중 표기/, from: '고1 기준 한 블록의 호흡이 과하다' },

  // ── 소재 부적절 ────────────────────────────────────────────────────
  { cause: 'sensitive', re: /규정하는 문장|편향|비하|고정관념|지문 교체로만|학습자에게 (맞지|부적절)/, from: '동양인 전체를 기만적이라고 규정하는 문장 — 지문 교체로만 해결된다' },
  // ── 문항 생성 ──────────────────────────────────────────────────────
  { cause: 'item_build', re: /복합(어|명사)/, from: '"치환이 고정 용어 \"utility scores\" 의 한쪽을 갈아 끼운 것이라"' },
  { cause: 'item_build', re: /첫 일치|같은 (낱말|표제어)|낱말 그 자체|눈으로 맞추|어휘상 겹친|그대로 노출/, from: '"①이 밑줄 친 \"Internal\" 은 정답 ③이 돌려놓아야 할 낱말 그 자체다"' },
  { cause: 'item_build', re: /고유명사|칭호|낱말이 아니(라|다)|선지가 될 수 없/, from: '"밑줄 5개 중 셋이 고유명사·칭호다"' },
  { cause: 'item_build', re: /밑줄(이|을| 자리|이 걸리지|이 속한|\s*[①-⑤])|밑줄 선정|밑줄 축|관사(가 어긋| 불일치)/, from: '"밑줄 ② 가 바뀐 낱말에 걸리지 않는다"' },

  // ── 오답 설계 ──────────────────────────────────────────────────────
  { cause: 'distractor', re: /같은 이유로 (틀린|틀리|무효|탈락)/, from: '"① \"cannot\" 과 ④ \"walking\" 이 같은 이유로 틀린다"' },
  { cause: 'distractor', re: /치환 긴장|반의(어)? ?(짝|치환)|넣어 볼 자리|치환 가능한/, from: '"치환 가능한 반의 짝이 없다"' },
  { cause: 'distractor', re: /매력(이|적|도)|오도(한다|다)|선택률|아무도 (안 )?고르|수상(해|하게) 보인/, from: '"정답보다 매력적인 오답이라 오도한다"' },
  { cause: 'distractor', re: /배제되는 것이|배제할 근거|실질 선지/, from: '"다섯 선지 중 배타적으로 배제되는 것이 하나도 없다"' },

  { cause: 'distractor', re: /탈락 이유가|한 선지 몫|자리 채우기|기능하지 않|무색 (동사|낱말)|한꺼번에 (걸리|탈락)/, from: '④와 ⑤ 는 탈락 이유가 같다 — 두 선지가 한 선지 몫이다' },
  { cause: 'distractor', re: /[12]지선다|실질 (경쟁지|후보|근접)|오답 분포|선택 비율|변별(이|을) (사라|나오지|측정)/, from: '실질 2지선다다' },
  { cause: 'distractor', re: /배타적이지 않/, from: '정답 낱말과 동일 어휘여서 정답과 배타적이지 않다' },
  // ── 정답 성립 ──────────────────────────────────────────────────────
  { cause: 'answer', re: /유일하(지|게)|배타적으로 (서지|성립)/, from: '"정답 ①(A)-(C)-(B) 가 유일하지 않다"' },
  { cause: 'answer', re: /정답이 성립하지|오히려 자연스럽|반박으로 (완전히 )?성립|자연스럽게 읽히므로|문자 그대로 없다/, from: '"바꿔 넣은 반대말이 그 문맥에서 오히려 자연스럽다"' },
  { cause: 'answer', re: /정답이 (마지막|맨 뒤|첫) 자리|변별력이 낮|변별이 사라진/, from: '"정답이 마지막 자리 ⑤ 다 — 변별력이 낮다"' },

  // ── 해설 ──────────────────────────────────────────────────────────
  { cause: 'explanation', re: /해설/, from: '"해설이 가리키는 자리가 정답 자리와 다르다"' },

  // ── 유형 적합 ──────────────────────────────────────────────────────
  { cause: 'type_fit', re: /유형(과|이|을)? ?(어긋|다루는 축|정의에|설계상)/, from: '"유형과 어긋난다 — 밑줄 5개 중 셋이 고유명사다"' },
  { cause: 'type_fit', re: /answer_key.rule|규칙 이름|표방한 규칙/, from: '"answer_key.rule 이 demonstrative 인데 … 접속사다"' },
]

export interface CauseVerdict {
  cause: ReviewCause
  /** 걸린 계열 전부. 둘 이상이면 **접은 것이 판정이 아니라 보고**라는 뜻이다. */
  matched: Exclude<ReviewCause, 'unknown'>[]
}

/** 사유 한 줄을 계열로 접는다. 못 맞히면 `unknown` — 가까운 칸에 밀어 넣지 않는다. */
export function classifyCause(finding: string): CauseVerdict {
  const text = typeof finding === 'string' ? finding : ''
  const matched: Exclude<ReviewCause, 'unknown'>[] = []
  for (const r of RULES) {
    if (r.re.test(text) && !matched.includes(r.cause)) matched.push(r.cause)
  }
  if (matched.length === 0) return { cause: 'unknown', matched: [] }
  // 뿌리 우선순위 — REVIEW_CAUSES 의 순서가 정본이다.
  const cause = REVIEW_CAUSES.find((c) => matched.includes(c))!
  return { cause, matched }
}

export interface CauseTally {
  cause: ReviewCause
  findings: number
  /** 그 계열에 걸린 **문항** 수. 한 문항이 여러 사유를 받으므로 findings 보다 작다. */
  items: number
}

export interface CauseReport {
  totalFindings: number
  totalItems: number
  tally: CauseTally[]
  /** 둘 이상 계열에 걸린 사유 수 — 접기의 불확실성 크기다. */
  ambiguous: number
  /** 미분류 비율(0~1). **이 값이 크면 아래 집계를 근거로 쓰면 안 된다.** */
  unknownShare: number
}

export interface FindingRow {
  itemId: string
  finding: string
}

export function tallyCauses(rows: readonly FindingRow[]): CauseReport {
  const byCause = new Map<ReviewCause, { findings: number; items: Set<string> }>()
  const items = new Set<string>()
  let ambiguous = 0
  for (const r of rows) {
    const v = classifyCause(r.finding)
    if (v.matched.length > 1) ambiguous += 1
    items.add(r.itemId)
    if (!byCause.has(v.cause)) byCause.set(v.cause, { findings: 0, items: new Set() })
    const b = byCause.get(v.cause)!
    b.findings += 1
    b.items.add(r.itemId)
  }
  const tally: CauseTally[] = [...byCause.entries()]
    .map(([cause, b]) => ({ cause, findings: b.findings, items: b.items.size }))
    .sort((a, b) => b.findings - a.findings)
  const unknown = byCause.get('unknown')?.findings ?? 0
  return {
    totalFindings: rows.length,
    totalItems: items.size,
    tally,
    ambiguous,
    unknownShare: rows.length === 0 ? 0 : unknown / rows.length,
  }
}
