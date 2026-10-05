// scripts/csat/error-evidence/codebook/xmodel.mjs
//
// Cross-Model Blind Dry Run — Claude Code × Codex 4중 교차검증(4-Layer Cross-Model Verification).
// 사람 판정이 아니다. 결과를 human reliability · 사람 검증이라고 부르지 않는다(cross-model agreement).
// 절차 · 판정 규칙: docs/csat-learner/codebook/XMODEL_DRY_RUN.md
//
// 각 단계는 **저장소 밖 실행 폴더**의 단계별 하위 폴더에서, 저장소 · 기대 판정 · 다른 판정자 결과에 접근할 수 없게 돌린다.
//   Claude: `claude -p --tools ""`(도구 전부 끔) · 설정/훅/MCP 미적재 · 세션 미저장 — 새 컨텍스트
//   Codex : `codex exec --ignore-user-config --ephemeral -s read-only` · 빈 폴더 · 명령 실행 이벤트를 감사(있으면 누출 의심으로 실패)
// 문항 원문 · 판정 원본은 실행 폴더에만 둔다. 저장소에는 집계(report)만 쓴다.
//
//   node --tls-max-v1.2 --env-file=apps/web/.env.local scripts/csat/error-evidence/codebook/xmodel.mjs prepare --run <dir>
//   node scripts/csat/error-evidence/codebook/xmodel.mjs run      --run <dir> --stage train-a|train-b|a1|b1|a2|b2|final-claude|final-codex [--part N]
//   node scripts/csat/error-evidence/codebook/xmodel.mjs gate1    --run <dir>      (a1 · b1 완료 뒤 → a2 · b2 패킷)
//   node scripts/csat/error-evidence/codebook/xmodel.mjs resolve  --run <dir>      (a2 · b2 완료 뒤 → 4-way 판정 · final 패킷)
//   node scripts/csat/error-evidence/codebook/xmodel.mjs seal     --run <dir>      (final 완료 뒤 → 최종 판정 봉인)
//   node scripts/csat/error-evidence/codebook/xmodel.mjs report   --run <dir> --out <repo md>  (봉인 뒤에만 기대 판정을 연다)

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { agreement, CODES, FAMILIES, OUTCOMES, PRIMARY_CODES } from './agreement.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const DIR = path.join(ROOT, 'docs/csat-learner/codebook')
const argv = process.argv.slice(2)
const cmd = argv[0]
const arg = (k, d) => { const i = argv.indexOf(k); return i > 0 ? argv[i + 1] : d }
const RUN = arg('--run') ? path.resolve(arg('--run')) : null
if (!RUN) { console.error('--run <저장소 밖 폴더> 필요'); process.exit(2) }
// 정션 · 심볼릭 링크를 따라간 실제 경로로 검사한다(문자열 비교만으로는 저장소로 연결된 링크를 못 막는다)
const isLink = (p) => { try { return fs.lstatSync(p).isSymbolicLink() } catch { return false } }
const lexists = (p) => { try { fs.lstatSync(p); return true } catch { return false } }
const realOf = (p) => { let q = p; while (!lexists(q)) q = path.dirname(q); if (isLink(q) && !fs.existsSync(q)) return null; return path.join(fs.realpathSync.native(q), path.relative(q, p)) }
const inside = (a, b) => { if (!a || !b) return false; const r = path.relative(b, a); return r === '' || (!r.startsWith('..') && !path.isAbsolute(r)) }
const XROOT = path.resolve('C:/vf-xmodel')
if (!inside(realOf(RUN), realOf(XROOT)) || inside(realOf(RUN), realOf(path.resolve(ROOT, '..')))) {
  console.error(`실행 폴더는 ${XROOT} 아래 · 저장소(와 이웃 워크트리) 밖이어야 한다(실제 경로 기준) — 판정자가 저장소를 볼 수 없게 · 원문이 저장소에 쓰이지 않게`); process.exit(2)
}
const OP = path.join(RUN, 'operator')
// 회차 입력 — 준비(prepare) 때 --corpus · --codebook · --expected(코드북 폴더 기준 상대 경로)로 정하고 매니페스트에 고정한다.
// 지정하지 않으면 rev3 회차 기본값(human-corpus · CODEBOOK.md · sealed/human-expected) — 지난 회차 재현이 그대로 된다
const RUN_CFG = (() => {
  const mf = path.join(OP, 'manifest.json')
  const fromMan = fs.existsSync(mf) ? JSON.parse(fs.readFileSync(mf, 'utf8')).cfg : null
  const cfg = fromMan ?? { corpus: arg('--corpus') ?? 'data/human-corpus.json', codebook: arg('--codebook') ?? 'CODEBOOK.md', expected: arg('--expected') ?? 'data/sealed/human-expected.json', training: 'data/human-training.json' }
  for (const v of Object.values(cfg)) if (path.isAbsolute(v) || v.split(/[\\/]/).includes('..')) { console.error(`회차 입력은 코드북 폴더 기준 상대 경로: ${v}`); process.exit(2) }
  return cfg
})()
const CORPUS_F = path.join(DIR, RUN_CFG.corpus), CODEBOOK_F = path.join(DIR, RUN_CFG.codebook), EXPECTED_F = path.join(DIR, RUN_CFG.expected), TRAINING_F = path.join(DIR, RUN_CFG.training)
// 모든 쓰기 대상의 실제 경로가 실행 폴더 안인지(하위 정션으로 저장소에 쓰는 경로 차단) — 보고 출력만 예외로 따로 검사
const guardWrite = (f) => { const t = path.resolve(f); if (isLink(t)) { console.error(`쓰기 대상이 링크다: ${f}`); process.exit(2) } if (!inside(realOf(t), realOf(RUN))) { console.error(`쓰기 대상이 실행 폴더 밖이다(실제 경로): ${f}`); process.exit(2) } }
const sha = (s) => createHash('sha256').update(s).digest('hex')
const readJ = (f) => JSON.parse(readAny(f))
// 실행 폴더 자료 읽기 — 링크 · 실행 폴더 밖 실제 경로 거부
const readRun = (f) => { const t = path.resolve(f); if (isLink(t) || !inside(realOf(t), realOf(RUN))) throw new Error(`실행 폴더 밖이거나 링크인 자료: ${f}`); return fs.readFileSync(t, 'utf8') }
// 저장소에서 읽어도 되는 것: 코드북 폴더(docs/csat-learner/codebook) 안의 실제 파일만 — 링크 거부
function readAny(f) {
  const t = path.resolve(f)
  if (inside(t, RUN)) return readRun(t)
  if (isLink(t) || !inside(realOf(t), realOf(DIR))) throw new Error(`허용되지 않은 읽기 경로: ${f}`)
  return fs.readFileSync(t, 'utf8')
}
const writeJ = (f, v) => { guardWrite(f); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(v, null, 1) + '\n') }
const fam = (c) => (c ? c.split('.')[0] : null)
const ADEQ = ['A0', 'A1', 'A2', 'A3']
const CHALLENGE = ['support_one', 'both_plausible', 'neither_supported', 'insufficient_evidence']

// 판정 하나를 비교 가능한 열쇠로 — identified 는 primary, multiple_plausible 은 정렬한 후보, 나머지는 결과만
export function verdictKey(v) {
  if (!v || !v.outcome) return null
  if (v.outcome === 'identified') return `identified:${v.primary_cause}`
  if (v.outcome === 'multiple_plausible') return `multiple_plausible:${[...(v.candidate_causes ?? [])].sort().join('|')}`
  return v.outcome
}
const contribKey = (v) => [...new Set(v?.contributing_causes ?? [])].sort().join('|')
const keyFamily = (k) => (k?.startsWith('identified:') ? fam(k.slice(11)) : null)
const keyLabel = (k) => k

// ── 시드 고정 셔플 ──
function shuffled(list, seedStr) {
  let seed = parseInt(sha(seedStr).slice(0, 8), 16)
  const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)
  return list.map((x) => [rand(), x]).sort((a, b) => a[0] - b[0]).map(([, x]) => x)
}

// ── 판정자 출력 스키마 ──
const VERDICT_FIELDS = `{
  "case_id": "<사례 id 그대로>",
  "evidence_adequacy": "A0|A1|A2|A3",
  "outcome": "identified|multiple_plausible|insufficient_evidence|inconsistent_evidence|no_fitting_code|unsupported_stimulus",
  "primary_cause": "<코드 또는 null — identified 일 때만>",
  "contributing_causes": ["<코드>", "... 최대 2개, primary 와 중복 금지"],
  "confidence": "low|medium|high",
  "candidate_causes": ["<multiple_plausible 이면 후보 2개 이상 — 각각 최소 증거가 있어야 한다>"],
  "supporting_evidence_refs": ["reason|blocked_span|interpretation|self_category|context 중 근거로 쓴 것"],
  "excluded_candidates": [{"code": "<가장 강한 경쟁 코드>", "reason": "<왜 배제되는가 — 한 문장>"}],
  "decision_rule_used": "<예: Q4a · R6>",
  "short_rationale": "<1–2문장 근거 요약 — 사고 과정 전문이 아니다>"
}`

const EVIDENCE_FIELDS = ['reason', 'blocked_span', 'interpretation', 'self_category', 'context']
const RULE_TOKEN = /^(Q-|Q[0-8]|Q4[ab]|R(?:[1-9]|1[01]))$/
const RULE_SCAN = /(?<![A-Za-z.])(Q-|Q\d+[a-z]?|R\d+)(?![\w.])/g
// 코드북 규칙 식별자가 하나 이상 있고, 있는 것은 모두 유효한가
const citesValidRule = (text) => { const t = (text ?? '').match(RULE_SCAN) ?? []; return t.length > 0 && t.every((x) => RULE_TOKEN.test(x)) }
function validateVerdict(v, ids, strict = false, caseData = null) {
  const e = []
  if (!ids.has(v.case_id)) e.push(`모르는 case_id ${v.case_id}`)
  if (!ADEQ.includes(v.evidence_adequacy)) e.push('evidence_adequacy')
  if (!OUTCOMES.includes(v.outcome)) e.push('outcome')
  if (v.outcome === 'identified' && !CODES.includes(v.primary_cause)) e.push('identified 인데 primary_cause 가 코드가 아니다')
  if (v.outcome !== 'identified' && v.primary_cause) e.push('identified 가 아닌데 primary_cause 가 있다')
  if (!Array.isArray(v.contributing_causes) || v.contributing_causes.length > 2 || v.contributing_causes.some((c) => !CODES.includes(c) || c === v.primary_cause)) e.push('contributing_causes')
  if (v.outcome === 'multiple_plausible' && (!Array.isArray(v.candidate_causes) || v.candidate_causes.length < 2 || v.candidate_causes.some((c) => !PRIMARY_CODES.includes(c)))) e.push('multiple_plausible 후보(primary 가능 코드 2개 이상)')
  if (v.primary_cause === 'B.no_verification') e.push('B.no_verification 은 contributing 전용(R11)')
  if (!['low', 'medium', 'high'].includes(v.confidence)) e.push('confidence')
  if (strict) {
    if (v.outcome === 'identified' && !['A2', 'A3'].includes(v.evidence_adequacy)) e.push('identified 인데 증거 충분성이 A2 미만(Q0)')
    if (!(v.decision_rule_used ?? '').trim() || !(v.short_rationale ?? '').trim()) e.push('규칙 · 근거 누락')
    if (v.outcome === 'multiple_plausible' && !['A2', 'A3'].includes(v.evidence_adequacy)) e.push('multiple_plausible 인데 증거 충분성이 A2 미만(R9)')
    if (v.outcome === 'multiple_plausible' && new Set(v.candidate_causes).size !== v.candidate_causes.length) e.push('multiple_plausible 후보 중복')
    if (v.outcome === 'identified' || v.outcome === 'multiple_plausible') {
      const refs = v.supporting_evidence_refs ?? []
      if (refs.some((r) => !EVIDENCE_FIELDS.includes(r))) e.push('근거 참조는 reason · blocked_span · interpretation · self_category · context 만')
      if (!refs.some((r) => r !== 'self_category')) e.push('self_category 는 증거가 아니라 주장이다(코드북 §2) — 다른 과정 증거 참조 필요')
      if (caseData && refs.some((r) => caseData[r] == null || caseData[r] === '')) e.push('비어 있는 과정 증거를 근거로 참조')
    }
    // 규칙 식별자처럼 생긴 토큰(Q-, Q+숫자, R+숫자)만 뽑는다 — family 글자(R · E)나 「§6 R vs E」 같은 결정표 인용은 식별자가 아니다
    if (!citesValidRule(v.decision_rule_used)) e.push(`decision_rule_used 에 코드북 규칙 식별자가 없거나 없는 식별자: ${v.decision_rule_used}`)
    if ((v.excluded_candidates ?? []).some((x) => x.code === v.primary_cause)) e.push('자기 primary 를 배제 후보로 적었다')
    if (v.outcome === 'identified' && v.primary_cause === 'B.no_verification') e.push('B.no_verification 은 primary 불가')
    if (v.competing_excluded === true && (!(v.excluded_candidates ?? []).length || v.excluded_candidates.some((x) => !CODES.includes(x.code) || !(x.reason ?? '').trim()))) e.push('competing_excluded=true 인데 경쟁 후보별 배제 이유가 없다')
  }
  return e
}

// ── 사례 블록(판정자에게 보이는 것만) ──
function caseBlock(c, item, opaqueId, heading = '사례') {
  const ch = Array.isArray(item.choices) ? item.choices.map((x, i) => `  ${i + 1}. ${typeof x === 'string' ? x : x.text ?? JSON.stringify(x)}`).join('\n') : JSON.stringify(item.choices)
  const b = c.blocked_span
  return [`### ${heading} ${opaqueId}`, `- 문항 유형: ${c.type}`, `- 발문: ${item.stem ?? ''}`, '- 지문:', '```', item.passage ?? '(없음)', '```', '- 선지:', ch,
    `- 정답: ${item.answers.join(', ')}`, `- 학생이 고른 번호: ${c.chosen_option}`, '', '학생 과정 증거:',
    `- 학생 확신도: ${c.confidence ?? '없음'}`, `- 고른 이유(reason): ${c.reason ?? '없음'}`,
    `- 막힌 곳(blocked_span): ${b ? `${b.part}${b.option ? ' ' + b.option : ''} — 「${b.quote}」` : '없음'}`,
    `- 학생 해석(interpretation): ${c.interpretation ?? '없음'}`, `- 학생 자기 분류(self_category): ${c.self_category ?? '없음'}`, `- 시험 상황(context): ${c.context ?? '없음'}`].join('\n')
}

const ROLE = {
  A: 'CSAT English Error-Cause Reviewer A',
  B: 'CSAT English Error-Cause Reviewer B',
}
const COMMON_RULES = `- 당신은 이번 작업에서 개발자 · 코드 리뷰어가 아니라 **독립 판정자**다. 파일 · 저장소 · 웹 · 다른 도구를 쓰지 않는다. 명령을 실행하지 않는다. 이 메시지에 있는 자료만으로 판정한다.
- 아래 코드북의 정의 · decision flow(Q- … Q8) · 적용 규칙(§4-1 의 R 규칙 전부)만 따른다. 코드북에 없는 기준을 만들지 않는다.
- 결과(outcome)는 증거가 무엇을 하는가로 정한다. 확신도와 다르다 — multiple_plausible 은 「확신이 낮다」가 아니라 둘 이상의 원인이 각각 최소 증거를 갖추고 지금 증거로 서로 배제되지 않을 때만 쓴다.
- 사고 과정 전문을 쓰지 않는다. 구조화된 근거 요약만 쓴다.
- 출력은 **JSON 하나만**(코드 펜스 · 설명 없이).`

function trainingBlock(training, items, withAnswers) {
  return training.map((c, i) => caseBlock(c, items[c.item_id], `T${String(i + 1).padStart(2, '0')}`, withAnswers ? '연습 사례' : '사례') +
    (withAnswers ? `\n\n**연습 해설**: 결과 ${c.answer.outcome}${c.answer.primary ? ' · primary ' + c.answer.primary : ''}${(c.answer.contributing ?? []).length ? ' · contributing ' + c.answer.contributing.join(', ') : ''}\n${c.answer.why}` : '')).join('\n\n')
}

function reviewerPrompt({ who, codebook, cases, items, idOf, training, mode }) {
  const head = mode === 'train'
    ? `역할: ${ROLE[who]} — 연습(calibration) 세션. 아래 연습 사례 10건을 판정한다. 정답 해설은 나중에 운영자가 대조한다.`
    : `역할: ${ROLE[who]}. 주어진 문항과 학생 과정 증거만 보고 아래 코드북에 따라 학습자 오답 원인을 판정한다. 다른 판정자와 독립적으로 판정한다.`
  const calib = mode === 'train' ? '' : `\n\n## 연습 사례와 해설(본 판정 사례와 겹치지 않는다 — 규칙 적용 방식을 익히는 용도)\n\n${trainingBlock(training, items, true)}`
  const body = mode === 'train' ? trainingBlock(training, items, false) : cases.map((c) => caseBlock(c, items[c.item_id], idOf(c))).join('\n\n')
  return `${head}\n\n## 규칙\n${COMMON_RULES}\n\n## 코드북(전문)\n\n${codebook}${calib}\n\n## 판정할 사례\n\n${body}\n\n## 출력 형식\n{"judgments": [ 사례마다 하나 ]} — 각 원소:\n${VERDICT_FIELDS}\n사례 ${mode === 'train' ? training.length : cases.length}건 모두 판정한다.`
}

// ── 엔진 실행(격리) ──
function claudeBin() {
  const p = path.join(process.env.APPDATA ?? '', 'npm/node_modules/@anthropic-ai/claude-code/bin/claude.exe')
  return fs.existsSync(p) ? p : 'claude'
}
function findCodex() {
  const ext = path.join(process.env.USERPROFILE ?? process.env.HOME ?? '', '.vscode/extensions')
  if (fs.existsSync(ext)) {
    const d = fs.readdirSync(ext).filter((x) => /^openai\.chatgpt-/.test(x)).sort().pop()
    if (d) { const p = path.join(ext, d, 'bin', process.platform === 'win32' ? 'windows-x86_64' : '', process.platform === 'win32' ? 'codex.exe' : 'codex'); if (fs.existsSync(p)) return p }
  }
  return 'codex'
}
const SCHEMA_VERDICTS = { type: 'object', additionalProperties: false, required: ['judgments'], properties: { judgments: { type: 'array', items: { type: 'object' } } } }

function extractJson(text) {
  const t = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '')
  const s = t.indexOf('{'); const e = t.lastIndexOf('}')
  return JSON.parse(t.slice(s, e + 1))
}

