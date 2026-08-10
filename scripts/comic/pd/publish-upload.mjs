// scripts/comic/pd/publish-upload.mjs
//
// 발행 스토리지 업로드 — 현대화 산출물(page-modern MAX 페이지 + letter.spec 모던 말풍선)을 공개 버킷
// (comic/pd/<slug>/)에 올리고, pd_comic_panels 를 **공개 URL + 모던 말풍선(box 좌표)** 페이지행으로 갱신한다.
// 이걸로 image_url 이 http 공개 URL 이 되어 학습자 서빙이 가능해진다(발행 게이트의 마지막 요건).
//
//   node scripts/comic/pd/publish-upload.mjs --workdir work/<slug> --slug <slug> --issue-id <uuid>
//
// 원작 작화 보존 트랙(page-modern)을 발행한다. AI 리스타일(modern/)을 쓰려면 --dir modern.

import fs from 'node:fs'
import path from 'node:path'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')

const WD = arg('workdir')
const SLUG = arg('slug')
const ISSUE_ID = arg('issue-id')
const SUBDIR = arg('dir', 'page-modern') // page-modern(작화보존) | modern(AI 리스타일)
if (!WD || !fs.existsSync(WD)) { console.error(`--workdir <dir> 필요: ${WD}`); process.exit(2) }
if (!SLUG || !ISSUE_ID) { console.error('--slug 와 --issue-id 필요'); process.exit(2) }

const imgDir = path.join(WD, SUBDIR)
if (!fs.existsSync(imgDir)) { console.error(`이미지 디렉터리 없음: ${imgDir} — 먼저 현대화(page-modern) 실행`); process.exit(2) }
const files = fs.readdirSync(imgDir).filter((f) => /^\d+\.jpg$/i.test(f)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
if (!files.length) { console.error('업로드할 이미지 없음'); process.exit(1) }

// letter.spec 모던 말풍선(box+text) — 페이지별. 없으면 빈 배열.
let spec = {}
const sf = path.join(WD, 'letter.spec.json')
if (fs.existsSync(sf)) { try { spec = JSON.parse(fs.readFileSync(sf, 'utf8')) } catch { /* noop */ } }

// env(service role)
const envPath = path.join(REPO, 'apps', 'web', '.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) { console.error('✗ Supabase env 없음(apps/web/.env.local)'); process.exit(1) }
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const BUCKET = 'comic'

const rows = []
for (const [i, f] of files.entries()) {
  const page = f.replace(/\.jpg$/i, '')
  const key = `pd/${SLUG}/${page}.jpg`
  const buf = fs.readFileSync(path.join(imgDir, f))
  const { error: upErr } = await db.storage.from(BUCKET).upload(key, buf, { contentType: 'image/jpeg', upsert: true })
  if (upErr) { console.error(`✗ 업로드 실패 ${key}: ${upErr.message}`); process.exit(1) }
  const publicUrl = db.storage.from(BUCKET).getPublicUrl(key).data.publicUrl
  const balloons = Array.isArray(spec[page]) ? spec[page].map((b) => ({ text: b.text, kind: b.type, box: { x: b.x, y: b.y, w: b.w, h: b.h } })) : []
  rows.push({ issue_id: ISSUE_ID, panel_order: i, source_page_no: Number(page) || i + 1, image_url: publicUrl, bubbles: balloons, target_vocab: [] })
  console.log(`  ✓ ${key}  (말풍선 ${balloons.length})`)
}

// pd_comic_panels 교체 — 페이지행(공개 URL + 모던 말풍선). 발행 리더가 이걸 렌더.
const { error: delErr } = await db.from('pd_comic_panels').delete().eq('issue_id', ISSUE_ID)
if (delErr) { console.error(`✗ 기존 컷 삭제 실패: ${delErr.message}`); process.exit(1) }
const { error: insErr } = await db.from('pd_comic_panels').insert(rows)
if (insErr) { console.error(`✗ 페이지행 삽입 실패: ${insErr.message}`); process.exit(1) }
// 표지 = 첫 페이지 공개 URL
await db.from('pd_comic_issues').update({ cover_url: rows[0].image_url, panels_total: rows.length }).eq('id', ISSUE_ID)

console.log(`\n✓ 발행 업로드 — ${rows.length}페이지 → ${BUCKET}/pd/${SLUG}/ (공개 URL) · pd_comic_panels 갱신`)
console.log(`  이제 콘솔 '발행' 버튼이 열립니다(콘텐츠 서빙 ✓).`)
