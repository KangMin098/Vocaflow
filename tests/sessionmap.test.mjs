// tests/sessionmap.test.mjs — Work ↔ Claude 담당 세션 매핑: 연결 상태 · UNKNOWN · 별칭은 권한 아님 · 충돌 감지 · 재연결 · 읽기 전용
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { goalSessionMap, mapMarkdown } from '../lib/sessionmap.mjs'
import { bindSession, startTask } from '../lib/tasks.mjs'

const SID = '0b28b2a1-3db1-436b-a609-cc9f90489880'
const SID2 = '11111111-2222-3333-4444-555555555555'
const NOW = '2026-10-10T10:00:00.000Z'
const mk = () => ({
  userGoals: { goals: {
    'UG-A': { ug_id: 'UG-A', title: '지도', status: 'OPEN', thread_id: 'TH-A', chat_surface: 'work', chat_url: 'https://chatgpt.com/c/abc', dispatch_owner: 'map', rounds: [{ recipient: 'chatgpt', request_id: 'REQ-1', round_id: 'TH-A-R01', response_status: 'APPLIED', created_at: '2026-10-10T03:00:00Z' }, { sender: 'chatgpt', request_id: 'REQ-1', round_id: 'TH-A-R02', completed_at: '2026-10-10T03:05:00Z' }] },
    'UG-B': { ug_id: 'UG-B', title: '단어', status: 'OPEN', thread_id: 'TH-B', rounds: [] },
    'UG-C': { ug_id: 'UG-C', title: '없음', status: 'PAUSED', thread_id: 'TH-C', rounds: [] },
  } },
  ownership: { owners: {
    map: { owner_id: 'map', worktrees: [{ path: 'd:/w/map', branch: 'feat/map' }], current_session: { label: SID, agent: 'claude', bound_at: '2026-10-10T06:00:00Z' }, session_history: [{ label: 'vocaflow-9b', agent: 'claude', bound_at: '2026-10-10T05:59:00Z', unbound_at: '2026-10-10T06:00:00Z' }], session_aliases: [SID] },
    words: { owner_id: 'words', worktrees: [{ path: 'd:/w/words', branch: 'feat/words' }], session_history: [] },
  } },
  taskQueue: { tasks: [
    { task_id: 'T-1', user_goal_id: 'UG-A', owner_id: 'map', status: 'IN_PROGRESS', worktree: 'd:/w/map', branch: 'feat/map', dispatch: { to: 'map', at: '2026-10-10T05:00:00Z', accepted_at: '2026-10-10T06:01:00Z', accepted_session: SID }, run: { session: SID }, history: [{ at: '2026-10-10T06:01:00Z', to: 'IN_PROGRESS', by: 'map' }] },
    { task_id: 'T-2', user_goal_id: 'UG-B', owner_id: 'words', status: 'COMPLETED', history: [{ at: '2026-10-09T10:00:00Z', to: 'COMPLETED', by: 'independent-review' }] },
  ] },
})

test('매핑: 목표별 Work URL · thread(별개 식별자) · owner · 세션 id·이름 · worktree · 진행 작업 · 마지막 인수·Work 응답', () => {
  const [a] = goalSessionMap(mk(), { now: NOW, activityOf: () => '2026-10-10T09:50:00Z', ugs: ['UG-A'] })
  assert.equal(a.work_chat_url, 'https://chatgpt.com/c/abc')
  assert.equal(a.work_thread_id, 'TH-A')
  assert.equal(a.owner_id, 'map')
  assert.equal(a.claude_session_id, SID)
  assert.equal(a.claude_session_name, 'vocaflow-9b', '이름은 이력의 별칭에서(표시용)')
  assert.equal(a.worktree, 'd:/w/map')
  assert.equal(a.active_task_id, 'T-1')
  assert.equal(a.last_claim.session, SID)
  assert.equal(a.last_work_response.request_id, 'REQ-1')
  assert.equal(a.connection_status, 'CONNECTED')
  assert.deepEqual(a.warnings, [])
})

