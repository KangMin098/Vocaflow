// apps/web/src/lib/csat/evidence.ts
//
// **기출 원천 콘솔 적재기 — 802문항을 한 벌로 읽어 결함까지 판정해 내려보낸다.**
//
// ── 왜 한 번에 전부 읽나 ──────────────────────────────────────────────
// 이 화면은 축 두 개를 골라 같은 집합을 다시 접는다. 축을 바꿀 때마다 서버에 물으면 조작이
// 네트워크 왕복이 되어 「겹쳐 보는」 일이 사라진다 — 탭 시절로 되돌아간다. 그래서 서버가
// **문항 한 줄씩(약 200바이트 × 802 ≈ 160kB)** 을 한 번에 내려 주고, 접는 일은 전부 브라우저가
// 한다. 대신 서버는 판정에 필요한 무거운 것(지문 876kB · 선지 분석 1.4MB)을 **혼자** 읽고
// 결과 불리언만 넘긴다.
//
// ⚠️ **RLS 를 우회한다**(`createCsatClient`). 반드시 `requireAdmin*` 게이트 뒤에서만 쓴다.
// ⚠️ **`csat_items.passage` 는 이 파일 밖으로 나가지 않는다.** 여기서만 읽고, 인용이 그 안에
//    있는지 판정해 `quoteLocated` 불리언 하나로 바꾼다. 평가원 저작물이 브라우저로 새는 경로를
//    타입으로 막는 것이 `EvidenceItem` 에 지문 칸이 없는 이유다.

import 'server-only'

import { createCsatClient, selectAllPages } from './client'
import {
  detectTypeReportMeta,
  type DefectCode,
  type EvidenceData,
  type EvidenceExam,
  type EvidenceItem,
  type EvidenceType,
} from './evidence-fold'
import { normalizeForMatch } from './quote-match'

type ExamRow = { id: string; label: string; kind: string; year: number; month: number }
type TypeRow = { id: string; name: string; status: string }
type ReportRow = {
  type_id: string
  n_analyzed: number
  answer_locus_pattern: string | null
  failure_modes: unknown
  procedure_steps: unknown
}
type ItemRow = {
  id: string
  exam_id: string
  no: number
  type_id: string | null
  points: number | null
  answer: number | null
  answers: number[] | null
  high_score: boolean
  body_ok: boolean
  passage: string | null
}
type AnalysisRow = {
  id: string
  item_id: string
  version: number
  answer_locus: { quote?: string } | null
  choice_analysis: { n: number; trap?: string | null; why_correct?: string | null; how_to_reject?: string | null }[] | null
  solve_procedure: unknown[] | null
  required_vocab: string[] | null
  time_budget_sec: number | null
  difficulty: { predicted?: number } | null
}
type ReviewRow = { analysis_id: string; persona: string; verdict: string }

const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])

/**
 * `.in()` 한 번에 실어 보낼 id 수.
 *
 * 이 값은 취향이 아니라 **URL 길이**다 — uuid 하나가 36자 + 구분자라 200개면 쿼리스트링이
 * 7KB 를 넘고, 그 앞에 선 프록시가 414 로 끊으면 화면은 이유 없이 빈다. 100 이면 3.7KB 다.
 */
const ID_CHUNK = 100

/** 첫 실패에 조회 이름을 붙인다 — 「어디가」 없는 오류 메시지는 고칠 자리를 안 가르쳐 준다. */
function firstLabeled(pairs: [string, string | null | undefined][]): string | null {
  for (const [label, msg] of pairs) if (msg) return `${label}: ${msg}`
  return null
}

/**
 * 지문을 실어 오는 조회의 창 크기.
 *
 * 1,000(PostgREST 의 상한)이 아니라 200인 이유는 **응답 크기**다 — 지문 평균 1,123자라
 * 1,000행이면 한 요청이 1MB 를 넘고, 그 한 건이 8초 예산 안에 못 들어오면 화면 전체가 빈다.
 * 요청 수가 넷으로 늘어나는 것은 이 화면이 요청당 한 번만 도므로 값이 싸다.
 */
const PASSAGE_WINDOW = 200

/**
 * `.range()` 를 **정해진 창 크기로** 끝까지 돈다.
 *
 * `selectAllPages` 는 창이 1,000 으로 박혀 있다(행 수가 상한인 경우를 위한 것이다). 여기서
 * 문제가 되는 것은 행 수가 아니라 **한 응답의 바이트**라 창을 따로 준다. 마지막 페이지가
 * 창보다 작으면 멈추는 규칙은 같다.
 */
