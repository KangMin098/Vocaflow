// scripts/csat/error-evidence/seed/build-seed.mjs
//
// v0.1 conditional seed candidate — DB 에 넣을 행(코드 · 경계)을 정본에서 기계적으로 만든다(손으로 옮기지 않는다).
//   정본 ① docs/csat-learner/codebook/CODEBOOK.rev4.2.md (sha256 앞 12 = c7001aff97b0 고정 — 다르면 멈춘다)
//   정본 ② docs/csat-learner/codebook/data/seed-v0.1-conditional.json (제품 결정 구성안)
//   정본 ③ SEED_DECISION.md 「제품 결정」(R9 · R12 accepted · R6 경계만 provisional · 두 코드 accepted · rev4.4 금지)
// 출력: docs/csat-learner/codebook/data/seed-v0.1-rows.json — validate-seed.mjs · dryrun-seed.mjs 의 입력. DB 에 쓰지 않는다.
//
//   node scripts/csat/error-evidence/seed/build-seed.mjs

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const CB_DIR = path.join(REPO, 'docs/csat-learner/codebook')
const DECISION = JSON.parse(fs.readFileSync(path.join(CB_DIR, 'data/seed-v0.1-conditional.json'), 'utf8'))
const CB_FILE = path.join(CB_DIR, DECISION.codebook_basis.file)
const cbBytes = fs.readFileSync(CB_FILE)
const cbSha = createHash('sha256').update(cbBytes).digest('hex')
if (!cbSha.startsWith(DECISION.codebook_basis.sha256_12)) throw new Error(`코드북 판이 결정과 다르다: ${cbSha.slice(0, 12)} ≠ ${DECISION.codebook_basis.sha256_12}`)
const cb = cbBytes.toString('utf8').replace(/\r\n/g, '\n')

// §5 코드 정의 — 「#### `CODE` 라벨」 + 「- **정의**: …」 「- **포함**: …」 「- **제외**: …」
const sec5 = cb.slice(cb.indexOf('## 5. 코드 정의'), cb.indexOf('## 6.'))
const declared = Number((sec5.match(/^## 5\. 코드 정의\((\d+)개\)/m) ?? [])[1])
const blocks = sec5.split(/^#### /m).slice(1)
const field = (b, name) => {
  const m = b.match(new RegExp(`^- \\*\\*${name}\\*\\*: (.+)$`, 'm'))
  return m ? m[1].trim() : null
}

// student_group — 학생 자기보고 상위 범주. 정본에 코드별 대응표가 없어 축 단위 규칙만 있다(아래 GROUP · validate 가 미결로 보고한다)
const GROUP = DECISION.student_group_by_axis ?? null
const codes = blocks.map((b) => {
  const head = b.split('\n')[0]
  const m = head.match(/^`([VSREBX]\.[a-z_]+)` (.+)$/)
  if (!m) throw new Error(`코드 머리줄 형식이 아니다: ${head}`)
  const [, code, label] = m
  const axis = code[0]
  const group = axis === 'B' ? null : (GROUP?.overrides?.[code] ?? GROUP?.axis?.[axis] ?? null)
  return { code, axis, label: label.trim(), definition: field(b, '정의'), inclusion: field(b, '포함'), exclusion: field(b, '제외'), student_group: group, status: 'active' }
})

// 경계 — 결정 JSON 을 DB 형식으로 정규화(순서 고정 · 키 · 상태 이름 · probe 키 소문자)
const STATUS = { provisional_boundary: 'provisional', provisional: 'provisional', accepted: 'accepted', accepted_boundary: 'accepted', retired: 'retired' }
const boundaries = DECISION.boundaries.map((b) => {
  const [a, c] = [...b.codes].sort((x, y) => (x < y ? -1 : x > y ? 1 : 0))   // DB 와 같은 "C" 정렬
  return {
    boundary_key: `${a.toLowerCase()}__${c.toLowerCase()}`, code_a: a, code_b: c,
    status: STATUS[b.status] ?? `?${b.status}`,
    probe_key: b.probe_key ?? null,
    decision_note: b.pattern,
    provenance: { decision: 'SEED_DECISION.md 제품 결정 2026-10-05 (2+3)', decision_json_id: b.id, codebook: `${DECISION.codebook_basis.file}@${cbSha.slice(0, 12)}`,
      on_undistinguished: b.on_undistinguished, auto_confirm: b.auto_confirm, evidence: b.evidence },
  }
})

const out = {
  _note: '생성물 — build-seed.mjs 가 정본에서 만든다. 손으로 고치지 않는다. DB 적용 아님(dry-run 입력).',
  generated_from: { codebook: DECISION.codebook_basis.file, codebook_sha256: cbSha, decision_json: 'data/seed-v0.1-conditional.json',
    decision_json_sha256: createHash('sha256').update(fs.readFileSync(path.join(CB_DIR, 'data/seed-v0.1-conditional.json'))).digest('hex') },
  declared_code_count: declared,
  taxonomy: { version: DECISION.taxonomy_version ?? null, note: `${DECISION.name} — ${DECISION.preregistered_result}. 제품 결정: ${DECISION.product_decision}. validated · verified taxonomy 가 아니다.` },
  codes, boundaries,
}
fs.writeFileSync(path.join(CB_DIR, 'data/seed-v0.1-rows.json'), JSON.stringify(out, null, 1) + '\n')
console.log(`codes ${codes.length}(선언 ${declared}) · boundaries ${boundaries.length} · codebook ${cbSha.slice(0, 12)} · version ${out.taxonomy.version}`)
