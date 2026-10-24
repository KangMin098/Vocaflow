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
import { lectureTargets } from '../../../../apps/web/src/lib/csat/lecture/targets.ts'
import type { Lecture, LectureCue } from '../../../../apps/web/src/lib/csat/lecture/types.ts'
import { validateLecture } from '../../../../apps/web/src/lib/csat/lecture/validate.ts'

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
    kind: 'official_briefing',
    url: 'https://www.korea.kr/news/policyNewsView.do?newsId=148787539',
    publisher: '대한민국 정책브리핑(교육부 정책뉴스) · 2014-11-24 — 평가원 이의심사 결과 발표',
    quote: "'percent'는 백분율을 나타내고, 'percent point'는 백분율 간 차이를 나타내기 때문에 'percent'라고 표현한 답지 ⑤번은 주어진 그래프의 내용과 일치하지 않는다",
    note: '복수정답(④·⑤)과 ⑤의 퍼센트·퍼센트포인트 혼동 사유 모두 공식 발표 사실. 원래 ④ 하나만 의도했다는 추정은 공식 근거 없음 — 출제 의도로 확정하지 않는다.',
    press_also: ['https://www.ajunews.com/view/20141124104332823', 'https://www.kwnews.co.kr/article/201411241722091'],
  },
  db: { answer: 4, answers: [4, 5] },
}

/** 강의 cue 수정안 — 바꾸는 cue 만. target 을 옮기는 cue 는 newTarget 을 둔다 */
const CUE_CHANGES: { id: string; why: string; text: string[]; newTarget?: LectureCue['target']; newRole?: LectureCue['role']; moveAfter?: string }[] = [
  {
    id: 'c1',
    why: '「답이 아닌 네 선지는 도표와 맞는 진술」은 단일 정답 전제 — 공식 정답은 ④·⑤ 둘. c1 은 정답 공개 경계(stopBefore 3) 앞이라 정답 번호를 밝히지 않고 전제 문장만 지운다.',
    text: ['여러분, 이 문항은 도표와 맞지 않는 진술을 고르는 문제예요. 발문의 않는 것은에 표시하세요.', '선지마다 도표와 맞는지 하나씩 판정합니다.'],
  },
  {
    id: 'c2',
    why: '「몇 포인트 증가는 뺄셈」 자체는 맞지만, ⑤의 「percent increase」를 같은 틀(뺄셈)로 읽게 심는다. 퍼센트포인트(차)와 퍼센트 증가(비율)를 처음부터 가른다.',
    text: ['선지마다 비교 종류를 먼저 표시하세요.', '최고는 크기 비교, 세 배는 나눗셈, 몇 퍼센트 증가는 비율, 몇 포인트는 뺄셈입니다.'],
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
      '여기 여섯 번째 문장을 보세요. 휴대폰 번호는 이에서 이십, 차이는 십팔 퍼센트포인트예요.',
      '증가율로는 구백 퍼센트라, 십팔 퍼센트 증가는 도표와 맞지 않아요.',
      '그래서 오 번도 정답입니다.',
    ],
    // analysis:answer 블록은 단일 정답(④)의 칩·해설만 보여 준다(theater.ts:218 · learner.ts:616) — ⑤ 설명과 어긋난다.
    // c9 가 말하는 「여섯 번째 문장」 그 자리(지문 지도 index 5 = ⑤ 선지 문장)를 비춘다 — 화면 복수정답 처리(K4-a)와 무관하게 맞다
    newTarget: { kind: 'anchor', id: 'sentence:5' },
    // 소거(eliminate) 역할은 원문 자리를 가리킬 수 없다(validate role-target) — ⑤ 의 정답 근거이므로 evidence 로, c5 바로 뒤로
    newRole: 'evidence',
    moveAfter: 'c5',
  },
  {
    id: 'c10',
    why: '④(이메일 주소)의 배수 과장 함정을 ⑤ 항목(휴대폰 번호 열 배)으로 설명한다 — 서로 다른 항목을 「그래서 세 배도 그럴듯해 보인다」로 잇는 근거 없는 추정이고, ⑤가 정답이 된 뒤에는 휴대폰 번호를 ④의 함정 재료로 쓰는 것이 학습자를 헷갈리게 한다. 함정 설명을 ④ 항목 안으로 좁힌다(정답 공개 경계 뒤 index 9 — 공개 위험 없음).',
    // r2(감수 A·B 합의): 근거 없는 학습자 반응 전제(「세 배쯤 보이기 쉽죠」)와 「도」를 빼고, 두 배에도 못 미친다는 사실로 c5 의 1.8배와 맞춘다
    text: ['여기 다섯 번째 문장의 배수 주장을 확인하세요.', '이메일 주소는 이십구에서 오십삼으로 늘었지만, 두 배인 오십팔에도 못 미쳐요.', '배수가 나오면 작은 값에 배수를 곱해 큰 값과 직접 견주세요.'],
  },
  {
    id: 'c11',
    why: '「increase — 여기서는 뺄셈」은 ⑤의 percent increase 를 뺄셈으로 고착시킨다.',
    text: ['어휘를 보세요.', 'three times higher', '세 배, 나눗셈으로 확인합니다.', 'increase', '증가, 퍼센트 증가는 비율이에요.', 'category', '항목,', 'overall', '전반적인.'],
  },
  {
    id: 'c12',
    why: '「증가는 빼서 확인한다, 이것이 규칙」은 틀린 일반 규칙(퍼센트 증가는 비율) — 과잉 일반화.',
    // r2(감수 A·B 합의): 배수는 c5·c10 과 같이 「곱해 견준다」, 퍼센트 증가율은 늘어난 양이 분자임을 밝힌다(최종값 비율 1000% 와 혼동 방지)
    text: ['정리할게요. 배수는 곱해 견주고, 퍼센트 증가율은 늘어난 양을 처음 값으로 나눠요.', '퍼센트포인트는 두 값을 빼요.', '다음에는 첫 십 초에 선지마다 비교 종류부터 표시하세요.'],
  },
]