function runEngine(engine, stageDir, prompt, tag) {
  const started = new Date().toISOString()
  if (engine === 'claude') {
    const r = spawnSync(claudeBin(), ['-p', '--tools', '', '--setting-sources', '', '--strict-mcp-config', '--no-session-persistence', '--model', 'claude-opus-5-5', '--output-format', 'json',
      '--system-prompt', '당신은 수능 영어 오답 원인 독립 판정자다. 도구 없이 사용자 메시지의 자료만으로 판정하고 JSON 하나만 출력한다.'],
    { cwd: stageDir, input: prompt, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 3_600_000 })
    guardWrite(path.join(stageDir, `raw-${tag}.json`)); fs.writeFileSync(path.join(stageDir, `raw-${tag}.json`), r.stdout ?? '')
    if (r.status !== 0) throw new Error(`claude 실패(${r.status}): ${(r.stderr ?? '').slice(0, 500)}`)
    const env = JSON.parse(r.stdout)
    const meta = { engine, started, finished: new Date().toISOString(), cli: spawnSync(claudeBin(), ['--version'], { encoding: 'utf8' }).stdout.trim(),
      models: Object.keys(env.modelUsage ?? {}), num_turns: env.num_turns, session_id: env.session_id, tools: 'none', leakage_events: env.num_turns === 1 ? [] : [`num_turns=${env.num_turns ?? '없음'}`] }
    return { text: env.result, meta }
  }
  const cx = findCodex()
  const lastF = path.join(stageDir, `last-${tag}.txt`); guardWrite(lastF)
  if (fs.existsSync(lastF) && fs.lstatSync(lastF).isSymbolicLink()) { console.error(`${lastF} 가 링크다`); process.exit(2) }
  const r = spawnSync(cx, ['exec', '--ignore-user-config', '--ephemeral', '-m', 'gpt-6.1-sol', '-s', 'read-only', '--skip-git-repo-check', '-C', stageDir, '-c', 'model_reasoning_effort="high"',
    '--json', '-o', lastF, '-'], { cwd: stageDir, input: prompt, encoding: 'utf8', maxBuffer: 1 << 28, timeout: 3_600_000 })
  guardWrite(path.join(stageDir, `raw-${tag}.jsonl`)); fs.writeFileSync(path.join(stageDir, `raw-${tag}.jsonl`), r.stdout ?? '')
  if (r.status !== 0) throw new Error(`codex 실패(${r.status}): ${(r.stderr ?? '').slice(-800)}`)
  const lines = (r.stdout ?? '').split('\n').filter((l) => l.trim())
  const events = lines.map((l) => { try { return JSON.parse(l) } catch { return { type: '(파싱 실패)' } } })
  const OK_EVENTS = new Set(['thread.started', 'turn.started', 'turn.completed', 'item.started', 'item.updated', 'item.completed'])
  const OK_ITEMS = new Set(['agent_message', 'reasoning'])
  const leak = events.filter((e) => !OK_EVENTS.has(e.type) || (e.item && !OK_ITEMS.has(e.item.type))).map((e) => (e.item ? `item:${e.item.type}` : e.type))
  if (!events.some((e) => e.type === 'turn.completed')) leak.push('turn.completed 없음(감사 불완전)')
  const model = events.find((e) => e.model)?.model ?? null
  const meta = { engine, started, finished: new Date().toISOString(), cli: spawnSync(cx, ['--version'], { encoding: 'utf8' }).stdout.trim(), models: [model ?? 'gpt-6.1-sol'],
    reasoning_effort: 'high', thread_id: events.find((e) => e.thread_id)?.thread_id ?? null, tools: 'sandbox read-only · 명령 이벤트 감사', leakage_events: [...new Set(leak)] }
  return { text: readRun(lastF), meta }
}

// 원본 기록에서 누출 감사를 다시 계산한다 — 결과 파일에 적힌 감사 값을 믿지 않는다
// out 이 주어지면 원본의 실행 출처(session/thread)와 최종 응답의 판정 목록이 결과 파일과 같은지도 대조한다
const judgmentsDigest = (list) => sha(JSON.stringify((list ?? []).map((v) => v.case_id + ':' + JSON.stringify(v)).sort()))
function auditRaw(stageDir, engine, tag, out = null, ids = null) {
  // 원본 응답에서 채택 사례만(첫 출현) 골라 결과와 비교한다
  const pick = (list) => { if (!ids) return list; const seen = new Set(); return (list ?? []).filter((v) => ids.includes(v.case_id) && !seen.has(v.case_id) && seen.add(v.case_id)) }
  if (engine === 'claude') {
    const f = path.join(stageDir, `raw-${tag}.json`)
    let env; try { env = JSON.parse(readRun(f)) } catch { return ['원본 기록 없음 · 파싱 실패'] }
    const e = []
    if (env.num_turns !== 1) e.push(`num_turns=${env.num_turns ?? '없음'}`)
    if (!env.session_id) e.push('session_id 없음')
    if (env.is_error) e.push('is_error')
    if (out) {
      if (out.meta?.session_id !== env.session_id) e.push('결과의 session_id 가 원본과 다르다')
      try { if (judgmentsDigest(pick(extractJson(env.result).judgments)) !== judgmentsDigest(out.judgments)) e.push('원본 최종 응답의 판정과 결과 파일이 다르다') } catch { e.push('원본 최종 응답 파싱 실패') }
    }
    return e
  }
  const f = path.join(stageDir, `raw-${tag}.jsonl`)
  let rawText; try { rawText = readRun(f) } catch { return ['원본 기록 없음'] }
  const events = rawText.split('\n').filter((l) => l.trim()).map((l) => { try { return JSON.parse(l) } catch { return { type: '(파싱 실패)' } } })
  const OK_EVENTS = new Set(['thread.started', 'turn.started', 'turn.completed', 'item.started', 'item.updated', 'item.completed'])
  const OK_ITEMS = new Set(['agent_message', 'reasoning'])
  const e = events.filter((x) => !OK_EVENTS.has(x.type) || (/^item\./.test(x.type) && !OK_ITEMS.has(x.item?.type)) || (x.item && !OK_ITEMS.has(x.item.type))).map((x) => (x.item ? `item:${x.item.type}` : x.type))
  if (!events.some((x) => x.type === 'thread.started' && x.thread_id)) e.push('thread.started/thread_id 없음')
  if (!events.some((x) => x.type === 'turn.started')) e.push('turn.started 없음')
  if (!events.some((x) => x.type === 'turn.completed')) e.push('turn.completed 없음')
  if (!events.some((x) => x.type === 'item.completed' && x.item?.type === 'agent_message')) e.push('최종 메시지 없음')
  // 상태 전이: thread.started(정확히 1, 처음) → turn.started(정확히 1) → item.*(turn 안) → turn.completed(정확히 1, 마지막)
  let st = 'init'
  for (const x of events) {
    if (x.type === 'thread.started') { if (st !== 'init') { e.push('thread.started 가 처음이 아니거나 둘 이상'); break } st = 'thread' }
    else if (x.type === 'turn.started') { if (st !== 'thread') { e.push('turn.started 위치 · 개수'); break } st = 'turn' }
    else if (/^item\./.test(x.type)) { if (st !== 'turn') { e.push('항목이 turn 밖에 있다'); break } }
    else if (x.type === 'turn.completed') { if (st !== 'turn') { e.push('turn.completed 위치 · 개수'); break } st = 'done' }
    else if (st === 'done') { e.push('turn.completed 뒤에 이벤트'); break }
  }
  if (st !== 'done') e.push('turn 이 완료 상태로 끝나지 않았다')
  if (events.some((x) => /^item\./.test(x.type) && (!x.item?.id || (x.item.type === 'agent_message' && x.type === 'item.completed' && typeof x.item.text !== 'string')))) e.push('항목 식별자 · 메시지 본문 누락')
  if (out) {
    const tid = events.find((x) => x.type === 'thread.started')?.thread_id
    if (out.meta?.thread_id !== tid) e.push('결과의 thread_id 가 원본과 다르다')
    const last = [...events].reverse().find((x) => x.type === 'item.completed' && x.item?.type === 'agent_message')?.item?.text
    try { if (judgmentsDigest(pick(extractJson(last ?? '').judgments)) !== judgmentsDigest(out.judgments)) e.push('원본 최종 메시지의 판정과 결과 파일이 다르다') } catch { e.push('원본 최종 메시지 파싱 실패') }
  }
  return [...new Set(e)]
}

// ── 명령 ──
const manifestF = path.join(OP, 'manifest.json')
const INPUT_FILES = () => ({ codebook: CODEBOOK_F, corpus: CORPUS_F, training: TRAINING_F,
  round1: path.join(DIR, 'data/round1.json'), round2_hard: path.join(DIR, 'data/round2-hard.json'), round2_recheck: path.join(DIR, 'data/round2-recheck.json'),
  map: path.join(OP, 'map.json'), items: path.join(OP, 'items.json') })
const fileHash = (f) => sha(readAny(f).replace(/\r\n/g, '\n'))
const inputHashes = () => Object.fromEntries(Object.entries(INPUT_FILES()).map(([k, f]) => [k, fileHash(f)]))
function verifyInputs() {
  const man = readJ(manifestF)
  if (!man.inputs) { console.error('매니페스트에 고정 입력 해시가 없다'); process.exit(2) }
  const now = inputHashes(); const bad = Object.keys(man.inputs).filter((k) => now[k] !== man.inputs[k])
  if (bad.length) { console.error(`준비 뒤 입력이 바뀌었다: ${bad.join(', ')}`); process.exit(2) }
}
const sealF = path.join(OP, 'seal.json')
const adjManifestF = path.join(OP, 'adj-manifest.json')
const manFor = (stage) => (/^adj[12]-[ab]$/.test(stage ?? '') ? adjManifestF : manifestF)
const assertNotSealed = () => { if (fs.existsSync(sealF)) { console.error('이미 봉인됐다 — 봉인 뒤에는 판정 · 후보 · 해결을 다시 만들지 않는다(기대 판정을 본 뒤 판정을 바꾸는 경로 차단)'); process.exit(2) } }

async function prepare() {
  assertNotSealed()
  const corpus = readJ(CORPUS_F)
  const training = readJ(TRAINING_F)
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n')
  const codebookHash = sha(codebook)
  if (codebookHash !== corpus.codebook_sha256) { console.error('CODEBOOK.md 가 고정 해시와 다르다 — 교차검증 중에는 코드북을 바꾸지 않는다'); process.exit(2) }
  if (!corpus.expected_sha256) { console.error('말뭉치에 기대 판정 사전 등록 해시가 없다'); process.exit(2) }
  const require = createRequire(path.join(ROOT, 'apps/web/package.json'))
  const { createClient } = require('@supabase/supabase-js')
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const ids = [...new Set([...corpus.cases, ...training.cases].map((c) => c.item_id))]
  const { data: rows, error } = await db.from('csat_items').select('id, stem, passage, choices, answer, answers').in('id', ids)
  if (error) throw new Error(error.message)
  const items = Object.fromEntries(rows.map((r) => [r.id, { stem: r.stem, passage: r.passage, choices: r.choices, answers: r.answers?.length ? r.answers : [r.answer] }]))
  const miss = ids.filter((id) => !items[id]); if (miss.length) throw new Error(`없는 문항 ${miss}`)
  // 불투명 사례 id(원래 id 는 출처 회차를 드러낸다 — C2- · H- …)
  const runId = path.basename(RUN)
  const opaque = shuffled(corpus.cases.map((c) => c.case_id), `${runId}:ids`)
  const map = Object.fromEntries(opaque.map((cid, i) => [cid, `K${String(i + 1).padStart(2, '0')}`]))
  writeJ(path.join(OP, 'items.json'), items)
  writeJ(path.join(OP, 'map.json'), map)
  const packets = {}
  const write = (stage, part, text) => { const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, `prompt-${part}.md`); guardWrite(f); fs.writeFileSync(f, text); packets[`${stage}/${part}`] = sha(text) }
  for (const [stage, who] of [['train-a', 'A'], ['train-b', 'B']]) write(stage, 1, reviewerPrompt({ who, codebook, items, training: training.cases, mode: 'train' }))
  for (const [stage, who] of [['a1', 'A'], ['b1', 'B']]) {
    const order = shuffled(corpus.cases, `${runId}:${stage}`)
    const half = Math.ceil(order.length / 2)
    ;[order.slice(0, half), order.slice(half)].forEach((cs, i) => write(stage, i + 1, reviewerPrompt({ who, codebook, cases: cs, items, idOf: (c) => map[c.case_id], training: training.cases, mode: 'main' })))
  }
  writeJ(manifestF, { run_id: runId, created: new Date().toISOString(), codebook_rev: corpus.codebook_rev, codebook_sha256: codebookHash, expected_sha256_preregistered: corpus.expected_sha256,
    corpus_id: corpus.id, cases: corpus.cases.length, packets, inputs: inputHashes(), cfg: RUN_CFG })
  console.log(`준비: ${RUN} · 사례 ${corpus.cases.length} · 패킷 ${Object.keys(packets).length} · 기대 판정은 열지 않음(사전 등록 해시만 기록)`)
}

function stageEngine(stage) { return /^(train-a|a1|a2p|a2|final-claude|adj1-a|adj2-a)$/.test(stage) ? 'claude' : 'codex' }

// 사례별 검증 오류 — 배치 전체가 아니라 사례 단위로 모은다
function caseErrors(v, ctx) {
  const { isChallenge, isFinal, plans, caseByOid, expectIds, stage } = ctx
  if (isAdjStage(stage)) return validateAdj(v, stage, expectIds, caseByOid[v.case_id])
  const verdict = isChallenge ? v.proposal : v
  const e = []
  if (isChallenge) e.push(...(plans[v.case_id] ? validateChallenge(v, plans[v.case_id], caseByOid[v.case_id]) : ['계획에 없는 사례']))
  e.push(...validateVerdict({ ...verdict, case_id: v.case_id }, expectIds, isChallenge || isFinal, caseByOid[v.case_id]))
  return e
}

