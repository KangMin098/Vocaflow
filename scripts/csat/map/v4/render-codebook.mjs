#!/usr/bin/env node
// scripts/csat/map/v4/render-codebook.mjs
// docs/csat-learner/v4/codebook.json + asis-snapshot.json → docs/csat-learner/LEARNING_MAP_DOMAIN_TASK_CODEBOOK.md
//   node scripts/csat/map/v4/render-codebook.mjs [--check]
// --check: 파일을 안 고치고, 다시 그린 결과와 다르면 exit 1. 재실행 안전(통째로 다시 쓴다).
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4', p), 'utf8'))
const snap = read('asis-snapshot.json')
const cb = read('codebook.json')

const esc = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ')
const row = (cells) => `| ${cells.map(esc).join(' | ')} |`
const table = (head, rows) => [row(head), row(head.map(() => '---')), ...rows.map(row)].join('\n')
const count = (xs) => xs.reduce((a, x) => ((a[x] = (a[x] ?? 0) + 1), a), {})
const fmt = (o) => Object.entries(o).map(([k, v]) => `${k} ${v}`).join(' · ')

const lines = snap.nodes.filter((n) => n.kind === 'line')
const linkCount = count(snap.line_links.map((l) => l.line_code))
const itemNos = (code) => snap.line_links.filter((l) => l.line_code === code && l.link_kind === 'item_no').map((l) => l.ref)
const typeRefs = (code) => snap.line_links.filter((l) => l.line_code === code && l.link_kind === 'type').map((l) => l.ref)
const tasksOf = (code) => snap.tasks.filter((t) => t.line_code === code).map((t) => t.id)
const v4Of = (taskId, line) => cb.activity_task_override[taskId] ?? cb.lines[line].v4
const presc = fs.readFileSync(path.join(ROOT, 'apps/web/src/lib/csat/map/prescription.ts'), 'utf8')
const stageSrc = presc.slice(presc.indexOf('export const TASK_STAGE'), presc.indexOf('export const LINKS'))
const STAGE = Object.fromEntries([...stageSrc.matchAll(/'([A-J]\d+-\d)':\s*'(FIND|REPAIR|TRANSFER|CHECK)'/g)].map((m) => [m[1], m[2]]))
const exec = (id) => cb.in_app_execution[id] ?? 'checklist'

// 중복 후보: 같은 v4 TASK 를 겨누고 같은 활동 분류인 과제 묶음(서로 다른 라인)
const dupKey = new Map()
for (const t of snap.tasks) for (const v of v4Of(t.id, t.line_code)) {
  const k = `${v}|${cb.activity_class[t.id]}`
  dupKey.set(k, [...(dupKey.get(k) ?? []), t.id])
}
const dupsOf = (t) => {
  const out = new Set()
  for (const v of v4Of(t.id, t.line_code)) for (const o of dupKey.get(`${v}|${cb.activity_class[t.id]}`) ?? []) {
    const ol = snap.tasks.find((x) => x.id === o).line_code
    if (o !== t.id && ol !== t.line_code) out.add(o)
  }
  return [...out]
}

