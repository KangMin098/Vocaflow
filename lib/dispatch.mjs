// lib/dispatch.mjs
//
// 담당 세션 실행 모드(owner_session) — AI-Control 은 제품 코드를 직접 바꾸지 않고 목표의 기존 담당 세션이 실행하도록 조정한다.
//
//   목표: goal.execution_mode = 'owner_session' · goal.dispatch_owner = <owner_id>(기존 담당 — 임의 변경 금지)
//   배정: 그 목표의 새 작업은 dispatch_owner 에게. task.dispatch = { to, at, accepted_at, accepted_session }
//         담당 세션의 받은 편지함 planning/inbox/<owner>.md 에 작업·수용 기준·인수/제출 명령을 덧붙인다(파일 = 세션 이름이 바뀌어도 남는 계약)
//   인수: 담당 세션이 `vfc task start <id> --owner <owner> ...` 를 실행한 순간 accepted_at 기록(등록 ≠ 인수)
//   실행: 오케스트레이터는 owner_session 작업을 구현하지 않는다(선정에서 제외). 담당 세션이 증거·제출(REVIEW)하면
//         오케스트레이터가 Codex 독립 리뷰만 돌려 완료/반려한다 — 리뷰는 제품 코드를 바꾸지 않는다.
//   재개: 담당 세션이 죽은 작업은 handoffDeadSessions 가 READY 로 되돌려 같은 owner 에게 다시 둔다(받은 편지함에 재개 알림).

import fs from 'node:fs'
import path from 'node:path'
import { root } from './paths.mjs'

export const EXECUTION_MODES = ['orchestrator', 'owner_session']
export const goalMode = (g) => (g?.execution_mode === 'owner_session' ? 'owner_session' : 'orchestrator')

export function inboxFile(owner) {
  return path.join(root(), 'planning', 'inbox', `${owner}.md`)
}

/** 받은 편지함에 한 항목을 덧붙인다 — 담당 세션이 읽고 `vfc task start` 로 인수한다 */
export function writeInbox(owner, { kind, task, goal, note = '' }) {
  const f = inboxFile(owner)
  fs.mkdirSync(path.dirname(f), { recursive: true })
  if (!fs.existsSync(f)) fs.writeFileSync(f, `# ${owner} 받은 편지함 (AI-Control 배정)\n\n작업을 시작할 때 \`node bin/vfc.mjs task start <id> --owner ${owner} --agent <claude|codex> --session <세션명>\` 로 인수한다(인수 기록 = 배정 확인). 증거는 \`task evidence\`, 끝나면 \`task submit\` — 리뷰·완료 판정은 AI-Control(독립 리뷰)이 한다.\n`)
  const lines = [
    '',
    `## ${new Date().toISOString()} · ${kind} · ${task.task_id}`,
    `- 목표: ${goal.ug_id} 「${goal.title}」 · 설계 v${task.design_version ?? '-'} · 기준 [${(task.design_acceptance || []).join(',')}]`,
    `- 작업: ${task.title}`,
    `- 허용 경로: ${(task.allowed_paths || []).join(', ')}`,
    `- 금지: ${(task.forbidden_paths || []).join(', ')}`,
    ...((task.acceptance || []).map((a, i) => `- 수용 기준 ${i}: ${a}`)),
    `- 인수: \`node bin/vfc.mjs task start ${task.task_id} --owner ${owner} --agent claude --session <세션명>\` (worktree 미지정이면 먼저 \`task assign-worktree ${task.task_id} <경로> --by ${owner} --branch <브랜치>\`)`,
    ...(note ? [`- 메모: ${note}`] : []),
  ]
  fs.appendFileSync(f, lines.join('\n') + '\n')
  return f
}

/** 작업을 담당 owner 에게 배정(상태만) — 받은 편지함 기록은 writeInbox */
export function markDispatched(task, owner, at) {
  task.dispatch = { to: owner, at, accepted_at: null, accepted_session: null }
}

/** 인수 기록 — startTask 가 부른다 */
export function markAccepted(task, session, at) {
  if (task.dispatch && !task.dispatch.accepted_at) Object.assign(task.dispatch, { accepted_at: at, accepted_session: session?.label ?? null })
}
