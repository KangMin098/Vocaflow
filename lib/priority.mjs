// lib/priority.mjs
//
// 다음 작업 선정(WF-S5 §4). 점수와 **사람이 읽을 이유**를 같이 낸다. 최근 작업량·커밋 수는 입력이 아니다.
//
//   점수 = (9 − 범주) × w.category + 목표상태 가중 + R0 차단 가중 + 의존 목표 수 × w.per_dependent_goal + 작업 우선순위 가중
//   범주는 config/priority.json 의 goal_category(정본 L3 목표 → 1~8).
// 후보는 READY 작업만. COMPLETED·IN_PROGRESS·BLOCKED·WAITING_CHATGPT·FAILED·REVIEW 는 제외(이유를 남긴다).
// 정본 목표가 있는데 열린 작업이 없는 것은 `uncovered` 로 따로 보인다 — 자동으로 작업을 만들지는 않는다(owner·범위가 필요).

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))

export function loadPriorityConfig(file = process.env.VFC_PRIORITY_CONFIG || path.join(HERE, '..', 'config', 'priority.json')) {
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}

/** 정본에서 각 목표에 의존하는 목표 수(dependencies 역방향) */
export function dependentCounts(doc) {
  const n = {}
  for (const c of doc.criteria) for (const d of c.dependencies || []) n[d] = (n[d] || 0) + 1
  return n
}

export function scoreTask(task, { doc, goalStatus, config, deps = dependentCounts(doc) }) {
  const w = config.weights
  const goal = doc.criteria.find((c) => c.id === task.goal_id)
  const cat = config.goal_category[task.goal_id] ?? 8
  const gs = goalStatus.goals[task.goal_id]?.status ?? 'UNKNOWN'
  const parts = [
    { k: 'category', v: (9 - cat) * w.category, why: `범주 ${cat} — ${config.categories[String(cat)]}` },
    { k: 'goal_status', v: w.goal_status[gs] ?? 0, why: `목표 ${task.goal_id} 현재 ${gs}` },
    { k: 'r0', v: goal?.blocking_for_R0 ? w.blocking_for_R0 : 0, why: goal?.blocking_for_R0 ? 'R0 차단 목표' : 'R0 차단 아님' },
    { k: 'dependents', v: (deps[task.goal_id] || 0) * w.per_dependent_goal, why: `이 목표에 의존하는 목표 ${deps[task.goal_id] || 0}개` },
    { k: 'task_priority', v: w.task_priority[task.priority] ?? 0, why: `작업 우선순위 ${task.priority}` },
  ]
  return { task_id: task.task_id, goal_id: task.goal_id, category: cat, score: parts.reduce((a, p) => a + p.v, 0), reasons: parts.map((p) => `${p.why} (${p.v >= 0 ? '+' : ''}${p.v})`) }
}

export function rankTasks({ doc, state, config = loadPriorityConfig() }) {
  const deps = dependentCounts(doc)
  const excluded = []
  const ranked = []
  for (const t of state.taskQueue.tasks) {
    if (t.status !== 'READY') {
      excluded.push({ task_id: t.task_id, status: t.status, reason: `상태 ${t.status} — 후보 아님` })
      continue
    }
    ranked.push(scoreTask(t, { doc, goalStatus: state.goalStatus, config, deps }))
  }
  // 동점은 task_id 순(결정적) — 「최근」이 아니라 등록 순서
  ranked.sort((a, b) => b.score - a.score || a.task_id.localeCompare(b.task_id))
  const openGoals = new Set(state.taskQueue.tasks.filter((t) => !['COMPLETED', 'FAILED'].includes(t.status)).map((t) => t.goal_id))
  const uncovered = doc.criteria
    .filter((c) => c.level === 3 && state.goalStatus.goals[c.id]?.status !== 'PASS' && !openGoals.has(c.id))
    .map((c) => ({ goal_id: c.id, category: config.goal_category[c.id] ?? 8, status: state.goalStatus.goals[c.id]?.status ?? 'UNKNOWN', r0: c.blocking_for_R0 }))
    .sort((a, b) => a.category - b.category || a.goal_id.localeCompare(b.goal_id))
  return { ranked, excluded, uncovered }
}