// 패킷을 머리 · 사례 블록 · 꼬리로 나눈다(재판정 패킷은 같은 머리 · 꼬리에 위반 사례 블록만)
function splitPacket(prompt) {
  const tailAt = prompt.lastIndexOf('\n\n## 출력 형식')
  const firstAt = prompt.search(/\n### 사례 \S+/)
  const head = prompt.slice(0, firstAt), tail = prompt.slice(tailAt)
  const blocks = {}
  const re = /\n### 사례 (\S+)[\s\S]*?(?=\n### 사례 \S+|\n\n## 출력 형식)/g
  for (const m of prompt.slice(firstAt).matchAll(re)) blocks[m[1]] = m[0]
  return { head, tail, blocks }
}

function run() {
  const stage = arg('--stage'); const part = arg('--part', '1')
  if (!isAdjStage(stage)) assertNotSealed()
  verifyInputs()
  if (!/^\d+$/.test(part)) { console.error('--part 는 숫자'); process.exit(2) }
  const man = readJ(manFor(stage))
  const stageDir = path.join(RUN, stage)
  guardWrite(path.join(stageDir, 'x')) // 원본 출력(raw · last)도 실행 폴더 안에만
  const promptF = path.join(stageDir, `prompt-${part}.md`)
  const prompt = readRun(promptF)
  if (sha(prompt) !== man.packets[`${stage}/${part}`]) { console.error('패킷 해시 불일치 — prompt 파일이 바뀌었다'); process.exit(2) }
  const outF = path.join(stageDir, `out-${part}.json`)
  if (lexists(outF)) {
    const o = readJ(outF)
    if (o.packet_hash !== man.packets[`${stage}/${part}`]) { console.error(`${outF} 는 다른 패킷의 결과다 — 패킷을 다시 만들었다면 그 결과를 운영자가 직접 옮겨 두고 다시 실행한다`); process.exit(2) }
    console.log(`이미 있음: ${outF}`); return
  }
  const isChallenge = /^(a2|b2)$/.test(stage), isFinal = /^final-/.test(stage)
  const plans = isChallenge ? readJ(path.join(OP, `${stage}-labels.json`)) : null
  const caseByOid = (() => { const m = readJ(path.join(OP, 'map.json')); const c = readJ(CORPUS_F).cases; return Object.fromEntries(c.map((x) => [m[x.case_id], x])) })()
  const expectIds = new Set(prompt.match(/^### 사례 (\S+)/gm).map((s) => s.slice(7)))
  const ctx = { isChallenge, isFinal, plans, caseByOid, expectIds, stage }
  const engine = stageEngine(stage)
  const accepted = {}            // case_id → 판정
  const segments = []            // 실행 단위 기록(본 패킷 · 재판정 패킷)
  let pending = [...expectIds]   // 아직 유효한 판정이 없는 사례
  let lastErrors = {}
  const exec = (packetKey, text, tag, ids) => {
    const { text: out, meta } = runEngine(engine, stageDir, text, tag)
    meta.leakage_events = [...new Set([...meta.leakage_events, ...auditRaw(stageDir, engine, tag)])]
    meta.isolation = engine === 'claude' ? 'tools-disabled' : 'audited(read-only sandbox · 명령 · 파일 이벤트 0 확인 — 샌드박스가 읽기를 강제로 막지는 않는다)'
    if (meta.leakage_events.length) { console.error(`누출 의심 — 판정 중 도구 · 명령 이벤트: ${meta.leakage_events}`); process.exit(3) }
    let list = []
    try { list = extractJson(out).judgments ?? [] } catch (e) { console.error(`${tag} 파싱 실패: ${e.message}`) }
    const got = []
    for (const v of list) {
      if (!ids.includes(v.case_id) || accepted[v.case_id] || got.includes(v.case_id)) continue
      const errs = caseErrors(v, ctx)
      if (errs.length) { lastErrors[v.case_id] = errs; continue }
      accepted[v.case_id] = v; got.push(v.case_id)
    }
    for (const id of ids) if (!accepted[id] && !lastErrors[id]) lastErrors[id] = ['출력에 없음']
    segments.push({ packet_key: packetKey, packet_hash: man.packets[packetKey], tag, run_id: `${man.run_id}:${stage}:${tag}`, meta, accepted_ids: got })
    pending = pending.filter((id) => !accepted[id])
    console.log(`${stage}/${tag}: 유효 ${got.length}/${ids.length}${pending.length ? ` · 남음 ${pending.join(' ')}` : ''}`)
  }
  // 본 패킷 — 출력이 통째로 깨지면(유효 0) 한 번 더
  exec(`${stage}/${part}`, prompt, `${part}-1`, [...expectIds])
  if (!Object.keys(accepted).length) { lastErrors = {}; exec(`${stage}/${part}`, prompt, `${part}-2`, [...expectIds]) }
  // 재판정 — 위반 사례만, 같은 머리 · 꼬리 + 그 사례 블록 + 위반한 코드북 규칙(다른 판정자 정보 없음)
  const { head, tail, blocks } = splitPacket(prompt)
  for (let r = 1; r <= 2 && pending.length; r++) {
    const note = '\n\n## 재판정 안내\n아래 사례는 이전 출력이 코드북 규칙 · 출력 형식을 어겨 다시 판정한다. 위반 내용(규칙 · 형식만):\n' +
      pending.map((id) => `- 사례 ${id}: ${(lastErrors[id] ?? []).join('; ')}`).join('\n')
    const text = head + pending.map((id) => blocks[id]).join('') + note + tail.replace(/사례 \d+건 모두/, `사례 ${pending.length}건 모두`)
    const key = `${stage}/${part}-r${r}`
    const f = path.join(stageDir, `prompt-${part}-r${r}.md`); guardWrite(f); fs.writeFileSync(f, text)
    // 쓰기 직전에 다시 읽어 합친다 — 두 판정자 단계를 동시에 돌리면 먼저 읽은 매니페스트로 덮어 서로의 재판정 패킷 등록을 지웠다(2026-10-05)
    man.packets[key] = sha(text)
    const fresh = readJ(manFor(stage)); fresh.packets[key] = man.packets[key]; writeJ(manFor(stage), fresh); Object.assign(man.packets, fresh.packets)
    const ids = [...pending]; lastErrors = {}
    exec(key, text, `${part}-r${r}`, ids)
  }
  const invalid = pending.map((id) => ({ case_id: id, invalid_output: true, errors: lastErrors[id] ?? [] }))
  const judgments = [...expectIds].filter((id) => accepted[id]).map((id) => accepted[id])
  writeJ(outF, { stage, part, reviewer_run_id: segments[0].run_id.replace(/:([^:]+)$/, (m0, t) => `:${t.replace('-', ':')}`), codebook_hash: man.codebook_sha256, packet_hash: man.packets[`${stage}/${part}`],
    model_family: engine, meta: segments[0].meta, segments, judgments, invalid })
  console.log(`${stage}/${part}: 유효 ${judgments.length} · 무효(→ Final 대상) ${invalid.length} · 실행 ${segments.length}회`)
}

const loadStage = (stage) => {
  const d = path.join(RUN, stage)
  const man = readJ(manFor(stage))
  const parts = Object.keys(man.packets).filter((k) => new RegExp(`^${stage}/\\d+$`).test(k))
  if (!parts.length) throw new Error(`${stage} 패킷 없음`)
  const isCh = /^(a2|b2)$/.test(stage), isFin = /^final-/.test(stage)
  const plans = isCh ? JSON.parse(readRun(path.join(OP, `${stage}-labels.json`))) : null
  const caseByOid = (() => { const mp = JSON.parse(readRun(path.join(OP, 'map.json'))); return Object.fromEntries(readJ(CORPUS_F).cases.map((x) => [mp[x.case_id], x])) })()
  const all = parts.flatMap((k) => {
    const p = k.split('/')[1]
    const f = path.join(d, `out-${p}.json`)
    if (!lexists(f)) throw new Error(`${stage} 결과 없음: ${f}`)
    const o = JSON.parse(readRun(f))
    const prompt = readRun(path.join(d, `prompt-${p}.md`))
    if (sha(prompt) !== man.packets[k] || o.packet_hash !== man.packets[k] || o.codebook_hash !== man.codebook_sha256 || o.stage !== stage || String(o.part) !== p) throw new Error(`${f}: 패킷 · 코드북 해시 · 단계가 현재 회차와 다르다`)
    const want = new Set(prompt.match(/^### 사례 (\S+)/gm).map((x) => x.slice(7)))
    const invalid = o.invalid ?? []
    const got = [...o.judgments.map((v) => v.case_id), ...invalid.map((v) => v.case_id)]
    if (got.length !== want.size || new Set(got).size !== got.length || got.some((id) => !want.has(id))) throw new Error(`${f}: 사례 집합이 패킷과 정확히 같지 않다(누락 · 중복 · 남는 사례)`)
    // 실행 단위마다: 패킷 해시 · 실행 식별자 · 원본 감사 · 원본 응답의 채택 판정이 결과와 같은지
    const segs = o.segments ?? [{ packet_key: k, packet_hash: o.packet_hash, tag: o.reviewer_run_id.split(':').slice(-2).join('-'), run_id: o.reviewer_run_id, meta: o.meta, accepted_ids: o.judgments.map((v) => v.case_id) }]
    const byId = Object.fromEntries(o.judgments.map((v) => [v.case_id, v]))
    const covered = new Set()
    for (const sg of segs) {
      if (!new RegExp(`^${stage}/${p}(-r\\d+)?$`).test(sg.packet_key) || man.packets[sg.packet_key] !== sg.packet_hash) throw new Error(`${f}: 실행 단위 패킷 해시 불일치(${sg.packet_key})`)
      const sp = readRun(path.join(d, `prompt-${sg.packet_key.split('/')[1]}.md`))
      if (sha(sp) !== sg.packet_hash) throw new Error(`${f}: 실행 단위 패킷 파일이 바뀌었다(${sg.packet_key})`)
      const audit = auditRaw(d, stageEngine(stage), sg.tag, { meta: sg.meta, judgments: sg.accepted_ids.map((id) => byId[id]) }, sg.accepted_ids)
      if (audit.length || (sg.meta?.leakage_events ?? []).length) throw new Error(`${f}: 누출 감사 실패(${sg.tag}) — ${audit.join(', ')}`)
      for (const id of sg.accepted_ids) { if (covered.has(id)) throw new Error(`${f}: 같은 사례를 두 실행에서 채택`); covered.add(id) }
    }
    if (covered.size !== o.judgments.length || o.judgments.some((v) => !covered.has(v.case_id))) throw new Error(`${f}: 채택 판정과 실행 기록이 맞지 않는다`)
    // 읽을 때마다 현재 검증 규칙을 다시 적용
    const bad = []
    for (const v of o.judgments) {
      if (isAdjStage(stage)) { const ae = validateAdj(v, stage, want, caseByOid[v.case_id]); if (ae.length) bad.push(`${v.case_id}: ${ae.join(', ')}`); continue }
      const ve = validateVerdict({ ...(isCh ? v.proposal : v), case_id: v.case_id }, want, isCh || isFin, caseByOid[v.case_id])
      const ce = isCh ? validateChallenge(v, plans[v.case_id], caseByOid[v.case_id]) : []
      if (ve.length || ce.length) bad.push(`${v.case_id}: ${[...ve, ...ce].join(', ')}`)
    }
    if (bad.length) throw new Error(`${f}: 현재 검증 규칙 위반 — ${bad.slice(0, 6).join(' / ')}`)
    return [...o.judgments, ...invalid]
  })
  return Object.fromEntries(all.map((v) => [v.case_id, v]))
}
const unmap = () => { const m = readJ(path.join(OP, 'map.json')); return { toCase: Object.fromEntries(Object.entries(m).map(([k, v]) => [v, k])), toOpaque: m } }

// 판정 → 사람이 읽는 후보 서술(출처 · 근거 문장 없이)
const describe = (v) => `결과 ${v.outcome}` + (v.outcome === 'identified' ? ` · primary ${v.primary_cause}` : '') + (v.outcome === 'multiple_plausible' ? ` · 후보 ${v.candidate_causes.join(', ')}` : '') +
  ((v.contributing_causes ?? []).length ? ` · contributing ${v.contributing_causes.join(', ')}` : '')
const keyToVerdict = (k) => {
  if (k.startsWith('identified:')) return { outcome: 'identified', primary_cause: k.slice(11), contributing_causes: [], candidate_causes: [] }
  if (k.startsWith('multiple_plausible:')) return { outcome: 'multiple_plausible', primary_cause: null, contributing_causes: [], candidate_causes: k.slice(19).split('|') }
  return { outcome: k, primary_cause: null, contributing_causes: [], candidate_causes: [] }
}

// 1차 판정이 같을 때 둘째 후보 — 두 판정자가 스스로 가장 강하게 배제한 경쟁 코드(코드북 밖 정보를 쓰지 않는다)
function rivalKey(a, b, agreedKey) {
  const counts = {}
  for (const v of [a, b]) {
    for (const x of v.excluded_candidates ?? []) if (CODES.includes(x.code)) counts[x.code] = (counts[x.code] ?? 0) + 2
    for (const c of v.candidate_causes ?? []) if (CODES.includes(c)) counts[c] = (counts[c] ?? 0) + 1
    for (const c of v.contributing_causes ?? []) if (CODES.includes(c)) counts[c] = (counts[c] ?? 0) + 1
  }
  const ranked = Object.entries(counts).sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).map(([c]) => `identified:${c}`).filter((k) => k !== agreedKey)
  if (ranked.length) return ranked[0]
  return agreedKey === 'insufficient_evidence' ? null : 'insufficient_evidence'
}

// 반대검증(adversarial falsification) — 두 호출로 나눈다.
//   ① a2p · b2p: 후보를 보지 않은 새 context 에서 사례만 보고 독립 판정(후보 anchoring 제거 · 같은 모델 재판정 안정성 측정)
//   ② a2 · b2  : 그 독립 판정 + 익명 후보(X · Y, 순서 무작위)를 주고 후보마다 최소 증거 · 배제 증거를 검사
// 1차가 insufficient_evidence 로 합의하고 경쟁 후보가 없는 사례에는 강제 Y 를 만들지 않는다 — open-set: 코드북 전체에서 X 를 반증할 대안 Z 를 찾게 한다.
// 대안 Z 는 자유 서술이 아니라 정규 판정 구조(outcome · primary · 후보)로 받는다 — 판정 코드와 배제 코드를 섞지 않게.
const ALT_FIELDS = `{"outcome": "<identified|multiple_plausible|… — 찾지 못하면 null>", "primary_cause": "<identified 일 때 코드>", "candidate_causes": ["<multiple_plausible 일 때 2개 이상>"], "minimum_evidence_met": false, "inclusion_evidence": "<직접 증거>", "evidence_refs": ["reason|blocked_span|interpretation|self_category|context"], "z_excluded": false, "z_exclusion_evidence": "<Z 자체를 배제하는 증거>", "z_subordinated_by_stage_order": false, "z_subordinating_rule": "<subordinated=true 면 필수>", "nearest_competing": "<Z 의 가장 가까운 경쟁 코드 — Z 가 최소 증거를 충족하면 필수>", "nearest_competing_min_evidence_met": false, "nearest_competing_inclusion_evidence": "<met=true 면 필수 — 그 경쟁 원인의 직접 증거>", "nearest_competing_evidence_refs": ["reason|blocked_span|interpretation|context"], "nearest_competing_excluded": false, "nearest_competing_exclusion_evidence": "<배제했다면 그 증거>"}`
const CHALLENGE_FIELDS = `{
  "case_id": "<사례 id>",
  "candidate_tests": [{"label": "X|Y — 주어진 후보 모두", "minimum_evidence_met": true, "inclusion_evidence": "<포함 기준을 충족하는 직접 증거 — met=true 면 필수>", "excluded": false, "exclusion_evidence": "<그 후보를 실제로 배제하는 증거 — excluded=true 면 필수>", "subordinated_by_stage_order": false, "subordinating_rule": "<subordinated=true 면 필수 — 코드북 규칙 식별자(예: Q 순서 · R3 · R5 · R8 · R10 · R11): 최소 증거는 있지만 코드북 우선 규칙상 다른 후보가 primary 라 이 후보는 contributing 이다>"}],
  "alternative_z": ${ALT_FIELDS},
  "challenge_result": "support_one|both_plausible|neither_supported|insufficient_evidence",
  "proposal": ${VERDICT_FIELDS.replace(/\n/g, '\n  ')}
}`
const OPEN_FIELDS = `{
  "case_id": "<사례 id>",
  "insufficient_falsified": false,
  "alternative_z": ${ALT_FIELDS},
  "challenge_result": "insufficient_evidence|support_one|both_plausible",
  "proposal": ${VERDICT_FIELDS.replace(/\n/g, '\n  ')}
}`

function challengePrompt(who, codebook, entries, items, pre) {
  const body = entries.map(({ c, oid, cands, open }) => {
    const mine = pre[oid] ? `\n\n당신이 후보를 보기 전에 이 사례에 내린 독립 판정: ${describe(pre[oid])} — 근거: ${pre[oid].short_rationale ?? ''}` : ''
    const task = open
      ? `\n\n검토할 가설 X: 「지금 증거만으로는 특정 학습자 오답 원인을 판정하기에 부족하다(insufficient_evidence)」.\n과제: ① X 를 반증할 수 있는가 ② 코드북 전체에서 최소 증거를 **실제로** 충족하는 원인이 하나라도 있는가 ③ 있다면 가장 강한 대안 Z ④ Z 의 포함 기준을 충족하는 직접 증거 ⑤ Z 의 가장 가까운 경쟁 원인을 배제할 수 있는가 ⑥ 그런 코드가 없으면 insufficient_evidence 를 유지한다. 증거 없는 원인을 만들어 내지 않는다. insufficient_falsified 는 「Z 가 최소 증거를 충족하고 Z 자체가 배제되지 않음」과 같아야 한다.\n출력 형식(이 사례만): ${OPEN_FIELDS.replace(/\n\s*/g, ' ')}`
      : '\n\n검토할 후보 판정(출처 · 순서는 의미 없음):\n' + cands.map(({ label, v }) => `- 후보 ${label}: ${describe(v)}`).join('\n')
    return caseBlock(c, items[c.item_id], oid) + mine + task
  }).join('\n\n')
  return `역할: ${ROLE[who]} — 반대검증(adversarial falsification). 목적은 후보를 확인해 주는 것이 아니라 **후보가 틀렸을 가능성을 적극적으로 찾는 것**이다.
각 사례마다 후보를 하나씩 반증하라 — 후보마다: 포함 기준을 충족하는 직접 증거가 있는가(minimum_evidence_met) · 그 후보를 실제로 배제하는 증거가 있는가(excluded — 약한 반론 · 「다른 해석도 가능」은 배제가 아니다) · 최소 증거는 있지만 코드북의 우선 규칙(Q4 → Q5 → Q6 → Q7 단계 순서 · R3 · R5 · R8 · R10 · R11 등)으로 다른 후보에 밀려 contributing 이 되는가(subordinated_by_stage_order — 근거 규칙 식별자를 적는다). 「primary 후보로 살아남음」 = 최소 증거 충족 · 배제 안 됨 · 밀리지 않음. 그리고 후보 밖에서 코드북상 가장 강한 다른 판정(alternative_z)을 하나 찾아 같은 시험을 한다(없으면 outcome null). z_excluded = Z 자체가 증거로 배제됨 · nearest_competing_excluded = Z 의 가장 가까운 경쟁 원인을 Z 가 배제함.
challenge_result: support_one(primary 후보로 살아남은 판정이 정확히 하나) · both_plausible(둘 이상) · neither_supported(어느 후보도 최소 증거 없음 — 다른 판정이 맞다) · insufficient_evidence(원인 판정 증거가 애초에 없다). 그다음 최종 제안(proposal)을 낸다.
후보가 다수 의견인지, 누가 냈는지, 이전에 합의됐는지는 알 수 없고 판단에 쓰지 않는다. 당신의 이전 독립 판정도 후보와 같은 무게의 가설일 뿐이다.

## 규칙
${COMMON_RULES}

## 코드북(전문)

${codebook}

## 사례

${body}

## 출력 형식
{"judgments": [ 사례마다 하나 ]} — 가설 X 하나만 주어진 사례는 그 사례에 적힌 형식, 나머지는:
${CHALLENGE_FIELDS}
사례 ${entries.length}건 모두.`
}

function gate1() {
  assertNotSealed()
  verifyInputs()
  const man = readJ(manifestF)
  const corpus = readJ(CORPUS_F)
  const items = readJ(path.join(OP, 'items.json'))
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n')
  const training = readJ(TRAINING_F)
  const A1 = loadStage('a1'), B1 = loadStage('b1')
  const { toOpaque } = unmap()
  const rows = []
  const plan = {}
  for (const c of corpus.cases) {
    const oid = toOpaque[c.case_id]; const a = A1[oid], b = B1[oid]
    if (!a || !b) throw new Error(`${oid} 1차 판정 누락`)
    const ka = verdictKey(a), kb = verdictKey(b)
    const g = ka === kb ? 'G1_initial_agreement' : a.outcome !== b.outcome ? 'G4_outcome_disagreement'
      : keyFamily(ka) && keyFamily(ka) === keyFamily(kb) ? 'G2_boundary_disagreement' : 'G3_major_disagreement'
    rows.push({ oid, gate1: g, a1: ka, b1: kb })
    const rival = ka === kb ? rivalKey(a, b, ka) : kb
    plan[oid] = rival ? { keys: [ka, rival], open: false } : { keys: [ka], open: true }
  }
  // ① 후보 없는 독립 재판정 패킷(판정자마다 다른 순서)
  for (const [stage, who] of [['a2p', 'A'], ['b2p', 'B']]) {
    const order = shuffled(corpus.cases, `${man.run_id}:${stage}`)
    const half = Math.ceil(order.length / 2)
    ;[order.slice(0, half), order.slice(half)].forEach((cs, i) => {
      const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true })
      const text = reviewerPrompt({ who, codebook, cases: cs, items, idOf: (x) => toOpaque[x.case_id], training: training.cases, mode: 'main' })
      guardWrite(path.join(d, `prompt-${i + 1}.md`)); fs.writeFileSync(path.join(d, `prompt-${i + 1}.md`), text); man.packets[`${stage}/${i + 1}`] = sha(text)
    })
  }
  writeJ(manifestF, man)
  writeJ(path.join(OP, 'gate1.json'), rows)
  writeJ(path.join(OP, 'challenge-plan.json'), plan)
  const cnt = rows.reduce((m, r) => ((m[r.gate1] = (m[r.gate1] ?? 0) + 1), m), {})
  console.log('Gate 1:', JSON.stringify(cnt), `· open-set(강제 Y 없음) ${Object.values(plan).filter((p) => p.open).length}`)
}

// ② a2p · b2p 완료 뒤 — 후보 공개 패킷
function challenge() {
  assertNotSealed()
  verifyInputs()
  const man = readJ(manifestF)
  const corpus = readJ(CORPUS_F)
  const items = readJ(path.join(OP, 'items.json'))
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n')
  const plan = readJ(path.join(OP, 'challenge-plan.json'))
  const { toOpaque } = unmap()
  for (const [stage, preStage, who] of [['a2', 'a2p', 'A'], ['b2', 'b2p', 'B']]) {
    const pre = loadStage(preStage)
    const entries = shuffled(corpus.cases, `${man.run_id}:${stage}:order`).map((c) => {
      const oid = toOpaque[c.case_id]; const p = plan[oid]
      const order = shuffled(p.keys, `${man.run_id}:${stage}:${oid}`)
      return { c, oid, open: p.open, cands: order.map((k, i) => ({ label: 'XY'[i], key: k, v: keyToVerdict(k) })) }
    })
    writeJ(path.join(OP, `${stage}-labels.json`), Object.fromEntries(entries.map((e) => [e.oid, { open: e.open, labels: Object.fromEntries(e.cands.map((x) => [x.label, x.key])) }])))
    const half = Math.ceil(entries.length / 2)
    ;[entries.slice(0, half), entries.slice(half)].forEach((es, i) => {
      const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true })
      const text = challengePrompt(who, codebook, es, items, pre); guardWrite(path.join(d, `prompt-${i + 1}.md`)); fs.writeFileSync(path.join(d, `prompt-${i + 1}.md`), text); man.packets[`${stage}/${i + 1}`] = sha(text)
    })
  }
  writeJ(manifestF, man)
  console.log('반대검증 패킷: a2 · b2')
}

// 대안 Z → 판정 열쇠(최소 증거를 갖추고 Z 자체가 배제되지 않을 때만 생존)
const zKey = (z) => (z?.outcome ? verdictKey({ outcome: z.outcome, primary_cause: z.primary_cause, candidate_causes: z.candidate_causes ?? [] }) : null)
const zSurvives = (z) => !!(z?.outcome && z.minimum_evidence_met && !z.z_excluded && z.z_subordinated_by_stage_order !== true)
// Z 가 살 때의 판정 열쇠 — 최근접 경쟁이 살아 있으면(최소 증거 충족 · 배제 안 됨) Z 단독이 아니라 둘의 multiple 로
const zSurvivorKey = (z) => {
  if (!zSurvives(z)) return null
  const k = zKey(z)
  if (z.outcome === 'identified' && CODES.includes(z.nearest_competing) && z.nearest_competing_min_evidence_met && !z.nearest_competing_excluded)
    return `multiple_plausible:${[z.primary_cause, z.nearest_competing].sort().join('|')}`
  return k
}
function validateZ(z) {
  const e = []
  if (!z || typeof z !== 'object') return ['alternative_z 없음']
  if (typeof z.minimum_evidence_met !== 'boolean' || typeof z.z_excluded !== 'boolean' || typeof z.z_subordinated_by_stage_order !== 'boolean') e.push('alternative_z 불리언')
  if (z.z_subordinated_by_stage_order && (!z.minimum_evidence_met || !citesValidRule(z.z_subordinating_rule))) e.push('Z 우선순위 밀림은 최소 증거 충족 + 코드북 규칙 식별자(Q 순서 · R1–R11) 근거 필요')
  if (z.outcome != null) {
    if (!OUTCOMES.includes(z.outcome)) e.push('alternative_z.outcome')
    if (z.outcome === 'identified' && !CODES.includes(z.primary_cause)) e.push('alternative_z.primary_cause')
    if (z.outcome === 'multiple_plausible' && (!Array.isArray(z.candidate_causes) || z.candidate_causes.length < 2 || z.candidate_causes.some((c) => !PRIMARY_CODES.includes(c)))) e.push('alternative_z.candidate_causes(primary 가능 코드)')
    if (z.minimum_evidence_met && !(z.inclusion_evidence ?? '').trim()) e.push('alternative_z 직접 증거 누락')
    if (z.z_excluded && !(z.z_exclusion_evidence ?? '').trim()) e.push('alternative_z 배제 증거 누락')
  } else if (z.minimum_evidence_met) e.push('alternative_z 판정 없이 met=true')
  return e
}

