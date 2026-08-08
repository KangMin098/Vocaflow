// scripts/comic/connect-check.mjs
// CCP 자가호스트 연결 상태 보드 — Kaggle · RunPod · ComfyUI(터널/pod) 연결을 한 번에 점검.
//   모두 READ-ONLY(과금·변경 없음). 자격증명이 준비되면 즉시 ✓ 로 바뀐다.
//
//   node scripts/comic/connect-check.mjs
//
// 자격증명 위치(우선순위):
//   Kaggle  : env KAGGLE_USERNAME+KAGGLE_KEY  ||  ~/.kaggle/kaggle.json  (Create New Token 로 발급)
//   RunPod  : env RUNPOD_API_KEY              ||  scripts/comic/runpod/.runpod-key   (Console→Settings→API Keys)
//   ComfyUI : --comfy <url>                   ||  scripts/comic/.comfy-url            (Kaggle 터널/RunPod 프록시)
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const HERE = import.meta.dirname
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true }
const readMaybe = (p) => { try { return fs.readFileSync(p, 'utf8').trim() } catch { return '' } }
const readJson = (p) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')) } catch { return null } }
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', DIM = '\x1b[2m', X = '\x1b[0m'
const rows = []
const row = (name, ok, detail, hint) => rows.push({ name, ok, detail, hint })

// ── Kaggle (무료 T4 · 인터랙티브 터널) ──
async function checkKaggle() {
  const kj = readJson(path.join(os.homedir(), '.kaggle', 'kaggle.json'))
  const user = process.env.KAGGLE_USERNAME || kj?.username
  const key = process.env.KAGGLE_KEY || kj?.key
  if (!user || !key) return row('Kaggle', null, '자격증명 없음', 'kaggle.com → Settings → API → Create New Token → ~/.kaggle/kaggle.json 저장')
  try {
    const auth = 'Basic ' + Buffer.from(`${user}:${key}`).toString('base64')
    const r = await fetch('https://www.kaggle.com/api/v1/competitions/list?page=1', { headers: { Authorization: auth }, signal: AbortSignal.timeout(20000) })
    if (r.status === 200) return row('Kaggle', true, `연결됨 (user=${user})`)
    if (r.status === 401) return row('Kaggle', false, `토큰 거부(401) user=${user}`, '토큰 만료/무효 — Create New Token 으로 재발급 후 ~/.kaggle/kaggle.json 교체')
    return row('Kaggle', false, `HTTP ${r.status}`, '잠시 후 재시도')
  } catch (e) { return row('Kaggle', false, `네트워크 오류: ${e.message}`) }
}

// ── RunPod (유료 4090 · 헤드리스 pod) ──
async function checkRunpod() {
  const key = (process.env.RUNPOD_API_KEY || readMaybe(path.join(HERE, 'runpod', '.runpod-key'))).trim()
  if (!key) return row('RunPod', null, 'API 키 없음', 'runpod.io → Settings → API Keys → 생성 → scripts/comic/runpod/.runpod-key 저장(또는 env RUNPOD_API_KEY)')
  try {
    const r = await fetch('https://rest.runpod.io/v1/pods', { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(20000) })
    if (r.status === 200) {
      const pods = await r.json().catch(() => [])
      const list = Array.isArray(pods) ? pods : (pods?.pods || [])
      const running = list.filter((p) => (p.desiredStatus || '').toUpperCase() === 'RUNNING')
      const detail = list.length ? `연결됨 · pod ${list.length}개(RUNNING ${running.length})` : '연결됨 · pod 없음(cold start 필요)'
      return row('RunPod', true, detail, list.length ? undefined : 'pod.mjs 로 생성(과금 — 확인 후)')
    }
    if (r.status === 401) return row('RunPod', false, '키 거부(401)', '키 무효 — 재발급 후 .runpod-key 교체')
    return row('RunPod', false, `HTTP ${r.status}`)
  } catch (e) { return row('RunPod', false, `네트워크 오류: ${e.message}`) }
}

// ── ComfyUI (Kaggle 터널 또는 RunPod 프록시 — 실제 생성 엔드포인트) ──
async function checkComfy() {
  let url = String(arg('comfy', readMaybe(path.join(HERE, '.comfy-url')))).replace(/\/$/, '')
  if (!url) return row('ComfyUI', null, '.comfy-url 없음', 'Kaggle 셀/RunPod pod 기동 후 공개 URL 을 scripts/comic/.comfy-url 에 저장')
  try {
    const r = await fetch(`${url}/system_stats`, { headers: { Accept: 'application/json' }, redirect: 'manual', signal: AbortSignal.timeout(15000) })
    if (r.status === 200) return row('ComfyUI', true, `가동 중 · ${url.replace(/^https?:\/\//, '')}`)
    if (r.status >= 300 && r.status < 400) return row('ComfyUI', false, `로그인 리다이렉트(${r.status})`, 'ai-dock 폼로그인 필요 — gen-comfy 는 --user/--pass 로 자동 처리(pod 기동은 됨)')
    return row('ComfyUI', false, `HTTP ${r.status} · ${url.replace(/^https?:\/\//, '')}`, 'URL 만료/서버 미기동 — 재기동 후 .comfy-url 갱신')
  } catch (e) { return row('ComfyUI', false, `도달 불가: ${e.message}`, 'URL 만료/오프라인 — 새 URL 로 갱신') }
}

await Promise.all([checkKaggle(), checkRunpod(), checkComfy()])

console.log(`\n  CCP 자가호스트 연결 상태  ${DIM}(read-only · 과금 없음)${X}\n`)
for (const { name, ok, detail, hint } of rows) {
  const mark = ok === true ? `${G}✓${X}` : ok === false ? `${R}✗${X}` : `${Y}○${X}`
  console.log(`  ${mark}  ${name.padEnd(9)} ${detail}`)
  if (hint) console.log(`       ${DIM}↳ ${hint}${X}`)
}
const ready = rows.filter((r) => r.ok === true).map((r) => r.name)
const need = rows.filter((r) => r.ok !== true).map((r) => r.name)
console.log(`\n  준비됨: ${ready.join(', ') || '(없음)'}${need.length ? ` · 대기: ${need.join(', ')}` : ' · 전부 준비 완료 🎉'}\n`)
process.exit(0)
