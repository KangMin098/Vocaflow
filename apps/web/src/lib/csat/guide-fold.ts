// apps/web/src/lib/csat/guide-fold.ts
//
// 기출 분석 → **학습 가이드 원천 자료**로 접는 순수 함수들.
//
// 왜 별도 파일인가: 여기 있는 것은 전부 입력 → 출력이 고정된 계산이라 DB 없이 검사할 수 있다.
// IO 는 `guide.ts` 가 갖는다(`server-only`). 접는 규칙이 바뀌면 테스트가 먼저 깨져야 한다.
//
// ⚠️ **평가원 지문 원문(`csat_items.passage`)은 이 파일에 들어오지 않는다.** 여기서 접는 것은
//    유형 리포트·문항 분석(우리 저작물)뿐이다. 교재 원천으로 내보내는 자료에 원문이 섞이면
//    그 자료를 쓴 교재가 곧바로 저작권 문제를 안는다.

/** 유형 리포트의 함정 한 줄 (원자료) */
export interface RawTrap {
  trap: string
  count?: number
  signature?: string
}

/**
 * 함정 **계열** — 라벨이 갈라져 있던 같은 함정을 묶은 것.
 *
 * 왜 필요한가: 리포트는 청크 단위로 누적돼서 같은 함정이 다른 이름으로 여러 줄 남는다.
 * 실측(2026-09-05) R-ORDER 은 라벨 30개인데 「지시어 선행사」 계열만 4줄(18+16+14+7=55회),
 * 「첫 등장」 계열이 4줄, 「연결사 방향」 계열이 4줄이었다. 라벨 그대로 교재 목차를 짜면
 * 한 유형에 30개 꼭지가 생기고, 그중 12개가 같은 말이다. 계열로 접어야 목차가 된다.
 *
 * ⚠️ 이 병합은 **라벨 문자열 휴리스틱**이지 의미 판정이 아니다. 겹치는 낱말이 2개 이상이면
 *    같은 계열로 본다. 그래서 합성 라벨(「A / B / C」)이 두 계열을 잇는 과잉 병합이 남는다 —
 *    화면과 내보내기 모두 원 라벨을 함께 싣는 이유다. 확정 분류는 사람이(또는 드레인이) 한다.
 */
export interface TrapFamily {
  /** 대표 라벨 — 계열에서 관찰 횟수가 가장 큰 것 */
  key: string
  /** 병합된 원 라벨 전부 (관찰 횟수 내림차순) */
  labels: string[]
  /** 계열 누적 관찰 횟수 */
  count: number
  /** 대표 라벨의 signature — 학습자에게 「어떻게 알아보나」를 주는 문장 */
  signature: string | null
}

/** 한국어 라벨에서 자주 붙는 조사 — 「반복에 낚임」과 「반복 유인」을 같은 계열로 보려면 떼야 한다 */
const PARTICLES = ['으로', '에서', '에게', '까지', '부터', '이나', '에', '이', '가', '을', '를', '은', '는', '의', '로', '와', '과', '도']

/** 3자 이상인 토큰에서만 조사를 뗀다 — 「의미」의 「의」를 떼면 다른 말이 된다 */
function stripParticle(token: string): string {
  if (token.length < 3) return token
  for (const p of PARTICLES) {
    if (token.length - p.length >= 2 && token.endsWith(p)) return token.slice(0, -p.length)
  }
  return token
}