test('연결 상태: IDLE · OFFLINE(기록 없음·오래됨) · UNBOUND(세션 없음) · NO_OWNER · 확인 못 하면 UNKNOWN', () => {
  const st = (seen) => goalSessionMap(mk(), { now: NOW, activityOf: () => seen, ugs: ['UG-A'] })[0].connection_status
  assert.equal(st('2026-10-10T08:00:00Z'), 'IDLE')
  assert.equal(st('2026-10-08T00:00:00Z'), 'OFFLINE')
  assert.equal(st(null), 'OFFLINE')
  const rows = goalSessionMap(mk(), { now: NOW })
  const b = rows.find((r) => r.goal_id === 'UG-B')
  assert.equal(b.connection_status, 'UNBOUND')
  assert.equal(b.owner_source, 'last_task')
  assert.equal(b.work_chat_url, 'UNKNOWN', 'URL 이 없으면 지어내지 않는다')
  assert.equal(b.claude_session_id, 'UNKNOWN')
  assert.equal(rows.find((r) => r.goal_id === 'UG-C').connection_status, 'NO_OWNER')
  assert.match(mapMarkdown(rows), /UNKNOWN\(미연결\)[\s\S]*CONNECTED|OFFLINE/)
})

test('충돌 감지: 다른 세션이 실행 중 · 같은 세션이 두 owner · 살아 있는 worker 여럿', () => {
  const s = mk()
  s.taskQueue.tasks[0].run.session = SID2
  s.ownership.owners.words.session_aliases = [SID]
  s.ownership.owners.map.workers = { w1: { status: 'idle', heartbeat_at: '2026-10-10T09:58:00Z' }, w2: { status: 'busy', heartbeat_at: '2026-10-10T09:59:00Z' } }
  const w = goalSessionMap(s, { now: NOW, activityOf: () => '2026-10-10T09:55:00Z', ugs: ['UG-A'] })[0].warnings.join('\n')
  assert.match(w, /T-1 는 다른 세션/)
  assert.match(w, /여러 owner/)
  assert.match(w, /worker 2개/)
})

test('재연결: 이전 세션 기록 보존 · 다른 owner 에 묶인 세션은 거부 · 세션 이름만으로는 인수 못 함 · 조회는 상태를 바꾸지 않는다', () => {
  const s = mk()
  const before = JSON.stringify(s)
  goalSessionMap(s, { now: NOW, activityOf: () => null })
  assert.equal(JSON.stringify(s), before, '조회는 읽기 전용')
  // 재시작한 세션(새 id)을 같은 owner 에 — 이전 세션은 이력에 남는다
  bindSession(s, 'map', { label: SID2, agent: 'claude', name: 'vocaflow-9b' })
  assert.equal(s.ownership.owners.map.current_session.label, SID2)
  assert.equal(s.ownership.owners.map.session_history.at(-1).label, SID)
  assert.equal(goalSessionMap(s, { now: NOW, ugs: ['UG-A'] })[0].claude_session_name, 'vocaflow-9b')
  // 다른 owner 에 묶인 세션 id 로는 묶을 수 없다
  assert.throws(() => bindSession(s, 'words', { label: SID2, agent: 'claude' }), { code: 'SESSION_OWNED_ELSEWHERE' })
  // 세션 「이름」 은 인수 권한이 아니다 — 배정 작업은 등록된 세션 id(별칭)·worker 만
  const t = { task_id: 'T-9', owner_id: 'map', status: 'READY', depends_on: [], dispatch: { to: 'map' }, db_scope: { mode: 'none', targets: [] } }
  s.taskQueue.tasks.push(t)
  assert.throws(() => startTask(s, 'T-9', { owner_id: 'map', session: { label: 'vocaflow-9b', agent: 'claude' } }), { code: 'WRONG_WORKER' })
})
