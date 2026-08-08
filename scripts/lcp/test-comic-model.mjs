// scripts/lcp/test-comic-model.mjs
// CCP 자동 테스트 오케스트레이터 — 모델×환경 dispatch → 샘플 생성 → 관측 기록 → 엄격 루브릭 채점 유도.
//   자가호스트 우선: 모델 run_envs 로 환경 제약 검증 후 러너(gen-*.mjs) 실행.
//
//   node scripts/lcp/test-comic-model.mjs --model flux2-dev --env runpod-4090 \
//        --script scripts/comic/examples/carol-stave1.adapted.json --panels 6,10,18 [--comfy URL] [--run]
//
//   --run 없으면 계획/명령만 출력(dry). 실제 생성엔 COMFY_URL(자가호스트) 또는 API 키 필요.
//   생성 후 comic_gen_runs + comic_panel_events 기록. 이미지 품질(캐릭터/화풍/텍스트-free/정본)
//   엄격 채점은 Claude Code(드레인 오퍼레이터)가 샘플을 보고 comic_gen_tests.result 에 기록.

import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { resolveRunner, ENV_INFO } from '../comic/model-runners.mjs'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i === -1 ? d : (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) }
const MODEL = arg('model'), ENV = arg('env', 'runpod-4090'), SCRIPT = arg('script'), BOOK = arg('book')
const PANELS = arg('panels') ? String(arg('panels')).split(',').map(Number) : [1, 2, 3]
const DO_RUN = !!arg('run')
if (!MODEL) { console.error('--model KEY 필수 (comic_gen_models.key)'); process.exit(2) }

// 1) 모델 + 환경 제약 검증
const { data: m } = await db.from('comic_gen_models').select('*').eq('key', MODEL).maybeSingle()
if (!m) { console.error(`모델 없음: ${MODEL}`); process.exit(1) }
if (!(m.run_envs || []).includes(ENV)) {
  console.error(`✗ 선택 제약 위반: ${MODEL} 은 ${ENV} 에서 실행 불가. 가능 환경: ${(m.run_envs || []).join(', ') || '(없음)'}`)
  process.exit(1)
}
const runner = resolveRunner(MODEL)
if (!runner) { console.error(`✗ 러너 미구현: ${MODEL}`); process.exit(1) }
console.error(`▶ ${m.name} · env=${ENV}(${ENV_INFO[ENV]?.connect}) · runner=${runner.script}`)
console.error(`  샘플 컷: ${PANELS.join(',')} · fit ${m.comic_fit} · min_vram ${m.min_vram_gb ?? '-'}GB`)

// 스타일(선택): art_prompt 해석 → 생성 화풍 고정
const STYLE = arg('style')
let style = null
if (STYLE) {
  const { data: st } = await db.from('comic_styles').select('key, name, format, genre, palette, art_prompt, negative_prompt').eq('key', STYLE).maybeSingle()
  if (!st) { console.error(`✗ 스타일 없음: ${STYLE}`); process.exit(1) }
  style = st
  console.error(`  스타일: ${st.name} (${st.format}/${st.genre}/${st.palette})`)
  console.error(`    art_prompt: ${(st.art_prompt || '').slice(0, 90)}...`)
}

const bookId = BOOK || '66b084a0-72a1-414a-98ea-3c27308772fc' // Carol default
const adapted = SCRIPT || 'scripts/comic/examples/carol-stave1.adapted.json'
const outDir = path.resolve(`out/test-${MODEL}-${Date.now() % 1e6}`)

// 2) run 기록 시작
const { data: runRow } = await db.from('comic_gen_runs').insert({
  library_book_id: bookId, backend: m.key, model: m.name, site: ENV, style: style?.key ?? null,
  status: 'running', panels_total: PANELS.length, panels_done: 0,
  note: `[테스트] ${ENV} 샘플${style ? ` · 스타일 ${style.name}` : ''}`,
}).select('id').single()
console.error(`  run ${runRow?.id?.slice(0, 8)} 시작`)

// 3) gen 명령
const comfy = arg('comfy') || (fs.existsSync('scripts/comic/.comfy-url') ? fs.readFileSync('scripts/comic/.comfy-url', 'utf8').trim() : null)
const cmd = ['node', runner.script, '--script', adapted, '--out', outDir, '--style', 'gonick', '--panels', PANELS.join(',')]
if (ENV !== 'api' && comfy) cmd.push('--comfy', comfy)
console.error(`\n  $ ${cmd.join(' ')}`)

if (!DO_RUN) {
  console.error('\n(dry) --run 으로 실제 생성. 자가호스트는 COMFY_URL(.comfy-url/--comfy) 필요.')
  await db.from('comic_gen_runs').update({ status: 'queued', note: 'dry-plan' }).eq('id', runRow.id)
  process.exit(0)
}
if (ENV !== 'api' && !comfy) { console.error('✗ COMFY_URL 없음 — RunPod/Kaggle ComfyUI 기동 후 .comfy-url 설정'); await db.from('comic_gen_runs').update({ status: 'failed', error: 'no COMFY_URL' }).eq('id', runRow.id); process.exit(1) }

fs.mkdirSync(outDir, { recursive: true })
const r = spawnSync(cmd[0], cmd.slice(1), { stdio: 'inherit' })

// 4) 결과 스캔 + 이벤트 기록
const made = fs.existsSync(outDir) ? fs.readdirSync(outDir).filter((f) => /\.(jpg|png)$/.test(f)) : []
const ev = PANELS.map((n) => {
  const hit = made.find((f) => f.includes(String(n).padStart(2, '0')))
  return { run_id: runRow.id, library_book_id: bookId, chapter_idx: 1, page_order: n, attempt: 1,
    phase: 'gen', status: hit ? 'pass' : 'fail', backend: m.key, message: hit ? path.join(outDir, hit) : '생성 실패' }
})
await db.from('comic_panel_events').insert(ev)
const pass = ev.filter((e) => e.status === 'pass').length
await db.from('comic_gen_runs').update({
  status: r.status === 0 && pass > 0 ? 'done' : 'failed', panels_done: PANELS.length, panels_pass: pass, panels_fail: PANELS.length - pass,
  finished_at: new Date().toISOString(),
}).eq('id', runRow.id)
console.error(`\n✓ 샘플 ${pass}/${PANELS.length} 생성 · ${outDir}`)
console.error('  → Claude Code 가 샘플을 열어 엄격 루브릭(캐릭터/화풍 일관·텍스트-free·정본·해부·비용, pass≥80) 채점 후')
console.error('    comic_gen_tests.result/status 갱신 (관측: comic_gen_runs 기록됨)')