// 반대검증 결과 → 살아남은 판정 열쇠 집합(최소 증거 충족 + 배제되지 않음)
function survivors(ch, plan) {
  const s = new Set()
  const z = zSurvivorKey(ch.alternative_z)
  if (plan.open) { s.add(z ?? 'insufficient_evidence'); return s } // 반증 여부는 모델의 불리언이 아니라 Z 검사에서 도출
  for (const t of ch.candidate_tests ?? []) if (t.minimum_evidence_met && !t.excluded && t.subordinated_by_stage_order !== true && plan.labels[t.label]) s.add(plan.labels[t.label])
  if (z) s.add(z)
  return s
}
// 반대검증 출력 검증 — 검사 종류는 운영자 계획(라벨 파일)으로 정한다
function validateChallenge(v, plan, caseData = null) {
  const e = []
  if (!CHALLENGE.includes(v.challenge_result)) e.push('challenge_result')
  e.push(...validateZ(v.alternative_z))
  const z = v.alternative_z
  if (z?.outcome && z.minimum_evidence_met && !CODES.includes(z.nearest_competing)) e.push('alternative_z.nearest_competing 코드 누락')
  if (z?.outcome && z.minimum_evidence_met && typeof z.nearest_competing_min_evidence_met !== 'boolean') e.push('nearest_competing_min_evidence_met 불리언')
  if (z?.outcome && z.minimum_evidence_met && typeof z.nearest_competing_excluded !== 'boolean') e.push('nearest_competing_excluded 불리언')
  if (z?.outcome && z.minimum_evidence_met && z.nearest_competing_min_evidence_met === true) {
    const nr = z.nearest_competing_evidence_refs ?? []
    if (!(z.nearest_competing_inclusion_evidence ?? '').trim()) e.push('nearest_competing 직접 증거 누락')
    if (!nr.length || nr.some((r) => !EVIDENCE_FIELDS.includes(r)) || !nr.some((r) => r !== 'self_category')) e.push('nearest_competing 증거 참조는 실제 과정 증거')
    if (caseData && nr.some((r) => caseData[r] == null || caseData[r] === '')) e.push('nearest_competing 이 비어 있는 과정 증거를 참조')
  }
  if (z?.outcome && z.minimum_evidence_met && !PRIMARY_CODES.includes(z.nearest_competing)) e.push('nearest_competing 은 primary 가능 코드')
  if (z?.outcome === 'identified' && z.nearest_competing === z.primary_cause) e.push('nearest_competing 이 Z 자신이다')
  if (z?.outcome && z.minimum_evidence_met) {
    const refs = z.evidence_refs ?? []
    if (!refs.length || refs.some((r) => !EVIDENCE_FIELDS.includes(r)) || !refs.some((r) => r !== 'self_category')) e.push('Z 의 증거 참조는 실제 과정 증거(self_category 만으로는 안 된다)')
    if (caseData && refs.some((r) => caseData[r] == null || caseData[r] === '')) e.push('Z 가 비어 있는 과정 증거를 참조')
  }
  if (z?.outcome === 'identified' && !PRIMARY_CODES.includes(z.primary_cause)) e.push('alternative_z.primary_cause 는 primary 가능 코드')
  if (z?.outcome === 'multiple_plausible' && Array.isArray(z.candidate_causes) && new Set(z.candidate_causes).size !== z.candidate_causes.length) e.push('alternative_z 후보 중복')
  if (plan.open && z?.outcome && !['identified', 'multiple_plausible'].includes(z.outcome)) e.push('open-set 의 Z 는 원인 판정(identified · multiple_plausible)이어야 X 를 반증한다')
  if (z?.nearest_competing_excluded && !(z.nearest_competing_exclusion_evidence ?? '').trim()) e.push('nearest_competing 배제 근거 누락')
  const pk = verdictKey(v.proposal)
  if (plan.open) {
    if (typeof v.insufficient_falsified !== 'boolean') e.push('insufficient_falsified')
    else if (v.insufficient_falsified !== zSurvives(z)) e.push('insufficient_falsified 가 Z 검사와 어긋난다')
    if (zSurvives(z)) { const zk = zSurvivorKey(z); if (pk !== zk || v.challenge_result !== (zk.startsWith('multiple_plausible') ? 'both_plausible' : 'support_one')) e.push('Z 가 생존했는데 결과 · 제안이 Z 검사와 다르다') }
    else if (v.challenge_result !== 'insufficient_evidence' || pk !== 'insufficient_evidence') e.push('Z 가 생존하지 않았는데 insufficient 를 유지하지 않았다')
    return e
  }
  const labels = Object.keys(plan.labels)
  const tl = (v.candidate_tests ?? []).map((t) => t.label)
  if (tl.length !== labels.length || labels.some((l) => !tl.includes(l))) e.push(`candidate_tests 는 후보 ${labels.join('·')} 를 하나씩`)
  for (const t of v.candidate_tests ?? []) {
    if (typeof t.minimum_evidence_met !== 'boolean' || typeof t.excluded !== 'boolean' || typeof t.subordinated_by_stage_order !== 'boolean') e.push(`${t.label} 불리언`)
    if (t.subordinated_by_stage_order && (!t.minimum_evidence_met || !citesValidRule(t.subordinating_rule))) e.push(`${t.label} 우선순위 밀림은 최소 증거 충족 + 코드북 규칙 식별자(Q 순서 · R1–R11) 근거 필요`)
    if (t.minimum_evidence_met && !(t.inclusion_evidence ?? '').trim()) e.push(`${t.label} 직접 증거 누락`)
    if (t.excluded && !(t.exclusion_evidence ?? '').trim()) e.push(`${t.label} 배제 증거 누락`)
  }
  const sv = survivors(v, plan)
  // 주어진 후보(X · Y)가 모두 기각되고 대안 Z 만 살아남으면 neither_supported(다른 판정이 맞다) — 제안은 Z
  const labelSurvives = labels.some((l) => sv.has(plan.labels[l]))
  const zOnly = !labelSurvives && sv.size === 1
  const want = zOnly ? 'neither_supported' : sv.size === 1 ? 'support_one' : sv.size >= 2 ? 'both_plausible' : null
  if (want && v.challenge_result !== want) e.push(`생존 ${sv.size}개인데 challenge_result=${v.challenge_result}`)
  if (!want && !['neither_supported', 'insufficient_evidence'].includes(v.challenge_result)) e.push('생존 후보가 없는데 support/both 결과')
  if (!want && ['identified', 'multiple_plausible'].includes(v.proposal?.outcome)) e.push('생존 원인이 없는데 원인을 확정 · 제안한다(검사하지 않은 원인)')
  if (sv.size === 1 && !sv.has(pk)) e.push('제안이 유일 생존 판정이 아니다')
  if (sv.size >= 2) {
    const codes = [...sv].flatMap((k) => (k.startsWith('identified:') ? [k.slice(11)] : k.startsWith('multiple_plausible:') ? k.slice(19).split('|') : []))
    if (v.proposal?.outcome === 'multiple_plausible') { const pc = new Set(v.proposal.candidate_causes ?? []); const sc = new Set(codes); if (pc.size !== sc.size || [...pc].some((c) => !sc.has(c))) e.push('multiple 제안의 후보가 생존 원인 집합과 정확히 같지 않다') }
    else if (v.proposal?.outcome !== 'inconsistent_evidence') e.push('생존 판정이 둘 이상인데 제안이 하나로 확정한다')
  }
  if (v.challenge_result === 'insufficient_evidence' && pk !== 'insufficient_evidence') e.push('insufficient_evidence 결과와 제안이 어긋난다')
  if (v.challenge_result === 'neither_supported' && pk && labels.some((l) => plan.labels[l] === pk)) e.push('neither_supported 인데 제안이 기각된 후보다')
  return e
}

const GRADE = { V4: 'verification_grade_4', V3: 'verification_grade_3', V2: 'verification_grade_2', V1: 'verification_grade_1', V0: 'verification_grade_0' }
const outcomeGrade = (k, strong) => {
  if (!k) return GRADE.V1
  if (k === 'insufficient_evidence' || k === 'unsupported_stimulus') return GRADE.V0
  if (k.startsWith('identified:')) return strong ? GRADE.V4 : GRADE.V3
  return GRADE.V2 // multiple_plausible · inconsistent_evidence · no_fitting_code — 원인 하나를 확정하지 않는 결과
}

const FINAL_FIELDS = VERDICT_FIELDS.replace('"short_rationale"', '"competing_excluded": true,\n  "short_rationale"')
function finalPrompt(codebook, entries, items) {
  const body = entries.map(({ c, oid, opinions }) => caseBlock(c, items[c.item_id], oid) + '\n\n익명 판정 의견(출처 · 순서 · 개수는 다수결이 아니다):\n' +
    opinions.map((o, i) => `- 의견 ${i + 1}: ${o}`).join('\n')).join('\n\n')
  return `역할: CSAT English Error-Cause Final Judge. 이전 판정들이 갈린 사례다. 익명 의견들을 참고하되 **다수결로 정하지 않는다**.
판단 순서: ① 최소 증거 ② 배제 기준 ③ decision rule ④ 경쟁 가설 제거. 경쟁 후보를 증거로 배제하지 못하면 identified 로 확정하지 말고 multiple_plausible 등 증거가 허용하는 결과를 쓴다.
competing_excluded: 남은 경쟁 판정을 모두 증거로 배제했으면 true.

## 규칙
${COMMON_RULES}

## 코드북(전문)

${codebook}

## 사례

${body}

## 출력 형식
{"judgments": [ 사례마다 하나 ]} — 각 원소:
${FINAL_FIELDS}
사례 ${entries.length}건 모두.`
}

// 후보별 시험 결과(열쇠 → 최소 증거 충족 · 배제 증거 유무)
const tests = (ch, plan) => plan.open ? {} : Object.fromEntries((ch.candidate_tests ?? []).filter((t) => plan.labels[t.label]).map((t) => [plan.labels[t.label], { met: t.minimum_evidence_met === true, excluded: t.excluded === true, subordinated: t.subordinated_by_stage_order === true }]))

function resolve() {
  assertNotSealed()
  verifyInputs()
  const man = readJ(manifestF)
  const corpus = readJ(CORPUS_F)
  const items = readJ(path.join(OP, 'items.json'))
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n')
  const A1 = loadStage('a1'), B1 = loadStage('b1'), A2 = loadStage('a2'), B2 = loadStage('b2')
  const L2a = readJ(path.join(OP, 'a2-labels.json')), L2b = readJ(path.join(OP, 'b2-labels.json'))
  const A2p = loadStage('a2p'), B2p = loadStage('b2p')
  const g1 = Object.fromEntries(readJ(path.join(OP, 'gate1.json')).map((r) => [r.oid, r]))
  const { toOpaque } = unmap()
  const rows = []
  for (const c of corpus.cases) {
    const oid = toOpaque[c.case_id]
    const k1a = verdictKey(A1[oid]), k1b = verdictKey(B1[oid])
    // 무효 출력은 빈 자리표시로 바꿔 아래 기록 · 지표 계산이 깨지지 않게 한다(판정 · 생존은 없음)
    const blank = { invalid_output: true, proposal: {}, candidate_tests: [], alternative_z: null, challenge_result: 'invalid_output' }
    const ca = A2[oid]?.invalid_output ? blank : A2[oid], cb = B2[oid]?.invalid_output ? blank : B2[oid]
    const invalidCh = !!(ca.invalid_output || cb.invalid_output)
    const pa = ca?.invalid_output ? null : verdictKey(ca.proposal), pb = cb?.invalid_output ? null : verdictKey(cb.proposal)
    const sa = ca?.invalid_output ? new Set() : survivors(ca, L2a[oid]), sb = cb?.invalid_output ? new Set() : survivors(cb, L2b[oid])
    const only = (s, k) => s.size === 1 && s.has(k)
    let matrix
    if (k1a === k1b && pa === k1a && pb === k1a && only(sa, k1a) && only(sb, k1a)) matrix = 'GREEN-A_strong_consensus'
    else if (k1a !== k1b && pa === pb && only(sa, pa) && only(sb, pa)) matrix = 'GREEN-B_independent_convergence'
    else if ([pa, pb].includes('insufficient_evidence')) matrix = 'RED-C_evidence_insufficient'
    else if ([pa, pb].some((k) => /^(multiple_plausible|inconsistent_evidence)/.test(k))) matrix = 'RED-B_evidence_conflict'
    else if (pa === pb) matrix = 'YELLOW-A_unresolved_objection'
    else if (keyFamily(pa) && keyFamily(pa) === keyFamily(pb)) matrix = 'YELLOW-B_same_family_boundary'
    else matrix = 'RED-A_family_conflict'
    const green = matrix.startsWith('GREEN')
    // GREEN 이라도 identified 는 증거 충분성 A2 이상이어야 한다(Q0)
    if (invalidCh) matrix = 'RED-X_invalid_challenger_output'
    const adequacyOk = !invalidCh && [ca.proposal, cb.proposal].every((v) => v.outcome !== 'identified' || ['A2', 'A3'].includes(v.evidence_adequacy))
    const final = green && adequacyOk ? pa : null
    rows.push({ oid, gate1: g1[oid].gate1, a1: k1a, b1: k1b, a2p: verdictKey(A2p[oid]), b2p: verdictKey(B2p[oid]), a2: pa, b2: pb, open: L2a[oid].open,
      a1_adequacy: A1[oid].evidence_adequacy, b1_adequacy: B1[oid].evidence_adequacy, a2_adequacy: ca.proposal.evidence_adequacy, b2_adequacy: cb.proposal.evidence_adequacy,
      a2_tests: tests(ca, L2a[oid]), b2_tests: tests(cb, L2b[oid]), a2_falsified: L2a[oid].open ? zSurvives(ca.alternative_z) : null, b2_falsified: L2b[oid].open ? zSurvives(cb.alternative_z) : null, a2_z: zKey(ca.alternative_z), b2_z: zKey(cb.alternative_z), a2_challenge: ca.challenge_result, b2_challenge: cb.challenge_result,
      a2_survivors: [...sa], b2_survivors: [...sb], matrix: green && !adequacyOk ? 'YELLOW-A_unresolved_objection' : matrix,
      needs_final: !(green && adequacyOk), provisional: final, contrib_divergent: contribKey(ca.proposal) !== contribKey(cb.proposal), grade: final ? (contribKey(ca.proposal) !== contribKey(cb.proposal) && final.startsWith('identified:') ? GRADE.V2 : outcomeGrade(final, matrix.startsWith('GREEN-A'))) : null })
  }
  const toFinal = rows.filter((r) => r.needs_final)
  if (toFinal.length) {
    const byOid = Object.fromEntries(corpus.cases.map((c) => [toOpaque[c.case_id], c]))
    const op = (v) => `${describe(v)} — 근거: ${v.short_rationale ?? ''}${(v.excluded_candidates ?? []).length ? ` (배제: ${v.excluded_candidates.map((x) => `${x.code} — ${x.reason}`).join('; ')})` : ''}`
    for (const stage of ['final-claude', 'final-codex']) {
      const entries = shuffled(toFinal, `${man.run_id}:${stage}:order`).map((r) => ({ c: byOid[r.oid], oid: r.oid,
        opinions: shuffled([op(A1[r.oid]), op(B1[r.oid]), ...[A2[r.oid], B2[r.oid]].filter((x) => !x.invalid_output).map((x) => op(x.proposal))], `${man.run_id}:${stage}:${r.oid}`) }))
      const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true })
      const text = finalPrompt(codebook, entries, items); guardWrite(path.join(d, 'prompt-1.md')); fs.writeFileSync(path.join(d, 'prompt-1.md'), text); man.packets[`${stage}/1`] = sha(text)
    }
    writeJ(manifestF, man)
  }
  writeJ(path.join(OP, 'resolve.json'), rows)
  const cnt = rows.reduce((m, r) => ((m[r.matrix] = (m[r.matrix] ?? 0) + 1), m), {})
  console.log('4-way:', JSON.stringify(cnt), `· final 대상 ${toFinal.length}`)
}

// 보고가 읽는 모든 자료의 해시 — 봉인 뒤 바뀌면 보고를 거부한다
function sealedInputs() {
  const files = [path.join(OP, 'map.json'), path.join(OP, 'manifest.json'), path.join(OP, 'gate1.json'), path.join(OP, 'resolve.json'), path.join(OP, 'a2-labels.json'), path.join(OP, 'b2-labels.json'),
    CORPUS_F, TRAINING_F, CODEBOOK_F,
    path.join(DIR, 'data/round1.json'), path.join(DIR, 'data/round2-hard.json'), path.join(DIR, 'data/round2-recheck.json'), path.join(OP, 'challenge-plan.json')]
  for (const st of ['train-a', 'train-b', 'a1', 'b1', 'a2p', 'b2p', 'a2', 'b2', 'final-claude', 'final-codex']) {
    const d = path.join(RUN, st); if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter((x) => /^(out-\d+\.json|raw-\d+-\d+\.jsonl?|prompt-\d+\.md)$/.test(x)).sort()) files.push(path.join(d, f))
  }
  return Object.fromEntries(files.filter((f) => fs.existsSync(f)).map((f) => [path.relative(path.dirname(RUN), f).replace(/\\/g, '/'), sha(readAny(f).replace(/\r\n/g, '\n'))]))
}

function seal() {
  assertNotSealed()
  verifyInputs()
  const rows = readJ(path.join(OP, 'resolve.json'))
  const need = rows.filter((r) => r.needs_final)
  const FC = need.length ? loadStage('final-claude') : {}, FX = need.length ? loadStage('final-codex') : {}
  const out = rows.map((r) => {
    if (!r.needs_final) return { ...r, final: r.provisional, final_status: 'FINAL_VERIFIED', final_path: 'automated_cross_verification', contributing_divergent: r.contrib_divergent }
    const fc = FC[r.oid], fx = FX[r.oid]
    const kc = verdictKey(fc), kx = verdictKey(fx)
    if (kc && kc === kx) {
      const contribDiv = contribKey(fc) !== contribKey(fx)
      const own = new Set(kc.startsWith('identified:') ? [kc.slice(11)] : kc.startsWith('multiple_plausible:') ? kc.slice(19).split('|') : [])
      const rivals = [...new Set([r.a1, r.b1, r.a2, r.b2, ...(r.a2_survivors ?? []), ...(r.b2_survivors ?? [])].filter((k) => k && k !== kc).flatMap((k) => (k.startsWith('identified:') ? [k.slice(11)] : k.startsWith('multiple_plausible:') ? k.slice(19).split('|') : [])))].filter((c) => !own.has(c))
      const covers = (v) => rivals.every((c) => (v.excluded_candidates ?? []).some((x) => x.code === c && (x.reason ?? '').trim()))
      const strong = fc.competing_excluded === true && fx.competing_excluded === true && covers(fc) && covers(fx) && !contribDiv
      return { ...r, fc: kc, fx: kx, final: kc, final_status: 'FINAL_VERIFIED', final_path: 'dual_final_adjudication', contributing_divergent: contribDiv,
        grade: kc.startsWith('identified:') ? (strong ? GRADE.V3 : GRADE.V2) : outcomeGrade(kc, false) }
    }
    return { ...r, fc: kc, fx: kx, final: null, final_status: 'UNRESOLVED', final_path: 'dual_final_adjudication', grade: GRADE.V1 }
  })
  const text = JSON.stringify(out, null, 1) + '\n'
  guardWrite(path.join(OP, 'final.json')); fs.writeFileSync(path.join(OP, 'final.json'), text)
  writeJ(sealF, { sealed_at: new Date().toISOString(), final_sha256: sha(text), inputs: sealedInputs() })
  const cnt = out.reduce((m, r) => ((m[r.final_status] = (m[r.final_status] ?? 0) + 1), m), {})
  console.log('봉인:', JSON.stringify(cnt), sha(text).slice(0, 12))
}

