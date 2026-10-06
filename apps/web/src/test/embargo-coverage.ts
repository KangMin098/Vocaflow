// apps/web/src/test/embargo-coverage.ts
//
// Reveal Gate 앱 계층 가드(정적) — scripts/csat/reveal-gate/manifest.json 의 app_db_loaders 를 기준으로
//   ① ANSWER_SENSITIVE · CORRECTNESS 로 분류된 파일은 embargo-gate 를 import 하고 그 함수를 실제로 부른다
//   ② 정답 민감 · 정오 관계(매니페스트 class · sensitive_columns 기준)나 그런 함수를 읽는 앱 파일은 모두 분류돼 있다(기본 거부)
//   ③ 분류된 파일이 사라졌으면 낡은 항목이다
// 관리자 경로(app/admin · app/api/admin · lib/admin · components/admin)는 check-surfaces.mjs 와 같이 뺀다.

import fs from 'node:fs'
import path from 'node:path'

export interface GateManifest {
  db_relations: Record<string, { class: string; sensitive_columns?: string[] }>
  db_functions: Record<string, { class: string }>
  app_db_loaders: Record<string, { class: string; gate?: string }>
}

export interface CoverageProblem { file: string; problem: string }

export const GATED_CLASSES = ['ANSWER_SENSITIVE', 'CORRECTNESS'] as const
const SENSITIVE_REL_CLASSES = ['ANSWER_SENSITIVE', 'CORRECTNESS', 'CORRECTNESS_OWN_PRIOR']
const SENSITIVE_FN_CLASSES = ['CORRECTNESS_ORACLE', 'REVIEWER_INTERNAL']
export const GATE_FUNCTIONS = [
  'canRevealExam', 'canRevealItem', 'canRevealSession', 'embargoedExamIds', 'embargoedItemIds', 'userHasHeldSession',
  'loadRevealScope', 'assertRevealAllowed', 'revealHeldResponse', 'isItemHeld', 'isExamHeld', 'isTypeHeld',
]
const IMPORT = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'(?:@\/lib\/csat\/|\.\/|\.\.\/)embargo-gate'/g
const EXCLUDED = /^(app\/admin|app\/api\/admin|lib\/admin|components\/admin)\//

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) { if (e.name !== '__tests__') walk(p, out) }
    else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p)
  }
  return out
}

export function sensitiveNames(m: GateManifest): string[] {
  const rels = Object.entries(m.db_relations).filter(([, v]) => SENSITIVE_REL_CLASSES.includes(v.class) || (v.sensitive_columns ?? []).length > 0).map(([k]) => k)
  const fns = Object.entries(m.db_functions).filter(([, v]) => SENSITIVE_FN_CLASSES.includes(v.class)).map(([k]) => k)
  return [...rels, ...fns]
}

/** srcRoot = apps/web/src. 문제가 없으면 [] */
export function checkGateCoverage(srcRoot: string, m: GateManifest): CoverageProblem[] {
  const problems: CoverageProblem[] = []
  const rel = (p: string) => path.relative(srcRoot, p).replace(/\\/g, '/')
  const names = sensitiveNames(m)
  // ② 기본 거부 — 민감 관계 · 함수 이름을 문자열로 쓰는 파일은 분류돼 있어야 한다
  for (const file of ['lib', 'app', 'components'].flatMap((d) => walk(path.join(srcRoot, d)))) {
    const r = rel(file)
    if (EXCLUDED.test(r)) continue
    const s = fs.readFileSync(file, 'utf8')
    const hit = names.find((n) => s.includes(`'${n}'`))
    if (hit && !m.app_db_loaders[r]) problems.push({ file: r, problem: `정답 민감 · 정오 표면 '${hit}' 을 읽는데 manifest.app_db_loaders 에 없다(미분류 — 기본 거부)` })
  }
  for (const [r, v] of Object.entries(m.app_db_loaders)) {
    const file = path.join(srcRoot, r)
    // ③ 낡은 항목
    if (!fs.existsSync(file)) { problems.push({ file: r, problem: '매니페스트에만 있다(파일 없음)' }); continue }
    if (!(GATED_CLASSES as readonly string[]).includes(v.class)) continue
    // ① 관문 사용
    const s = fs.readFileSync(file, 'utf8')
    const imported = [...s.matchAll(IMPORT)].flatMap((x) => x[1].split(',').map((t) => t.replace(/^\s*type\s+/, '').trim().split(/\s+as\s+/).pop() ?? '').filter(Boolean))
    const fns = imported.filter((n) => GATE_FUNCTIONS.includes(n))
    if (fns.length === 0) { problems.push({ file: r, problem: `${v.class} 인데 embargo-gate 의 관문 함수를 import 하지 않는다` }); continue }
    const body = s.replace(IMPORT, '')
    if (!fns.some((n) => new RegExp(`\\b${n}\\s*\\(`).test(body))) problems.push({ file: r, problem: `${v.class} 인데 import 한 관문 함수(${fns.join(', ')})를 부르지 않는다` })
  }
  return problems
}
