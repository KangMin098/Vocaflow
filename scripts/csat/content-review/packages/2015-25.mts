// scripts/csat/content-review/packages/2015-25.mts
//
// **2015#25 콘텐츠 정정 패키지 — 첫 실제 검수 사례.** 수정안을 데이터로 두고, F 검증기(발행 전 검증 · 변경 영향)를 실제로 돌려
// 결과를 package.json 에 함께 남긴다. DB · 강의 원본 · sidecar 는 바꾸지 않는다(제안만).
//
// 실행: node_modules/.bin/tsx scripts/csat/content-review/packages/2015-25.mts
//   → docs/csat-learner/content-review/2015-25/package.json

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { analyzeImpact } from '../../../../apps/web/src/lib/csat/content-review/impact.ts'
import { validatePrepublish } from '../../../../apps/web/src/lib/csat/content-review/prepublish.ts'
import type { Lecture, LectureCue } from '../../../../apps/web/src/lib/csat/lecture/types.ts'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')
const lectures = JSON.parse(readFileSync(join(ROOT, 'apps/web/src/lib/csat/lecture-data/2015.json'), 'utf8'))
const before: Lecture = (lectures.lectures ?? lectures)['2015#25']
const disclosure = JSON.parse(readFileSync(join(ROOT, 'apps/web/src/lib/csat/lecture/disclosure-data.json'), 'utf8')).lectures['2015#25']

const OFFICIAL = {
  answers: [4, 5],
  basis: 'kice_answer_sheet',
  file: '2015영어영역_정답표_홀수.pdf',
  sha256: 'eec2f40632fe48ff0ab8628ea89b6114ee4036d9531c8c8ba984bbc67db467ce',
  reads: '25번 정답 「④, ⑤」 (홀수형 정답표 원본)',
  reason_source: {
    kind: 'press_verified',
    note: '정정 사유(⑤ 「eighteen percent increase」는 2%→20% 의 퍼센트포인트 차를 퍼센트로 잘못 쓴 진술 — 증가율은 900%)는 2014-11-24 주요 보도로 확인. 평가원 이의심사 원문은 미확보 — 사유는 보도 근거, 정답 집합은 정답표 근거.',
  },
  db: { answer: 4, answers: [4, 5] },
}