// ── 보고(봉인 뒤에만 기대 판정을 연다) ──
function report() {
  verifyInputs()
  const sealF = path.join(OP, 'seal.json')
const adjManifestF = path.join(OP, 'adj-manifest.json')
const manFor = (stage) => (/^adj[12]-[ab]$/.test(stage ?? '') ? adjManifestF : manifestF); if (!fs.existsSync(sealF)) { console.error('봉인 전에는 기대 판정을 열지 않는다'); process.exit(2) }
  const finalText = readRun(path.join(OP, 'final.json'))
  const sealRec = readJ(sealF)
  if (sha(finalText) !== sealRec.final_sha256) { console.error('봉인 뒤 final.json 이 바뀌었다'); process.exit(2) }
  const nowInputs = sealedInputs()
  const changed = [...new Set([...Object.keys(sealRec.inputs ?? {}), ...Object.keys(nowInputs)])].filter((k) => nowInputs[k] !== sealRec.inputs?.[k])
  if (!sealRec.inputs || changed.length) { console.error(`봉인 뒤 입력이 바뀌었다: ${changed.join(', ') || '봉인에 입력 해시 없음'}`); process.exit(2) }
  const rows = JSON.parse(finalText)
  const man = readJ(manifestF)
  const corpus = readJ(CORPUS_F)
  const { toCase } = unmap()
  const byCase = Object.fromEntries(corpus.cases.map((c) => [c.case_id, c]))
  const expRaw = readAny(EXPECTED_F)
  if (![sha(expRaw), sha(expRaw.replace(/\r\n/g, '\n'))].includes(man.expected_sha256_preregistered ?? corpus.expected_sha256)) { console.error('기대 판정 파일이 사전 등록 해시와 다르다'); process.exit(2) }
  const exp = JSON.parse(expRaw).expected
  const A1 = loadStage('a1'), B1 = loadStage('b1')
  const n = rows.length
  const pct = (x, d = n) => (d ? `${((100 * x) / d).toFixed(1)}%` : '—')
  const f3 = (x) => (x == null ? '—' : x.toFixed(3))

  // A. 1차 일치(cross-model) — 분석기와 같은 정의
  // analyze-human.mjs 와 같은 정의 — 둘 다 unsupported_stimulus 인 사례만 빼고, 한쪽만이면 불일치로 센다
  const judged = rows.filter((r) => !(A1[r.oid].outcome === 'unsupported_stimulus' && B1[r.oid].outcome === 'unsupported_stimulus'))
  const outAg = agreement(judged.map((r) => [A1[r.oid].outcome, B1[r.oid].outcome]), OUTCOMES)
  const insAg = agreement(judged.map((r) => [A1[r.oid].outcome === 'insufficient_evidence', B1[r.oid].outcome === 'insufficient_evidence']), [true, false])
  const wp = judged.filter((r) => A1[r.oid].primary_cause && B1[r.oid].primary_cause)
  const famAg = agreement(wp.map((r) => [fam(A1[r.oid].primary_cause), fam(B1[r.oid].primary_cause)]), FAMILIES)
  const priAg = agreement(wp.map((r) => [A1[r.oid].primary_cause, B1[r.oid].primary_cause]), PRIMARY_CODES)
  // 판정 전체 — 범주를 사전에 고정(primary 코드 + identified 밖 결과, multiple 후보 조합은 한 범주로)
  const coarse = (k) => (k?.startsWith('multiple_plausible') ? 'multiple_plausible' : k)
  const KEY_CATS = [...PRIMARY_CODES.map((c) => `identified:${c}`), ...OUTCOMES.filter((o) => o !== 'identified')]
  const keyAg = agreement(judged.map((r) => [coarse(r.a1), coarse(r.b1)]), KEY_CATS) // 결과 수준(multiple 후보 조합은 한 범주) — 고정 범주라 κ · AC1 계산 가능
  const exactKey = judged.filter((r) => r.a1 === r.b1).length // 판정 전체 정확 일치(후보 조합까지) — 관찰 일치만

  // B. Challenger reversal — 1차 합의 사례 중 반대검증 · 최종에서 뒤집힌 비율
  const g1 = rows.filter((r) => r.gate1 === 'G1_initial_agreement')
  const revChallenger = g1.filter((r) => r.a2 !== r.a1 || r.b2 !== r.a1).length
  const revFinal = g1.filter((r) => r.final && r.final !== r.a1).length
  const g1Unresolved = g1.filter((r) => !r.final).length
  const cnt = (list, f) => list.reduce((m, r) => { const k = f(r); m[k] = (m[k] ?? 0) + 1; return m }, {})
  // 반대검증 세부 — 하나의 reversal 수치로 뭉치지 않는다
  const g1Closed = g1.filter((r) => !r.open)
  // 생존 집합(후보 X · Y + 대안 Z)으로 판정 — 1차 합의안이 죽고 다른 가설만 살면 hard, 합의안도 살고 다른 가설도 살면 expansion
  const isCause = (k) => /^(identified|multiple_plausible):/.test(k ?? '')
  const hardOf = (sv, k) => !sv.includes(k) && sv.some((x) => x !== k)
  // 반전을 실제로 일으킨 검증자(합의안이 죽고 다른 판정이 산 쪽)의 검사로 종류를 정한다
  const hardKind = (r) => {
    const kinds = [[r.a2_survivors, r.a2_tests], [r.b2_survivors, r.b2_tests]].filter(([sv]) => hardOf(sv, r.a1)).map(([, t]) => { const x = t?.[r.a1]; return !x ? 'other' : !x.met ? 'unmet' : x.excluded ? 'excluded' : 'other' })
    return kinds.includes('unmet') && kinds.includes('excluded') ? 'mixed' : kinds[0] ?? 'other'
  }
  // 확장 = 합의안이 살아 있고, 합의안에 없던 **새 원인**이 생존(multiple 합의의 구성원 생존은 확장이 아니다)
  const codesOfKey = (k) => (k?.startsWith('identified:') ? [k.slice(11)] : k?.startsWith('multiple_plausible:') ? k.slice(19).split('|') : [k])
  const expandOf = (sv, k) => sv.includes(k) && sv.some((x) => x !== k && isCause(x) && codesOfKey(x).some((c) => !codesOfKey(k).includes(c)))
  const nonCauseConflict = g1.filter((r) => [r.a2_survivors, r.b2_survivors].some((sv) => sv.includes(r.a1) && sv.some((x) => x !== r.a1 && !isCause(x))))
  const hard = g1Closed.filter((r) => hardOf(r.a2_survivors, r.a1) || hardOf(r.b2_survivors, r.a1))
  const expand = g1Closed.filter((r) => !hard.includes(r) && (expandOf(r.a2_survivors, r.a1) || expandOf(r.b2_survivors, r.a1)))
  const openRows = rows.filter((r) => r.open)
  const falsified = openRows.filter((r) => r.a2_falsified || r.b2_falsified)
  const retained = g1.filter((r) => r.a2 === r.a1 && r.b2 === r.a1)
  const a2b2 = rows.filter((r) => r.a2 === r.b2).length
  const retest = { claude: rows.filter((r) => r.a1 === r.a2p).length, codex: rows.filter((r) => r.b1 === r.b2p).length }
  const vulnerable = {}
  for (const r of rows) for (const [k1, k2] of [[r.a1, r.a2], [r.b1, r.b2]]) if (k1 !== k2 && k1?.startsWith('identified:')) vulnerable[k1.slice(11)] = (vulnerable[k1.slice(11)] ?? 0) + 1
  const adeqChange = { claude: rows.filter((r) => r.a1_adequacy !== r.a2_adequacy).length, codex: rows.filter((r) => r.b1_adequacy !== r.b2_adequacy).length,
    a2b2_same: rows.filter((r) => r.a2_adequacy === r.b2_adequacy).length, a1b1_same: rows.filter((r) => r.a1_adequacy === r.b1_adequacy).length }
  const chDiff = { claude_changed: rows.filter((r) => r.a2 !== r.a1).length, codex_changed: rows.filter((r) => r.b2 !== r.b1).length,
    claude_multi: rows.filter((r) => r.a2?.startsWith('multiple_plausible')).length, codex_multi: rows.filter((r) => r.b2?.startsWith('multiple_plausible')).length }
  const challengeDetail = { g1: g1.length, g1_closed: g1Closed.length, retained: retained.length, hard_reversal: hard.map((r) => ({ case_id: toCase[r.oid], kind: hardKind(r) })), plausibility_expansion: expand.map((r) => toCase[r.oid]),
    open_set: openRows.length, insufficient_falsified: falsified.map((r) => toCase[r.oid]), a2_b2_same: a2b2, retest, vulnerable, adequacy: adeqChange, challenger: chDiff }

  // H. 기대 판정 비교(봉인 뒤)
  const expKey = (e) => (e ? verdictKey({ outcome: e.outcome, primary_cause: e.primary, candidate_causes: e.candidates ?? [] }) : null)
  // 기대 일치: identified 는 primary 까지, 그 밖은 결과만(기대 파일에 multiple_plausible 후보 목록이 없다) · accept(허용 대안)는 따로 센다
  const sameAsExp = (k, e) => !!(k && e) && (k.startsWith('identified:') ? e.outcome === 'identified' && k.slice(11) === e.primary : k.split(':')[0] === e.outcome)
  const acceptKeys = (e) => (e?.accept ?? []).map((a) => (CODES.includes(a) ? `identified:${a}` : a))
  const cmp = rows.map((r) => { const e = exp[toCase[r.oid]]; return { ...r, case_id: toCase[r.oid], expected: expKey(e), exp_match: sameAsExp(r.final, e), exp_accept: acceptKeys(e).includes(r.final), exp_one: [r.fc, r.fx].some((k) => sameAsExp(k, e)) } })
  const agreeExp = cmp.filter((r) => r.exp_match)
  const modelsAgreeExpDiffer = cmp.filter((r) => r.final && r.expected && !r.exp_match)
  const unresolvedExpMatchesOne = cmp.filter((r) => !r.final && r.exp_one)

  // G. 반복 충돌 쌍 — 같은 단계의 판정자 간 충돌(A1↔B1 · A2p↔B2p · A2↔B2 · Final C↔X)만 센다. 단계 사이 변화는 따로(stage_shift)
  const pairs = {}, shifts = {}
  const bump = (m, a, b) => { if (a && b && a !== b) { const p = [a, b].sort().join(' ↔ '); m[p] = (m[p] ?? 0) + 1 } }
  for (const r of cmp) {
    const seen = new Set()
    for (const [a, b] of [[r.a1, r.b1], [r.a2p, r.b2p], [r.a2, r.b2], [r.fc, r.fx]]) if (a && b && a !== b) { const p = [a, b].sort().join(' ↔ '); if (!seen.has(p)) { seen.add(p); pairs[p] = (pairs[p] ?? 0) + 1 } }
    bump(shifts, r.a1, r.a2); bump(shifts, r.b1, r.b2)
  }
  const repeated = Object.entries(pairs).filter(([, v]) => v >= 3).sort((a, b) => b[1] - a[1])

  // 이전 모델 dry run(개발 자료)과의 충돌 쌍 비교 — 합산하지 않는다
  const legacy = {}
  for (const f of ['round1', 'round2-hard', 'round2-recheck']) {
    const r = readJ(path.join(DIR, `data/${f}.json`))
    const get = (x) => (Array.isArray(x) ? x : Object.values(x ?? {}))
    const LA = Object.fromEntries(get(r.reviewerA).map((v) => [v.case_id, v])), LB = Object.fromEntries(get(r.reviewerB).map((v) => [v.case_id, v]))
    for (const id of Object.keys(LA)) if (LB[id]) legacy[id] = [LA[id], LB[id]]
  }
  const lk = (v) => verdictKey({ outcome: v.outcome, primary_cause: v.primary, candidate_causes: v.candidates ?? [] })
  const legacyPairs = {}
  for (const [, [a, b]] of Object.entries(legacy)) { const ka = lk(a), kb = lk(b); if (ka !== kb) { const p = [ka, kb].sort().join(' ↔ '); legacyPairs[p] = (legacyPairs[p] ?? 0) + 1 } }
  const shared = repeated.filter(([p]) => legacyPairs[p]).map(([p, v]) => [p, v, legacyPairs[p]])

  // I. 코드별 coverage — 노출(어느 판정에든 primary · 후보 · contributing 으로 등장) · 반대검증 후보로 검사됨 · 최종 확정 primary · 미해결 사례에 걸림
  const codesIn = (k) => (k ? (k.startsWith('identified:') ? [k.slice(11)] : k.startsWith('multiple_plausible:') ? k.slice(19).split('|') : []) : [])
  const coverage = Object.fromEntries(CODES.map((c) => [c, { exposed: 0, tested: 0, contributing: 0, final_primary: 0, unresolved: 0 }]))
  const A2s = loadStage('a2'), B2s = loadStage('b2'), A2ps = loadStage('a2p'), B2ps = loadStage('b2p')
  const FCs = fs.existsSync(path.join(RUN, 'final-claude', 'out-1.json')) ? loadStage('final-claude') : {}, FXs = fs.existsSync(path.join(RUN, 'final-codex', 'out-1.json')) ? loadStage('final-codex') : {}
  const stageVerdicts = (r) => [A1[r.oid], B1[r.oid], A2ps[r.oid], B2ps[r.oid], A2s[r.oid]?.proposal, B2s[r.oid]?.proposal, FCs[r.oid], FXs[r.oid]].filter(Boolean)
  for (const r of cmp) {
    const all = new Set([r.a1, r.b1, r.a2p, r.b2p, r.a2, r.b2, r.fc, r.fx, r.a2_z, r.b2_z].flatMap(codesIn))
    const contrib = new Set(stageVerdicts(r).flatMap((v) => v.contributing_causes ?? []))
    for (const c of contrib) { all.add(c); coverage[c].contributing++ }
    for (const c of all) if (coverage[c]) coverage[c].exposed++
    for (const c of new Set([...Object.keys(r.a2_tests ?? {}), ...Object.keys(r.b2_tests ?? {}), r.a2_z, r.b2_z].flatMap(codesIn))) coverage[c].tested++
    for (const c of codesIn(r.final)) if (r.final.startsWith('identified:')) coverage[c].final_primary++
    if (!r.final) for (const c of all) coverage[c].unresolved++
  }
  // J. 경계별 결과
  const bnd = {}
  for (const r of cmp) for (const b of byCase[r.case_id].boundaries ?? ['(없음)']) {
    bnd[b] ??= { n: 0, a1b1: 0, verified: 0, unresolved: 0, expected_match: 0 }
    bnd[b].n++; if (r.a1 === r.b1) bnd[b].a1b1++; if (r.final_status === 'FINAL_VERIFIED') bnd[b].verified++; else bnd[b].unresolved++; if (r.exp_match) bnd[b].expected_match++
  }
  // 확신도 vs 불일치
  const conf = {}
  for (const r of rows) for (const v of [A1[r.oid], B1[r.oid]]) { conf[v.confidence] ??= { n: 0, agree: 0 }; conf[v.confidence].n++; if (r.a1 === r.b1) conf[v.confidence].agree++ }

  const models = {}
  for (const st of ['train-a', 'train-b', 'a1', 'b1', 'a2p', 'b2p', 'a2', 'b2', 'final-claude', 'final-codex']) {
    const d = path.join(RUN, st); if (!fs.existsSync(d)) continue
    for (const f of fs.readdirSync(d).filter((x) => /^out-\d+\.json$/.test(x))) { const o = readJ(path.join(d, f)); models[`${st}/${o.part}`] = { cli: o.meta.cli, models: o.meta.models, run: o.reviewer_run_id, leakage: o.meta.leakage_events.length } }
  }
  // 연습 세트 점수(calibration)
  const training = readJ(TRAINING_F)
  const trainScore = {}
  for (const st of ['train-a', 'train-b']) {
    const f = path.join(RUN, st, 'out-1.json'); if (!fs.existsSync(f)) continue
    const T = Object.fromEntries(readJ(f).judgments.map((v) => [v.case_id, v]))
    trainScore[st] = training.cases.filter((c, i) => verdictKey(T[`T${String(i + 1).padStart(2, '0')}`]) === verdictKey({ outcome: c.answer.outcome, primary_cause: c.answer.primary, candidate_causes: c.answer.candidates ?? [] })).length
  }

  const gates = { family: famAg.po, primary: priAg.po, insufficient: insAg.po }
  const summary = { run_id: man.run_id, codebook_rev: man.codebook_rev, codebook_sha256: man.codebook_sha256, final_sha256: readJ(sealF).final_sha256, n,
    first_pass: { outcome: outAg, insufficient: insAg, family: famAg, primary: priAg, verdict_key: keyAg }, training_score: trainScore,
    gate1: cnt(rows, (r) => r.gate1), matrix: cnt(rows, (r) => r.matrix), grade: cnt(rows, (r) => r.grade ?? '(없음)'), final_status: cnt(rows, (r) => r.final_status),
    challenger_reversal: { initial_agreement: g1.length, challenger_changed: revChallenger, final_changed: revFinal }, challenge_detail: challengeDetail,
    expected: { agree: agreeExp.length, models_agree_expected_differs: modelsAgreeExpDiffer.map((r) => ({ case_id: r.case_id, final: r.final, expected: r.expected, in_accept: r.exp_accept })),
      unresolved_expected_matches_one: unresolvedExpMatchesOne.map((r) => r.case_id) },
    repeated_pairs: repeated, stage_shifts: shifts, legacy_shared_pairs: shared, coverage, boundaries: bnd, confidence: conf, models,
    cases: cmp.map((r) => ({ case_id: r.case_id, gate1: r.gate1, a1: r.a1, b1: r.b1, a2: r.a2, b2: r.b2, matrix: r.matrix, fc: r.fc ?? null, fx: r.fx ?? null, final: r.final, status: r.final_status, grade: r.grade, expected: r.expected })) }
  const outMd = path.resolve(arg('--out') ?? '')
  if (!/\.md$/.test(outMd) || !inside(realOf(outMd), realOf(DIR))) { console.error('--out 은 docs/csat-learner/codebook 아래 .md 여야 한다(집계만 · 봉인 자료와 겹치지 않게)'); process.exit(2) }
  const writeReport = (f, text) => { if (!/XMODEL_RESULT[^\\/]*\.(md|json)$/.test(f) || !inside(realOf(f), realOf(DIR)) || isLink(f)) { console.error(`보고는 docs/csat-learner/codebook/XMODEL_RESULT*.md|json 에만: ${f}`); process.exit(2) } fs.writeFileSync(f, text) }
  writeReport(outMd.replace(/\.md$/, '.json'), JSON.stringify(summary, null, 1) + '\n')
  const L = []
  L.push(`# Cross-Model Blind Dry Run 결과 — ${man.run_id}`, '', '> Claude Code × Codex 4중 교차검증. **사람 판정이 아니다** — 이 수치는 cross-model agreement 이며 human reliability · 사람 검증이 아니다. 원문 · 판정 원본은 저장소 밖 실행 폴더에만 있다.', '',
    `코드북 ${man.codebook_rev} \`${man.codebook_sha256.slice(0, 12)}\` · 최종 판정 봉인 \`${summary.final_sha256.slice(0, 12)}\` · 사례 ${n}`, '')
  L.push('## A. 1차(A1 Claude ↔ B1 Codex) cross-model 일치', '', '| 지표 | n | 일치 | κ | AC1 | 내부 screening |', '|---|---|---|---|---|---|',
    `| family | ${famAg.n} | ${pct(famAg.po * famAg.n, famAg.n)} | ${f3(famAg.kappa)} | ${f3(famAg.ac1)} | ≥ 80% ${gates.family >= 0.8 ? '통과' : '미달'} |`,
    `| primary | ${priAg.n} | ${pct(priAg.po * priAg.n, priAg.n)} | ${f3(priAg.kappa)} | ${f3(priAg.ac1)} | ≥ 70% ${gates.primary >= 0.7 ? '통과' : '미달'} |`,
    `| insufficient_evidence 여부 | ${insAg.n} | ${pct(insAg.po * insAg.n, insAg.n)} | ${f3(insAg.kappa)} | ${f3(insAg.ac1)} | ≥ 80% ${gates.insufficient >= 0.8 ? '통과' : '미달'} |`,
    `| outcome | ${outAg.n} | ${pct(outAg.po * outAg.n, outAg.n)} | ${f3(outAg.kappa)} | ${f3(outAg.ac1)} | 보고 |`,
    `| 판정(결과 + primary · multiple 은 한 범주) | ${keyAg.n} | ${pct(keyAg.po * keyAg.n, keyAg.n)} | ${f3(keyAg.kappa)} | ${f3(keyAg.ac1)} | 보고 |`,
    `| 판정 전체 정확 일치(multiple 후보 조합까지) | ${judged.length} | ${pct(exactKey, judged.length)} | — | — | 보고 |`, '',
    `연습 10건 점수(blind, 해설 전): ${Object.entries(trainScore).map(([k, v]) => `${k} ${v}/10`).join(' · ') || '—'}`, '',
    `Gate 1: ${Object.entries(summary.gate1).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '')
  L.push('## B. 반대검증(Challenger) — reversal 을 종류별로', '',
    '| 지표 | 값 |', '|---|---|',
    `| G1 유지(A2 · B2 제안 모두 1차 합의와 같음) | ${retained.length}/${g1.length} (${pct(retained.length, g1.length)}) |`,
    `| hard reversal(합의안이 죽고 다른 판정만 생존) — 최소 증거 미충족 ${hard.filter((r) => hardKind(r) === 'unmet').length} · 증거로 배제 ${hard.filter((r) => hardKind(r) === 'excluded').length} · 혼합 ${hard.filter((r) => hardKind(r) === 'mixed').length} · 기타 ${hard.filter((r) => hardKind(r) === 'other').length} | ${hard.length}/${g1Closed.length} (${pct(hard.length, g1Closed.length)}) ${hard.map((r) => toCase[r.oid]).join(' ')} |`,
    `| 원인 아닌 결과와의 충돌(합의안 + insufficient 등 동시 생존) | ${nonCauseConflict.length} ${nonCauseConflict.map((r) => toCase[r.oid]).join(' ')} |`,
    `| plausibility expansion(합의안도 충족하지만 다른 후보도 충족 · multiple 로 확장) | ${expand.length}/${g1Closed.length} (${pct(expand.length, g1Closed.length)}) ${expand.map((r) => toCase[r.oid]).join(' ')} |`,
    `| insufficient falsification(open-set 사례) | ${falsified.length}/${openRows.length} ${falsified.map((r) => toCase[r.oid]).join(' ')} |`,
    `| 최종 확정 판정이 1차 합의와 다름 · 미해결로 남음 | ${revFinal}/${g1.length} · ${g1Unresolved}/${g1.length} |`,
    `| A2 제안 = B2 제안 | ${a2b2}/${n} |`,
    `| 같은 모델 재판정(후보 보기 전) A1 = A2p · B1 = B2p | Claude ${retest.claude}/${n} · Codex ${retest.codex}/${n} |`,
    `| evidence adequacy 변화(1차 → 반대검증) | Claude ${adeqChange.claude} · Codex ${adeqChange.codex} · 두 모델 같음 1차 ${adeqChange.a1b1_same} → 반대검증 ${adeqChange.a2b2_same} |`,
    `| 반대검증자 차이 | Claude 판정 변경 ${chDiff.claude_changed} · multiple ${chDiff.claude_multi} / Codex 판정 변경 ${chDiff.codex_changed} · multiple ${chDiff.codex_multi} |`, '',
    `공격에 취약한 코드(1차 identified 가 반대검증에서 바뀐 횟수): ${Object.entries(vulnerable).sort((a, b) => b[1] - a[1]).map(([k, v]) => `\`${k}\` ${v}`).join(' · ') || '없음'}`, '',
    'confidence 는 모델별 보정이 달라(Codex 는 low 0회) 등급 산정에 쓰지 않는다 — 분석 보조 지표.', '')
  L.push('## C · D · E · F. 4-way · 등급 · 최종', '', `4-way: ${Object.entries(summary.matrix).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '',
    `등급: ${Object.entries(summary.grade).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '',
    `Final adjudication 대상 ${rows.filter((r) => r.needs_final).length} · 최종: ${Object.entries(summary.final_status).map(([k, v]) => `${k} ${v}`).join(' · ')}`, '')
  L.push('## G. 반복 충돌 쌍(같은 단계 판정자 간 · 같은 쌍 3사례 이상)', '', '| 쌍 | 사례 | 이전 모델 dry run 에서도(개발 자료 · 합산 안 함) |', '|---|---|---|',
    ...(repeated.length ? repeated.map(([p, v]) => `| ${p} | ${v} | ${legacyPairs[p] ?? 0} |`) : ['| (없음) | | |']), '',
    `단계 사이 변화(1차 → 반대검증, 같은 모델): ${Object.entries(shifts).sort((a, b) => b[1] - a[1]).map(([p, v]) => `${p} ${v}`).join(' · ') || '없음'}`, '')
  L.push('## H. 기대 판정 비교(봉인 뒤 · 기대는 정답이 아니다)', '', `최종 확정이 기대와 같음 ${agreeExp.length} · **모델 합의가 기대와 다름 ${modelsAgreeExpDiffer.length}** · 미해결 중 final 한쪽이 기대와 같음 ${unresolvedExpMatchesOne.length}`, '',
    ...(modelsAgreeExpDiffer.length ? ['| 사례 | 최종(모델) | 기대 |', '|---|---|---|', ...modelsAgreeExpDiffer.map((r) => `| ${r.case_id} | ${r.final} | ${r.expected}${r.exp_accept ? ' (허용 대안에 있음)' : ''} |`)] : []), '')
  L.push('## I. 코드별 coverage', '', '| 코드 | 노출 사례 | 반대검증에서 검사(X · Y · Z) | contributing(전 단계) | 최종 확정 primary | 미해결에 걸림 |', '|---|---|---|---|---|---|',
    ...CODES.map((c) => `| \`${c}\` | ${coverage[c].exposed} | ${coverage[c].tested} | ${coverage[c].contributing} | ${coverage[c].final_primary} | ${coverage[c].unresolved} |`), '')
  L.push('## J. 경계별', '', '| 경계 | n | 1차 일치 | 확정 | 미해결 | 기대와 같음 |', '|---|---|---|---|---|---|',
    ...Object.entries(bnd).sort((a, b) => b[1].n - a[1].n).map(([k, v]) => `| ${k} | ${v.n} | ${v.a1b1} | ${v.verified} | ${v.unresolved} | ${v.expected_match} |`), '')
  L.push('## 확신도 vs 1차 일치', '', Object.entries(conf).map(([k, v]) => `${k}: ${v.agree}/${v.n}`).join(' · '), '')
  L.push('## 실행 기록(모델 · 버전 · 누출 감사)', '', '| 단계 | CLI | 모델 | 누출 이벤트 |', '|---|---|---|---|', ...Object.entries(models).map(([k, v]) => `| ${k} | ${v.cli} | ${v.models.join(', ')} | ${v.leakage} |`), '')
  L.push('## 사례별(원문 없음)', '', '| 사례 | Gate1 | A1 | B1 | A2 | B2 | 4-way | Final C/X | 최종 | 등급 | 기대 |', '|---|---|---|---|---|---|---|---|---|---|---|',
    ...summary.cases.map((r) => `| ${r.case_id} | ${r.gate1.split('_')[0]} | ${r.a1} | ${r.b1} | ${r.a2} | ${r.b2} | ${r.matrix.split('_')[0]} | ${r.fc ?? ''} / ${r.fx ?? ''} | ${r.final ?? 'UNRESOLVED'} | ${(r.grade ?? '').replace('verification_grade_', 'vg')} | ${r.expected} |`), '')
  // 복수 후보 열쇠(multiple_plausible:A|B)의 `|` 가 표 열 구분자로 읽히지 않게 이스케이프
  writeReport(outMd, L.join('\n').replace(/multiple_plausible:[A-Za-z_.|]+/g, (m) => m.replace(/\|/g, '\\|')))
  console.log(`보고: ${outMd}`)
}


