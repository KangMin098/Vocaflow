// scripts/comic/pd/refine.mjs
//
// PDCP 정제(현대식 보완/개선) 단계 — OCR 원문(파편·오탈자)을 컷별로 병합·교정·(선택)현대화하여
// 학습 가능한 대사로. **Claude Code 오퍼레이터-in-the-loop** (CCP 채점과 동형):
//   스크립트가 직접 LLM 을 부르지 않는다 — 이 저장소엔 API 키가 없고(무키 원칙), 정제는 판단이
//   필요해 드레인 오퍼레이터(Claude Code)가 수행한다. 스크립트는 intake 를 뽑고 output 을 흡수한다.
//
//   node refine.mjs --intake <workdir>   → refine.intake.json (컷별 OCR 파편 + 정제 지시)
//   node refine.mjs --ingest <workdir> [--modernize]
//                                       → refine.output.json(오퍼레이터 작성) 을 읽어
//                                         bubbles.refined.manifest.json 생성
//
// 왜 필요한가: raw OCR 은 한 캡션을 여러 파편으로 쪼개고(예: "The"/"Marvel"/"Of our big")
// 오탈자를 남긴다(seated→eated). 원문 그대로는 46% 만 사용가능. 오퍼레이터 정제로 컷별 읽기순서
// 병합 + 교정 + (원하면)고어체 현대화 → 학습 대사 완성. 발행 전 마지막 콘텐츠 관문.

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return undefined; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true }
const has = (n) => process.argv.includes(`--${n}`)

const workDir = arg('intake') || arg('ingest')
if (!workDir || typeof workDir !== 'string') {
  console.error('사용법: node refine.mjs --intake <workdir> | --ingest <workdir> [--modernize]')
  process.exit(2)
}
const LOCAL = path.join(workDir, 'bubbles.local.manifest.json')
const INTAKE = path.join(workDir, 'refine.intake.json')
const OUTPUT = path.join(workDir, 'refine.output.json')
const REFINED = path.join(workDir, 'bubbles.refined.manifest.json')

function readJson(f) { return JSON.parse(fs.readFileSync(f, 'utf8')) }

// ── --intake : OCR 파편을 오퍼레이터용 정제 인테이크로 ──────────────
if (has('intake')) {
  if (!fs.existsSync(LOCAL)) { console.error(`OCR 매니페스트 없음: ${LOCAL} (ocr-local 먼저)`); process.exit(1) }
  const mf = readJson(LOCAL)
  const panels = (mf.panels || [])
    .map((p, id) => ({ id, pageOrder: p.pageOrder, page: p.page, panelIndex: p.panelIndex,
      fragments: (p.bubbles || []).map((b) => ({ text: b.text, kind: b.kind, confidence: b.confidence, needsReview: !!b.needsReview })) }))
    .filter((p) => p.fragments.length > 0)
  const intake = {
    slug: path.basename(workDir),
    generatedFrom: 'bubbles.local.manifest.json',
    guide: [
      '각 컷(panel)의 fragments 는 OCR 이 쪼갠 파편이다. 이것을 읽는 순서로 병합하고 OCR 오탈자를 교정해',
      '컷별로 자연스러운 대사/캡션을 만든다. kind 는 caption(내레이션) 또는 speech(말풍선)로 구분한다.',
      '원문에 충실하되 학습 가독성을 우선한다. --modernize 로 흡수하면 고어체를 현대 영어로 순화(뜻 보존).',
      'output 형식: refine.output.json = { "modernized": bool, "panels": [ { "id": <intake.id>, "bubbles": [ { "text": "...", "kind": "caption|speech" } ] } ] }',
      '내용이 없거나 순수 잡음(페이지번호 등)인 컷은 output 에서 생략한다(원문 유지).',
    ].join('\n'),
    stats: { panels: panels.length, fragments: panels.reduce((a, p) => a + p.fragments.length, 0) },
    panels,
  }
  fs.writeFileSync(INTAKE, JSON.stringify(intake, null, 2))
  console.log(`✓ refine.intake.json — 컷 ${panels.length} · 파편 ${intake.stats.fragments}`)
  console.log(`  → Claude Code 오퍼레이터가 ${INTAKE} 를 읽고 refine.output.json 작성 후:`)
  console.log(`     node scripts/comic/pd/refine.mjs --ingest ${workDir}`)
  process.exit(0)
}

// ── --ingest : 오퍼레이터 정제 결과 흡수 → 정제 매니페스트 ──────────
if (has('ingest')) {
  if (!fs.existsSync(LOCAL)) { console.error(`OCR 매니페스트 없음: ${LOCAL}`); process.exit(1) }
  if (!fs.existsSync(OUTPUT)) { console.error(`정제 결과 없음: ${OUTPUT} (오퍼레이터 작성 필요 — 먼저 --intake)`); process.exit(1) }
  const mf = readJson(LOCAL)
  const out = readJson(OUTPUT)
  const byId = new Map((out.panels || []).map((p) => [p.id, p.bubbles || []]))
  let refinedPanels = 0, refinedBubbles = 0
  const panels = (mf.panels || []).map((p, id) => {
    const rb = byId.get(id)
    if (!rb || rb.length === 0) return p // 정제 없음 → 원문 유지
    refinedPanels++; refinedBubbles += rb.length
    return { pageOrder: p.pageOrder, page: p.page, panelIndex: p.panelIndex,
      bubbles: rb.map((b) => ({ text: String(b.text || '').trim(), kind: b.kind === 'speech' ? 'speech' : 'caption', refined: true })).filter((b) => b.text) }
  })
  const totalBubbles = panels.reduce((a, p) => a + (p.bubbles || []).length, 0)
  const refined = {
    engine: 'claude-refine', source: 'bubbles.local.manifest.json',
    modernized: !!out.modernized || has('modernize'),
    stats: { panels: panels.length, refinedPanels, refinedBubbles, bubbles: totalBubbles,
      fromOcr: (mf.stats && mf.stats.bubbles) || null },
    panels,
  }
  fs.writeFileSync(REFINED, JSON.stringify(refined, null, 2))
  console.log(`✓ bubbles.refined.manifest.json — 정제 컷 ${refinedPanels} · 대사 ${totalBubbles}${refined.modernized ? ' · 현대화' : ''}`)
  console.log(`  OCR 원문 ${refined.stats.fromOcr ?? '?'}개 → 정제 ${totalBubbles}개`)
  process.exit(0)
}
