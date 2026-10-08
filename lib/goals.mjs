// lib/goals.mjs
//
// STEP 2 승인 정본을 읽고 검증한다. 정본은 **읽기 전용** — 이 모듈은 어떤 정본 파일도 쓰지 않는다.
//
// 검사 항목 (STEP 3 지시 §2 의 1~10):
//   1 정본 파일 존재 · 2 목표 버전 일치 · 3 사용자 승인 기록 · 4 L0~L4 계층 · 5 ID 중복
//   6 상위·하위 관계 · 7 JSON 스키마 · 8 플랫폼 전체 범위 · 9 CSAT 축소 여부 · 10 완료 기준 충돌
// 결과는 errors(정본을 쓸 수 없음) / warnings(쓸 수 있으나 사람이 볼 것) 로 나눈다.
// 정본을 고치지 않는다 — 발견 사항은 DECISION_LOG 의 OPEN_QUESTION 으로만 남긴다.

import fs from 'node:fs'
import path from 'node:path'
import { goalsDir } from './paths.mjs'
import { readJson, sha256File } from './fsutil.mjs'

export const CANON_FILES = ['PROJECT_GOAL.md', 'PRODUCT_STRATEGY.md', 'GOAL_ACCEPTANCE_CRITERIA.json', 'AI_WORKFLOW_REQUIREMENTS.md', 'GOAL_APPROVAL.md']
export const INPUT_FILES = ['STEP3_INPUT_CRITERIA.md']
export const MANIFEST = 'CANON_MANIFEST.json'

const ACCEPTANCE_KEYS = ['criterion_id', 'condition', 'verification_method', 'required_evidence', 'status']
const textOf = (c) => `${c.title} ${JSON.stringify(c.acceptance)}`
const CRITERION_KEYS = ['id', 'parent_id', 'level', 'title', 'phase', 'acceptance', 'dependencies', 'observed_status', 'evidence_refs', 'evidence_class', 'blocking_for_R0']
const PHASES = new Set(['vision', 'long_term', 'release', 'R0', 'R1', 'pilot', 'research', 'per_task'])
const TEMPLATE_PARENT = 'VG-L3-*'
const L1_REQUIRED = ['VG-L1-A', 'VG-L1-B', 'VG-L1-C', 'VG-L1-D']
const APPROVED_DECISIONS = ['SD-R0-01', 'SD-R0-02', 'SD-R0-03', 'SD-R0-04']
const CSAT_RE = /(수능|CSAT|학평|모의평가|기출)/i

export function loadCriteria(dir = goalsDir()) {
  return readJson(path.join(dir, 'GOAL_ACCEPTANCE_CRITERIA.json'))
}

/** 정본 id → criterion 맵. 템플릿(L4)은 별도. */
export function goalIndex(doc) {
  const byId = new Map()
  for (const c of doc.criteria) byId.set(c.id, c)
  return byId
}

/** 작업에 연결할 수 있는 목표인가. L4 작업은 정확히 하나의 주 L3 를 가져야 한다(PROJECT_GOAL §2). */
export function checkTaskGoal(doc, goalId) {
  const c = goalIndex(doc).get(goalId)
  if (!c) return { ok: false, reason: `goal_id ${goalId} 는 정본에 없다` }
  if (c.observed_status === 'template') return { ok: false, reason: `${goalId} 는 L4 템플릿이다 — 작업은 L3 목표에 연결하고 template 필드로 유형을 적는다` }
  if (c.level !== 3) return { ok: false, reason: `${goalId} 는 L${c.level} 이다 — 작업의 주 목표는 L3 여야 한다(PROJECT_GOAL §2)` }
  return { ok: true, criterion: c }
}

export function templateTypes(doc) {
  return doc.criteria.filter((c) => c.observed_status === 'template').map((c) => c.id)
}

function headerVersion(text) {
  const m = text.match(/v(\d+\.\d+\.\d+)/)
  return m ? m[1] : null
}

export function buildManifest(dir = goalsDir()) {
  const files = {}
  for (const f of [...CANON_FILES, ...INPUT_FILES]) {
    const fp = path.join(dir, f)
    if (fs.existsSync(fp)) files[f] = { sha256: sha256File(fp), bytes: fs.statSync(fp).size, role: CANON_FILES.includes(f) ? 'canon' : 'step_input' }
  }
  return files
}