// ── adjudication(봉인 뒤) — docs/csat-learner/codebook/ADJUDICATION_PLAN.md 에 사전 등록된 절차
// 1단계 adj1-a(Claude) · adj1-b(Codex): 사례 + 기대 판정과 작성 근거만 보고 독립 판정 · 기대 지지 평가(모델 결과 비공개)
// 2단계 adj2-a · adj2-b: 새 context 에서 자기 1단계 판정 + 익명 모델 판정 공개 → adjudication 코드
// 회차 봉인 자료는 고치지 않는다 — 별도 매니페스트(operator/adj-manifest.json)
const ADJ_CODES = ['GOLD_WRONG', 'GOLD_UNDERSPECIFIED', 'ITEM_AMBIGUOUS', 'ITEM_BAD_CONSTRUCT', 'CODEBOOK_BOUNDARY_WEAK', 'CODE_REDUNDANT', 'MODEL_SHARED_BIAS', 'INSUFFICIENT_EVIDENCE']
const isAdjStage = (stage) => /^adj[12]-[ab]$/.test(stage)

// ── adjudication v2 — 지정 사례만(--cases), 실패 원인 7분류. 1단계: 기대 판정 + 회차 모델 판정(익명)을 보고 독립 분류(다른 adjudicator 결과 비공개)
// 2단계: 두 adjudicator 의 1단계 분류를 익명으로 공개 → 같은 증거 · 규칙으로 최종 분류. 다수결 금지
const ADJ2_CATS = ['GOLD_WRONG', 'CASE_CONSTRUCTION', 'RULE_INSUFFICIENT', 'TAXONOMY_OVERLAP', 'TAXONOMY_MISSING', 'SHARED_MODEL_BIAS', 'GENUINELY_UNRESOLVED']
const V2_FIELDS = `{
  "case_id": "<사례 id>",
  "own_verdict": {"outcome": "<결과>", "primary_cause": "<identified 일 때>", "candidate_causes": ["<multiple 일 때>"]},
  "primary_category": "${ADJ2_CATS.join('|')}",
  "contributing_categories": ["<위 분류 0개 이상, primary 와 중복 금지>"],
  "key_answers": ["<사례에 적힌 핵심 질문마다 한 문장씩, 순서대로>"],
  "expected_fix_needed": false,
  "rule_fix_needed": false,
  "case_fix_needed": false,
  "recommended_gold": {"outcome": "<결과>", "primary_cause": "<identified 일 때>", "candidate_causes": ["<multiple 일 때>"]},
  "short_rationale": "<1–3문장 — 학생 증거 → 최소 증거 → 배제 기준 → 결정 규칙 → 기대와 모델 판정 비교 순서로>"
}`
function adjV2Prompt(phase, entries, codebook, items, cbLabel) {
  const body = entries.map((x) => caseBlock(x.c, items[x.c.item_id], x.oid) + '\n\n' + goldBlock(x.c, x.e) + x.models + (x.questions.length ? '\n\n핵심 질문:\n' + x.questions.map((q, i) => `${i + 1}. ${q}`).join('\n') : '') + (phase === 2 ? x.reveal : '')).join('\n\n')
  const head = phase === 1
    ? `역할: CSAT English Error-Cause Adjudicator — 1단계 독립 분류. 이 사례들은 코드북 ${cbLabel} 재검증에서 기준에 못 미쳤다(모델 판정이 기대와 다르거나 최종 판정이 갈림). 다른 adjudicator 의 판단은 보지 않는다(주어지지 않는다). 각 사례에 대해 스스로 판정하고, 실패의 원인을 분류한다.`
    : `역할: CSAT English Error-Cause Adjudicator — 2단계 최종 분류. 1단계의 두 독립 분류(출처 숨김)가 공개된다. 다수결이 아니라 같은 증거와 코드북 ${cbLabel} 규칙으로 최종 분류한다.`
  return `${head}
판단 순서: ① 실제 학생 증거 ② 최소 증거 ③ 배제 기준 ④ 결정 규칙 ⑤ 기대 판정과 모델 판정 비교.
분류: GOLD_WRONG(기대 판정이 틀림) · CASE_CONSTRUCTION(사례가 겨냥한 구분을 드러내지 못하거나 두 판정을 모두 정당화) · RULE_INSUFFICIENT(결정 규칙에 단계 · tie-break 가 빠짐) · TAXONOMY_OVERLAP(두 코드의 경계 자체가 겹침 — 규칙 보완으로 안 갈림) · TAXONOMY_MISSING(맞는 코드가 없음) · SHARED_MODEL_BIAS(규칙은 충분한데 판정들이 같은 방향으로 오판) · GENUINELY_UNRESOLVED(증거로 가를 수 없는 사례 — 실패가 아님). primary 1개 + contributing 0개 이상.
expected_fix_needed · rule_fix_needed · case_fix_needed 는 이 분류에서 따라 나오는 조치다(고치는 것은 이 작업 밖).

## 규칙
${COMMON_RULES}

## 코드북 ${cbLabel}(전문)

${codebook}

## 사례

${body}

## 출력 형식
{"judgments": [ 사례마다 하나 ]} — 각 원소:
${V2_FIELDS}
사례 ${entries.length}건 모두.`
}
function validateAdjV2(v, ids, nQuestions) {
  const e = []
  if (!ids.has(v.case_id)) e.push('모르는 case_id')
  if (!ADJ2_CATS.includes(v.primary_category)) e.push('primary_category')
  if (!Array.isArray(v.contributing_categories) || v.contributing_categories.some((c) => !ADJ2_CATS.includes(c) || c === v.primary_category)) e.push('contributing_categories')
  for (const k of ['expected_fix_needed', 'rule_fix_needed', 'case_fix_needed']) if (typeof v[k] !== 'boolean') e.push(k)
  if (!Array.isArray(v.key_answers) || v.key_answers.length < nQuestions) e.push('key_answers(질문마다 하나)')
  for (const g of [v.own_verdict, v.recommended_gold]) {
    if (!OUTCOMES.includes(g?.outcome)) { e.push('verdict.outcome'); continue }
    if (g.outcome === 'identified' && !PRIMARY_CODES.includes(g.primary_cause)) e.push('verdict.primary_cause')
    // 배열인지 먼저 — 문자열 · 객체가 오면 예외로 실행 전체가 멈추지 않고 검증 오류(→ 재판정)로 처리
    if (g.outcome === 'multiple_plausible' && (!Array.isArray(g.candidate_causes) || new Set(g.candidate_causes).size < 2 || g.candidate_causes.length !== new Set(g.candidate_causes).size || g.candidate_causes.some((c) => !PRIMARY_CODES.includes(c)))) e.push('verdict.candidate_causes')
  }
  if (v.primary_category === 'GOLD_WRONG' && !v.expected_fix_needed) e.push('GOLD_WRONG 인데 expected_fix_needed=false')
  if (!(v.short_rationale ?? '').trim()) e.push('short_rationale')
  return e
}

function adjTargets() {
  // 봉인 검증 — 봉인 뒤 바뀐 final.json 으로 대상을 고르지 않는다(report 와 같은 검사)
  if (!lexists(sealF)) { console.error('회차 봉인 뒤에만'); process.exit(2) }
  const finalText = readRun(path.join(OP, 'final.json'))
  if (sha(finalText) !== JSON.parse(readRun(sealF)).final_sha256) { console.error('봉인 뒤 final.json 이 바뀌었다'); process.exit(2) }
  const rows = JSON.parse(finalText)
  const expRaw = readAny(EXPECTED_F)
  const exp = JSON.parse(expRaw).expected
  const { toCase } = unmap()
  const same = (k, e) => !!(k && e) && (k.startsWith('identified:') ? e.outcome === 'identified' && k.slice(11) === e.primary : k.split(':')[0] === e.outcome)
  return rows.filter((r) => !r.final || !same(r.final, exp[toCase[r.oid]])).map((r) => ({ ...r, case_id: toCase[r.oid], expected: exp[toCase[r.oid]] }))
}

const goldBlock = (c, e) => `기대 판정(사례 작성자가 정한 것 — 정답이 아니다): 결과 ${e.outcome}${e.primary ? ' · primary ' + e.primary : ''}${(e.accept ?? []).length ? ' · 허용 대안 ' + e.accept.join(', ') : ''}
기대 판정 작성 근거: 의도한 실패 기제 — ${c.true_mechanism ?? '없음'} / 증거 설계 — ${c.evidence_design ?? '없음'} / 겨냥한 경계 — ${(c.boundaries ?? []).join(', ') || '없음'}`

const ADJ1_FIELDS = VERDICT_FIELDS.replace('"short_rationale"', '"gold_assessment": {"supported": "yes|partial|no", "reason": "<기대 판정이 학생 증거와 코드북으로 지지되는가 — 1–2문장>"},\n  "short_rationale"')
const ADJ2_FIELDS = `{
  "case_id": "<사례 id>",
  "adjudication_code": "${ADJ_CODES.join('|')}",
  "secondary_code": "<위 코드 중 하나 또는 null>",
  "boundary": "<관련 경계 — 코드 이름으로, 예: S.attachment ↔ S.core_structure / identified ↔ multiple_plausible>",
  "recommended_gold": {"outcome": "<결과>", "primary_cause": "<identified 일 때>", "candidate_causes": ["<multiple 일 때>"], "accept": ["<허용 대안 코드>"]},
  "codebook_issue": "<코드북에 고칠 점이 있으면 무엇을 — 없으면 빈 문자열>",
  "short_rationale": "<1–2문장>"
}`

function adjPrompt(phase, entries, codebook, items) {
  const body = entries.map((x) => caseBlock(x.c, items[x.c.item_id], x.oid) + '\n\n' + goldBlock(x.c, x.e) + (phase === 2 ? x.reveal : '')).join('\n\n')
  const head = phase === 1
    ? `역할: CSAT English Error-Cause Adjudicator — 1단계 독립 판정. 각 사례를 아래 코드북으로 스스로 판정하고, 사례 작성자의 기대 판정이 학생 증거와 코드북으로 지지되는지 평가한다. 다른 판정자의 판정은 보지 않는다(주어지지 않는다).`
    : `역할: CSAT English Error-Cause Adjudicator — 2단계 분류. 각 사례에 대해 당신의 1단계 독립 판정과, 출처를 숨긴 다른 판정들 · 회차 최종 결과가 주어진다. 다수결로 정하지 말고 증거 · 코드북 규칙으로 불일치의 원인을 하나의 adjudication 코드로 분류한다.
코드: GOLD_WRONG(기대 판정 자체가 잘못) · GOLD_UNDERSPECIFIED(기대는 가능하나 허용 대안 · 범위 부족) · ITEM_AMBIGUOUS(사례가 두 코드 이상을 정당화) · ITEM_BAD_CONSTRUCT(겨냥한 구분을 사례가 잘 못 드러냄) · CODEBOOK_BOUNDARY_WEAK(정의 · tie-break 규칙 부족) · CODE_REDUNDANT(두 코드가 실제 판정에서 안정적으로 구분되지 않음) · MODEL_SHARED_BIAS(규칙은 충분한데 판정들이 같은 방향으로 오판) · INSUFFICIENT_EVIDENCE(지금 자료로 adjudication 불가).
S.attachment 사례는 CODE_REDUNDANT 가능성을 열어 둔다 — 「규칙만 보완하면 구분된다」고 가정하지 않는다.`
  const fields = phase === 1 ? ADJ1_FIELDS : ADJ2_FIELDS
  return `${head}

## 규칙
${COMMON_RULES}

## 코드북(전문)

${codebook}

## 사례

${body}

## 출력 형식
{"judgments": [ 사례마다 하나 ]} — 각 원소:
${fields}
사례 ${entries.length}건 모두.`
}

function validateAdj(v, stage, ids, caseData) {
  const am = lexists(adjManifestF) ? readJ(adjManifestF) : null
  if (am?.version === 'v2') { const oid = v.case_id; const cid = Object.entries(readJ(path.join(OP, 'map.json'))).find(([, o]) => o === oid)?.[0]; return validateAdjV2(v, ids, (am.questions?.[cid] ?? []).length) }
  if (/^adj1-/.test(stage)) {
    const e = validateVerdict(v, ids, true, caseData)
    if (!['yes', 'partial', 'no'].includes(v.gold_assessment?.supported) || !(v.gold_assessment?.reason ?? '').trim()) e.push('gold_assessment')
    return e
  }
  const e = []
  if (!ids.has(v.case_id)) e.push('모르는 case_id')
  if (!ADJ_CODES.includes(v.adjudication_code)) e.push('adjudication_code')
  if (v.secondary_code != null && (!ADJ_CODES.includes(v.secondary_code) || v.secondary_code === v.adjudication_code)) e.push('secondary_code')
  if (!(v.boundary ?? '').trim()) e.push('boundary')
  const g = v.recommended_gold ?? {}
  if (!OUTCOMES.includes(g.outcome)) e.push('recommended_gold.outcome')
  if (g.outcome === 'identified' && !PRIMARY_CODES.includes(g.primary_cause)) e.push('recommended_gold.primary_cause')
  if (g.outcome === 'multiple_plausible' && (!Array.isArray(g.candidate_causes) || new Set(g.candidate_causes).size < 2 || g.candidate_causes.length !== new Set(g.candidate_causes).size || g.candidate_causes.some((c) => !PRIMARY_CODES.includes(c)))) e.push('recommended_gold.candidate_causes(서로 다른 primary 가능 코드 2개 이상)')
  if ((g.accept ?? []).some((c) => !CODES.includes(c) && !OUTCOMES.includes(c))) e.push('recommended_gold.accept')
  if (!(v.short_rationale ?? '').trim()) e.push('short_rationale')
  return e
}

