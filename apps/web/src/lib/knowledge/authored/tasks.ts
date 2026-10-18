// apps/web/src/lib/knowledge/authored/tasks.ts
// 창작 세트가 있는 TASK 와 그 채점 과제 키 — 클라이언트 · 지도 계산이 쓴다. 세트 JSON(Gold 포함)을 클라이언트 번들에 넣지 않으려고 따로 둔다.
// authored-items.test.ts 가 세트와 이 표가 같은지 지킨다.
export const AUTHORED_TASK_KEYS: Readonly<Record<string, string>> = {
  'r.central_meaning': 'authored-central-meaning',
  'e.evidence_location': 'authored-evidence-locate',
  'e.option_correspondence': 'authored-option-match',
  'r.inference': 'authored-inference',
  'r.relation': 'authored-cohesion',
  's.form_scope': 'authored-grammar-scope',
  'v.contextual_sense': 'authored-vocab-context',
}
export const AUTHORED_TASKS: readonly string[] = Object.keys(AUTHORED_TASK_KEYS)
/** 학습자 화면 머리말(코드북 display · name) */
export const AUTHORED_TASK_LABEL: Readonly<Record<string, string>> = {
  'r.central_meaning': 'R5 중심 의미', 'e.evidence_location': 'E 근거 위치', 'e.option_correspondence': 'E 선지-본문 대응',
  'r.inference': 'R 추론', 'r.relation': 'R 문장 사이 관계', 's.form_scope': 'S 형태 · 의미 범위', 'v.contextual_sense': 'V 문맥 의미 선택',
}
export const authoredKeysOf = (task: string): string[] => (AUTHORED_TASK_KEYS[task] ? [AUTHORED_TASK_KEYS[task]] : [])