const md = []
md.push(`# 학습 지도 rev4.0 — 영역 · TASK 코드북(설계 제안 · 2026-10-10)

> **생성 문서 — 손으로 고치지 않는다.** 원천: [v4/codebook.json](./v4/codebook.json) · 기준 실측: [v4/asis-snapshot.json](./v4/asis-snapshot.json)(개발 DB 읽기 전용).
> 다시 그리기: \`node scripts/csat/map/v4/render-codebook.mjs\` · 무결성: \`node --test scripts/csat/map/v4/__tests__/codebook.test.mjs\`.
> 정본은 [LEARNING_MAP_VNEXT.md](./LEARNING_MAP_VNEXT.md) rev2.1 이다. 이 코드북은 정본을 바꾸지 않는다 — TASK 정의는 정본 §3 후보에 수행 목표 · 조건 · 관찰 · 기준을 **덧붙인 제안**이다.
> 근거 구분: **[실측]** DB · 코드에서 읽은 값 · **[정본]** rev2.1 승인 내용 · **[제안]** 이 문서의 설계 · **[가설]** 검증 안 됨.

## 1. 요약

- [실측] 라인 ${lines.length} · 과제(활동) ${snap.tasks.length} · 라인↔문항 연결 ${snap.line_links.length}.
- [제안] rev4 TASK ${cb.tasks.length}개 — 상태 ${fmt(count(cb.tasks.map((t) => t.status)))} · 직접 확인 ${fmt(count(cb.tasks.map((t) => t.direct_check)))}. **새로 발명한 TASK 는 0** — 모두 정본 §3 후보 · 학습자 화면 듣기 4단계에서 왔다(\`proposed\` 상태 0). 이전 설계의 「36개 수행 TASK」 목록은 저장소에서 찾지 못했다(2026-10-10 grep) — 그래서 대조 기준을 정본 후보로 삼았다.
- [제안] 라인 판단: ${fmt(count(Object.values(cb.lines).map((l) => l.decision)))}. 수행 목표 성격 라인 ${Object.values(cb.lines).filter((l) => l.performance_goal).length} — **지금 학습 요구를 만들 수 있는 것**: ${Object.entries(cb.lines).filter(([, l]) => l.performance_goal && l.v4.some((id) => cb.tasks.find((t) => t.id === id).status !== 'hold')).map(([k]) => k).join(' · ')} · **목표 성격이지만 대상 TASK 가 모두 보류(요구 0)**: ${Object.entries(cb.lines).filter(([, l]) => l.performance_goal && l.v4.every((id) => cb.tasks.find((t) => t.id === id).status === 'hold')).map(([k]) => k).join(' · ')}.
- [제안] 활동 분류: ${fmt(count(Object.values(cb.activity_class).filter((v) => typeof v === 'string' && v.length === 2)))} — ${Object.entries(cb.status_vocab.activity_class).map(([k, v]) => `${k}=${v}`).join(' · ')}. **수행 목표 TASK 로 분류된 활동은 0** — DB 의 \`csat_map_task\` 는 이름과 달리 전부 활동 · 확인 · 방법 · 자료 · 관리 항목이다.
- [실측] 앱 안에서 실제로 실행되는 활동: ${Object.entries(cb.in_app_execution).filter(([k]) => !k.startsWith('$')).map(([k, v]) => `${k}(${v})`).join(' · ')}. 나머지 ${snap.tasks.length - Object.keys(cb.in_app_execution).filter((k) => !k.startsWith('$')).length}개는 체크리스트(완료 토글)뿐이다.

## 2. 영역(6축) 재검토
`)
md.push(table(['축', '이름', '기존 라인', '현재 proxy', '독립성', '관찰 가능성', '교수 가능성', '성장', '전이', '한국 평가 관련성'],
  cb.domains.map((d) => [d.axis, d.name, d.legacy_lines.join(' · '), d.legacy_proxy, d.independence, d.observability, d.teachability, d.growth, d.transfer, d.korean_assessment])))
md.push(`
> [실측] DB 의 「축」 노드는 A · B · C · D · I · J 6개다(본질 역량 · 문항 유형 · 선지 함정 · 풀이 습관 · 공부 방법 · 시험 운영). V/S/R/E/L/X 는 \`lib/csat/map/core.ts\` 가 A1–A9 를 묶어 **계산하는 표시 층**이고 DB 노드가 아니다. 보고서의 「6개 핵심축 V/S/R/E/L/X」와 「A/B/C/D/I/J 54라인」은 서로 다른 6이다.

## 3. rev4 TASK 정의
`)
md.push(table(['표시', '영구 ID', '축', '종류', '상태', '이름', '수행 목표', '조건', '관찰 증거', '정성 성취 기준', '정량 계획 정책', '직접 확인', '방법(기존 라인·과제)'],
  cb.tasks.map((t) => [t.display, `\`${t.id}\``, t.axis, t.kind === 'integrated' ? '통합 관찰' : '원자', t.status, t.name, t.goal, t.conditions, t.evidence, t.criterion, t.quantity_policy, t.direct_check, t.methods.join(' · ')])))
