// lib/planning.mjs
//
// ChatGPT 와의 파일 교환. API 도 브라우저 자동화도 쓰지 않는다 — 사람이 옮긴다.
//
//   1) createRequest(): planning/requests/REQ-YYYYMMDD-NNN.md 를 만든다.
//      머리에 기계 판독 블록(```json vfc-request```) · 사람이 읽을 질문 · 첨부할 파일 목록(경로+sha256) ·
//      ChatGPT 가 돌려줄 응답 형식(```json vfc-response``` 템플릿)이 들어간다.
//   2) 사용자가 그 파일(과 첨부)을 ChatGPT 웹/Work 에 붙이고, 응답 전체를
//      planning/responses/REQ-....response.md (또는 .json) 로 저장한다.
//   3) validateResponse()/importResponse(): 응답 안의 vfc-response JSON 을 꺼내 구조를 검증한다.
//      통과하면 DECISION_LOG 에 PROPOSED/OPEN_QUESTION 으로만 들어간다 — **ChatGPT 응답은 결코 APPROVED 가 아니다.**
//      원본은 planning/archive/ 로 옮겨 재가져오기를 막는다.

import fs from 'node:fs'
import path from 'node:path'
import { p } from './paths.mjs'
import { sha256File } from './fsutil.mjs'
import { loadCriteria, goalIndex } from './goals.mjs'

export const VERDICTS = ['approve', 'revise', 'reject', 'needs_info']
export const SEVERITIES = ['P0', 'P1', 'P2', 'P3']

/** 요청 id 날짜는 로컬 날짜(KST)다 — UTC 를 쓰면 오전 9시 전 요청이 전날 번호를 받는다. */
function today() {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
}

function nextRequestId() {
  for (const d of [p.requests(), p.responses(), p.archive()]) fs.mkdirSync(d, { recursive: true })
  const prefix = `REQ-${today()}-`
  const all = [p.requests(), p.archive()].flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d) : []))
  const n = all.filter((f) => f.startsWith(prefix)).map((f) => Number(f.slice(prefix.length, prefix.length + 3))).filter(Number.isFinite)
  return `${prefix}${String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0')}`
}

export const REQUEST_KINDS = ['review', 'plan']
export const PLAN_FIELDS = ['goal_fit', 'design', 'priority', 'learner_value', 'scope', 'preserved_contracts', 'acceptance', 'risks']

