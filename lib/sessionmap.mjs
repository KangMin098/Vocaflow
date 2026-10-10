// lib/sessionmap.mjs
//
// Work ↔ Claude 담당 세션 매핑 — 읽기 전용 관찰 메타데이터(2026-10-10 사용자 요구). 상태를 바꾸지 않는다.
//
//   목표당 대표 Work 대화 1개 · 대표 Claude 담당 세션 1개. 세션이 바뀌어도 영구 owner_id · 목표 · 작업 이력은 그대로다.
//   - Work 대화 URL(chat_url · `ugoal link`)과 내부 thread_id 는 다른 식별자다 — 같다고 가정하지 않는다
//   - 세션 이름(vocaflow-9b 등)은 사람이 알아보는 별칭일 뿐 — 라우팅·권한 근거가 아니다(권한은 owner_id · session id · worker_id)
//   - 확인할 수 없는 값은 'UNKNOWN' — 지어내지 않는다
//   - 이 정보는 승인 증거가 아니다
//
// 연결 상태(connection_status):
//   CONNECTED  담당 세션 id 가 있고 그 세션의 최근 활동(대화 기록 갱신)이 ACTIVE_MS 안
//   IDLE       세션 id 는 있으나 마지막 활동이 ACTIVE_MS ~ OFFLINE_MS 사이
//   OFFLINE    마지막 활동이 OFFLINE_MS 보다 오래됐거나 대화 기록을 찾을 수 없다
//   UNBOUND    담당 owner 에 묶인 세션이 없다(배정은 받은 편지함에만 남는다)
//   NO_OWNER   목표에 담당 owner 가 없다

export const ACTIVE_MS = 30 * 60_000
export const OFFLINE_MS = 24 * 3600_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const U = 'UNKNOWN'
const OPEN = ['READY', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'WAITING_CHATGPT']

/** 목표의 담당 owner — 담당 세션 모드면 dispatch_owner, 아니면 마지막 위임 실행자, 그것도 없으면 열린 작업의 owner */
export function goalOwner(state, g) {
  if (g.dispatch_owner) return { owner_id: g.dispatch_owner, source: 'dispatch_owner' }
  const dlg = (g.delegations || []).at(-1)
  if (dlg?.executor_owner) return { owner_id: dlg.executor_owner, source: 'delegation' }
  const mine = state.taskQueue.tasks.filter((x) => x.user_goal_id === g.ug_id)
  const t = mine.filter((x) => OPEN.includes(x.status)).at(-1)
  if (t) return { owner_id: t.owner_id, source: 'open_task' }
  const last = mine.at(-1) // 열린 작업이 없으면 마지막 작업의 owner(이력) — 출처를 밝힌다
  return last ? { owner_id: last.owner_id, source: 'last_task' } : { owner_id: null, source: null }
}

/**
 * 순수 계산 — 테스트 대상.
 *   activityOf(sessionId) → 그 세션 대화 기록의 마지막 갱신 ISO 또는 null(호출자가 ~/.claude/projects 에서 읽는다)
 */
