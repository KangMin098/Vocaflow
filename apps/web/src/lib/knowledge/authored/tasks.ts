// apps/web/src/lib/knowledge/authored/tasks.ts
// 창작 세트가 있는 TASK 와 그 채점 과제 키 — 클라이언트 · 지도 계산이 쓴다. 세트 JSON(Gold 포함)을 클라이언트 번들에 넣지 않으려고 따로 둔다.
// authored-items.test.ts 가 세트와 이 표가 같은지 지킨다.
export const AUTHORED_TASK_KEYS: Readonly<Record<string, string>> = { 'r.central_meaning': 'authored-central-meaning' }
export const AUTHORED_TASKS: readonly string[] = Object.keys(AUTHORED_TASK_KEYS)
export const authoredKeysOf = (task: string): string[] => (AUTHORED_TASK_KEYS[task] ? [AUTHORED_TASK_KEYS[task]] : [])
