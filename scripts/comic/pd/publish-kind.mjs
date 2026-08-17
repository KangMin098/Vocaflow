// scripts/comic/pd/publish-kind.mjs
//
// 유형 하나를 발행 직전까지 밀어 올린다 — 현대화(page-modern) → 스토리지 업로드(publish-upload).
//
//   node scripts/comic/pd/publish-kind.mjs --kind war [--limit 20] [--dry-run]
//   node scripts/comic/pd/publish-kind.mjs --series atomic-war --source restored   ← 원본 그대로
//
// `--source restored` = 현대화를 건너뛰고 **복원 원본**을 그대로 올린다.
//   현대화(page-modern)는 화이트포인트·평면컬러로 "모던 웹툰" 느낌을 만드는 별도 판단이다.
//   원작 인쇄 질감을 그대로 보여주는 편이 낫다고 볼 수도 있고, 무엇보다 **먼저 읽히는 것**이
//   먼저다. 복원 단계는 이미 여백 크롭·탈황변·디노이즈·2배 업스케일을 마친 상태라
//   그대로 읽을 수 있다.
//
// ── 왜 "유형 단위" 인가 ──────────────────────────────────────────
//   학습자 서가(/comics/restored)는 유형별로 묶여 나간다. 여러 유형을 조금씩 올리면
//   어느 묶음도 완성되지 않고, 서가에는 반쯤 빈 칸만 늘어난다. 유형 하나를 끝내면
//   그 묶음이 통째로 도착한다.
//
// ── 이 스크립트가 하지 "않는" 것: PD 근거 확정 ───────────────────
//   `pd_basis` 를 자동으로 채우지 않는다. 1930~1963 발행물이 PD 인지는 **저작권 갱신 기록을
//   실제로 확인해야 알 수 있는 법적 판단**이고, 그 확인 없이 값을 넣는 것은 근거를 지어내는 것이다.
//   DB 게이트(pd_issues_publish_gate)가 존재하는 이유가 정확히 이것이라, 스크립트가 우회하면
//   게이트는 장식이 된다. 여기서는 **게이트 앞까지만** 밀고, 무엇이 남았는지 보고한다.
//   확정은 사람이 /admin/pd-comics 또는 POST /api/pdcp/publish {action:'confirm-pd'} 로 한다.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : process.argv[i + 1] }
const has = (n) => process.argv.includes(`--${n}`)
const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
const REPO = path.resolve(HERE, '..', '..', '..')

const KIND = arg('kind')
const SERIES = arg('series')
const LIMIT = Number(arg('limit', 50))
const DRY = has('dry-run')
// page-modern(현대화 산출물) | restored(복원 원본 그대로)
const SOURCE_DIR = String(arg('source', 'page-modern'))
const SKIP_MODERN = SOURCE_DIR !== 'page-modern'
if (!KIND && !SERIES) {
  console.error('사용법: --kind <유형키> 또는 --series <시리즈키> [--limit N] [--dry-run]')
  process.exit(2)
}

