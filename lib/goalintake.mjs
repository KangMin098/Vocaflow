// lib/goalintake.mjs
//
// ChatGPT 자연어 목표 요청 → AI-Control 목표(재사용 또는 신규). 2026-10-10 사용자 요구.
//
// 경로(지원되는 것만): 사용자가 ChatGPT(Work)에 자연어로 말한다 → Work 가 교환 저장소(KangMin098/vocaflow-exchange)의
//   라벨 `vfc-goal` 이슈에 ```json vfc-goal-request``` 블록을 남긴다(PR 댓글과 같은 GitHub 쓰기 — 사용자 명의 + Work 앱)
//   → poc/work-bridge.mjs `collect-goals` 가 planning/goal-requests/ 로 가져온다 → 여기 intakeGoalRequest 가 판정한다.
//
// 판정(규칙만 · LLM 없음):
//   ① 같은 요청(source)은 한 번만 — 재실행 안전
//   ② 기존 목표 재사용: goal_ref 일치 → chat_url 일치 → 제목 낱말 겹침(Jaccard ≥ 0.5)
//      재사용하면 자연어 요청을 그 목표의 사용자 방향(next_scope)에 「[ChatGPT 요청 날짜]」 로 더한다 — 설계·승인 게이트는 그대로
//   ③ 새 목표: 정본 L3 목표(canon_goal_ids)가 있어야 만든다(작업은 정본에 묶인다). 없으면 만들지 않고 NEEDS_CANON 으로 남긴다
//      새 목표는 설계가 없으므로 첫 설계를 Work 에 요청할 대상(DESIGN_REQUIRED)이다 — 승인·owner 배정은 사용자 결정
//   ④ chat_url 이 오면 목표의 Work 대화 참조로 연결(이미 다른 URL 이 있으면 바꾸지 않고 충돌로 기록)
// 이 요청은 **승인이 아니다** — 목표 등록·방향 기록까지만. 설계 승인·DB·범위 확대는 기존 게이트.

import { RuleError } from './tasks.mjs'

export const REQ_SCHEMA = 'vfc-goal-request/1'
const now = () => new Date().toISOString()
const words = (s) => new Set(String(s || '').toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length >= 2))
export function jaccard(a, b) {
  const A = words(a)
  const B = words(b)
  if (!A.size || !B.size) return 0
  let n = 0
  for (const x of A) if (B.has(x)) n++
  return n / (A.size + B.size - n)
}

/** 본문에서 vfc-goal-request 블록 하나를 꺼내 검증 */
export function parseGoalRequest(body) {
  const blocks = [...String(body).matchAll(/```json vfc-goal-request\s*\n([\s\S]*?)\n```/g)]
  if (blocks.length !== 1) return { error: `vfc-goal-request 블록이 정확히 1개여야 한다(발견 ${blocks.length})` }
  let j
  try {
    j = JSON.parse(blocks[0][1])
  } catch (e) {
    return { error: `JSON 오류: ${e.message}` }
  }
  const errs = []
  if (j.schema !== REQ_SCHEMA) errs.push(`schema 는 ${REQ_SCHEMA}`)
  if (!j.request || typeof j.request !== 'string' || j.request.trim().length < 10) errs.push('request(사용자 자연어 요청 원문 · 10자 이상)')
  if (j.chat_url !== undefined && j.chat_url !== null && !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(j.chat_url)) errs.push('chat_url 은 https://chatgpt.com/… 만')
  if (j.canon_goal_ids !== undefined && !(Array.isArray(j.canon_goal_ids) && j.canon_goal_ids.every((x) => typeof x === 'string'))) errs.push('canon_goal_ids 는 문자열 배열')
  return errs.length ? { error: errs.join(', ') } : { req: j }
}