async function pagedWindow<T>(
  size: number,
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const out: T[] = []
  for (let from = 0; ; from += size) {
    const res = await run(from, from + size - 1)
    if (res.error) return { rows: out, error: res.error.message }
    const batch = (res.data ?? []) as T[]
    out.push(...batch)
    if (batch.length < size) break
    // 조회가 잘못 걸려 표 전체를 끌어오는 사고를 여기서 멈춘다.
    if (out.length >= 100_000) break
  }
  return { rows: out, error: null }
}

/**
 * 같은 조회를 id 묶음으로 나눠 던지고 합친다 — **묶음끼리는 동시에** 간다.
 *
 * 순차로 돌렸더니 한 화면이 15~67초였다(실측 2026-09-16 · 802개면 묶음 9개 × 조회 2종 =
 * 왕복 18회). 묶음을 나눈 이유는 **URL 길이**지 DB 부하가 아니므로 순서를 지킬 까닭이 없다 —
 * 동시에 던지면 왕복이 1회분 시간으로 접힌다. 반환 순서는 `Promise.all` 이 보존한다.
 */
async function selectByIds<T>(
  ids: string[],
  run: (chunk: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
): Promise<{ rows: T[]; error: string | null }> {
  const chunks: string[][] = []
  for (let i = 0; i < ids.length; i += ID_CHUNK) chunks.push(ids.slice(i, i + ID_CHUNK))
  const results = await Promise.all(chunks.map((c) => run(c)))
  const out: T[] = []
  for (const res of results) {
    if (res.error) return { rows: out, error: res.error.message }
    out.push(...((res.data ?? []) as T[]))
  }
  return { rows: out, error: null }
}

/** `items-fold.ts` 의 `MIN_WHY` 와 같은 잣대 — 두 화면이 다른 길이를 쓰면 같은 문항이 두 판정을 갖는다. */
const MIN_WHY = 40

/**
 * 인용이 지문 안에 있나.
 *
 * 그대로 `indexOf` 하면 802문항 중 771만 찾힌다 — PDF 에서 뽑은 지문과 사람이 쓴 인용문이 같은
 * 글자를 다른 코드포인트로 적기 때문이다(“ vs " · — vs -). `normalizeForMatch` 로 접으면
 * **791** 이고, 못 찾는 11건은 **전부 `body_ok = false`**(지문 자체가 잘린 것)다 — 실측 2026-09-15.
 * 즉 지문이 온전한 589문항은 **589/589 전부** 찾힌다. 매칭기의 한계가 아니라 원천의 결함이다.
 */
function quoteLocated(passage: string | null, quote: string | null | undefined): boolean {
  const q = (quote ?? '').trim()
  if (!q) return false
  const p = passage ?? ''
  if (!p) return false
  return normalizeForMatch(p).text.includes(normalizeForMatch(q).text)
}

/**
 * 콘솔 한 벌.
 *
 * 다섯 조회가 전부 1,000행 벽을 넘거나 넘을 수 있다 — `csat_item_analyses` 3,069행 ·
 * `csat_analysis_reviews` 9,207행 · `csat_items` 802행. 전부 `selectAllPages` 를 지나간다.
 * (이 저장소는 PostgREST 가 **오류 없이 1,000행에서 자르는** 것에 여러 번 데었다.)
 */
export async function loadEvidence(): Promise<EvidenceData> {
  const db = createCsatClient()
  const empty: EvidenceData = {
    items: [],
    exams: [],
    types: [],
    generatedAt: new Date().toISOString().slice(0, 19).replace('T', ' ') + 'Z',
    loadError: null,
  }

  // ── 1단계: 가벼운 것 + 「어느 판이 최신인가」만 ───────────────────────
  //
  // 분석은 덮지 않고 **버전을 올려 새 행**으로 쌓인다 — 802문항에 3,069행이다. 무거운 칸
  // (`choice_analysis` 1.4MB · `answer_locus`)을 전부 끌어와 놓고 74%를 버리면, 화면이 느린
  // 것으로 끝나지 않고 **statement timeout 으로 빈 화면이 된다**(실측 2026-09-16). 그래서
  // 먼저 id·버전만 받아 최신 802개를 고르고, 무거운 칸은 그 802개만 가져온다.
  const [examsRes, typesRes, reportsRes, itemsPaged, headsPaged] = await Promise.all([
    db.from('csat_exams').select('id, label, kind, year, month'),
    db.from('csat_types').select('id, name, status').eq('in_scope', true),
    db
      .from('csat_type_reports')
      .select('type_id, n_analyzed, answer_locus_pattern, failure_modes, procedure_steps')
      .eq('status', 'published'),
    // ⚠️ **지문을 1,000행씩 끌어오면 8초 예산을 넘긴다.** `authenticator` 의
    //    `statement_timeout` 은 8s 이고, 802행 × 평균 1,123자 = 876kB 를 한 요청에 담으면
    //    DB 가 한가할 때만 통과한다 — 드레인이 도는 시각에는 `canceling statement due to
    //    statement timeout` 으로 화면이 통째로 빈다(실측 2026-09-16). 창을 200행으로 좁히면
    //    요청이 넷으로 늘어나는 대신 각각이 220kB 라 부하 중에도 들어온다.
    //    ⚠️ 지문을 빼면 인용 대조를 못 한다 — 줄일 수 있는 것은 **요청당 행 수**뿐이다.
    pagedWindow<ItemRow>(PASSAGE_WINDOW, (from, to) =>
      db
        .from('csat_items')
        .select('id, exam_id, no, type_id, points, answer, answers, high_score, body_ok, passage')
        .eq('in_scope', true)
        .order('id', { ascending: true })
        .range(from, to),
    ),
    selectAllPages<{ id: string; item_id: string; version: number }>((from, to) =>
      db.from('csat_item_analyses').select('id, item_id, version').eq('status', 'published').range(from, to),
    ),
  ])

  // **어느 조회가 죽었는지 이름을 붙여 올린다.** 조회 일곱이 하나의 문자열로 합쳐지면
  // 「statement timeout」만 보이고 어디를 고쳐야 하는지가 사라진다 — 실측 2026-09-16 에
  // 그 화면을 보고 30분을 엉뚱한 조회에 썼다. 모든 PostgREST 요청은 `authenticator` 의
  // **8초** 예산 안에서 끝나야 한다(`statement_timeout=8s`).
  const headError = firstLabeled([
    ['회차', examsRes.error?.message],
    ['유형', typesRes.error?.message],
    ['유형 리포트', reportsRes.error?.message],
    ['문항(지문 포함)', itemsPaged.error],
    ['분석 버전 목록', headsPaged.error],
  ])
  if (headError) return { ...empty, loadError: headError }

  const latestHead = new Map<string, { id: string; item_id: string; version: number }>()
  for (const h of headsPaged.rows) {
    const cur = latestHead.get(h.item_id)
    if (!cur || h.version > cur.version) latestHead.set(h.item_id, h)
  }
  const latestIds = [...latestHead.values()].map((h) => h.id)

  // ── 2단계: 최신 판의 무거운 칸과 그 판에 달린 검수만 ──────────────────
  const [bodies, reviews] = await Promise.all([
    selectByIds<AnalysisRow>(latestIds, (chunk) =>
      db
        .from('csat_item_analyses')
        .select(
          'id, item_id, version, answer_locus, choice_analysis, solve_procedure, required_vocab, time_budget_sec, difficulty',
        )
        .in('id', chunk),
    ),
    // **옛 판에 달린 검수는 아무것도 보증하지 않는다.** 9,207행 중 최신 판에 달린 것은
    // 2,406(= 802 × 3)뿐이다. 전부 끌어와 세면 「넉넉하다」로 보이지만 그 수는 거짓이다.
    selectByIds<ReviewRow>(latestIds, (chunk) =>
      db.from('csat_analysis_reviews').select('analysis_id, persona, verdict').in('analysis_id', chunk),
    ),
  ])

  const bodyError = firstLabeled([
    ['분석 본문', bodies.error],
    ['검수 기록', reviews.error],
  ])
  if (bodyError) return { ...empty, loadError: bodyError }

  const latest = new Map<string, AnalysisRow>(bodies.rows.map((a) => [a.item_id, a]))

  // **행이 아니라 페르소나 집합을 센다.** 같은 눈이 세 번 본 것은 다각이 아니다
  // (`publish-gate.ts` 의 `countTriPersonaPassed` 와 같은 규칙).
  const passers = new Map<string, Set<string>>()
  for (const r of reviews.rows) {
    if (r.verdict !== 'pass') continue
    let s = passers.get(r.analysis_id)
    if (!s) passers.set(r.analysis_id, (s = new Set()))
    s.add(r.persona)
  }

  const examRows = (examsRes.data ?? []) as ExamRow[]
  const typeRows = (typesRes.data ?? []) as TypeRow[]
  const reportRows = (reportsRes.data ?? []) as ReportRow[]

  const examById = new Map(examRows.map((e) => [e.id, e]))
  const typeById = new Map(typeRows.map((t) => [t.id, t]))
  const reportByType = new Map(reportRows.map((r) => [r.type_id, r]))

  // ── 유형 리포트의 결함을 먼저 판정한다 — 문항 결함이 여기서 파생된다 ──
  const itemsPerType = new Map<string, number>()
  for (const it of itemsPaged.rows) {
    if (it.type_id) itemsPerType.set(it.type_id, (itemsPerType.get(it.type_id) ?? 0) + 1)
  }

  const types: EvidenceType[] = typeRows.map((t) => {
    const rep = reportByType.get(t.id)
    return {
      id: t.id,
      name: t.name,
      status: t.status === 'retired' ? 'retired' : 'active',
      items: itemsPerType.get(t.id) ?? 0,
      reportN: rep?.n_analyzed ?? null,
      analystMeta: rep
        ? detectTypeReportMeta({
            answer_locus_pattern: rep.answer_locus_pattern,
            failure_modes: arr<string>(rep.failure_modes),
            procedure_steps: arr<{ step?: string }>(rep.procedure_steps),
          })
        : [],
    }
  })

  const typeTextBad = new Set(types.filter((t) => t.analystMeta.length > 0).map((t) => t.id))
  // 리포트가 아예 없는 유형은 계수 불일치로 세지 않는다 — 없는 것과 틀린 것은 다르다.
  const typeCountBad = new Set(
    types.filter((t) => t.reportN != null && t.reportN !== t.items).map((t) => t.id),
  )

  // ── 문항 ─────────────────────────────────────────────────────────────
  const items: EvidenceItem[] = itemsPaged.rows.map((it) => {
    const a = latest.get(it.id) ?? null
    const choices = a?.choice_analysis ?? []
    const correct = it.answer != null ? choices.find((c) => c.n === it.answer) : choices.find((c) => c.why_correct)
    const distractors = choices.filter((c) => c !== correct)
    const rejected = distractors.filter((c) => (c.how_to_reject ?? '').trim().length >= MIN_WHY).length
    const traps = [
      ...new Set(
        distractors
          .map((c) => (c.trap ?? '').trim())
          .filter((t) => t.length > 0),
      ),
    ]

    const exam = examById.get(it.exam_id)
    const type = it.type_id ? typeById.get(it.type_id) : null
    const points = it.points ?? 0
    const answerCount = it.answers?.length ?? (it.answer == null ? 0 : 1)
    const located = quoteLocated(it.passage, a?.answer_locus?.quote)
    const reviewed3 = a ? (passers.get(a.id)?.size ?? 0) >= 3 : false

    const defects: DefectCode[] = []
    if (!it.body_ok) defects.push('body')
    if (!located) defects.push('quote')
    if (it.high_score !== (points === 3)) defects.push('scoring')
    if (answerCount > 1) defects.push('answerKey')
    if (it.type_id && typeTextBad.has(it.type_id)) defects.push('reportText')
    if (it.type_id && typeCountBad.has(it.type_id)) defects.push('reportCount')

    return {
      id: it.id,
      examId: it.exam_id,
      examLabel: exam?.label ?? it.exam_id,
      year: exam?.year ?? 0,
      kind: exam?.kind === 'suneung' ? 'suneung' : 'mock',
      no: it.no,
      typeId: it.type_id ?? '—',
      typeName: type?.name ?? it.type_id ?? '미분류',
      points,
      highScore: it.high_score,
      answer: it.answer,
      answerCount,
      steps: a?.solve_procedure?.length ?? 0,
      vocab: a?.required_vocab?.length ?? 0,
      traps,
      predicted: typeof a?.difficulty?.predicted === 'number' ? a.difficulty.predicted : 0,
      timeSec: a?.time_budget_sec ?? 0,
      whyLen: (correct?.why_correct ?? '').trim().length,
      rejected,
      distractors: distractors.length,
      bodyOk: it.body_ok,
      quoteLocated: located,
      reviewed3,
      defects,
    }
  })

  const itemsPerExam = new Map<string, number>()
  for (const it of items) itemsPerExam.set(it.examId, (itemsPerExam.get(it.examId) ?? 0) + 1)

  const exams: EvidenceExam[] = examRows.map((e) => ({
    id: e.id,
    label: e.label,
    kind: e.kind === 'suneung' ? 'suneung' : 'mock',
    year: e.year,
    month: e.month,
    items: itemsPerExam.get(e.id) ?? 0,
  }))

  return { ...empty, items, exams, types }
}