const edited = before.cues.map((c) => {
  const ch = CUE_CHANGES.find((x) => x.id === c.id)
  if (!ch) return c
  // focus 는 적재가 계산해 덮는 값이다 — 대상을 옮긴 cue 는 옛 focus 를 들고 가지 않는다
  const { focus: _oldFocus, ...rest } = c
  void _oldFocus
  return { ...rest, role: ch.newRole ?? c.role, target: ch.newTarget ?? c.target, segments: ch.text.map((t) => ({ lang: 'ko-KR' as const, text: t })) }
})
// 자리 옮기기(moveAfter) 후 order 다시 매김
for (const ch of CUE_CHANGES.filter((x) => x.moveAfter)) {
  const from = edited.findIndex((c) => c.id === ch.id)
  const [moved] = edited.splice(from, 1)
  edited.splice(edited.findIndex((c) => c.id === ch.moveAfter) + 1, 0, moved!)
}
const after: Lecture = { ...before, version: before.version + 1, cues: edited.map((c, i) => ({ ...c, order: i + 1 })) }
// 영어 낭독 조각은 en-US 로(원본과 같은 규칙)
for (const c of after.cues) {
  c.segments = c.segments.map((s) => (/^[a-z ]+$/i.test(s.text) ? { lang: 'en-US' as const, text: s.text } : s))
}