/** 기존 목표 찾기 — 반환 { goal, reason } 또는 null */
export function matchExisting(state, req) {
  const goals = Object.values(state.userGoals?.goals || {}).filter((g) => g.status !== 'ACCEPTED')
  if (req.goal_ref) {
    const g = goals.find((x) => x.ug_id === req.goal_ref || x.thread_id === req.goal_ref)
    if (g) return { goal: g, reason: `goal_ref ${req.goal_ref}` }
  }
  if (req.chat_url) {
    const g = goals.find((x) => x.chat_url && x.chat_url === req.chat_url)
    if (g) return { goal: g, reason: 'chat_url 일치(같은 Work 대화)' }
  }
  const text = `${req.title || ''} ${req.request}`
  const best = goals.map((g) => ({ g, s: Math.max(jaccard(req.title || req.request, g.title), jaccard(text, g.title)) })).sort((a, b) => b.s - a.s)[0]
  if (best && best.s >= 0.5) return { goal: best.g, reason: `제목 낱말 겹침 ${best.s.toFixed(2)}` }
  return null
}

/**
 * 요청 하나를 판정·적용. deps.newGoal(state, {title, canon_goal_ids, origin, by}) — usergoals 의 목표 생성(순환 import 회피)
 * 반환 { outcome: 'reused'|'created'|'needs_canon'|'duplicate_source', goal_id?, reason }
 */
export function intakeGoalRequest(state, req, { source, by, deps }) {
  const U = state.userGoals
  U.goal_requests ||= []
  if (U.goal_requests.some((r) => r.source === source)) return { outcome: 'duplicate_source', reason: `이미 처리한 요청(${source})` }
  const rec = { source, at: now(), by, request: req.request.slice(0, 2000), chat_url: req.chat_url ?? null, title: req.title ?? null }
  const hit = matchExisting(state, req)
  let result
  if (hit) {
    const g = hit.goal
    g.next_scope = [...(g.next_scope || []), `[ChatGPT 요청 ${rec.at.slice(0, 10)}] ${req.request.replace(/\s+/g, ' ').slice(0, 500)}`]
    g.history.push({ at: rec.at, event: 'goal.chatgpt_request', by, note: `${hit.reason} · ${source}` })
    linkUrl(g, req.chat_url, by, rec)
    result = { outcome: 'reused', goal_id: g.ug_id, reason: hit.reason }
  } else if (!(req.canon_goal_ids || []).length) {
    result = { outcome: 'needs_canon', reason: '기존 목표와 겹치지 않고 정본 L3 목표(canon_goal_ids)가 없다 — 새 목표를 만들지 않았다(사용자·Work 가 정본 목표를 지정해 다시 보낸다)' }
  } else {
    const title = (req.title || req.request).replace(/\s+/g, ' ').slice(0, 80)
    const g = deps.newGoal(state, { title, canon_goal_ids: req.canon_goal_ids, origin: 'chatgpt', by })
    g.next_scope = [`[ChatGPT 요청 ${rec.at.slice(0, 10)}] ${req.request.replace(/\s+/g, ' ').slice(0, 500)}`]
    if (req.owner_hint && state.ownership.owners[req.owner_hint]) g.proposed_owner = req.owner_hint // 제안일 뿐 — 배정은 사용자 결정
    linkUrl(g, req.chat_url, by, rec)
    result = { outcome: 'created', goal_id: g.ug_id, reason: 'ChatGPT 자연어 요청으로 새 목표(설계 전) — 다음: Work 첫 설계 요청 → 사용자 승인 · owner 배정' }
  }
  U.goal_requests.push({ ...rec, ...result })
  return result
}

function linkUrl(g, url, by, rec) {
  if (!url) return
  if (!g.chat_url) {
    g.chat_surface = 'work'
    g.chat_url = url
    g.history.push({ at: rec.at, event: 'surface.linked', by, note: 'work (ChatGPT 요청)' })
  } else if (g.chat_url !== url) {
    // 대표 Work 대화는 하나 — 바꾸지 않고 기록만(사람이 ugoal link 로 정한다)
    rec.chat_url_conflict = { kept: g.chat_url, got: url }
  }
}

export function requireRequest(body) {
  const r = parseGoalRequest(body)
  if (r.error) throw new RuleError('BAD_GOAL_REQUEST', r.error)
  return r.req
}
