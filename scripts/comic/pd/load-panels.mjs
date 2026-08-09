// scripts/comic/pd/load-panels.mjs
//
// refine 정제 대사 + 컷 이미지 지오메트리를 pd_comic_panels 에 적재 — refine 결과를 "학습 콘텐츠로 확정".
// 이후 admin 모니터 드릴다운('컷 대사')과(발행 시) 학습자 리더가 실제 컷 대사를 보여준다.
//   node scripts/comic/pd/load-panels.mjs --workdir work/<slug>
// qc.workDir 로 이슈 매칭(파이프라인 --record 가 저장). 정제본(bubbles.refined) 우선, 없으면 bubbles.local.
// 재실행 멱등(이슈 컷 전체 교체). 적재 후 status='review'(사람 검수 대기)로.

import fs from 'node:fs'
import path from 'node:path'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? undefined : process.argv[i + 1] }
const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')) } catch { return null } }

const WD = arg('workdir')
if (!WD) { console.error('사용법: node scripts/comic/pd/load-panels.mjs --workdir work/<slug>'); process.exit(2) }
const REPO = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..', '..', '..')

// env
const envPath = path.join(REPO, 'apps', 'web', '.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('✗ Supabase env 없음 (apps/web/.env.local)'); process.exit(1) }
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(url, key, { auth: { persistSession: false } })

const abs = path.resolve(WD)
// 이슈 매칭 — qc.workDir. filter 실패 대비 client-side 폴백.
let issue = null
try { const { data } = await db.from('pd_comic_issues').select('id, slug, title').filter('qc->>workDir', 'eq', abs).maybeSingle(); issue = data } catch { /* noop */ }
if (!issue) {
  const { data } = await db.from('pd_comic_issues').select('id, slug, title, qc').order('created_at', { ascending: false }).limit(50)
  issue = (data || []).find((r) => (r.qc && r.qc.workDir) === abs) || null
}
if (!issue) { console.error(`✗ 이슈 못 찾음 (qc.workDir=${abs}) — 파이프라인 --record 로 먼저 실행`); process.exit(1) }

const pm = readJson(path.join(WD, 'panels', 'panels.manifest.json'))?.panels
if (!Array.isArray(pm)) { console.error('✗ panels.manifest.json 없음/형식오류'); process.exit(1) }
const refinedMf = readJson(path.join(WD, 'bubbles.refined.manifest.json'))
const bubblesMf = refinedMf ?? readJson(path.join(WD, 'bubbles.local.manifest.json'))
const usingRefined = !!refinedMf
if (!bubblesMf) { console.error('✗ bubbles 매니페스트 없음 (OCR/refine 먼저)'); process.exit(1) }

// (pageOrder, panelIndex) → bubbles
const bmap = new Map()
for (const p of bubblesMf.panels || []) bmap.set(`${p.pageOrder}-${p.panelIndex}`, p.bubbles || [])

const sorted = [...pm].sort((a, b) => (a.pageOrder - b.pageOrder) || (a.panelIndex - b.panelIndex))
const rows = sorted.map((p, i) => ({
  issue_id: issue.id,
  panel_order: i + 1,
  source_page_no: p.pageOrder ?? null,
  image_url: `panels/${path.basename(p.file)}`, // work 상대경로 — dev artifact 라우트로 서빙
  bubbles: (bmap.get(`${p.pageOrder}-${p.panelIndex}`) || []).map((b) => ({ text: String(b.text || '').trim(), kind: b.kind === 'speech' ? 'speech' : 'caption', ...(b.refined ? { refined: true } : {}) })).filter((b) => b.text),
  target_vocab: [],
  source_box: p.srcBox ?? null,
}))

await db.from('pd_comic_panels').delete().eq('issue_id', issue.id)
const { error } = await db.from('pd_comic_panels').insert(rows)
if (error) { console.error(`✗ 적재 실패: ${error.message}`); process.exit(1) }
await db.from('pd_comic_issues').update({ panels_total: rows.length, status: 'review' }).eq('id', issue.id)

const withText = rows.filter((r) => r.bubbles.length).length
const totalBubbles = rows.reduce((a, r) => a + r.bubbles.length, 0)
console.log(`✓ pd_comic_panels 적재 — "${issue.title}" 컷 ${rows.length}(대사있음 ${withText}) · 대사 ${totalBubbles} · ${usingRefined ? '정제본(refined)' : '원문(OCR)'}`)
console.log('  → status=review · admin 모니터 "컷 대사" 드릴다운에서 실 콘텐츠 확인')