/** 분석 v6 제안 — v5(published) 기준, 바꾸는 칸만 */
const ANALYSIS_V6 = {
  base_version: 5,
  design_intent:
    'Email Addresses 는 2006년 29%, 2012년 53%다. 53÷29 는 약 1.8배라 「three times」가 성립하지 않는다(④). Cell Phone Numbers 는 2%→20%로, 두 퍼센트 값의 차는 18 퍼센트포인트이지만 증가율은 900%다. ⑤의 「an eighteen percent increase」는 퍼센트포인트를 퍼센트로 쓴 진술이라 도표와 맞지 않고, 평가원은 ④·⑤를 모두 정답으로 인정했다. [공식 사실] 정답 집합 ④·⑤(정답표) · ⑤ 인정 사유 percent 와 percent point 의 구분(평가원 이의심사 결과 발표, 정책브리핑 2014-11-24). [확정하지 않음] 원래 ④ 하나만 의도했는지는 공식 근거가 없다.',
  // answer_locus.quote 는 **문자열**이다(binding/adapter.ts:51 · evidence.ts:60 · learner.ts 의 quote 처리) — 배열로 바꾸면 로더가 깨진다.
  // quote 는 v5 그대로(④ 문장) 두고, 근거 설명과 문장 번호(분석은 1부터: ④=[5] · ⑤=[6])에 ⑤를 더한다. 그 밖의 키는 보존.
  answer_locus_patch: {
    reasoning: '④: 29×3=87 이어야 하지만 53 이라 약 1.8배. ⑤: 2→20 의 차는 18 퍼센트포인트, 증가율은 (20−2)÷2=900% 라 「eighteen percent increase」는 도표와 어긋난다. 정답 집합은 평가원 정답표의 ④·⑤.',
    sentence_index: [5, 6],
  },
  choice_n5: {
    n: 5,
    verdict: 'correct',
    trap: '퍼센트·퍼센트포인트 혼동',
    why_correct:
      '[6]의 「an eighteen percent increase」를 Cell Phone Numbers 의 두 값으로 확인한다. 2→20 은 차이로는 18 퍼센트포인트, 원래 값 대비 증가율로는 900%다. 「percent increase」는 증가율을 말하므로 18% 증가는 도표와 맞지 않는다. 평가원은 이 선지를 ④와 함께 정답으로 인정했다(정답표 「④, ⑤」).',
    confirmed_at: { note: '평가원 정답표 2015 홀수형 25번 「④, ⑤」(sha256 eec2f406…) · 평가원 이의심사 결과 발표(정책브리핑 2014-11-24) — percent 는 백분율, percent point 는 백분율 간 차이. 도표 값은 v5 확인값(Cell Phone Numbers 2/20) 그대로.', sentence_index: [6] },
  },
  solve_procedure_step2: {
    from: '선지마다 비교 종류를 표시한다 — each/highest 는 크기 비교, three times 는 나눗셈, increase 숫자는 뺄셈.',
    to: '선지마다 비교 종류를 표시한다 — each/highest 는 크기 비교, three times 는 나눗셈, 「몇 퍼센트 증가」는 원래 값 대비 비율, 「몇 퍼센트포인트」는 뺄셈.',
    // r2(감수 B E4): on_fail 도 숫자 낱말만 보고 곱셈/차이를 가르게 해 eighteen percent 를 차이로 오독하게 남는다 — 함께 고친다
    on_fail_from: '종류를 못 정하면 선지 속 숫자 낱말(three times, eighteen)이 곱셈인지 차이인지부터 본다.',
    on_fail_to: '숫자만 보지 말고 함께 쓰인 표현을 확인한다. three times 는 비교값÷기준값, percent increase 는 (나중 값−처음 값)÷처음 값×100, percentage points 는 두 백분율 값의 차이로 계산한다.',
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

// ── 강의 적재 검사(validate.ts) — v6 가 만드는 대상 목록으로 수정 강의를 실제로 돌린다 ──
// v6 에서 ⑤ 는 distractor 가 아니므로 reject:5 대상이 **사라진다** — 옛 c9(reject:5)는 이 검사에서 실패해야 하고, 새 c9(anchor:sentence:5)는 통과해야 한다
const skel = JSON.parse(readFileSync(join(ROOT, 'apps/web/src/lib/csat/skeleton-data/2015.json'), 'utf8')).items.find((i: { id: string }) => i.id === '2015#25')
const snapItem = JSON.parse(readFileSync(join(ROOT, 'apps/web/src/lib/csat/content-review/data/snapshot.json'), 'utf8')).items['2015#25']
const placed = skel.sentences.flatMap((s: { reveals: { anchorId: string }[] }) => s.reveals.map((r) => r.anchorId))
const targetsV6 = lectureTargets({ answer: 4, answer_unknown: false, has_ability: true, has_intent: true, distractors: [1, 2, 3], procedure_len: 4, vocab_len: 3, skeleton: { sentences: skel.sentences.length, placedAnchorIds: placed } })
const vctx = { targets: targetsV6, answer: 4, wrongChoices: [1, 2, 3], hasTrapLabels: true, hasVocab: true, analysisTexts: [], sourceTexts: [...snapItem.passageSentences, ...snapItem.choices] }
const lectureCheckAfter = validateLecture(after, vctx)
const lectureCheckOldC9 = validateLecture({ ...after, cues: after.cues.map((c) => (c.id === 'c9' ? { ...c, target: { kind: 'analysis' as const, id: 'reject:5' } } : c)) }, vctx)
const targetIssues = (r: ReturnType<typeof validateLecture>) => r.issues.filter((i) => /target|대상/i.test(`${i.code} ${i.msg}`))

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
console.log(JSON.stringify({
  lecture_validate_after: { ok: lectureCheckAfter.ok, issues: lectureCheckAfter.issues.map((i) => `${i.code}@${i.cue ?? '-'}: ${i.msg}`) },
  lecture_validate_old_c9_target: targetIssues(lectureCheckOldC9).map((i) => `${i.code}@${i.cue ?? '-'}`),
  targets_v6: targetsV6,
}, null, 1))