/** 라벨을 비교 가능한 토큰 집합으로 — 구분자(·, /, -, →, 괄호…)는 전부 경계로 본다 */
export function trapTokens(label: string): Set<string> {
  return new Set(
    label
      .split(/[\s·・/,()[\]{}\-–—→~「」『』"'’:;.!?]+/)
      .map((t) => stripParticle(t.trim()))
      .filter((t) => t.length > 0),
  )
}

/**
 * 두 라벨이 같은 계열인가.
 *
 * 조건 둘을 **모두** 만족해야 한다:
 *   ① 겹치는 토큰이 2개 이상 — 한 낱말만 겹치는 것(「없음」끼리)은 계열이 아니다
 *   ② 겹치는 것 중 2자 이상인 토큰이 하나 이상 — 「첫」·「이」 같은 1자만으로 묶지 않는다
 */
export function sameTrapFamily(a: string, b: string): boolean {
  const ta = trapTokens(a)
  const tb = trapTokens(b)
  let shared = 0
  let sharedLong = 0
  for (const t of ta) {
    if (!tb.has(t)) continue
    shared += 1
    if (t.length >= 2) sharedLong += 1
  }
  return shared >= 2 && sharedLong >= 1
}

/** 두 라벨이 공유하는 토큰 수 — 어느 계열에 더 가까운지 고를 때 쓴다 */
function sharedCount(a: string, b: string): number {
  const ta = trapTokens(a)
  const tb = trapTokens(b)
  let n = 0
  for (const t of ta) if (tb.has(t)) n += 1
  return n
}

/**
 * 함정 라벨들을 계열로 접는다.
 *
 * **관찰 횟수가 큰 라벨을 대표(seed)로 세우고, 나머지를 대표와 견주어 붙인다.** 이행적으로
 * 번지게 하면(union-find) 합성 라벨 하나가 남의 계열을 끌어온다 — 실측으로 확인했다:
 * 「지시어 선행사 없음 / 어긋남」이 「연결사 근거 없음 · 방향 어긋남」과 {없음, 어긋남} 두 낱말을
 * 공유해서, 서로 아무 상관 없는 「지시어 선행사」 4줄과 「연결사 방향」 4줄이 한 계열 8줄로
 * 뭉개졌다. 대표하고만 견주면 그 다리가 놓이지 않는다(합성 라벨은 자기가 닮은 대표에 붙는다).
 *
 * 대표 후보가 여럿이면 **공유 토큰이 많은 쪽**, 같으면 관찰 횟수가 큰 쪽으로 간다.
 */
export function foldTrapFamilies(traps: RawTrap[]): TrapFamily[] {
  const rows = traps
    .filter((t) => typeof t?.trap === 'string' && t.trap.trim().length > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))

  const families: { head: RawTrap; members: RawTrap[] }[] = []

  for (const row of rows) {
    let best: { fam: (typeof families)[number]; shared: number } | null = null
    for (const fam of families) {
      if (!sameTrapFamily(fam.head.trap, row.trap)) continue
      const shared = sharedCount(fam.head.trap, row.trap)
      if (!best || shared > best.shared) best = { fam, shared }
    }
    if (best) best.fam.members.push(row)
    else families.push({ head: row, members: [row] })
  }

  return families
    .map((f) => ({
      key: f.head.trap,
      labels: f.members.map((m) => m.trap),
      count: f.members.reduce((s, m) => s + (m.count ?? 0), 0),
      signature: f.head.signature ?? null,
    }))
    .sort((a, b) => b.count - a.count || b.labels.length - a.labels.length)
}

// ── 분석자 작업 로그 탐지 ───────────────────────────────────────────────

/**
 * 유형 리포트의 `answer_locus_pattern` 은 드레인 청크마다 **덧붙여** 쌓인다. 그래서 그 안에
 * 분석자끼리 하는 말이 그대로 남는다 — 「앞선 청크의 관찰 ①은 이 청크에서는 성립하지 않는다」
 * 「── 2026-09-04 갱신」 「confirmed_at 에 두 번째 자리를 적어야 했다」.
 *
 * **그 글이 학습자 화면 `/csat/<유형>` 에 그대로 나간다.** 학습자에게 「청크」는 아무 뜻이 없고,
 * 자기가 읽는 것이 완성된 설명인지 작업 메모인지 구별할 방법도 없다. 고치려면 사람(또는 드레인)이
 * 다시 써야 하므로, 우선 **어느 유형이 그런지 눈에 보이게** 한다 — 안 보이면 고쳐지지 않는다.
 *
 * 표지는 애매하지 않은 것만 쓴다. 「재확인된다」·「성립하지 않는다」 같은 말은 학습자용 서술에도
 * 정당하게 나오므로 세지 않는다.
 */
const ANALYST_MARKERS: readonly [string, RegExp][] = [
  ['청크', /청크/],
  ['관찰 번호', /관찰\s*[①②③④⑤]/],
  ['날짜 갱신 표시', /\d{4}-\d{2}-\d{2}\s*갱신/],
  ['내부 필드명', /confirmed_at|answer_locus\.|_PROMPT/],
  ['배치 지시', /이번 회차분|다음 배치|앞선 배치/],
]

/** `answer_locus_pattern` 에서 발견된 작업 로그 표지 이름들 (없으면 빈 배열) */
export function detectAnalystMeta(text: string | null): string[] {
  if (!text) return []
  return ANALYST_MARKERS.filter(([, re]) => re.test(text)).map(([name]) => name)
}

// ── 가이드 원천 자료의 모양 ─────────────────────────────────────────────

export interface GuideProcedureStep {
  step: string
  on_fail?: string
}

export interface CsatGuideType {
  type_id: string
  name: string
  section: string
  status: 'active' | 'retired'
  /** 사정권 기출에서 이 유형이 몇 문항인가 — 교재에서 이 꼭지에 줄 분량의 근거 */
  items: number
  /** 최근 4개년(2023학년도~) 문항 수 — 현행 설계에서의 비중 */
  recent: number
  n_analyzed: number
  time_budget_sec: number | null
  answer_locus_pattern: string | null
  /**
   * 근거 서술에 분석자 작업 로그가 섞여 있나 — 비어 있어야 학습자 화면에 그대로 내보낼 수 있다.
   * 이 화면·이 파일이 이것을 세는 이유는 [detectAnalystMeta] 주석에 있다.
   */
  analyst_meta: string[]
  procedure: GuideProcedureStep[]
  /** 접기 전 라벨 수 — 「30 → 8」이 보여야 접었다는 걸 안다 */
  traps_raw: number
  trap_families: TrapFamily[]
  failure_modes: string[]
  /** 분석자가 예측한 정답률 평균 (0~1). 없으면 null */
  predicted_avg: number | null
  /** 이 유형이 요구한 낱말 — 요구한 문항 수 내림차순 */
  vocab: { lemma: string; items: number }[]
}

/**
 * 사전에서 어떻게 찾았나.
 *
 * `direct` 와 `resolved` 를 가르는 이유: 분석이 적는 낱말은 지문에 나온 **그 꼴** 그대로다
 * (allowed · entries · submissions · diminishing). 표제어로만 대조하면 그것들이 전부
 * 「사전에 없음」이 되어 **뜻이 이미 있는 낱말을 다시 만들라고** 시킨다.
 *
 * 잣대를 세 번 고쳤고 그때마다 수가 줄었다(실측 2026-09-05) — 표제어만 **907** →
 * `inflected_forms` 까지 **474** → 학습자 경로의 정본 해소기(`unresolved_dict_words`)로
 * **286**. `resolved` 는 그 해소기가 표제어로 풀어 준 것이고, **드레인 대상이 아니다.**
 */
export type VocabMatch = 'direct' | 'resolved' | 'none'

export interface CsatGuideVocab {
  lemma: string
  /** 이 낱말을 필수로 요구한 사정권 문항 수 */
  items: number
  /** 요구한 유형 (문항 수 내림차순) */
  types: string[]
  /** 가장 최근 출제 연도 */
  latest_year: number | null
  /** `shared_dictionary` 에 뜻이 있나 — `match !== 'none'` 과 같다 */
  in_dictionary: boolean
  /** 어떤 경로로 찾았나 */
  match: VocabMatch
  /** 표제어를 알 수 있으면 그것(교재에 실을 것은 이쪽이다). 해소기만 통과했으면 null */
  headword: string | null
  /** 다어절(구·숙어)인가 — 사전에 5,547개 있으므로 대상 밖이 아니라 **빈칸**이다 */
  is_phrase: boolean
  cefr_level: string | null
  v_level: number | null
}

export interface CsatGuideExam {
  exam_id: string
  label: string
  kind: string
  year: number
  items: number
  points: number
  /** 사정권 문항 권장 풀이 시간 합(초) — 「이 회차를 몇 분에 도는가」 */
  time_budget_sec: number
  predicted_avg: number | null
}

export interface CsatGuideSource {
  generated_at: string
  types: CsatGuideType[]
  vocab: CsatGuideVocab[]
  exams: CsatGuideExam[]
  totals: {
    types: number
    items: number
    analyzed: number
    /** 접기 전 함정 라벨 총수 */
    trapLabels: number
    /** 접은 뒤 계열 총수 — 교재 꼭지 수의 상한이다 */
    trapFamilies: number
    /** 근거 서술을 학습자에게 그대로 내보낼 수 있는 유형 수 (작업 로그가 안 섞인 것) */
    typesLearnerReady: number
    vocabLemmas: number
    /** 표제어로 바로 찾힌 것 */
    vocabDirect: number
    /** 해소기가 표제어로 풀어 준 것 — 교재에는 표제어를 싣는다. **드레인 대상이 아니다** */
    vocabResolved: number
    /** 어느 잣대로 쟀나. 'fallback' 이면 정본 해소기를 못 불러 빈칸이 실제보다 많다 */
    vocabResolver: 'rpc' | 'fallback'
    /** 뜻이 실제로 없는 것 = 어휘 드레인의 다음 몫 */
    vocabGap: number
    /** 그중 다어절(구·숙어) */
    vocabGapPhrase: number
    vocabInDictionary: number
    /** 사정권 전 문항 권장 시간 합(초) */
    timeBudgetSec: number
  }
}

// ── Markdown 내보내기 ───────────────────────────────────────────────────

function pct(part: number, whole: number): string {
  if (whole <= 0) return '—'
  return `${Math.round((part / whole) * 1000) / 10}%`
}

function mmss(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}분 ${String(s).padStart(2, '0')}초`
}

/**
 * 교재 집필자·강사가 그대로 읽을 수 있는 한 벌.
 *
 * 표가 아니라 **문단 순서**로 쓴 이유: 교재 원고는 「무엇을 재나 → 어디를 보나 → 어떻게 푸나
 * → 무엇에 걸리나 → 무슨 낱말이 필요한가」 순서로 짜인다. 그 순서를 자료가 이미 갖고 있으면
 * 집필이 재배열이 아니라 살 붙이기가 된다.
 */
export function renderGuideMarkdown(src: CsatGuideSource): string {
  const L: string[] = []
  const t = src.totals

  L.push('# 기출 분석 학습 가이드 원천 자료')
  L.push('')
  L.push(`생성 ${src.generated_at} · 평가원 수능·모의평가 독해(사정권) 분석에서 자동 생성.`)
  L.push('')
  L.push('> 이 문서에는 **평가원 지문 원문이 들어 있지 않다.** 유형 리포트와 문항 분석(우리 저작물)만 접은 것이다.')
  L.push('> 함정 「계열」은 라벨이 겹치는 낱말로 묶은 **휴리스틱**이라 원 라벨을 함께 싣는다 — 확정 분류는 사람이 한다.')
  L.push('')
  L.push('## 한눈에')
  L.push('')
  L.push('| 항목 | 값 |')
  L.push('| --- | --- |')
  L.push(`| 유형 | ${t.types} |`)
  L.push(`| 사정권 문항 | ${t.items} |`)
  L.push(`| 분석 완료 문항 | ${t.analyzed} (${pct(t.analyzed, t.items)}) |`)
  L.push(`| 함정 라벨 → 계열 | ${t.trapLabels} → ${t.trapFamilies} |`)
  L.push(
    `| 근거 서술 학습자 배포 가능 | ${t.typesLearnerReady} / ${t.types} (나머지는 분석자 작업 로그가 섞여 있다) |`,
  )
  L.push(`| 필수 어휘 (낱말) | ${t.vocabLemmas} |`)
  L.push(`| 그중 사전 등재 | ${t.vocabInDictionary} (${pct(t.vocabInDictionary, t.vocabLemmas)}) |`)
  L.push(`| — 표제어로 직접 | ${t.vocabDirect} |`)
  L.push(`| — 해소기가 표제어로 풀었다 | ${t.vocabResolved} |`)
  L.push(`| **뜻이 없는 빈칸** | ${t.vocabGap} (낱말 ${t.vocabGap - t.vocabGapPhrase} · 구 ${t.vocabGapPhrase}) |`)
  if (t.vocabResolver === 'fallback') {
    L.push('')
    L.push(
      '> ⚠️ 정본 해소기(`unresolved_dict_words`)를 못 불러 `inflected_forms` 로 물러섰다 — **빈칸이 실제보다 많게 세어진다**(실측 474 대 286). 이 표를 드레인 몫으로 쓰기 전에 해소기가 되살아났는지 확인할 것.',
    )
  }
  L.push(`| 사정권 권장 시간 합 | ${mmss(t.timeBudgetSec)} |`)
  L.push('')

  L.push('## 1. 유형별 가이드')
  L.push('')
  for (const ty of src.types) {
    L.push(`### ${ty.name} \`${ty.type_id}\`${ty.status === 'retired' ? ' — 2023학년도 이후 출제 없음' : ''}`)
    L.push('')
    const bits = [`기출 ${ty.items}문항`, `최근 4개년 ${ty.recent}문항`, `분석 ${ty.n_analyzed}문항`]
    if (ty.time_budget_sec) bits.push(`권장 ${ty.time_budget_sec}초`)
    if (ty.predicted_avg !== null) bits.push(`예측 정답률 ${Math.round(ty.predicted_avg * 100)}%`)
    L.push(bits.join(' · '))
    L.push('')

    if (ty.answer_locus_pattern) {
      L.push('**정답 근거가 어디 있나**')
      L.push('')
      if (ty.analyst_meta.length) {
        L.push(
          `> ⚠️ 이 서술에는 분석자 작업 로그가 섞여 있다(${ty.analyst_meta.join(' · ')}). 학습자에게 그대로 내보내기 전에 다시 써야 한다.`,
        )
        L.push('')
      }
      L.push(ty.answer_locus_pattern)
      L.push('')
    }

    if (ty.procedure.length) {
      L.push('**풀이 절차**')
      L.push('')
      ty.procedure.forEach((p, i) => {
        L.push(`${i + 1}. ${p.step}`)
        if (p.on_fail) L.push(`   - 막히면: ${p.on_fail}`)
      })
      L.push('')
    }

    if (ty.trap_families.length) {
      L.push(`**되풀이되는 함정** — 계열 ${ty.trap_families.length}개 (원 라벨 ${ty.traps_raw}개를 접은 것)`)
      L.push('')
      for (const f of ty.trap_families) {
        const alias = f.labels.length > 1 ? ` _(같은 계열 라벨 ${f.labels.length}: ${f.labels.join(' · ')})_` : ''
        L.push(`- **${f.key}** — ${f.count}회${alias}`)
        if (f.signature) L.push(`  - 알아보는 법: ${f.signature}`)
      }
      L.push('')
    }

    if (ty.failure_modes.length) {
      L.push(`**학습자가 미끄러지는 자리** (${ty.failure_modes.length})`)
      L.push('')
      for (const f of ty.failure_modes) L.push(`- ${f}`)
      L.push('')
    }

    if (ty.vocab.length) {
      L.push('**이 유형이 요구한 낱말** (요구 문항 수 순)')
      L.push('')
      L.push(ty.vocab.map((v) => `${v.lemma}(${v.items})`).join(' · '))
      L.push('')
    }
  }

  L.push('## 2. 기출 필수 어휘 원천')
  L.push('')
  L.push('분석이 「이 문항을 풀려면 이 낱말을 알아야 한다」고 지목한 낱말. 분석은 **지문에 나온 그 꼴**을 적으므로,')
  L.push('표제어로만 대조하면 굴절형이 전부 「없음」이 된다 — 그래서 「굴절형(표제어)」을 따로 적는다.')
  L.push('**없음** 만이 교재에 실을 뜻이 아직 없는 낱말이다.')
  L.push('')
  L.push('| 낱말 | 문항 | 유형 | 최근 | 사전 | CEFR | V |')
  L.push('| --- | ---: | --- | ---: | :---: | --- | ---: |')
  for (const v of src.vocab) {
    const dict =
      v.match === 'direct' ? '있음' : v.match === 'resolved' ? (v.headword ? `해소(${v.headword})` : '해소됨') : '**없음**'
    L.push(
      `| ${v.lemma} | ${v.items} | ${v.types.slice(0, 3).join(', ')} | ${v.latest_year ?? '—'} | ${dict} | ${
        v.cefr_level ?? '—'
      } | ${v.v_level ?? '—'} |`,
    )
  }
  L.push('')

  L.push('## 3. 회차별 구성')
  L.push('')
  L.push('| 회차 | 구분 | 사정권 문항 | 배점 | 권장 시간 | 예측 정답률 |')
  L.push('| --- | --- | ---: | ---: | ---: | ---: |')
  for (const e of src.exams) {
    L.push(
      `| ${e.label} | ${e.kind === 'suneung' ? '수능' : '모의평가'} | ${e.items} | ${e.points} | ${mmss(
        e.time_budget_sec,
      )} | ${e.predicted_avg === null ? '—' : `${Math.round(e.predicted_avg * 100)}%`} |`,
    )
  }
  L.push('')

  return L.join('\n')
}