/** 강의 cue 수정안 — 바꾸는 cue 만. target 을 옮기는 cue 는 newTarget 을 둔다 */
const CUE_CHANGES: { id: string; why: string; text: string[]; newTarget?: LectureCue['target'] }[] = [
  {
    id: 'c1',
    why: '「답이 아닌 네 선지는 도표와 맞는 진술」은 단일 정답 전제 — 공식 정답은 ④·⑤ 둘. c1 은 정답 공개 경계(stopBefore 3) 앞이라 정답 번호를 밝히지 않고 전제 문장만 지운다.',
    text: ['여러분, 이 문항은 도표와 맞지 않는 진술을 고르는 문제예요. 발문의 않는 것은에 표시하세요.', '선지마다 도표와 맞는지 하나씩 판정합니다.'],
  },
  {
    id: 'c2',
    why: '「몇 포인트 증가는 뺄셈」 자체는 맞지만, ⑤의 「percent increase」를 같은 틀(뺄셈)로 읽게 심는다. 퍼센트포인트(차)와 퍼센트 증가(비율)를 처음부터 가른다.',
    text: ['읽기 전에 할 일은 하나예요. 선지마다 비교 종류를 먼저 표시하세요.', '가장 높다는 크기 비교, 세 배는 나눗셈이에요. 퍼센트 값끼리 몇 포인트 늘었다는 건 뺄셈이지만, 몇 퍼센트 증가는 원래 값에 대한 비율입니다.'],
  },
  {
    id: 'c4',
    why: '「사 번이 정답」만 말해 공식 복수정답 ⑤를 빠뜨린다. 정답 공개 경계 지점(index 3)이므로 여기서 정답 집합을 처음 밝힌다.',
    text: ['여기 다섯 번째 문장, 사 번이 정답입니다.', '오 번도 정답이에요. 평가원이 두 선지를 함께 인정했어요.', '이메일 주소는 이천육 년 이십구, 이천십이 년 오십삼이에요.'],
  },
  {
    id: 'c9',
    why: '공식 정답 ⑤를 「맞는 진술이고, 답이 아닙니다」로 소거한다(정면 충돌). 하이라이트 대상도 reject:5 → answer 로 옮겨야 소거 대상으로 읽히지 않는다.',
    text: [
      '오 번은 여섯 번째 문장을 짚어 보세요. 휴대폰 번호는 이에서 이십으로, 값의 차이는 십팔 퍼센트포인트예요.',
      '그런데 선지는 십팔 퍼센트 증가라고 했죠. 이에서 이십이면 원래 값의 아홉 배가 늘어난 것이라, 증가율은 구백 퍼센트입니다.',
      '퍼센트와 퍼센트포인트를 섞어 쓴 진술이라 도표와 맞지 않아요.',
      '그래서 오 번도 정답입니다.',
    ],
    newTarget: { kind: 'analysis', id: 'answer' },
  },
  {
    id: 'c11',
    why: '「increase — 여기서는 뺄셈」은 ⑤의 percent increase 를 뺄셈으로 고착시킨다.',
    text: ['어휘를 보세요.', 'three times higher', '세 배, 곧 나눗셈으로 확인합니다.', 'increase', '증가. 몇 퍼센트 증가는 비율이고, 퍼센트포인트는 두 퍼센트 값의 차이예요.', 'category', '항목,', 'overall', '전반적인이라는 뜻입니다.'],
  },
  {
    id: 'c12',
    why: '「증가는 빼서 확인한다, 이것이 규칙」은 틀린 일반 규칙(퍼센트 증가는 비율) — 과잉 일반화.',
    text: ['정리할게요. 배수는 나눠서, 퍼센트 증가는 원래 값에 대한 비율로, 퍼센트포인트는 빼서 확인합니다.', '다음에는 첫 십 초에 선지마다 크기, 배수, 비율, 차이 중 어느 비교인지부터 표시하세요.'],
  },
]

const after: Lecture = {
  ...before,
  version: before.version + 1,
  cues: before.cues.map((c) => {
    const ch = CUE_CHANGES.find((x) => x.id === c.id)
    if (!ch) return c
    return { ...c, target: ch.newTarget ?? c.target, segments: ch.text.map((t) => ({ lang: 'ko-KR' as const, text: t.replace(/^(three times higher|increase|category|overall)$/, '$1') })) }
  }),
}
// 영어 낭독 조각은 en-US 로(원본과 같은 규칙)
for (const c of after.cues) {
  c.segments = c.segments.map((s) => (/^[a-z ]+$/i.test(s.text) ? { lang: 'en-US' as const, text: s.text } : s))
}