// env
const envPath = path.join(REPO, 'apps', 'web', '.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('✗ Supabase env 없음 (apps/web/.env.local)'); process.exit(1)
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

let q = db.from('pd_comic_issues')
  .select('id, slug, title, status, qc, pd_basis, pd_checked_at, source_url, panels_total, issue_no, series_key')
  .in('status', ['ocr', 'review'])
if (KIND) q = q.eq('kind', KIND)
if (SERIES) q = q.eq('series_key', SERIES)
const { data: issues, error } = await q
  .order('series_key', { ascending: true })
  .order('issue_no', { ascending: true, nullsFirst: false })
  .limit(LIMIT)
if (error) { console.error(`✗ 조회 실패: ${error.message}`); process.exit(1) }
if (!issues?.length) { console.log('대상 없음 (status=ocr|review 인 호가 없습니다)'); process.exit(0) }

console.log(`\n발행 준비 ${DRY ? '[계획만]' : ''} — ${KIND ?? SERIES} · ${issues.length}건`)
console.log(`  이미지 출처   ${SOURCE_DIR}${SKIP_MODERN ? ' (현대화 건너뜀 — 복원 원본 그대로)' : ''}\n`)

const run = (script, args) => spawnSync(process.execPath, [path.join(HERE, script), ...args], { encoding: 'utf8', cwd: REPO })

let modernized = 0, uploaded = 0, failed = 0
const blocked = []

for (const iss of issues) {
  const wd = iss.qc?.workDir
  if (!wd || !fs.existsSync(wd)) {
    console.log(`  ⊘ ${iss.title} — work 디렉터리 없음(드레인 먼저)`); failed++; continue
  }
  console.log(`━━ ${iss.title}`)

  if (DRY) {
    const hasModern = fs.existsSync(path.join(wd, 'page-modern'))
    console.log(`   현대화 ${hasModern ? '이미 있음' : '필요'} · 업로드 필요 · PD근거 ${iss.pd_basis ?? '없음'}`)
    if (!iss.pd_basis) blocked.push(iss)
    continue
  }

  // ① 현대화 — ffmpeg 만 쓴다(GPU·모델 없음). 원작 페이지 구성은 100% 보존.
  //    `--source restored` 면 건너뛴다(복원 원본을 그대로 발행).
  if (!SKIP_MODERN) {
    const mDir = path.join(wd, 'page-modern')
    const already = fs.existsSync(mDir) && fs.readdirSync(mDir).filter((f) => /^\d+\.jpg$/i.test(f)).length > 0
    if (!already) {
      const r = run('page-modern.mjs', ['--workdir', wd])
      if (r.status !== 0) {
        console.error(`   ✗ 현대화 실패: ${(r.stderr || r.stdout || '').split('\n').slice(-2).join(' ')}`)
        failed++; continue
      }
      modernized++
      console.log(`   ✓ 현대화`)
    } else {
      console.log(`   · 현대화 (이미 있음)`)
    }
  }

  // 업로드할 이미지가 실제로 있는지 먼저 본다 — 없으면 업로드가 "0장 성공"으로 끝나
  // 컷 0개짜리 호가 발행 준비 완료로 보인다.
  const srcDir = path.join(wd, SOURCE_DIR)
  const srcCount = fs.existsSync(srcDir)
    ? fs.readdirSync(srcDir).filter((f) => /^\d+\.jpe?g$/i.test(f)).length
    : 0
  if (srcCount === 0) {
    console.error(`   ✗ 업로드할 이미지 없음: ${SOURCE_DIR}/`)
    failed++; continue
  }

  // ② 스토리지 업로드 — 컷 image_url 을 공개 URL 로. 이게 되어야 학습자에게 서빙된다.
  const u = run('publish-upload.mjs', ['--workdir', wd, '--slug', iss.slug, '--issue-id', iss.id, '--dir', SOURCE_DIR])
  if (u.status !== 0) {
    console.error(`   ✗ 업로드 실패: ${(u.stderr || u.stdout || '').split('\n').filter(Boolean).slice(-2).join(' ')}`)
    failed++; continue
  }
  uploaded++
  console.log(`   ✓ 업로드 — ${(u.stdout || '').split('\n').filter((l) => l.includes('발행 업로드')).join('')}`)

  // 검수 대기로 올려 둔다(발행은 PD 확정 후 사람이).
  await db.from('pd_comic_issues').update({ status: 'review' }).eq('id', iss.id)
  if (!iss.pd_basis) blocked.push(iss)
}

console.log(`\n── 요약 ─────────────────────────────`)
console.log(`  현대화 ${modernized} · 업로드 ${uploaded} · 실패 ${failed}`)

if (blocked.length) {
  console.log(`\n⚠️ PD 근거 미확정 ${blocked.length}건 — **이 상태로는 발행되지 않습니다**(DB 게이트).`)
  console.log(`   1930~1963 발행물은 저작권 갱신 기록을 확인해야 PD 여부가 정해집니다.`)
  console.log(`   확인처: Stanford Copyright Renewal Database · Catalog of Copyright Entries`)
  console.log(`   확정: /admin/pd-comics 또는 POST /api/pdcp/publish {issueId, action:'confirm-pd', pdBasis:'no-renewal'}`)
  blocked.slice(0, 10).forEach((b) => console.log(`     · ${b.slug}  ${b.title.slice(0, 60)}`))
  if (blocked.length > 10) console.log(`     … 외 ${blocked.length - 10}건`)
}
console.log(`\n다음: PD 근거 확정 → 발행하면 /comics/restored 유형 묶음에 나타납니다.`)
