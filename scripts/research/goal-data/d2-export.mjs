// scripts/research/goal-data/d2-export.mjs
//
// D2 배치 입력 내보내기(읽기 전용 · DB 에 쓰지 않는다). 원문 · 선지 · 정답은 local/(git 제외)에만.
//   node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> scripts/research/goal-data/d2-export.mjs <batch>
// 배치 정의는 BATCHES 에 고정(무작위 없음). 이미 local/<batch>/input.json 이 있으면 덮어쓰지 않는다(선정 동결).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { insertSplit } from './insert-split.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local')
const KEY_TYPES = [22, 23, 29, 31, 32, 33, 34, 36, 37, 38, 39, 40]
export const BATCHES = {
  // 1차 표본(2026 수능 · M2706)과 겹치지 않는 직전 평가원 시험 — v2 규칙이 다른 시험에서도 일치를 올리는지 확인
  'b2-v2': { rule: 'M2609 독해 18–45 전 28 + 2025 수능 핵심 유형 12(22·23·29·31–34·36–40)', ids: [...Array.from({ length: 28 }, (_, k) => `M2609#${18 + k}`), ...KEY_TYPES.map((n) => `2025#${n}`)] },
  // 계약 v2.1 — 주어진 문장 오독으로 무효가 된 pilot-1 · b2 삽입 8문항 재판정
  'b3-insert': { rule: '2026 · M2706 · M2609 · 2025 의 #38 · #39 (주어진 문장 분리 입력)', ids: ['2026', 'M2706', 'M2609', '2025'].flatMap((e) => [`${e}#38`, `${e}#39`]) },
  // 계약 v2.1 확대 — 1·2배치와 겹치지 않는 직전 평가원 시험
  'b4-v21': { rule: 'M2606 독해 18–45 전 28 + 2024 수능 핵심 유형 12', ids: [...Array.from({ length: 28 }, (_, k) => `M2606#${18 + k}`), ...KEY_TYPES.map((n) => `2024#${n}`)] },
  // 802 확대(T-0100) — 범위 배치: 시험 순서대로 채우고 상한 40. 결손 · 도표 · 삽입 경계 불확실은 멈추지 않고 excluded 에 사유를 남긴다
  // 평가원 모의평가 나머지 — M2706(pilot-1 이 핵심 유형 12 판정) 나머지 → M2409 순 ≤40 · 기판정 자동 제외
  'b8-v24': { rule: 'M2706 18–45 중 미판정 → M2409 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4(v2.5 는 관측 검증 전 미봉인)', ids: ['M2706', 'M2409'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // v2.5 사전 등록(V2_5_PREREGISTRATION rev3) 표본 — 2022 수능 핵심 밖(도표 제외) 15 + M2406(도표 · 장문 43 · 44 사전 제외) 25 = 40 · A/B 는 v2.4
  'b9-v24': { rule: '2022 수능 핵심 유형 밖 18–45 → M2406 18–45(장문 43 · 44 는 상한 안에서 대상 M2406#45 를 지키려 사전 제외) ≤40 · 도표 · 결손 · 기판정 제외', ids: [...Array.from({ length: 28 }, (_, k) => 18 + k).filter((n) => !KEY_TYPES.includes(n)).map((n) => `2022#${n}`), ...Array.from({ length: 28 }, (_, k) => 18 + k).filter((n) => n !== 43 && n !== 44).map((n) => `M2406#${n}`)], range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // 사전 등록 비교 배치 — b9-v24 입력에서 대상 유형만 그대로 떼어 낸다(DB 재조회 없음 · 같은 원문 바이트). (C,D) = v2.5 · (E,F) = v2.4
  'b9t-v25': { rule: 'b9-v24 의 대상 유형(R-FACT · R-NOTICE · X-FACT · R-IMPLY · R-MOOD) — 계약 v2.5 (C,D)', derived_from: 'b9-v24', target_types: ['R-FACT', 'R-NOTICE', 'X-FACT', 'R-IMPLY', 'R-MOOD'], tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.5' },
  'b9t-v24': { rule: 'b9-v24 의 대상 유형(R-FACT · R-NOTICE · X-FACT · R-IMPLY · R-MOOD) — 계약 v2.4 대조 (E,F)', derived_from: 'b9-v24', target_types: ['R-FACT', 'R-NOTICE', 'X-FACT', 'R-IMPLY', 'R-MOOD'], tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // v2.4 확대 계속(T-0117 결정 — v2.5 미봉인 · 재등록 안 함). M2306 은 사전 등록 재등록용 예약 표본이었으나 재등록하지 않기로 해 일반 확대에 쓴다
  // 평가원 나머지 — M2206 → 2021 수능 순 ≤40 · v2.4 · 프롬프트는 mk-prompts 로 생성 · 보존
  'b22-v24': { rule: '잔여 — M2006 18–45 미판정 + 포함 시험 미기록 장문(2023#41–45 · M2409#44–45 · M2209#45 — M2406#43–44 는 사전 등록 제외라 기록만 · T-0122) · 도표 · 결손 · 기판정 · 같은 문항 중복 제외 · 계약 v2.4', ids: [...Array.from({ length: 28 }, (_, k) => `M2006#${18 + k}`), '2023#41', '2023#42', '2023#43', '2023#44', '2023#45', 'M2409#44', 'M2409#45', 'M2209#45'], range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b21-v24': { rule: '2014A · M1809 18–45 중 미판정 → M2006 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 · 같은 문항 중복 제외 · 계약 v2.4 · source_gap_suspected 보고', ids: ['2014A', 'M1809', 'M2006'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b20-v24': { rule: '2014B 18–45 → M1809 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 · 같은 문항 중복(2014A/B 공유 — 분모 1회) 제외 · 계약 v2.4', ids: ['2014B', 'M1809'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b19-v24': { rule: '2015 수능 18–45 → 2014A 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4 · 손 원본 sources/ 보존', ids: ['2015', '2014A'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b18-v24': { rule: '2017 수능 18–45 중 미판정 → 2016 수능 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4 · 조립 스크립트 형식 변환만', ids: ['2017', '2016'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b17-v24': { rule: '2018 수능 18–45 → 2017 수능 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4 · 청크 단위 검증', ids: ['2018', '2017'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b16-v24': { rule: '2020 수능 18–45 → 2019 수능 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4 · 관측 양쪽 중복 거부', ids: ['2020', '2019'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b15-v24': { rule: 'M2109 18–45 중 미판정 → M2106 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4', ids: ['M2109', 'M2106'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b14-v24': { rule: '2021 수능 18–45 중 미판정 → M2109 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4', ids: ['2021', 'M2109'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b13-v24': { rule: 'M2206 18–45 → 2021 수능 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4', ids: ['M2206', '2021'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // b11 에서 남은 M2306(기판정 자동 제외) → M2209 순 ≤40 · v2.4. 분석자 프롬프트에 CONTRACT_V2_5 · V2_5_* 열람 금지를 A · B 모두 고정(T-0118 요청)
  'b12-v24': { rule: 'M2306 18–45 중 미판정 → M2209 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4', ids: ['M2306', 'M2209'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b11-v24': { rule: 'M2309 18–45 → M2306 18–45 순으로 ≤40 · 도표 · 결손 · 기판정 제외 · 계약 v2.4', ids: ['M2309', 'M2306'].flatMap((e) => Array.from({ length: 28 }, (_, k) => `${e}#${18 + k}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // 사전 등록 확장 b10(rev4 §3) — b9 비교가 「유효 대상 12 미만」 으로 기록됐을 때만 export 할 수 있다(gate). M2309 대상 유형만
  'b10-v24': { rule: 'M2309 18–45 의 대상 유형(사전 등록 확장) — b9 유효 대상 12 미만일 때만', ids: Array.from({ length: 28 }, (_, k) => `M2309#${18 + k}`), range: true, cap: 40, only_types: ['R-FACT', 'R-NOTICE', 'X-FACT', 'R-IMPLY', 'R-MOOD'], requires_decision: 'insufficient_extend_b10', tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  'b10t-v25': { rule: 'b10-v24 대상 — 계약 v2.5 (C,D)', derived_from: 'b10-v24', target_types: ['R-FACT', 'R-NOTICE', 'X-FACT', 'R-IMPLY', 'R-MOOD'], tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.5' },
  'b10t-v24': { rule: 'b10-v24 대상 — 계약 v2.4 대조 (E,F)', derived_from: 'b10-v24', target_types: ['R-FACT', 'R-NOTICE', 'X-FACT', 'R-IMPLY', 'R-MOOD'], tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // 수능 나머지 문항(핵심 유형 밖) — 2024 · 2025 → 2023 순 ≤40 · 이미 판정한 문항은 자동 제외(이전 배치 selection)
  'b7-v24': { rule: '2024 · 2025 수능 핵심 유형 밖 18–45 → 2023 수능 핵심 유형 밖 순으로 ≤40 · 도표 · 결손 · 기판정 제외', ids: ['2024', '2025', '2023'].flatMap((e) => Array.from({ length: 28 }, (_, k) => 18 + k).filter((n) => !KEY_TYPES.includes(n)).map((n) => `${e}#${n}`)), range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.4' },
  // b5 이후(T-0103 보완 · 계약 v2.3): 2023#38 은 b5 동결 뒤 사용자 승인으로 DB 복구 — 새 source_sha256 으로 재결속해 여기서 판정한다
  'b6-v23': { rule: 'M2506 독해 전 문항 → 2023#38(복구 재결속) → 2022 수능 핵심 유형 순으로 ≤40 · 도표 · 결손 제외', ids: [...Array.from({ length: 28 }, (_, k) => `M2506#${18 + k}`), '2023#38', ...KEY_TYPES.map((n) => `2022#${n}`)], range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.3' },
  'b5-v22': { rule: 'M2509 독해 전 문항 → 2023 수능 핵심 유형 순으로 ≤40 · 도표 · 결손 제외', ids: [...Array.from({ length: 28 }, (_, k) => `M2509#${18 + k}`), ...KEY_TYPES.map((n) => `2023#${n}`)], range: true, cap: 40, tasks: ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure', 'e.evidence_location'], contract: 'v2.2' },
}
const EXCLUDE_TYPES = { 'R-CHART': '도표 값 · 단위 · 축 미결속(T-0100)' }
const batch = process.argv[2]
const def = BATCHES[batch]
if (!def) throw new Error(`배치 이름: ${Object.keys(BATCHES).join(' | ')}`)
const OUT = path.join(LOCAL, batch, 'input.json')
if (fs.existsSync(OUT)) throw new Error(`${path.relative(ROOT, OUT)} 가 이미 있다 — 선정은 동결이다`)
// 파생 배치: 부모 입력에서 대상 유형 행만 그대로 복사한다(같은 원문 · 같은 해시 — 세 쌍이 같은 문항 바이트를 본다)
if (def.derived_from) {
  const parentFile = path.join(LOCAL, def.derived_from, 'input.json')
  if (!fs.existsSync(parentFile)) throw new Error(`부모 배치 ${def.derived_from} 입력이 없다 — 먼저 export`)
  const parentRaw = fs.readFileSync(parentFile, 'utf8')
  const parent = JSON.parse(parentRaw)
  const rows = parent.rows.filter((r) => def.target_types.includes(r.type_id))
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify({ batch, rule: def.rule, tasks: def.tasks, contract: def.contract, derived_from: def.derived_from, parent_input_sha256: crypto.createHash('sha256').update(parentRaw).digest('hex'), generated_at: new Date().toISOString(), rows }, null, 1))
  const items = rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source_sha256: r.source_sha256, passage_sha256: r.passage_sha256 }))
  const SELF = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping', `${batch}-selection.json`)
  fs.writeFileSync(SELF, JSON.stringify({ batch, rule: def.rule, tasks: def.tasks, contract: def.contract, derived_from: def.derived_from, items, selection_sha256: crypto.createHash('sha256').update(JSON.stringify(items)).digest('hex') }, null, 1) + '\n')
  console.log(`${batch}: ${def.derived_from} 에서 대상 ${rows.length} 문항 · 계약 ${def.contract} → ${path.relative(ROOT, OUT)}`)
  process.exit(0)
}
// 사전 등록 gate — 비교 결과 파일의 결정이 맞을 때만 export 한다(결과를 보고 표본을 늘리는 경로를 막는다)
if (def.requires_decision) {
  const cmp = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping/v2_5-comparison.json')
  const decision = fs.existsSync(cmp) ? JSON.parse(fs.readFileSync(cmp, 'utf8')).decision : null
  if (decision !== def.requires_decision) throw new Error(`${batch} 는 비교 결정이 ${def.requires_decision} 일 때만 export 한다(현재 ${decision ?? '없음'})`)
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!String(URL_).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
async function get(table, select, ids) {
  const list = ids.map((i) => `"${i}"`).join(',')
  const res = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&${table === 'csat_items' ? 'id' : 'item_id'}=in.(${encodeURIComponent(list)})`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
  return res.json()
}
const items = await get('csat_items', 'id,exam_id,no,type_id,stem,passage,choices,answer,answers,points,body_ok', def.ids)
const analyses = await get('csat_item_analyses', 'item_id,version,status,measured_ability,design_intent,answer_locus,choice_analysis,solve_procedure,difficulty', def.ids)
const traps = await get('csat_dx_option_trap', '*', def.ids)
const byId = new Map(items.map((i) => [i.id, i]))
/** 분석 부적격 사유(없으면 null) — D1 결손 · 삽입 경계 불확실 · 범위 배치의 제외 유형 */
// 이미 다른 범위 배치(또는 고정 배치)에서 판정한 문항 — 범위 배치는 다시 넣지 않는다(재판정 배치 b3 같은 고정 배치는 의도적 재판정이라 대상 아님)
const SEL_DIR = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping')
const judgedBefore = new Map()
for (const f of fs.readdirSync(SEL_DIR).filter((f) => f.endsWith('-selection.json') && !f.startsWith(`${batch}-`))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(SEL_DIR, f), 'utf8')).items ?? []) judgedBefore.set(it.item_id, f.replace('-selection.json', ''))
}
for (const it of JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v62/data-expansion/pilot-selection.json'), 'utf8')).items ?? []) judgedBefore.set(it.item_id, 'pilot-1')
// 분모 규칙(D1 · b20): 발문 · 지문 · 선지 · 정답이 완전히 같은 문항(2014A/B 공유 문항)은 같은 문항이다 —
//   먼저 판정한 쪽 하나만 세고, 뒤의 것은 「같은 문항 중복」 으로 제외한다(링크 · κ · 문항 수 모두 1회). 지문만 같고 발문이 다르면 다른 문항
const sameItemKey = (i) => sha({ stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers })
const judgedByContent = new Map()
if (def.range) {
  // 이미 판정한 문항의 원문을 받아 같은 문항 열쇠를 만든다(이 배치 범위 밖 시험도 — 2014B 는 2014A 와 견준다)
  const prev = [...judgedBefore.keys()]
  for (let k = 0; k < prev.length; k += 100) for (const i of await get('csat_items', 'id,stem,passage,choices,answer,answers', prev.slice(k, k + 100))) judgedByContent.set(sameItemKey(i), i.id)
}
const seenInBatch = new Map()
function exclusion(id) {
  const i = byId.get(id)
  if (!i) return '문항 없음'
  if (def.only_types && !def.only_types.includes(i.type_id)) return '대상 유형 아님(사전 등록 확장)'
  if (def.range && judgedBefore.has(id)) return `이미 판정(${judgedBefore.get(id)})`
  if (def.range) {
    const k = sameItemKey(i)
    const twin = judgedByContent.get(k) ?? seenInBatch.get(k)
    if (twin && twin !== id) return `같은 문항 중복(${twin}) — 분모 1회`
    seenInBatch.set(k, id)
  }
  if (def.range && EXCLUDE_TYPES[i.type_id]) return EXCLUDE_TYPES[i.type_id]
  if (!i.body_ok) return 'body_ok=false(D1)'
  if (!Array.isArray(i.choices)) return 'choices 없음(D1)'
  if (!(i.answers?.length || i.answer != null)) return '정답 없음(D1)'
  if (i.type_id === 'R-INSERT' && insertSplit(i.passage).confidence === 'uncertain') return '삽입 경계 불확실'
  return null
}
// 제외 행도 내보낸 시점의 원천 상태를 해시로 봉인한다(T-0103: 제외 사실을 나중에 독립 재대조할 수 없었다). 원문은 local/ 의 input.json 에만
const passageSha = (p) => crypto.createHash('sha256').update(Buffer.from(String(p ?? ''), 'utf8')).digest('hex')
const snapshotOf = (i) => (i ? { type_id: i.type_id, body_ok: i.body_ok, choices_is_array: Array.isArray(i.choices), choices_count: Array.isArray(i.choices) ? i.choices.length : null, has_answer: !!(i.answers?.length || i.answer != null),
  source_sha256: sha({ stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }), passage_sha256: passageSha(i.passage) } : null)
const excluded = def.ids.map((id) => ({ item_id: id, reason: exclusion(id) })).filter((x) => x.reason).map((x) => ({ ...x, snapshot: snapshotOf(byId.get(x.item_id)) }))
const excludedRaw = excluded.map((x) => { const i = byId.get(x.item_id); return i ? { item_id: x.item_id, type_id: i.type_id, source: { stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points, body_ok: i.body_ok } } : { item_id: x.item_id, source: null } })
// 고정 배치는 부적격이 있으면 멈춘다(선정 동결) — 범위 배치만 제외하고 계속한다
if (excluded.length && !def.range) throw new Error(`분석 부적격: ${excluded.map((x) => `${x.item_id}(${x.reason})`).join(', ')}`)
const chosen = def.ids.filter((id) => !exclusion(id)).slice(0, def.cap ?? Infinity)
const latest = new Map()
for (const a of analyses) if (!latest.has(a.item_id) || latest.get(a.item_id).version < a.version) latest.set(a.item_id, a)
const rows = chosen.map((id) => {
  const i = byId.get(id), a = latest.get(id) ?? null
  const source = { stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }
  return { item_id: id, exam_id: i.exam_id, no: i.no, type_id: i.type_id, body_ok: i.body_ok, source, source_sha256: sha(source),
    // 재사용 키(T-0100): 원천 ID + 본문 SHA-256 — UTF-8 원문 바이트 그대로(정규화 · 공백 변경 없음). source_sha256 과 별도
    passage_sha256: passageSha(i.passage),
    ...(i.type_id === 'R-INSERT' ? { insert_split: insertSplit(i.passage) } : {}), analysis: a, analysis_sha256: a ? sha(a) : null, traps: traps.filter((t) => t.item_id === id) }
})
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ batch, rule: def.rule, tasks: def.tasks ?? null, contract: def.contract ?? null, generated_at: new Date().toISOString(), rows, excluded_raw: excludedRaw }, null, 1))
const examTotals = rows.reduce((m, r) => ({ ...m, [r.exam_id]: (m[r.exam_id] ?? 0) + 1 }), {})
const selection = { batch, rule: def.rule, tasks: def.tasks ?? null, contract: def.contract ?? null, exam_totals: examTotals, excluded, items: rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source_sha256: r.source_sha256, passage_sha256: r.passage_sha256, insert_split: r.insert_split ? { confidence: r.insert_split.confidence, given_chars: r.insert_split.given_sentence?.length ?? null } : undefined, analysis_version: r.analysis?.version ?? null, analysis_status: r.analysis?.status ?? null, analysis_sha256: r.analysis_sha256 })) }
const SEL = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping', `${batch}-selection.json`)
fs.mkdirSync(path.dirname(SEL), { recursive: true })
fs.writeFileSync(SEL, JSON.stringify({ ...selection, selection_sha256: sha(selection.items) }, null, 1) + '\n')
console.log(`${batch}: 문항 ${rows.length} · 제외 ${excluded.length} · 시험별 ${JSON.stringify(examTotals)} · 분석 ${rows.filter((r) => r.analysis).length} → ${path.relative(ROOT, OUT)}`)