export function goalSessionMap(state, { now, activityOf = () => null, ugs = null }) {
  const nowMs = Date.parse(now)
  const goals = Object.values(state.userGoals?.goals || {}).filter((g) => !ugs || ugs.includes(g.ug_id))
  // 같은 세션이 두 owner 에, 한 owner 에 살아 있는 worker 여럿 — 충돌 감지
  const sessionOwners = {}
  for (const [id, o] of Object.entries(state.ownership.owners || {})) {
    for (const lbl of [o.current_session?.label, ...(o.session_aliases || []).map((a) => (typeof a === 'string' ? a : a?.label))].filter(Boolean)) (sessionOwners[lbl] ||= new Set()).add(id)
  }
  return goals.map((g) => {
    const { owner_id, source } = goalOwner(state, g)
    const o = owner_id ? state.ownership.owners[owner_id] : null
    const cur = o?.current_session ?? null
    const sid = cur && UUID.test(cur.label) ? cur.label : (o?.session_aliases || []).map((a) => (typeof a === 'string' ? a : a?.label)).find((x) => UUID.test(x)) ?? null
    // 사람이 읽는 이름: 명시 기록(session_name) → 세션 이력 중 uuid 아닌 라벨(별칭) — 권한 근거 아님
    const name = cur?.name ?? [cur, ...[...(o?.session_history || [])].reverse()].find((x) => x && x.label && !UUID.test(x.label))?.label ?? null
    const tasks = state.taskQueue.tasks.filter((t) => t.user_goal_id === g.ug_id)
    const active = tasks.filter((t) => ['IN_PROGRESS', 'REVIEW'].includes(t.status)).at(-1) ?? tasks.filter((t) => t.status === 'READY' && t.dispatch).at(-1) ?? null
    const lastClaim = tasks.map((t) => t.dispatch?.accepted_at && { task_id: t.task_id, at: t.dispatch.accepted_at, session: t.dispatch.accepted_session }).filter(Boolean).sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null
    const lastTaskEvent = tasks.flatMap((t) => (t.history || []).map((h) => ({ task_id: t.task_id, at: h.at, to: h.to, by: h.by }))).sort((a, b) => (a.at < b.at ? 1 : -1))[0] ?? null
    const reqs = (g.rounds || []).filter((r) => r.recipient === 'chatgpt')
    const lastReq = reqs.at(-1) ?? null
    const lastResp = (g.rounds || []).filter((r) => r.sender === 'chatgpt').at(-1) ?? null
    const sessionSeen = sid ? activityOf(sid) : null
    const lastActivity = [sessionSeen, lastTaskEvent?.at, cur?.bound_at].filter(Boolean).sort().at(-1) ?? null
    let status
    if (!owner_id) status = 'NO_OWNER'
    else if (!sid) status = 'UNBOUND'
    else if (!sessionSeen) status = 'OFFLINE'
    else {
      const age = nowMs - Date.parse(sessionSeen)
      status = age <= ACTIVE_MS ? 'CONNECTED' : age <= OFFLINE_MS ? 'IDLE' : 'OFFLINE'
    }
    const warnings = []
    if (sid && (sessionOwners[sid]?.size || 0) > 1) warnings.push(`세션 ${sid.slice(0, 8)} 이 여러 owner 에 묶여 있다: ${[...sessionOwners[sid]].join(', ')}`)
    const liveWorkers = Object.values(o?.workers || {}).filter((w) => w.status !== 'revoked' && w.heartbeat_at && nowMs - Date.parse(w.heartbeat_at) < 5 * 60_000)
    if (liveWorkers.length > 1) warnings.push(`owner ${owner_id} 에 살아 있는 worker ${liveWorkers.length}개 — 동시 인수 충돌 가능`)
    if (liveWorkers.length && status === 'CONNECTED') warnings.push(`owner ${owner_id} 에 세션과 worker 가 함께 살아 있다 — 같은 작업을 둘이 잡지 않게 인수 기록(dispatch.accepted_session)을 본다`)
    const inProg = tasks.filter((t) => t.status === 'IN_PROGRESS' && t.run?.session && sid && t.run.session !== sid && !String(t.run.session).startsWith('w-') && !String(t.run.session).startsWith('orch-'))
    for (const t of inProg) warnings.push(`${t.task_id} 는 다른 세션(${String(t.run.session).slice(0, 12)})이 실행 중 — 현재 담당 세션과 다르다`)
    const wt = (active?.worktree && { path: active.worktree, branch: active.branch }) || (o?.worktrees || []).at(-1) || null
    return {
      goal_id: g.ug_id,
      goal_title: g.title,
      goal_status: g.status,
      work_chat_url: g.chat_url ?? U,
      work_chat_surface: g.chat_surface ?? U,
      work_thread_id: g.thread_id ?? U, // AI-Control 내부 대화 줄기 — Work URL 과 다른 식별자
      last_work_request: lastReq ? { request_id: lastReq.request_id, round_id: lastReq.round_id, status: lastReq.response_status, at: lastReq.created_at } : null,
      last_work_response: lastResp ? { request_id: lastResp.request_id, round_id: lastResp.round_id, at: lastResp.completed_at ?? lastResp.created_at } : null,
      owner_id: owner_id ?? U,
      owner_source: source,
      claude_session_id: sid ?? U,
      claude_session_name: name ?? U,
      session_bound_at: cur?.bound_at ?? null,
      previous_sessions: (o?.session_history || []).length,
      worktree: wt?.path ?? U,
      branch: wt?.branch ?? U,
      active_task_id: active?.task_id ?? null,
      active_task_status: active?.status ?? null,
      last_claim: lastClaim,
      last_task_event: lastTaskEvent,
      last_activity_at: lastActivity ?? U,
      session_seen_at: sessionSeen ?? U,
      connection_status: status,
      last_verified_at: now,
      warnings,
    }
  })
}

/** 사람이 읽는 표(markdown) */
export function mapMarkdown(rows) {
  const cell = (v) => String(v ?? '-').replace(/\|/g, '/')
  return [
    '| 목표 | Work 대화 | 담당 owner | Claude 세션(이름) | worktree · branch | 진행 작업 | 마지막 활동 | 연결 |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${cell(r.goal_id)} ${cell(r.goal_title).slice(0, 30)} | ${r.work_chat_url === U ? 'UNKNOWN(미연결)' : r.work_chat_url} | ${cell(r.owner_id)} | ${r.claude_session_id === U ? 'UNKNOWN' : r.claude_session_id.slice(0, 8)} (${cell(r.claude_session_name)}) | ${cell(r.worktree)} · ${cell(r.branch)} | ${r.active_task_id ? `${r.active_task_id} ${r.active_task_status}` : '-'} | ${cell(r.last_activity_at)} | ${r.connection_status} |`),
    ...rows.flatMap((r) => r.warnings.map((w) => `- ⚠ ${r.goal_id}: ${w}`)),
  ].join('\n')
}