md.push(`
- 통합 관찰(*-O1)은 TASK 로 계획 · 확인 대상이 되지만 **숙달도 · 막대를 계산하지 않는다**(정본 §3 머리말).
- TASK 가 아닌 층: ${Object.entries(cb.non_task_layers).map(([k, v]) => `\`${k}\` ${v}`).join(' · ')}.

## 4. 라인 54 전수 감사
`)
md.push(table(['라인', '명칭', '현재 소속', 'crosswalk(rev2.1)', '판단', '목적 층', '교육적 역할', '수행 목표', '연결 문항(item_no)', '연결 유형', '관찰 가능한 수행', '학습 방법', '평가 방법', 'rev4 TASK 후보', '과제', '판단 근거', '검증 상태'],
  lines.map((n) => {
    const l = cb.lines[n.code]
    const items = itemNos(n.code)
    return [n.code, n.name, `${n.axis} 축`, l.crosswalk_status, l.decision, l.layer, l.role, l.performance_goal ? '예' : '아니오',
      items.length ? `${items.length}(${items.slice(0, 6).join(',')}${items.length > 6 ? '…' : ''})` : '0', typeRefs(n.code).join(',') || '—',
      l.observable, l.method, l.assessment, l.v4.map((v) => `\`${v}\``).join(' ') || '—', tasksOf(n.code).length, l.why, l.verify]
  })))
md.push(`
> 연결 문항 수는 \`csat_map_line_link\`(link_kind=item_no) 실측. 라인별 연결 전체 ${snap.line_links.length}행 — ${fmt(count(snap.line_links.map((l) => l.link_kind)))}. 사용처: 모든 라인이 \`load.ts\` → \`model.ts buildMapModel\`(라인 목표율 · 성취율)과 54라인 상세 화면에 쓰인다.

## 5. 활동 183 전수 분류
`)
md.push(table(['과제', '라인', '제목', '분류', '기존 단계(TASK_STAGE)', '앱 실행', 'rev4 TASK 대응', '다른 라인 중복 후보'],
  snap.tasks.map((t) => [t.id, t.line_code, t.title, cb.activity_class[t.id], STAGE[t.id] ?? '단계 미정', exec(t.id), v4Of(t.id, t.line_code).map((v) => `\`${v}\``).join(' ') || '— (TASK 아님 층)', dupsOf(t).slice(0, 4).join(' ') || '—'])))
md.push(`
- 「기존 단계」 열은 \`apps/web/src/lib/csat/map/prescription.ts\` 의 \`TASK_STAGE\`(에이전트 판정 v1)를 렌더 때 읽은 값이다. 생애주기 단계(FIND …)와 활동 분류(DC …)는 다른 축이다 — 예: FIND 인데 MG 인 과제는 「찾기 단계의 기록 관리」다.
- 「중복 후보」는 같은 rev4 TASK 를 겨누고 같은 분류인 **다른 라인** 과제다. 자동 계산이라 실제 중복인지는 사람 확인이 필요하다 — 특히 C1-3 … C7-3 「끌린 이유 한 줄」 7개와 D1-2 · B10-1 · I10-2 「예상 답 먼저 쓰기」 계열은 **같은 활동이 여러 라인에 복제**된 것이 확인된다(제목 동일).
- 라인 대응이 없는 활동(— 표시)은 Question Lens · Item Feature · Pedagogy · Context 층에 남는다. 지울 대상이 아니다(데이터 보존).
`)

const out = path.join(ROOT, 'docs/csat-learner/LEARNING_MAP_DOMAIN_TASK_CODEBOOK.md')
const text = md.join('\n') + '\n'
if (process.argv.includes('--check')) {
  const cur = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').replace(/\r\n/g, '\n') : ''
  if (cur !== text) { console.error('코드북 문서가 원천과 다르다 — render-codebook.mjs 를 실행한다'); process.exit(1) }
  console.log('코드북 문서 = 원천')
} else {
  fs.writeFileSync(out, text)
  console.log(`→ ${path.relative(ROOT, out)} (${text.length} bytes)`)
}
