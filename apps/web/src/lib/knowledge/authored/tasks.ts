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
  'r.reference': 'authored-reference',
  'v.multiword': 'authored-multiword',
  'r.discourse_function': 'authored-discourse-function',
  'r.discourse_structure': 'authored-discourse-structure',
  'e.task_demand': 'authored-task-demand',
  's.sentence_core': 'authored-sentence-core',
  's.attachment': 'authored-attachment',
  's.chunk_boundary': 'authored-chunk-boundary',
  's.structural_relation': 'authored-structural-relation',
  'v.semantic_relation': 'authored-semantic-relation',
}
export const AUTHORED_TASKS: readonly string[] = Object.keys(AUTHORED_TASK_KEYS)
/** 학습자 화면 머리말(코드북 display · name) */
export const AUTHORED_TASK_LABEL: Readonly<Record<string, string>> = {
  'r.central_meaning': 'R5 중심 의미', 'e.evidence_location': 'E 근거 위치', 'e.option_correspondence': 'E 선지-본문 대응',
  'r.inference': 'R 추론', 'r.relation': 'R 문장 사이 관계', 's.form_scope': 'S 형태 · 의미 범위', 'v.contextual_sense': 'V 문맥 의미 선택',
  'r.reference': 'R 지시 · 응집 추적', 'v.multiword': 'V 덩어리 표현', 'r.discourse_function': 'R 문장 · 문단 기능', 'r.discourse_structure': 'R 글 전개 구조',
  'e.task_demand': 'E 발문 요구 파악', 's.sentence_core': 'S 문장 뼈대', 's.attachment': 'S 수식 관계', 's.chunk_boundary': 'S 의미 단위 경계',
  's.structural_relation': 'S 구조 관계', 'v.semantic_relation': 'V 표현 사이 의미 관계',
}
export const authoredKeysOf = (task: string): string[] => (AUTHORED_TASK_KEYS[task] ? [AUTHORED_TASK_KEYS[task]] : [])