function adjWritePackets(phase, man, entriesFor) {
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n')
  const items = readJ(path.join(OP, 'items.json'))
  for (const [stage, seed] of [[`adj${phase}-a`, 'A'], [`adj${phase}-b`, 'B']]) {
    const entries = shuffled(entriesFor(stage), `${man.run_id}:${stage}:${seed}`)
    const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true })
    const f = path.join(d, 'prompt-1.md'); const text = adjPrompt(phase, entries, codebook, items)
    guardWrite(f); fs.writeFileSync(f, text); man.packets[`${stage}/1`] = sha(text)
  }
  writeJ(adjManifestF, man)
}

function adjPrepare() {
  verifyInputs()
  if (!fs.existsSync(sealF)) { console.error('회차 봉인 뒤에만'); process.exit(2) }
  if (lexists(adjManifestF)) { console.error('adjudication 이 이미 준비됐다'); process.exit(2) }
  const base = readJ(manifestF)
  const man = { run_id: `${base.run_id}-adj`, codebook_sha256: base.codebook_sha256, created: new Date().toISOString(), plan_commit: arg('--plan-commit') ?? null, packets: {}, targets: [] }
  const corpus = readJ(CORPUS_F)
  const byCase = Object.fromEntries(corpus.cases.map((c) => [c.case_id, c]))
  const targets = adjTargets()
  man.targets = targets.map((t) => t.oid)
  adjWritePackets(1, man, () => targets.map((t) => ({ c: byCase[t.case_id], e: t.expected, oid: t.oid })))
  console.log(`adjudication 1단계 패킷: ${targets.length}건 (불일치 ${targets.filter((t) => t.final).length} · 미해결 ${targets.filter((t) => !t.final).length})`)
}

function adjReveal() {
  verifyInputs()
  const man = readJ(adjManifestF)
  if (man.packets['adj2-a/1']) { console.error('2단계 패킷이 이미 있다'); process.exit(2) }
  const corpus = readJ(CORPUS_F)
  const byCase = Object.fromEntries(corpus.cases.map((c) => [c.case_id, c]))
  const targets = adjTargets()
  const A1 = loadStage('a1'), B1 = loadStage('b1'), A2 = loadStage('a2'), B2 = loadStage('b2')
  const FC = lexists(path.join(RUN, 'final-claude', 'out-1.json')) ? loadStage('final-claude') : {}, FX = lexists(path.join(RUN, 'final-codex', 'out-1.json')) ? loadStage('final-codex') : {}
  const own = { 'adj2-a': loadStage('adj1-a'), 'adj2-b': loadStage('adj1-b') }
  // 1단계 무효 출력이 남았으면 2단계 패킷을 만들지 않고 사례를 알린다(재판정 후에도 무효 — 운영자 판단 필요)
  const bad1 = Object.entries(own).flatMap(([st, m]) => targets.filter((t) => !m[t.oid] || m[t.oid].invalid_output).map((t) => `${st.replace('adj2', 'adj1')}:${t.case_id}`))
  if (bad1.length) { console.error(`1단계 무효 · 누락 출력: ${bad1.join(' ')} — 해당 사례를 다시 판정하거나 제외 결정 후 진행`); process.exit(2) }
  const op = (v) => `${describe(v)} — 근거: ${v.short_rationale ?? ''}`
  adjWritePackets(2, man, (stage) => targets.map((t) => {
    const mine = own[stage][t.oid]
    const others = shuffled([A1[t.oid], B1[t.oid], A2[t.oid]?.proposal, B2[t.oid]?.proposal, FC[t.oid], FX[t.oid]].filter((v) => v && v.outcome).map(op), `${man.run_id}:${stage}:${t.oid}`)
    const reveal = `\n\n당신의 1단계 독립 판정: ${describe(mine)} — 기대 지지 ${mine.gold_assessment.supported}: ${mine.gold_assessment.reason}\n` +
      `다른 판정들(출처 · 단계 숨김 · 순서 무의미):\n${others.map((o, i) => `- 판정 ${i + 1}: ${o}`).join('\n')}\n회차 최종 결과: ${t.final ? `확정 — ${t.final}` : '미해결(최종 판정 둘이 갈림)'}`
    return { c: byCase[t.case_id], e: t.expected, oid: t.oid, reveal }
  }))
  console.log(`adjudication 2단계 패킷: ${targets.length}건`)
}

function adjReport() {
  verifyInputs()
  const man = readJ(adjManifestF)
  const { toCase } = unmap()
  const corpus = readJ(CORPUS_F)
  const byCase = Object.fromEntries(corpus.cases.map((c) => [c.case_id, c]))
  const targets = adjTargets()
  const J1a = loadStage('adj1-a'), J1b = loadStage('adj1-b'), Ja = loadStage('adj2-a'), Jb = loadStage('adj2-b')
  const norm = (b) => [...new Set(((b ?? '').match(/[A-Z]\.[a-z_]+|identified|multiple_plausible|insufficient_evidence|inconsistent_evidence/g) ?? []))].sort().join(' ↔ ')
  // 무효 출력(재판정 후에도 규칙 위반)은 코드 INVALID_OUTPUT 으로 남기고 합의로 세지 않는다
  const INV = { adjudication_code: 'INVALID_OUTPUT', secondary_code: null, boundary: '', recommended_gold: {}, codebook_issue: '' }
  const g1 = (v) => (v && !v.invalid_output ? v.gold_assessment?.supported ?? null : 'invalid')
  const rows = targets.map((t) => {
    const a = Ja[t.oid] && !Ja[t.oid].invalid_output ? Ja[t.oid] : INV, b = Jb[t.oid] && !Jb[t.oid].invalid_output ? Jb[t.oid] : INV
    const keys = [t.a1, t.b1, t.a2, t.b2, t.fc, t.fx, t.final].filter(Boolean)
    const codesTouched = new Set(keys.flatMap((k) => (k.startsWith('identified:') ? [k.slice(11)] : k.startsWith('multiple_plausible:') ? k.slice(19).split('|') : [k])))
    if (t.expected.primary) codesTouched.add(t.expected.primary)
    return { case_id: t.case_id, kind: t.final ? 'model_vs_gold' : 'unresolved', final: t.final ?? null, expected: verdictKey({ outcome: t.expected.outcome, primary_cause: t.expected.primary, candidate_causes: [] }),
      corpus_boundaries: byCase[t.case_id].boundaries ?? [], adj1: { a: verdictKey(J1a[t.oid]), b: verdictKey(J1b[t.oid]), gold_a: g1(J1a[t.oid]), gold_b: g1(J1b[t.oid]) },
      code_a: a.adjudication_code, code_b: b.adjudication_code, secondary_a: a.secondary_code ?? null, secondary_b: b.secondary_code ?? null,
      boundary_a: norm(a.boundary), boundary_b: norm(b.boundary), agreed: a.adjudication_code === b.adjudication_code && a.adjudication_code !== 'INVALID_OUTPUT' ? a.adjudication_code : null,
      gold_a: verdictKey(a.recommended_gold), gold_b: verdictKey(b.recommended_gold), accept_a: a.recommended_gold?.accept ?? [], accept_b: b.recommended_gold?.accept ?? [],
      issue_a: a.codebook_issue ?? '', issue_b: b.codebook_issue ?? '', codes_touched: [...codesTouched] }
  })
  const agreed = rows.filter((r) => r.agreed)
  // 사전 등록 rev4 조건 — 두 판정자가 같은 주 코드를 매긴 사례만 센다. 경계는 **두 판정자가 같게 짚은 adjudicated 경계**(정규화)로만 센다 —
  // 말뭉치의 겨냥 경계로 세면, 같은 겨냥 경계라도 실제 문제 경계가 다른 사례들이 한 경계 실패로 합쳐진다
  const boundaryKeys = (r) => (r.boundary_a && r.boundary_a === r.boundary_b ? [r.boundary_a] : [])
  const countBy = (list, codeSet) => { const m = {}; for (const r of list.filter((x) => codeSet.includes(x.agreed))) for (const k of boundaryKeys(r)) m[k] = (m[k] ?? 0) + 1; return m }
  const weakBy = countBy(agreed, ['CODEBOOK_BOUNDARY_WEAK'])
  const imBy = countBy(agreed, ['CODEBOOK_BOUNDARY_WEAK', 'MODEL_SHARED_BIAS'])
  const isIM = (k) => /identified ↔ multiple_plausible|identified.*multiple_plausible|multiple_plausible.*identified/.test(k)
  const attach = agreed.filter((r) => (r.codes_touched.includes('S.attachment') || r.corpus_boundaries.some((b) => /S\.attachment/.test(b))) && ['CODE_REDUNDANT', 'CODEBOOK_BOUNDARY_WEAK'].includes(r.agreed))
  const four = agreed.filter((r) => r.codes_touched.some((c) => ['R.relation', 'R.inference', 'V.wrong_sense', 'B.outside_knowledge'].includes(c)) && ['CODEBOOK_BOUNDARY_WEAK', 'CODE_REDUNDANT'].includes(r.agreed))
  const triggers = {
    t1_boundary_weak_same_boundary: Object.entries(weakBy).filter(([, n]) => n >= 2),
    t2_identified_vs_multiple_repeat: Object.entries(imBy).filter(([k, n]) => isIM(k) && n >= 2),
    t3_attachment_not_separable: attach.map((r) => r.case_id),
    t4_volatile_codes_rule_problem: four.length >= 2 ? four.map((r) => r.case_id) : [],
  }
  const rev4 = triggers.t1_boundary_weak_same_boundary.length > 0 || triggers.t2_identified_vs_multiple_repeat.length > 0 || triggers.t3_attachment_not_separable.length > 0 || triggers.t4_volatile_codes_rule_problem.length > 0
  const goldSide = agreed.filter((r) => ['GOLD_WRONG', 'GOLD_UNDERSPECIFIED', 'ITEM_BAD_CONSTRUCT'].includes(r.agreed)).length
  const mvg = rows.filter((r) => r.kind === 'model_vs_gold')
  const bias = mvg.filter((r) => r.agreed === 'MODEL_SHARED_BIAS').length
  const unresolved = rows.filter((r) => r.kind === 'unresolved').length
  const imRows = rows.filter((r) => r.corpus_boundaries.some(isIM))
  const seed = {
    // 명시적 제외 — 운영자 결정 파일(--exclusions, 실행 폴더 안 JSON {case_id: 사유}). 미해결 사례마다 비어 있지 않은 사유가 있어야 제외로 인정
    c1_unresolved_zero_or_excluded: (() => {
      const xf = arg('--exclusions'); const ex = xf ? JSON.parse(readRun(path.resolve(xf))) : {}
      const unres = rows.filter((r) => r.kind === 'unresolved').map((r) => r.case_id)
      const left = unres.filter((id) => !(typeof ex[id] === 'string' && ex[id].trim()))
      const extra = Object.keys(ex).filter((id) => !unres.includes(id))
      if (extra.length) { console.error(`제외 파일에 미해결이 아닌 사례: ${extra.join(' ')}`); process.exit(2) }
      return { ok: left.length === 0, detail: unres.length ? `미해결 ${unres.length}건 · 사유 있는 명시적 제외 ${unres.length - left.length}${left.length ? ` · 남음 ${left.join(' ')}` : ''}` : '미해결 없음', excluded: ex }
    })(),
    c2_no_repeated_rule_failure: { ok: !rev4, detail: rev4 ? 'rev4 조건 충족' : '없음' },
    c3_shared_bias_le_25pct: { ok: bias <= 4, detail: `MODEL_SHARED_BIAS(두 판정자 합의) ${bias}/${mvg.length}` },
    c4_im_boundary_reproducible: { ok: imRows.length > 0 && imRows.every((r) => r.agreed && r.agreed !== 'CODEBOOK_BOUNDARY_WEAK'), detail: `그 경계 사례 ${imRows.length}건 중 합의 · 규칙 약함 아님 ${imRows.filter((r) => r.agreed && r.agreed !== 'CODEBOOK_BOUNDARY_WEAK').length}` },
    // 허용 대안이 필요한 기대 판정이 없으면 충족, 있으면 새 회차 기대 파일에 반영하기 전까지 미충족
    c5_gold_accept_schema: (() => { const n = agreed.filter((r) => r.agreed === 'GOLD_UNDERSPECIFIED').length; return { ok: n === 0, detail: n ? `GOLD_UNDERSPECIFIED(합의) ${n}건 — 새 회차 기대 파일에 accept 반영 필요` : '허용 대안이 필요한 기대 판정 없음' } })(),
    c6_subset_rerun_if_rev4: { ok: !rev4, detail: rev4 ? 'rev4 후 바뀐 경계 subset 재-blind-run 필요' : '해당 없음' },
  }
  const codeCount = (k) => rows.reduce((m, r) => ((m[r[k]] = (m[r[k]] ?? 0) + 1), m), {})
  const summary = { run_id: man.run_id, plan_commit: man.plan_commit, n: rows.length, agreement: { agreed: agreed.length, disagreed: rows.length - agreed.length }, code_a: codeCount('code_a'), code_b: codeCount('code_b'),
    agreed_codes: agreed.reduce((m, r) => ((m[r.agreed] = (m[r.agreed] ?? 0) + 1), m), {}), triggers, rev4_required: rev4, gold_side_majority: goldSide > rows.length / 2, seed_candidate: Object.values(seed).every((x) => x.ok), seed, rows }
  const outMd = path.resolve(arg('--out') ?? '')
  if (!/ADJUDICATION_RESULT\.md$/.test(outMd) || !inside(realOf(outMd), realOf(DIR)) || isLink(outMd)) { console.error('--out 은 docs/csat-learner/codebook/ADJUDICATION_RESULT.md'); process.exit(2) }
  // 판정자 서술(코드북 문제)은 실행 폴더에만 — 저장소에는 코드 · 판정 열쇠 · 집계와 「문제 제기 여부」만
  writeJ(path.join(OP, 'adjudication-full.json'), summary)
  for (const r of rows) { r.codebook_issue_raised = { a: !!r.issue_a.trim(), b: !!r.issue_b.trim() }; delete r.issue_a; delete r.issue_b }
  fs.writeFileSync(outMd.replace(/\.md$/, '.json'), JSON.stringify(summary, null, 1) + '\n')
  const esc =(s) => String(s ?? '').replace(/\|/g, '\\|')
  const L = [`# Cross-Model Dry Run adjudication 결과 — ${man.run_id}`, '', `> 사전 등록: [ADJUDICATION_PLAN.md](./ADJUDICATION_PLAN.md)${man.plan_commit ? ` (커밋 \`${man.plan_commit}\`)` : ''} · 판정자 Claude · Codex(새 context, 2단계) · 사람 판정 아님 · 원문 없음.`, '',
    `대상 ${rows.length}건(모델-기대 불일치 ${mvg.length} · 미해결 ${unresolved}) · 두 판정자 주 코드 일치 ${agreed.length} · 불일치 ${rows.length - agreed.length}`, '',
    '## 코드 분포', '', '| 코드 | Claude | Codex | 두 판정자 합의 |', '|---|---|---|---|', ...ADJ_CODES.map((c) => `| \`${c}\` | ${summary.code_a[c] ?? 0} | ${summary.code_b[c] ?? 0} | ${summary.agreed_codes[c] ?? 0} |`), '',
    '## rev4 조건(사전 등록 — 합의 사례만)', '', `1. 같은 경계 CODEBOOK_BOUNDARY_WEAK ≥ 2: ${triggers.t1_boundary_weak_same_boundary.map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}`,
    `2. identified ↔ multiple_plausible 반복(≥ 2): ${triggers.t2_identified_vs_multiple_repeat.map(([k, n]) => `${k} ${n}`).join(' · ') || '없음'}`,
    `3. S.attachment 분리 안 됨: ${triggers.t3_attachment_not_separable.join(' ') || '없음'}`, `4. 흔들린 4코드 규칙 문제(≥ 2): ${triggers.t4_volatile_codes_rule_problem.join(' ') || '없음'}`, '',
    `**rev4 필요: ${rev4 ? '예' : '아니오'}** · GOLD 쪽(GOLD_WRONG · GOLD_UNDERSPECIFIED · ITEM_BAD_CONSTRUCT) 과반: ${summary.gold_side_majority ? '예' : '아니오'}`, '',
    '## v0.1 seed 후보 조건(사전 등록)', '', ...Object.entries(seed).map(([k, v]) => `- ${v.ok ? '충족' : '미충족'} — ${k}: ${v.detail}`), '', `**seed 후보: ${summary.seed_candidate ? '예' : '아니오'}**`, '',
    '## 사례별', '', '| 사례 | 종류 | 회차 최종 | 기대 | 1단계 A / B (기대 지지) | 코드 Claude / Codex | 경계 | 권장 기대 A / B | 코드북 문제 제기 A / B |', '|---|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.case_id} | ${r.kind === 'unresolved' ? '미해결' : '불일치'} | ${esc(r.final ?? '—')} | ${esc(r.expected)} | ${esc(r.adj1.a)} (${r.adj1.gold_a}) / ${esc(r.adj1.b)} (${r.adj1.gold_b}) | ${r.code_a} / ${r.code_b} | ${esc(r.boundary_a || r.boundary_b)} | ${esc(r.gold_a)} / ${esc(r.gold_b)} | ${r.codebook_issue_raised.a ? '예' : '—'} / ${r.codebook_issue_raised.b ? '예' : '—'} |`), '',
    '판정자 서술(코드북 문제 · 근거) 전문은 저장소 밖 실행 폴더 `operator/adjudication-full.json` 에만 있다.', '']
  fs.writeFileSync(outMd, L.join('\n'))
  console.log(`adjudication 보고: rev4 ${rev4 ? '필요' : '불필요'} · seed 후보 ${summary.seed_candidate ? '예' : '아니오'} · 합의 ${agreed.length}/${rows.length}`)
}

