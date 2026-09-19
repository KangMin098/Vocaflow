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
// Windows 파일시스템은 대소문자를 구분하지 않는다 — `work/AtomicAttack…` 와 `work/atomicattack…`
// 은 같은 디렉터리인데 문자열 비교로는 다르다. 실측: 같은 폴더를 가리키는 --workdir 로
// "이슈 못 찾음" 이 났다. 경로 비교는 정규화해서 한다.
const norm = (p) => String(p ?? '').replace(/[\\/]+/g, '\\').replace(/\\+$/, '').toLowerCase()
const absKey = norm(abs)

// 이슈 매칭 — qc.workDir. filter 실패 대비 client-side 폴백.
let issue = null
try { const { data } = await db.from('pd_comic_issues').select('id, slug, title').filter('qc->>workDir', 'eq', abs).maybeSingle(); issue = data } catch { /* noop */ }
if (!issue) {
  const { data } = await db.from('pd_comic_issues').select('id, slug, title, qc').order('created_at', { ascending: false }).limit(2000)
  issue = (data || []).find((r) => norm(r.qc && r.qc.workDir) === absKey) || null
}
if (!issue) { console.error(`✗ 이슈 못 찾음 (qc.workDir=${abs}) — 파이프라인 --record 로 먼저 실행`); process.exit(1) }

const pm = readJson(path.join(WD, 'panels', 'panels.manifest.json'))?.panels
if (!Array.isArray(pm)) { console.error('✗ panels.manifest.json 없음/형식오류'); process.exit(1) }
// 매니페스트 3종을 **전부** 본다 — 우선순위: 정제본 > 로컬OCR > 소스 hOCR.
//
// ⚠️ `bubbles.manifest.json`(ocr.mjs 가 실제로 쓰는 파일)을 빠뜨리고 있었다.
// 그래서 hOCR 추출이 성공한 호도 "대사 없음"으로 적재됐다 — 에러 없이, 대사만 사라진 채로.
// (드레인 라우트는 둘 다 보는데 여기만 안 봤다. 같은 산출물을 읽는 두 코드가 서로 다른
//  파일 목록을 갖고 있으면 이런 식으로 조용히 갈린다.)
const refinedMf = readJson(path.join(WD, 'bubbles.refined.manifest.json'))
const bubblesMf =
  refinedMf ??
  readJson(path.join(WD, 'bubbles.local.manifest.json')) ??
  readJson(path.join(WD, 'bubbles.manifest.json'))
const usingRefined = !!refinedMf

// 대사가 없어도 적재한다 — **컷 이미지 자체가 콘텐츠**이고, 원작 레터링은 그림 안에 있다.
//
// 왜 예전엔 여기서 멈췄나: OCR 이 파이프라인의 필수 단계라고 보았기 때문이다. 그런데 실제로는
// 소스가 hOCR 을 줄 때만 대사가 나온다(own-ocr 어댑터·hOCR 없는 IA 업로드는 애초에 못 준다).
// 파이프라인 자신은 이미 그걸 정상으로 취급해 ocr 단계를 건너뛰고 검수로 넘긴다 —
// 그런데 적재가 exit 1 로 막아서, **컷은 멀쩡한데 DB 에 영원히 못 들어가는 호**가 생겼다
// (실측 2026-08-17: Atomic War 전권이 여기서 막혔다). 두 단계가 서로 다른 규칙을 갖고 있었다.
//
// 대사는 나중에 채울 수 있다(refine → 재적재는 멱등). 컷을 못 넣으면 아무것도 시작되지 않는다.
if (!bubblesMf) {
  console.log('⚠️ bubbles 매니페스트 없음 — 대사 없이 컷만 적재합니다(소스가 hOCR 미제공).')
  console.log('   대사는 검수에서 넣거나 refine 후 재실행하면 채워집니다(재적재 멱등).')
}

// (pageOrder, panelIndex) → bubbles
const bmap = new Map()
for (const p of bubblesMf?.panels || []) bmap.set(`${p.pageOrder}-${p.panelIndex}`, p.bubbles || [])

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
const textSrc = usingRefined ? '정제본(refined)' : bubblesMf ? '원문(OCR)' : '대사 없음(hOCR 미제공)'
console.log(`✓ pd_comic_panels 적재 — "${issue.title}" 컷 ${rows.length}(대사있음 ${withText}) · 대사 ${totalBubbles} · ${textSrc}`)
console.log('  → status=review · admin 모니터 "컷 대사" 드릴다운에서 실 콘텐츠 확인')