/** 분석 v6 제안 — v5(published) 기준, 바꾸는 칸만 */
const ANALYSIS_V6 = {
  base_version: 5,
  design_intent:
    'Email Addresses 는 2006년 29%, 2012년 53%다. 53÷29 는 약 1.8배라 「three times」가 성립하지 않는다(④). Cell Phone Numbers 는 2%→20%로, 두 퍼센트 값의 차는 18 퍼센트포인트이지만 증가율은 900%다. ⑤의 「an eighteen percent increase」는 퍼센트포인트를 퍼센트로 쓴 진술이라 도표와 맞지 않고, 평가원은 정답표에서 ④·⑤를 모두 정답으로 인정했다. [사실] 정답 집합 ④·⑤ — 평가원 정답표. [보도 근거] ⑤의 정정 사유(퍼센트·퍼센트포인트 혼동). [가설] 원래 출제 설계는 ④ 하나를 겨냥했을 가능성 — 공식 확인 없음.',
  answer_locus: {
    quote: ['the percentage of 2012 was three times higher than that of 2006', 'an eighteen percent increase in the category of cell phone numbers'],
    reasoning: '④: 29×3=87 이어야 하지만 53 이라 약 1.8배. ⑤: 2→20 의 차는 18 퍼센트포인트, 증가율은 (20−2)÷2=900% 라 「eighteen percent increase」는 도표와 어긋난다. 정답 집합은 평가원 정답표의 ④·⑤.',
    sentence_index: [5, 6],
  },
  choice_n5: {
    n: 5,
    verdict: 'correct',
    trap: '퍼센트·퍼센트포인트 혼동',
    why_correct:
      '[6]의 「an eighteen percent increase」를 Cell Phone Numbers 의 두 값으로 확인한다. 2→20 은 차이로는 18 퍼센트포인트, 원래 값 대비 증가율로는 900%다. 「percent increase」는 증가율을 말하므로 18% 증가는 도표와 맞지 않는다. 평가원은 이 선지를 ④와 함께 정답으로 인정했다(정답표 「④, ⑤」).',
    confirmed_at: { note: '평가원 정답표 2015 홀수형 25번 「④, ⑤」(sha256 eec2f406…). 도표 값은 v5 확인값(Cell Phone Numbers 2/20) 그대로.', sentence_index: [6] },
  },
  solve_procedure_step2: {
    from: '선지마다 비교 종류를 표시한다 — each/highest 는 크기 비교, three times 는 나눗셈, increase 숫자는 뺄셈.',
    to: '선지마다 비교 종류를 표시한다 — each/highest 는 크기 비교, three times 는 나눗셈, 「몇 퍼센트 증가」는 원래 값 대비 비율, 「몇 퍼센트포인트」는 뺄셈.',
  },
}

/** v3 탐구(inquiry-data.json) 수정안 */
const INQUIRY = {
  distractors_remove_n5: '⑤를 distractors(「맞는 진술」)에서 뺀다 — 공식 정답이다.',
  principle_statement: {
    from: '도표 문항의 배수 진술(three times)은 두 값의 비율로, 증가 진술(an increase)은 차이로 계산 방식을 갈라 검산한다',
    to: '도표 문항의 배수 진술(three times)과 퍼센트 증가 진술(percent increase)은 비율로, 퍼센트포인트 진술은 차이로 계산 방식을 갈라 검산한다',
  },
}

// ── F 검증기로 실제 확인 ─────────────────────────────────────────
const verdictsBefore = [1, 2, 3].map((n) => ({ choice: n, verdict: 'distractor' })).concat([{ choice: 4, verdict: 'correct' }, { choice: 5, verdict: 'distractor' }])
const verdictsAfter = verdictsBefore.map((v) => (v.choice === 5 ? { ...v, verdict: 'correct' } : v))
// 검증기는 정답 선지를 'answer' 로 읽는다 — 분석의 'correct' 를 같은 뜻으로 넘긴다
const asAnswer = (vs: { choice: number; verdict: string }[]) => vs.map((v) => ({ ...v, verdict: v.verdict === 'correct' ? 'answer' : v.verdict }))