// ── rev4 채택 판정 — docs/csat-learner/codebook/REV4_VALIDATION_PLAN.md(사전 등록 c406cbd09)의 기준을 그대로 기계 판정
// 봉인 · 입력 검증 뒤에만. 사례 원문 없이 사례 id · 판정 열쇠 · 통과 여부만 저장소에 쓴다
function rev4Eval() {
  verifyInputs()
  if (!lexists(sealF)) { console.error('봉인 뒤에만'); process.exit(2) }
  const finalText = readRun(path.join(OP, 'final.json'))
  if (sha(finalText) !== JSON.parse(readRun(sealF)).final_sha256) { console.error('봉인 뒤 final.json 이 바뀌었다'); process.exit(2) }
  const rows = JSON.parse(finalText)
  const { toCase } = unmap()
  const corpus = readJ(CORPUS_F)
  const exp = JSON.parse(readAny(EXPECTED_F)).expected
  const byCase = Object.fromEntries(rows.map((r) => [toCase[r.oid], r]))
  const setOf = Object.fromEntries(corpus.cases.map((c) => [c.case_id, c.set]))
  // 기대와 같음 — identified 는 primary 까지, multiple 은 후보 집합까지(기대에 후보가 있으면), 그 밖은 결과
  const match = (k, e) => {
    if (!k || !e || e.outcome === 'undetermined') return false
    if (k.startsWith('identified:')) return e.outcome === 'identified' && k.slice(11) === e.primary
    if (k.startsWith('multiple_plausible:')) return e.outcome === 'multiple_plausible' && (!(e.candidates ?? []).length || [...e.candidates].sort().join('|') === k.slice(19))
    return k === e.outcome
  }
  const verified = (id) => byCase[id]?.final_status === 'FINAL_VERIFIED'
  const ok = (id) => verified(id) && match(byCase[id].final, exp[id])
  // 수렴 — 권장 기대가 갈린 regression 사례: FINAL_VERIFIED 이고 그 판정이 두 adjudicator 권장 중 하나(accept 에 담아 둠)
  const converged = (id) => verified(id) && (exp[id]?.accept ?? []).includes(byCase[id].final)
  // 채택 기준 — --spec(코드북 폴더 기준 상대 경로, 사전 등록 커밋 파일)이 있으면 그것, 없으면 rev4 회차 기준(REV4_VALIDATION_PLAN)
  const spec = arg('--spec') ? JSON.parse(readAny(path.join(DIR, arg('--spec')))) : {
    label: 'rev4',
    changes: {
      R6: { holdout: ['R4-H1', 'R4-H2'], regression_match: ['C4-11', 'H-13', 'H-05', 'C4-07'], regression_converge: ['C2-02'] },
      R12: { holdout: ['R4-H3', 'R4-H4', 'R4-H5'], regression_match: ['N-13'], regression_converge: ['H-17', 'N-04'] },
      R9_section6: { holdout: ['R4-H6', 'R4-H7'], regression_match: ['N-15', 'N-05'], regression_converge: [] },
    },
    regression_defined: ['C4-11', 'H-13', 'H-05', 'C4-07', 'N-13', 'N-14', 'N-15', 'H-04', 'N-05'],
    baseline: { match: 7, of: 9, label: 'rev3' },
  }
  const CHANGES = spec.changes
  const regDefined = spec.regression_defined
  const regMatch = regDefined.filter(ok).length
  const noRegression = regMatch >= spec.baseline.match
  const result = {}
  for (const [name, c] of Object.entries(CHANGES)) {
    const h = c.holdout.map((id) => ({ id, final: byCase[id]?.final ?? null, status: byCase[id]?.final_status, expected: exp[id], pass: ok(id) }))
    const rm = c.regression_match.map((id) => ({ id, final: byCase[id]?.final ?? null, pass: ok(id) }))
    const rc = c.regression_converge.map((id) => ({ id, final: byCase[id]?.final ?? null, pass: converged(id) }))
    result[name] = { holdout: h, regression_match: rm, regression_converge: rc, adopt: noRegression && [...h, ...rm, ...rc].every((x) => x.pass) }
  }
  const surv = corpus.cases.filter((c) => c.set === 'surveillance').map((c) => ({ id: c.case_id, final: byCase[c.case_id]?.final ?? null, status: byCase[c.case_id]?.final_status }))
  const survAbsorbed = surv.length > 0 && surv.every((x) => x.final?.startsWith('identified:S.') && x.final !== 'identified:S.attachment')
  const summary = { plan_commit: arg('--plan-commit') ?? null, codebook_sha256: readJ(manifestF).codebook_sha256, final_sha256: sha(finalText), regression_defined_match: `${regMatch}/${regDefined.length}`, baseline: `${spec.baseline.match}/${spec.baseline.of} (${spec.baseline.label})`, label: spec.label, no_regression: noRegression, changes: result, surveillance: surv, surveillance_absorbed_into_other_S: survAbsorbed,
    sets: Object.fromEntries(['regression', 'holdout', 'surveillance'].map((st) => [st, { n: rows.filter((r) => setOf[toCase[r.oid]] === st).length, verified: rows.filter((r) => setOf[toCase[r.oid]] === st && r.final_status === 'FINAL_VERIFIED').length, unresolved: rows.filter((r) => setOf[toCase[r.oid]] === st && r.final_status === 'UNRESOLVED').map((r) => toCase[r.oid]) }])) }
  const outMd = path.resolve(arg('--out') ?? '')
  if (!/REV4[0-9]*_EVAL\.md$/.test(outMd) || !inside(realOf(outMd), realOf(DIR)) || isLink(outMd)) { console.error('--out 은 docs/csat-learner/codebook/REV4*_EVAL.md'); process.exit(2) }
  fs.writeFileSync(outMd.replace(/\.md$/, '.json'), JSON.stringify(summary, null, 1) + '\n')
  const esc = (x) => String(x ?? '—').replace(/\|/g, '\\|')
  const ek = (e) => (!e ? '—' : e.outcome === 'identified' ? `identified:${e.primary}` : e.outcome === 'multiple_plausible' ? `multiple_plausible:${(e.candidates ?? []).slice().sort().join('|')}` : e.outcome)
  const L = [`# ${spec.label} 재검증 결과 — 변경점별 채택 판정`, '', `> 사전 등록: ${arg('--spec') ? `[${arg('--spec')}](./${arg('--spec')})` : '[REV4_VALIDATION_PLAN.md](./REV4_VALIDATION_PLAN.md)'}${summary.plan_commit ? ` (\`${summary.plan_commit}\`)` : ''} · 코드북 \`${summary.codebook_sha256.slice(0, 12)}\` · 최종 판정 봉인 \`${summary.final_sha256.slice(0, 12)}\` · Claude × Codex 4중 blind · 사람 검증 아님 · 원문 없음.`, '',
    '## 세트별(따로 본다)', '', '| 세트 | 건 | 최종 확정 | 미해결 |', '|---|---|---|---|', ...Object.entries(summary.sets).map(([k, v]) => `| ${k} | ${v.n} | ${v.verified} | ${v.unresolved.join(' ') || '—'} |`), '',
    `퇴행 검사 — 기대가 정해진 Regression ${regDefined.length}건 일치 **${summary.regression_defined_match}** (기준 ${summary.baseline}) → ${noRegression ? '퇴행 없음' : `**퇴행 — ${spec.label} 전체 보류**`}`, '']
  for (const [name, r] of Object.entries(result)) {
    L.push(`## ${name} — ${r.adopt ? '**채택**' : '**candidate 유지**'}`, '', '| 사례 | 구분 | 최종 | 기대 / 기준 | 통과 |', '|---|---|---|---|---|',
      ...r.holdout.map((x) => `| ${x.id} | holdout | ${esc(x.final)} | ${esc(ek(x.expected))} | ${x.pass ? '예' : '아니오'} |`),
      ...r.regression_match.map((x) => `| ${x.id} | regression | ${esc(x.final)} | ${esc(ek(exp[x.id]))} | ${x.pass ? '예' : '아니오'} |`),
      ...r.regression_converge.map((x) => `| ${x.id} | regression(수렴) | ${esc(x.final)} | 두 adjudicator 권장 중 하나: ${esc((exp[x.id]?.accept ?? []).join(' / '))} | ${x.pass ? '예' : '아니오'} |`), '')
  }
  L.push('## Surveillance — S.attachment(채택과 무관)', '', ...surv.map((x) => `- ${x.id}: ${esc(x.final)} (${x.status})`), '', `두 건 모두 다른 S 코드로 흡수: ${survAbsorbed ? '예 → 다음 개정에서 병합 · 하향 후보' : '아니오'}`, '')
  fs.writeFileSync(outMd, L.join('\n'))
  console.log(`rev4 판정: ${Object.entries(result).map(([k, v]) => `${k} ${v.adopt ? '채택' : '보류'}`).join(' · ')} · 퇴행 ${noRegression ? '없음' : '있음'}`)
}
function adjV2Context() {
  const man = readJ(adjManifestF)
  const corpus = readJ(CORPUS_F)
  const byCase = Object.fromEntries(corpus.cases.map((c) => [c.case_id, c]))
  const exp = JSON.parse(readAny(EXPECTED_F)).expected
  const finalText = readRun(path.join(OP, 'final.json'))
  if (sha(finalText) !== JSON.parse(readRun(sealF)).final_sha256) { console.error('봉인 뒤 final.json 이 바뀌었다'); process.exit(2) }
  const { toOpaque } = unmap()
  const rows = Object.fromEntries(JSON.parse(finalText).map((r) => [r.oid, r]))
  return { man, byCase, exp, rows, toOpaque, cbLabel: readJ(manifestF).cfg?.codebook === 'CODEBOOK.rev4.md' ? 'rev4' : 'rev3' }
}
// 모델 판정(익명) — 1단계부터 공개: 실패 원인을 분류하려면 기대와 무엇이 어긋났는지 알아야 한다
function modelsBlock(oid, row, seed) {
  const A1 = loadStage('a1'), B1 = loadStage('b1'), A2 = loadStage('a2'), B2 = loadStage('b2')
  const FC = lexists(path.join(RUN, 'final-claude', 'out-1.json')) ? loadStage('final-claude') : {}, FX = lexists(path.join(RUN, 'final-codex', 'out-1.json')) ? loadStage('final-codex') : {}
  const op = (v) => `${describe(v)} — 근거: ${v.short_rationale ?? ''}`
  const all = shuffled([A1[oid], B1[oid], A2[oid]?.proposal, B2[oid]?.proposal, FC[oid], FX[oid]].filter((v) => v && v.outcome).map(op), seed)
  return `\n\n이 회차의 판정들(출처 · 단계 숨김 · 순서 무의미):\n${all.map((o, i) => `- 판정 ${i + 1}: ${o}`).join('\n')}\n회차 최종 결과: ${row.final ? `확정 — ${row.final}` : '미해결(최종 판정 둘이 갈림)'}`
}
function adjV2Prepare() {
  verifyInputs()
  if (!lexists(sealF)) { console.error('회차 봉인 뒤에만'); process.exit(2) }
  if (lexists(adjManifestF)) { console.error('adjudication 이 이미 준비됐다'); process.exit(2) }
  const qf = arg('--questions'); const questions = qf ? JSON.parse(readRun(path.resolve(qf))) : {}
  const cases = (arg('--cases') ?? '').split(',').map((x) => x.trim()).filter(Boolean)
  if (!cases.length) { console.error('--cases 필요'); process.exit(2) }
  const base = readJ(manifestF)
  // 매니페스트를 쓰기 전에 검증 — 실패한 준비가 「이미 준비됨」 상태로 남아 재시도를 막지 않게
  {
    const finalText = readRun(path.join(OP, 'final.json'))
    if (sha(finalText) !== JSON.parse(readRun(sealF)).final_sha256) { console.error('봉인 뒤 final.json 이 바뀌었다'); process.exit(2) }
    const known = new Set(readJ(CORPUS_F).cases.map((c) => c.case_id)); const { toOpaque: tp } = unmap(); const fr = new Set(JSON.parse(finalText).map((r) => r.oid))
    const bad = cases.filter((id) => !known.has(id) || !fr.has(tp[id]))
    if (bad.length) { console.error(`없는 사례: ${bad.join(' ')}`); process.exit(2) }
  }
  writeJ(adjManifestF, { run_id: `${base.run_id}-adj2`, version: 'v2', codebook_sha256: base.codebook_sha256, created: new Date().toISOString(), plan_commit: arg('--plan-commit') ?? null, packets: {}, cases, questions })
  const { man, byCase, exp, rows, toOpaque, cbLabel } = adjV2Context()
  for (const id of cases) if (!byCase[id] || !rows[toOpaque[id]]) { console.error(`없는 사례: ${id}`); process.exit(2) }
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n'); const items = readJ(path.join(OP, 'items.json'))
  for (const [stage, seed] of [['adj1-a', 'A'], ['adj1-b', 'B']]) {
    const entries = shuffled(cases.map((id) => ({ c: byCase[id], e: exp[id], oid: toOpaque[id], questions: questions[id] ?? [], models: modelsBlock(toOpaque[id], rows[toOpaque[id]], `${man.run_id}:${stage}:${id}`) })), `${man.run_id}:${stage}:${seed}`)
    const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, 'prompt-1.md'); const text = adjV2Prompt(1, entries, codebook, items, cbLabel)
    guardWrite(f); fs.writeFileSync(f, text); man.packets[`${stage}/1`] = sha(text)
  }
  writeJ(adjManifestF, man)
  console.log(`adjudication v2 1단계: ${cases.join(' ')}`)
}
function adjV2Reveal() {
  verifyInputs()
  const { man, byCase, exp, rows, toOpaque, cbLabel } = adjV2Context()
  if (man.packets['adj2-a/1']) { console.error('2단계 패킷이 이미 있다'); process.exit(2) }
  const P = { a: loadStage('adj1-a'), b: loadStage('adj1-b') }
  const bad = man.cases.filter((id) => ['a', 'b'].some((k) => !P[k][toOpaque[id]] || P[k][toOpaque[id]].invalid_output))
  if (bad.length) { console.error(`1단계 무효 · 누락: ${bad.join(' ')}`); process.exit(2) }
  const show = (v) => `분류 ${v.primary_category}${v.contributing_categories.length ? ' (+' + v.contributing_categories.join(', ') + ')' : ''} · 자기 판정 ${describe(v.own_verdict)} · 권장 기대 ${describe(v.recommended_gold)} · 기대 수정 ${v.expected_fix_needed} · 규칙 수정 ${v.rule_fix_needed} · 사례 수정 ${v.case_fix_needed} — 근거: ${v.short_rationale} — 질문 답: ${v.key_answers.join(' / ')}`
  const codebook = readAny(CODEBOOK_F).replace(/\r\n/g, '\n'); const items = readJ(path.join(OP, 'items.json'))
  for (const [stage, seed] of [['adj2-a', 'A'], ['adj2-b', 'B']]) {
    const entries = shuffled(man.cases.map((id) => { const oid = toOpaque[id]; const two = shuffled([P.a[oid], P.b[oid]], `${man.run_id}:${stage}:${id}:rev`)
      return { c: byCase[id], e: exp[id], oid, questions: man.questions[id] ?? [], models: modelsBlock(oid, rows[oid], `${man.run_id}:${stage}:${id}`),
        reveal: `\n\n1단계 독립 분류 두 개(출처 숨김 · 순서 무의미):\n- 분류 1: ${show(two[0])}\n- 분류 2: ${show(two[1])}` } }), `${man.run_id}:${stage}:${seed}`)
    const d = path.join(RUN, stage); fs.mkdirSync(d, { recursive: true }); const f = path.join(d, 'prompt-1.md'); const text = adjV2Prompt(2, entries, codebook, items, cbLabel)
    guardWrite(f); fs.writeFileSync(f, text); man.packets[`${stage}/1`] = sha(text)
  }
  writeJ(adjManifestF, man)
  console.log('adjudication v2 2단계 패킷')
}
function adjV2Report() {
  verifyInputs()
  const { man, rows, toOpaque, exp } = adjV2Context()
  const P1 = { a: loadStage('adj1-a'), b: loadStage('adj1-b') }, P2 = { a: loadStage('adj2-a'), b: loadStage('adj2-b') }
  const vk = (g) => verdictKey({ outcome: g?.outcome, primary_cause: g?.primary_cause, candidate_causes: g?.candidate_causes ?? [] })
  const out = man.cases.map((id) => {
    const oid = toOpaque[id]
    // 무효 · 누락 출력은 판정 없음으로 — 조치 값을 비우고 최종 분류를 INVALID_OUTPUT 으로 공개한다(기본 결정으로 흘러가지 않게)
    const ok = (v) => (v && !v.invalid_output ? v : { primary_category: 'INVALID_OUTPUT', contributing_categories: [], expected_fix_needed: null, rule_fix_needed: null, case_fix_needed: null, recommended_gold: {}, short_rationale: '', key_answers: [], invalid: true })
    const a1 = ok(P1.a[oid]), b1 = ok(P1.b[oid]), a2 = ok(P2.a[oid]), b2 = ok(P2.b[oid])
    const agreed = a2.invalid || b2.invalid ? 'INVALID_OUTPUT' : a2.primary_category === b2.primary_category ? a2.primary_category : null
    const flag = (k) => (a2[k] === b2[k] ? a2[k] : 'split')
    return { case_id: id, run_final: rows[oid].final ?? 'UNRESOLVED', expected: exp[id], independent: { claude: a1.primary_category, codex: b1.primary_category }, final2: { claude: a2.primary_category, codex: b2.primary_category },
      final_category: agreed ?? 'ADJUDICATION_SPLIT', contributing: { claude: a2.contributing_categories, codex: b2.contributing_categories },
      expected_fix_needed: flag('expected_fix_needed'), rule_fix_needed: flag('rule_fix_needed'), case_fix_needed: flag('case_fix_needed'), recommended_gold: { claude: vk(a2.recommended_gold), codex: vk(b2.recommended_gold) },
      rationale: { claude: a2.short_rationale, codex: b2.short_rationale }, key_answers: { claude: a2.key_answers, codex: b2.key_answers } }
  })
  writeJ(path.join(OP, 'adjudication-v2-full.json'), out)
  // 사용자 지시(2026-10-05)의 채택 규칙
  const cat = (id) => out.find((r) => r.case_id === id)?.final_category
  const decide = {
    R9_section6: cat('R4-H6') === 'GOLD_WRONG' ? 'adopt' : 'candidate',
    R6: ['RULE_INSUFFICIENT', 'TAXONOMY_OVERLAP'].includes(cat('R4-H1')) ? 'candidate' : ['CASE_CONSTRUCTION', 'GENUINELY_UNRESOLVED'].includes(cat('R4-H1')) ? 're-evaluate(rule 자체 실패 아님 가능)' : 'candidate',
    R12: ['RULE_INSUFFICIENT', 'TAXONOMY_OVERLAP'].includes(cat('N-13')) ? 'candidate' : cat('N-13') === 'GOLD_WRONG' ? 're-evaluate(기대 오류)' : 'candidate',
  }
  const outMd = path.resolve(arg('--out') ?? '')
  if (!/ADJUDICATION_REV4\.md$/.test(outMd) || !inside(realOf(outMd), realOf(DIR)) || isLink(outMd)) { console.error('--out 은 docs/csat-learner/codebook/ADJUDICATION_REV4.md'); process.exit(2) }
  const pub = out.map(({ rationale, key_answers, ...r }) => ({ ...r, expected: vk({ outcome: r.expected.outcome, primary_cause: r.expected.primary, candidate_causes: r.expected.candidates ?? [] }) }))
  fs.writeFileSync(outMd.replace(/\.md$/, '.json'), JSON.stringify({ run_id: man.run_id, plan_commit: man.plan_commit, cases: pub, decision: decide }, null, 1) + '\n')
  const esc = (x) => String(x ?? '—').replace(/\|/g, '\\|')
  const L = [`# rev4 재검증 미달 3건 adjudication — ${man.run_id}`, '', '> 2단계(1단계 독립 분류 → 두 분류 공개 후 최종 분류) · Claude · Codex 새 context · 사람 판정 아님 · 원문 · 판정자 서술은 저장소 밖(operator/adjudication-v2-full.json). 원본 기대 판정 · rev4 결과는 고치지 않는다 — 정정은 이 기록으로만.', '',
    '| 사례 | 회차 최종 | 기대 | 독립 Claude / Codex | 최종 Claude / Codex | **최종 분류** | 기대 수정 | 규칙 수정 | 사례 수정 | 권장 기대 Claude / Codex |', '|---|---|---|---|---|---|---|---|---|---|',
    ...pub.map((r) => `| ${r.case_id} | ${esc(r.run_final)} | ${esc(r.expected)} | ${r.independent.claude} / ${r.independent.codex} | ${r.final2.claude} / ${r.final2.codex} | **${r.final_category}** | ${r.expected_fix_needed} | ${r.rule_fix_needed} | ${r.case_fix_needed} | ${esc(r.recommended_gold.claude)} / ${esc(r.recommended_gold.codex)} |`), '',
    '## 채택 규칙 적용(2026-10-05 사용자 지시)', '', `- §6/R9: R4-H6 이 GOLD_WRONG 합의면 채택 → **${decide.R9_section6}**`, `- R6: R4-H1 이 RULE_INSUFFICIENT · TAXONOMY_OVERLAP 이면 candidate, CASE_CONSTRUCTION · GENUINELY_UNRESOLVED 면 재평가 → **${decide.R6}**`, `- R12: N-13 이 RULE_INSUFFICIENT · TAXONOMY_OVERLAP 이면 candidate → **${decide.R12}**`, '']
  fs.writeFileSync(outMd, L.join('\n'))
  console.log('v2 보고:', JSON.stringify(decide), out.map((r) => `${r.case_id}=${r.final_category}`).join(' '))
}

const cmds = { prepare, run, gate1, challenge, resolve, seal, report, 'adj-prepare': adjPrepare, 'adj-reveal': adjReveal, 'adj-report': adjReport, 'rev4-eval': rev4Eval, 'adj2-prepare': adjV2Prepare, 'adj2-reveal': adjV2Reveal, 'adj2-report': adjV2Report }
if (!cmds[cmd]) { console.error(`명령: ${Object.keys(cmds).join(' | ')}`); process.exit(2) }
await cmds[cmd]()