// thread(선택, WF-S7): { thread_id, goal_ref(UG-…), round_id, design_version, base_commit, parent_response_id, purpose } —
// 있으면 헤더와 응답 템플릿에 실리고, 응답은 같은 값을 그대로 돌려줘야 한다(다른 목표·라운드 응답의 오적용 차단). 없으면 WF-S4 형식 그대로.
export function createRequest({ topic, question, goal_ids = [], attachments = [], canon_version, created_by, context = '', kind = 'review', task_id = null, thread = null }) {
  if (!REQUEST_KINDS.includes(kind)) throw new Error(`kind 는 ${REQUEST_KINDS.join('|')}`)
  if (kind === 'plan' && !goal_ids.length) throw new Error('기획 요청(plan)은 대상 goal_id 가 필요하다')
  if (!topic || !question) throw new Error('topic 과 question 이 필요하다')
  const idx = goalIndex(loadCriteria())
  for (const g of goal_ids) if (!idx.has(g)) throw new Error(`goal_id ${g} 는 정본에 없다`)
  const files = attachments.map((a) => {
    if (!fs.existsSync(a)) throw new Error(`첨부 파일 없음: ${a}`)
    return { path: a.replace(/\\/g, '/'), sha256: sha256File(a), bytes: fs.statSync(a).size }
  })
  const id = nextRequestId()
  const header = { schema: 'vfc-request/1', request_id: id, kind, task_id, created_at: new Date().toISOString(), created_by, canon_version, topic, goal_ids, attachments: files, ...(thread ? { thread } : {}) }
  const responseTemplate = {
    schema: 'vfc-response/1',
    request_id: id,
    responder: 'chatgpt',
    responded_at: 'YYYY-MM-DDTHH:MM:SSZ',
    canon_version,
    verdict: 'approve | revise | reject | needs_info',
    summary: '한두 문장',
    findings: [{ id: 'F1', severity: 'P0 | P1 | P2 | P3', goal_ids: goal_ids.slice(0, 1), claim: '무엇이 문제인가', evidence: '근거(파일·줄·자료)', recommendation: '권고' }],
    proposed_decisions: [{ summary: '제안하는 결정', affects_goal_ids: goal_ids.slice(0, 1), rationale: '이유', requires_user_approval: true }],
    open_questions: ['사용자에게 물을 것'],
    ...(thread ? { thread_id: thread.thread_id, goal_ref: thread.goal_ref, round_id: thread.round_id, design_version: thread.design_version, ...(thread.context_base_commit ? { context_base_commit: thread.context_base_commit } : {}) } : {}),
  }
  if (kind === 'plan') {
    responseTemplate.plan = {
      goal_fit: '최종 목표(정본 goal_ids)와의 적합성 판단과 근거',
      design: '추천 설계(무엇을 어디에 어떻게)',
      priority: 'P0 | P1 | P2 | P3 — 이유',
      learner_value: '실제 학습자에게 생기는 가치',
      scope: '구현 범위(포함/제외)',
      preserved_contracts: ['바꾸면 안 되는 기존 계약'],
      acceptance: ['검증 가능한 수용 기준'],
      risks: ['위험·불확실성'],
    }
  }
  const body = `# ${id} — ${topic}

\`\`\`json vfc-request
${JSON.stringify(header, null, 2)}
\`\`\`

## 요청 (ChatGPT 에게)

${question}

${context ? `## 맥락\n\n${context}\n` : ''}
## 첨부 (사용자가 함께 올릴 파일)

${files.length ? files.map((f) => `- \`${f.path}\` · sha256 \`${f.sha256.slice(0, 16)}…\` · ${f.bytes} B`).join('\n') : '- 없음'}

## 응답 규칙

- 승인된 전략 결정 SD-R0-01~04 는 다시 묻지 않는다. 바꿀 필요가 보이면 \`proposed_decisions\` 에 영향 범위와 함께 적는다.
- 사실(근거 있음)과 가설을 구분한다. 근거 없는 상태 판정은 쓰지 않는다.
- 응답 **마지막에** 아래 형식의 블록을 정확히 하나 넣는다(첫 줄 \`\`\`json vfc-response). 이 블록만 기계가 읽는다.
- goal_ids 는 정본 GOAL_ACCEPTANCE_CRITERIA.json 의 id(VG-…)만 쓴다.

\`\`\`json vfc-response
${JSON.stringify(responseTemplate, null, 2)}
\`\`\`

## 사용자 전달 절차

1. 이 파일과 첨부를 ChatGPT(웹 또는 Work)에 올린다.
2. 응답 전체를 \`planning/responses/${id}.response.md\` 로 저장한다.
3. ${thread ? '\`node bin/vfc.mjs ugoal intake --by user\` — thread·목표·버전 검증 후 새 설계 버전(PROPOSED)으로 들어간다(자동 승인 없음).' : `\`node bin/vfc.mjs planning import ${id}\` — 구조 검증 후 DECISION_LOG 에 제안으로 들어간다(자동 승인 없음).`}
`
  const file = path.join(p.requests(), `${id}.md`)
  fs.writeFileSync(file, body, { flag: 'wx' })
  return { id, file, header }
}

export function readRequestHeader(id) {
  for (const dir of [p.requests(), p.archive()]) {
    const f = path.join(dir, `${id}.md`)
    if (fs.existsSync(f)) {
      const m = fs.readFileSync(f, 'utf8').match(/```json vfc-request\s*\n([\s\S]*?)\n```/)
      if (!m) throw new Error(`${id} 요청 헤더 블록이 없다`)
      return JSON.parse(m[1])
    }
  }
  return null
}

/** 응답 파일에서 vfc-response 블록을 꺼낸다. 순수 .json 파일도 받는다. 블록이 0개 또는 2개 이상이면 거부. */
export function extractResponse(text, filename = '') {
  if (filename.endsWith('.json')) return JSON.parse(text)
  const blocks = [...text.matchAll(/```json vfc-response\s*\n([\s\S]*?)\n```/g)]
  if (blocks.length !== 1) throw new Error(`vfc-response 블록이 정확히 1개여야 한다 (발견 ${blocks.length})`)
  return JSON.parse(blocks[0][1])
}

export function validateResponse(resp, { expectRequestId } = {}) {
  const errors = []
  const idx = goalIndex(loadCriteria())
  const isStr = (v) => typeof v === 'string' && v.trim().length > 0
  if (resp?.schema !== 'vfc-response/1') errors.push('schema 는 vfc-response/1')
  if (!isStr(resp?.request_id)) errors.push('request_id 누락')
  if (expectRequestId && resp?.request_id !== expectRequestId) errors.push(`request_id ${resp?.request_id} ≠ 파일의 요청 ${expectRequestId}`)
  const header = isStr(resp?.request_id) ? readRequestHeader(resp.request_id) : null
  if (isStr(resp?.request_id) && !header) errors.push(`요청 ${resp.request_id} 를 찾을 수 없다 — 요청 없는 응답은 받지 않는다`)
  if (resp?.responder !== 'chatgpt') errors.push("responder 는 'chatgpt'")
  if (!isStr(resp?.responded_at) || Number.isNaN(Date.parse(resp.responded_at))) errors.push('responded_at 은 ISO 날짜')
  if (header && resp?.canon_version !== header.canon_version) errors.push(`canon_version ${resp?.canon_version} ≠ 요청 ${header.canon_version} — 다른 정본으로 답했다`)
  if (!VERDICTS.includes(resp?.verdict)) errors.push(`verdict 는 ${VERDICTS.join('|')}`)
  if (!isStr(resp?.summary)) errors.push('summary 누락')
  for (const k of ['findings', 'proposed_decisions', 'open_questions']) if (!Array.isArray(resp?.[k])) errors.push(`${k} 는 배열`)
  const checkGoals = (ids, where) => {
    if (!Array.isArray(ids)) return errors.push(`${where}.goal_ids 는 배열`)
    for (const g of ids) if (!idx.has(g)) errors.push(`${where}: goal_id ${g} 는 정본에 없다`)
  }
  ;(resp?.findings || []).forEach((f, i) => {
    if (!isStr(f.id)) errors.push(`findings[${i}].id`)
    if (!SEVERITIES.includes(f.severity)) errors.push(`findings[${i}].severity 는 P0~P3`)
    for (const k of ['claim', 'evidence', 'recommendation']) if (!isStr(f[k])) errors.push(`findings[${i}].${k} 누락`)
    checkGoals(f.goal_ids, `findings[${i}]`)
  })
  ;(resp?.proposed_decisions || []).forEach((d, i) => {
    if (!isStr(d.summary) || !isStr(d.rationale)) errors.push(`proposed_decisions[${i}] summary/rationale 누락`)
    if (d.requires_user_approval !== true) errors.push(`proposed_decisions[${i}].requires_user_approval 는 true 여야 한다 — ChatGPT 는 결정을 승인할 수 없다`)
    checkGoals(d.affects_goal_ids, `proposed_decisions[${i}]`)
  })
  ;(resp?.open_questions || []).forEach((q, i) => {
    if (!isStr(q)) errors.push(`open_questions[${i}] 는 문자열`)
  })
  // thread 요청이면 응답이 같은 thread·목표·라운드·설계 버전을 가리켜야 한다 — 섞여 도착한 다른 목표 응답을 막는다
  if (header?.thread) {
    // 패킷을 붙인 요청이면 응답도 같은 기준 제품 커밋을 근거로 했다고 돌려줘야 한다(교환 저장소 revision 과 구분)
    if (header.thread.context_base_commit && resp?.context_base_commit !== header.thread.context_base_commit) errors.push(`context_base_commit ${JSON.stringify(resp?.context_base_commit)} ≠ 요청 ${header.thread.context_base_commit} — 다른 기준 커밋을 근거로 한 응답이다`)
    for (const k of ['thread_id', 'goal_ref', 'round_id', 'design_version']) {
      if (resp?.[k] !== header.thread[k]) errors.push(`${k} ${JSON.stringify(resp?.[k])} ≠ 요청 ${JSON.stringify(header.thread[k])} — 다른 목표·라운드의 응답이다`)
    }
  }
  if (header?.kind === 'plan') {
    const pl = resp?.plan
    if (!pl || typeof pl !== 'object') errors.push('기획 요청 응답에는 plan 객체가 필요하다')
    else
      for (const k of PLAN_FIELDS) {
        const v = pl[k]
        const ok = Array.isArray(v) ? v.length > 0 && v.every(isStr) : isStr(v)
        if (!ok) errors.push(`plan.${k} 가 비었거나 형식이 틀렸다`)
      }
    if (pl && !/^P[0-3]\b/.test(String(pl.priority || ''))) errors.push('plan.priority 는 P0~P3 로 시작해야 한다')
  }
  if (JSON.stringify(resp || {}).includes('P0 | P1')) errors.push('템플릿 자리표시자가 그대로 남아 있다')
  return { ok: errors.length === 0, errors }
}

export function responseFileFor(id) {
  for (const ext of ['.response.md', '.response.json']) {
    const f = path.join(p.responses(), `${id}${ext}`)
    if (fs.existsSync(f)) return f
  }
  return null
}

/** 검증 통과 시 DECISION_LOG 항목 목록을 만든다(쓰기는 호출자가 withState 안에서). */
export function toDecisionEntries(resp, sourceFile) {
  const base = { source: 'chatgpt', request_id: resp.request_id, source_file: sourceFile, canon_version: resp.canon_version }
  const out = [{ ...base, status: 'RECORDED', kind: 'review_verdict', summary: `ChatGPT verdict=${resp.verdict}: ${resp.summary}`, findings: resp.findings }]
  if (resp.plan) out.push({ ...base, status: 'PROPOSED', kind: 'plan', summary: `ChatGPT 기획: ${resp.plan.design.slice(0, 120)}`, plan: resp.plan, requires_user_approval: true })
  for (const d of resp.proposed_decisions) out.push({ ...base, status: 'PROPOSED', kind: 'proposal', summary: d.summary, rationale: d.rationale, affects_goal_ids: d.affects_goal_ids, requires_user_approval: true })
  for (const q of resp.open_questions) out.push({ ...base, status: 'OPEN_QUESTION', kind: 'question', summary: q })
  return out
}