const nowReport = validatePrepublish({ itemId: '2015#25', officialAnswers: OFFICIAL.answers, choiceVerdicts: asAnswer(verdictsBefore), cues: before.cues })
const afterReport = validatePrepublish({ itemId: '2015#25', officialAnswers: OFFICIAL.answers, choiceVerdicts: asAnswer(verdictsAfter), cues: after.cues })
const impact = analyzeImpact({
  before, after,
  passageSentenceCount: 6,
  disclosure,
  analysisVersionBefore: 5,
  analysisVersionAfter: 6,
  analysisChanged: true,
})

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16)
const pkg = {
  schema: 'content-review-package/1',
  item_id: '2015#25',
  status: { human_content_approval: 'none', db_changed: false, lecture_changed: false, published: false },
  official: OFFICIAL,
  binding: { lecture_version: before.version, lecture_digest_disclosure: disclosure?.digest ?? null, analysis_published_versions: [1, 2, 3, 4, 5], analysis_latest: 5 },
  errors: [
    { where: 'analysis v1~v5 choice_analysis n5', current: 'verdict distractor · 「20−2=18 … 맞는 진술이라 답이 아니다」', severity: 'BLOCK', fix: 'v6 에서 verdict correct + why_correct' },
    { where: 'analysis v5 design_intent · answer_locus', current: '④ 만 설명 · sentence_index [5]', severity: 'REVIEW', fix: '④·⑤ 와 [5,6]' },
    { where: 'analysis v5 solve_procedure step2', current: '「increase 숫자는 뺄셈」 — 틀린 일반 규칙', severity: 'BLOCK', fix: '퍼센트 증가=비율 · 퍼센트포인트=차' },
    { where: 'analysis v1~v4 solve_procedure 마지막 단계', current: '「X 가 둘이면 ⑤를 곱셈으로 처리하지 않았는지」 — 단일 정답 전제', severity: 'REVIEW', fix: '옛 판본 — v6 published 뒤 노출 경로 확인(최신만 노출이면 무수정 보존)' },
    { where: 'lecture c1', current: before.cues[0]!.segments.map((s) => s.text).join(' / '), severity: 'BLOCK', fix: 'CUE_CHANGES c1' },
    { where: 'lecture c2 · c11 · c12', current: '퍼센트 증가를 뺄셈으로 가르치는 일반 규칙', severity: 'BLOCK', fix: 'CUE_CHANGES c2 · c11 · c12' },
    { where: 'lecture c4', current: '「사 번이 정답」 — ⑤ 누락', severity: 'BLOCK', fix: 'CUE_CHANGES c4' },
    { where: 'lecture c9 (target reject:5)', current: '공식 정답 ⑤를 소거', severity: 'BLOCK', fix: 'CUE_CHANGES c9 · target answer 로 이동' },
    { where: 'inquiry-data.json 2015#25 (v3 탐구 · review verified)', current: 'distractors 에 ⑤(truth true) · principle 「증가 진술은 차이로」', severity: 'BLOCK', fix: 'INQUIRY' },
    { where: '학습자 화면 정답 표시 — ItemScreen.tsx:100 · overlay-reveal.ts:135 · theater.ts', current: '단일 answer(4)만 「정답」 표시', severity: 'BLOCK', fix: 'K4-a(csat-judgment-d owner) — answers 집합 소비' },
  ],
  correct_statements_kept: ['c3 도표 소개', 'c5 ④ 배수 계산(53÷29≈1.8)', 'c6~c8 ①②③ 소거', 'c10 배수 과장 함정(열 배 = 900% 증가와 정합)', 'analysis v5 ①~④ 판정·도표 값'],
  lecture_changes: CUE_CHANGES,
  lecture_after_preview: after.cues.map((c) => ({ id: c.id, target: `${c.target.kind}:${c.target.id}`, text: c.segments.map((s) => s.text).join(' / ') })),
  analysis_v6: ANALYSIS_V6,
  inquiry: INQUIRY,
  validation: {
    prepublish_now: nowReport,
    prepublish_after: afterReport,
    impact,
  },
  hashes: { cue_changes: sha(JSON.stringify(CUE_CHANGES)), analysis_v6: sha(JSON.stringify(ANALYSIS_V6)) },
}

const out = join(ROOT, 'docs/csat-learner/content-review/2015-25/package.json')
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, JSON.stringify(pkg, null, 2) + '\n')
console.log(JSON.stringify({
  now_blocked: nowReport.blocked, now: nowReport.findings.map((f) => `${f.code}@${f.where}`),
  after_blocked: afterReport.blocked, after: afterReport.findings.map((f) => `${f.code}@${f.where}`),
  impact: { changed: impact.changedCues, version_bump: impact.lectureVersionBumpRequired, disclosure_invalidated: impact.disclosureInvalidated, analysis_bump: impact.analysisRevisionBumpRequired, findings: impact.findings.map((f) => `${f.severity}:${f.code}@${f.cueId ?? '-'}`) },
}, null, 1))