export function validateCanon(dir = goalsDir()) {
  const errors = []
  const warnings = []
  const facts = {}

  // 1 존재
  for (const f of CANON_FILES) if (!fs.existsSync(path.join(dir, f))) errors.push(`[1] 정본 파일 없음: ${f}`)
  if (errors.length) return { ok: false, errors, warnings, facts }

  // 7 JSON 스키마
  let doc
  try {
    doc = loadCriteria(dir)
  } catch (e) {
    errors.push(`[7] GOAL_ACCEPTANCE_CRITERIA.json 파싱 실패: ${e.message}`)
    return { ok: false, errors, warnings, facts }
  }
  for (const k of ['schema_version', 'document_status', 'status_vocabulary', 'release_gates', 'criteria', 'policy', 'strategic_decisions', 'r0_scope']) {
    if (!(k in doc)) errors.push(`[7] 최상위 키 누락: ${k}`)
  }
  if (!Array.isArray(doc.criteria)) {
    errors.push('[7] criteria 가 배열이 아니다')
    return { ok: false, errors, warnings, facts }
  }
  const vocab = new Set(doc.status_vocabulary || [])
  const acIds = []
  const templateStatus = []
  doc.criteria.forEach((c, i) => {
    for (const k of CRITERION_KEYS) if (!(k in c)) errors.push(`[7] criteria[${i}] (${c.id ?? '?'}) 키 누락: ${k}`)
    if (!PHASES.has(c.phase)) warnings.push(`[7] ${c.id} phase 가 알 수 없는 값: ${c.phase}`)
    if (c.observed_status !== 'template' && !vocab.has(c.observed_status)) errors.push(`[7] ${c.id} observed_status '${c.observed_status}' 가 status_vocabulary 밖이다`)
    if (!Array.isArray(c.acceptance) || c.acceptance.length === 0) errors.push(`[7] ${c.id} acceptance 가 비었다`)
    for (const [j, a] of (c.acceptance || []).entries()) {
      for (const k of ACCEPTANCE_KEYS) if (!(k in a)) errors.push(`[7] ${c.id}.acceptance[${j}] 키 누락: ${k}`)
      const str = (v) => typeof v === 'string' && v.trim().length > 0
      if ('condition' in a && !str(a.condition)) errors.push(`[7] ${c.id}.acceptance[${j}].condition 은 비지 않은 문자열`)
      if ('verification_method' in a && !str(a.verification_method)) errors.push(`[7] ${c.id}.acceptance[${j}].verification_method 는 비지 않은 문자열`)
      if ('required_evidence' in a && !(Array.isArray(a.required_evidence) && a.required_evidence.length && a.required_evidence.every(str))) errors.push(`[7] ${c.id}.acceptance[${j}].required_evidence 는 비지 않은 문자열 배열`)
      if ('criterion_id' in a && !str(a.criterion_id)) errors.push(`[7] ${c.id}.acceptance[${j}].criterion_id 형식 오류`)
      if ('status' in a && (typeof a.status !== 'string' || !a.status)) errors.push(`[7] ${c.id}.acceptance[${j}].status 는 비지 않은 문자열`)
      else if (a.status && !vocab.has(a.status)) {
        // L4 템플릿은 아직 인스턴스가 아니므로 'not_instantiated' 를 쓴다 — 어휘 밖이지만 의미상 정당. 정본은 고치지 않고 경고로 남긴다.
        if (c.observed_status === 'template' && a.status === 'not_instantiated') templateStatus.push(c.id)
        else errors.push(`[7] ${c.id}.acceptance[${j}].status '${a.status}' 가 vocabulary 밖`)
      }
      if (a.criterion_id) acIds.push(a.criterion_id)
    }
  })
  const acDup = acIds.filter((x, i) => acIds.indexOf(x) !== i)
  if (acDup.length) errors.push(`[5] acceptance criterion_id 중복: ${[...new Set(acDup)].join(', ')}`)
  facts.acceptance_items = acIds.length
  if (templateStatus.length) warnings.push(`[7] L4 템플릿 ${templateStatus.length}개의 acceptance.status 'not_instantiated' 가 status_vocabulary 에 없다 — 템플릿 전용 값으로 해석(정본 다음 판에서 어휘에 추가 권고)`)

  // 2 버전
  const versions = {}
  for (const f of CANON_FILES.filter((f) => f.endsWith('.md'))) versions[f] = headerVersion(fs.readFileSync(path.join(dir, f), 'utf8'))
  versions['GOAL_ACCEPTANCE_CRITERIA.json'] = doc.schema_version
  const distinct = new Set(Object.values(versions).filter(Boolean))
  facts.versions = versions
  if (distinct.size !== 1) errors.push(`[2] 정본 버전 불일치: ${JSON.stringify(versions)}`)
  else facts.canon_version = [...distinct][0]
  for (const [f, v] of Object.entries(versions)) if (!v) warnings.push(`[2] ${f} 머리에서 버전을 못 읽었다`)

  // 3 승인 기록
  const approval = fs.readFileSync(path.join(dir, 'GOAL_APPROVAL.md'), 'utf8')
  if (!/APPROVED_STRATEGY_BASELINE/.test(approval)) errors.push('[3] GOAL_APPROVAL.md 에 APPROVED_STRATEGY_BASELINE 상태가 없다')
  const approvalDate = (approval.match(/승인일:\s*\*\*(\d{4}-\d{2}-\d{2})\*\*/) || [])[1]
  facts.approved_at = approvalDate ?? null
  if (!approvalDate) errors.push('[3] 승인일을 찾지 못했다')
  for (const id of APPROVED_DECISIONS) {
    const inMd = new RegExp(`\\|\\s*${id}\\s*\\|[^\\n]*APPROVED`).test(approval)
    const inJson = (doc.strategic_decisions || []).find((d) => d.decision_id === id)
    if (!inMd) errors.push(`[3] GOAL_APPROVAL.md 에 ${id} APPROVED 행이 없다`)
    if (!inJson) errors.push(`[3] criteria JSON strategic_decisions 에 ${id} 가 없다`)
    else if (String(inJson.approval_status).toLowerCase() !== 'approved') errors.push(`[3] ${id} approval_status=${inJson.approval_status}`)
  }
  if (doc.approved_at && approvalDate && doc.approved_at !== approvalDate) errors.push(`[3] 승인일 불일치 JSON ${doc.approved_at} vs MD ${approvalDate}`)
  facts.approval_scope = 'strategy only — 구현·출시·학습 효과 미승인(GOAL_APPROVAL §4)'

  // 봉인: manifest 가 있으면 형식·필수 파일·해시·버전·승인일을 모두 대조(정본 무단 수정 · 빈 manifest 탐지)
  const manPath = path.join(dir, MANIFEST)
  if (fs.existsSync(manPath)) {
    let man
    try {
      man = readJson(manPath)
    } catch (e) {
      errors.push(`[seal] ${MANIFEST} 파싱 실패: ${e.message}`)
    }
    if (man !== undefined && (man === null || typeof man !== 'object' || Array.isArray(man))) errors.push('[seal] manifest 는 객체여야 한다')
    else if (man) {
      if (man.schema !== 'vfc-canon-manifest/1') errors.push('[seal] manifest schema 가 vfc-canon-manifest/1 이 아니다')
      const files = man.files && typeof man.files === 'object' ? man.files : {}
      for (const req of CANON_FILES) if (!files[req]) errors.push(`[seal] manifest 에 정본 ${req} 가 없다`)
      for (const [mf, rec] of Object.entries(files)) {
        const fp = path.join(dir, mf)
        if (!/^[a-f0-9]{64}$/.test(rec?.sha256 || '')) errors.push(`[seal] ${mf} 해시 형식 오류`)
        else if (!fs.existsSync(fp)) errors.push(`[seal] manifest 의 ${mf} 가 없다`)
        else if (sha256File(fp) !== rec.sha256) errors.push(`[seal] ${mf} 해시 불일치 — 정본이 승인 후 바뀌었다. 변경은 제안→검토→결정 기록→버전 갱신 순서로만`)
      }
      if (facts.canon_version && man.canon_version !== facts.canon_version) errors.push(`[seal] 봉인 버전 ${man.canon_version} ≠ 정본 버전 ${facts.canon_version}`)
      if (facts.approved_at && man.approved_at !== facts.approved_at) errors.push(`[seal] 봉인 승인일 ${man.approved_at} ≠ 정본 승인일 ${facts.approved_at}`)
      facts.sealed_version = man.canon_version
    }
  } else {
    warnings.push('[seal] CANON_MANIFEST.json 없음 — 아직 봉인되지 않았다')
  }

  // 5 ID 중복
  const seen = new Map()
  for (const c of doc.criteria) seen.set(c.id, (seen.get(c.id) || 0) + 1)
  const dups = [...seen].filter(([, n]) => n > 1).map(([id]) => id)
  if (dups.length) errors.push(`[5] goal id 중복: ${dups.join(', ')}`)
  const gateIds = (doc.release_gates || []).map((g) => g.id)
  if (new Set(gateIds).size !== gateIds.length) errors.push('[5] release gate id 중복')

  // 4·6 계층과 관계
  const byId = goalIndex(doc)
  const levels = {}
  for (const c of doc.criteria) levels[c.level] = (levels[c.level] || 0) + 1
  facts.level_counts = levels
  facts.criteria_count = doc.criteria.length
  for (const lv of [0, 1, 2, 3, 4]) if (!levels[lv]) errors.push(`[4] L${lv} 목표가 없다`)
  const roots = doc.criteria.filter((c) => c.parent_id === null)
  if (roots.length !== 1 || roots[0].level !== 0) errors.push(`[4] L0 루트가 정확히 하나여야 한다 (실제 ${roots.map((r) => r.id).join(',')})`)
  for (const c of doc.criteria) {
    if (c.parent_id === null) continue
    if (c.parent_id === TEMPLATE_PARENT) {
      if (c.level !== 4) errors.push(`[6] ${c.id}: 템플릿 부모는 L4 만 쓸 수 있다`)
      continue
    }
    const parent = byId.get(c.parent_id)
    if (!parent) errors.push(`[6] ${c.id} 의 parent ${c.parent_id} 가 없다`)
    else if (parent.level !== c.level - 1) errors.push(`[6] ${c.id}(L${c.level}) 의 parent ${parent.id} 가 L${parent.level} — 한 단계 위여야 한다`)
  }
  // 순환 검사
  for (const c of doc.criteria) {
    const path_ = new Set()
    let cur = c
    while (cur && cur.parent_id && cur.parent_id !== TEMPLATE_PARENT) {
      if (path_.has(cur.id)) {
        errors.push(`[6] 순환: ${c.id}`)
        break
      }
      path_.add(cur.id)
      cur = byId.get(cur.parent_id)
    }
  }
  // L4 템플릿의 dependencies 는 자유 서술(「해당 L3 의 계약/선행 태스크」)이라 id 검사 대상이 아니다
  for (const c of doc.criteria.filter((c) => c.observed_status !== 'template')) for (const d of c.dependencies || []) if (!byId.has(d) && !gateIds.includes(d)) warnings.push(`[6] ${c.id} dependency ${d} 가 정본 id 가 아니다`)
  // 모든 L2 아래 L3 가 있는가
  for (const c of doc.criteria.filter((c) => c.level === 2)) if (!doc.criteria.some((k) => k.parent_id === c.id)) errors.push(`[4] L2 ${c.id} 아래 L3 가 없다`)

  // 8 플랫폼 전체 범위
  for (const id of L1_REQUIRED) if (!byId.has(id)) errors.push(`[8] L1 축 누락: ${id}`)
  const l0 = roots[0]
  const scopeText = fs.readFileSync(path.join(dir, 'PROJECT_GOAL.md'), 'utf8')
  const domains = { 어휘: /어휘/, 문장: /문장|구문/, 독해: /독해/, 듣기: /듣기/, 강의: /강의/, 게임: /게임/, 평가: /평가/, 교사: /교사/, 콘텐츠: /콘텐츠/ }
  const missingDomains = Object.entries(domains).filter(([, re]) => !re.test(scopeText)).map(([k]) => k)
  facts.domains_covered = Object.keys(domains).filter((k) => !missingDomains.includes(k))
  if (missingDomains.length) errors.push(`[8] PROJECT_GOAL 에서 플랫폼 영역이 빠졌다: ${missingDomains.join(', ')}`)

  // 9 CSAT 축소
  if (l0 && CSAT_RE.test(textOf(l0))) errors.push('[9] L0 가 수능/CSAT 로 축소돼 있다')
  const csatCount = doc.criteria.filter((c) => CSAT_RE.test(textOf(c))).length
  facts.csat_mentions = csatCount
  if (csatCount > doc.criteria.length / 4) warnings.push(`[9] CSAT 언급 목표가 ${csatCount}/${doc.criteria.length} — 편중 여부 검토`)
  if (!/수능.*동의어가 아니다|특화된 학습 환경/.test(scopeText)) warnings.push('[9] PROJECT_GOAL 에 「수능 ≠ 플랫폼 전체」 진술을 못 찾았다')
  if (CSAT_RE.test(JSON.stringify(doc.r0_scope?.target_learner ?? ''))) errors.push('[9] R0 대상이 수능/CSAT 다 — 승인된 SD-R0-01(중등 일반)과 다르다')
  const r0 = doc.r0_scope || {}
  if (!/middle/i.test(r0.target_learner || '')) errors.push(`[10] r0_scope.target_learner '${r0.target_learner}' 가 SD-R0-01(중등 일반 영어·독해)과 다르다`)
  if (!/anonymous/i.test(r0.entry || '') || !/signup/i.test(r0.entry || '')) errors.push(`[10] r0_scope.entry '${r0.entry}' 가 SD-R0-02(비로그인 체험→가입)와 다르다`)
  for (const step of ['anonymous_preview', 'read', 'practice', 'feedback', 'review', 'unseen_transfer', 'reassessment', 'history']) {
    if (!(r0.required_journey || []).includes(step)) errors.push(`[10] r0_scope.required_journey 에 ${step} 가 없다 — 승인된 R0 대표 경로와 다르다`)
  }

  // 10 완료 기준 충돌
  const pol = doc.policy || {}
  if (pol.skip_is_pass !== false) errors.push('[10] policy.skip_is_pass 가 false 가 아니다')
  if (pol.unknown_is_pass !== false) errors.push('[10] policy.unknown_is_pass 가 false 가 아니다')
  if (pol.synthetic_learners_count_as_real !== false) errors.push('[10] 합성 학습자를 실사용으로 셀 수 있게 돼 있다')
  for (const c of doc.criteria.filter((c) => c.blocking_for_R0)) {
    if (c.phase !== 'R0') warnings.push(`[10] ${c.id} blocking_for_R0=true 인데 phase=${c.phase}`)
    const parent = byId.get(c.parent_id)
    if (parent && parent.blocking_for_R0 === false && parent.level >= 2) warnings.push(`[10] ${c.id} 는 R0 차단인데 상위 ${parent.id} 는 아니다`)
  }
  for (const c of doc.criteria.filter((c) => c.level === 2 && c.blocking_for_R0)) {
    const kids = doc.criteria.filter((k) => k.parent_id === c.id)
    if (kids.length && !kids.some((k) => k.blocking_for_R0)) warnings.push(`[10] ${c.id} 는 R0 차단인데 하위 L3 중 R0 차단이 하나도 없다`)
  }
  // 선택 지원(강의/게임)이 R0 차단으로 표시돼 있으면, 조건이 「없이도 완결」인지 확인 — 「사용을 요구」하면 SD-R0 범위와 충돌
  for (const c of doc.criteria.filter((c) => c.blocking_for_R0 && /강의|게임/.test(c.title))) {
    const cond = JSON.stringify(c.acceptance)
    if (!/없이도/.test(cond)) warnings.push(`[10] ${c.id} 는 강의/게임 목표인데 R0 차단이고 「없이도 완결」 조건이 없다`)
  }
  const deferred = new Set(doc.r0_scope?.deferred || [])
  for (const d of ['classroom', 'payments']) if (!deferred.has(d)) errors.push(`[10] r0_scope.deferred 에 ${d} 가 없다 — SD-R0-04 와 충돌`)
  if (doc.r0_scope?.platform !== 'pc_web_first') errors.push('[10] r0_scope.platform 이 pc_web_first 가 아니다 — SD-R0-03 과 충돌')
  for (const g of doc.release_gates || []) if (g.status === 'pass' && !(g.evidence_refs || []).length) errors.push(`[10] release gate ${g.id} 가 증거 없이 pass`)

  facts.release_gates = gateIds
  facts.r0_required_journey = doc.r0_scope?.required_journey
  return { ok: errors.length === 0, errors, warnings, facts }
}
