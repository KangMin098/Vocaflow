// scripts/comic/kaggle/kaggle-auto-test.mjs
// CCP Kaggle 완전 headless 자동 테스트 — 로컬에서 컷별 워크플로를 정확히 계산(comic-prompt.mjs +
// DB comic_styles) → 자기완결 GPU 커널(ComfyUI localhost)로 임베드 → Bearer push → 폴링 → 이미지 pull.
// 터널 불필요(커널 내부 localhost 생성) · 파이프라인과 동일한 프롬프트 로직.
//
//   node scripts/comic/kaggle/kaggle-auto-test.mjs \
//     --script scripts/comic/examples/carol-stave1.adapted.json \
//     --style edu-factual-cartoon-bw --panels 6,10,18 [--poll] [--slug vocaflow-comic-test]
//
//   --poll 없으면 push 후 slug 만 출력(나중에 --status/--pull). --poll 이면 완료까지 대기 + out/ 로 pull.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { negForLevel, panelDims, panelPromptText, styleForLevel, GONICK, WEBTOON, REALISTIC } from '../comic-prompt.mjs'

// ── env (Supabase 스타일 조회용) ──
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const l of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); if (i === -1) return d; const v = process.argv[i + 1]; return v && !v.startsWith('--') ? v : true }
const has = (n) => process.argv.includes(`--${n}`)

// ── Kaggle 자격증명(Bearer) ──
const kj = (() => { try { return JSON.parse(fs.readFileSync(path.join(os.homedir(), '.kaggle', 'kaggle.json'), 'utf8')) } catch { return {} } })()
const KUSER = (process.env.KAGGLE_USERNAME || kj.username || '').trim()
const KKEY = (process.env.KAGGLE_KEY || kj.key || '').trim()
if (!KUSER || !KKEY) { console.error('✗ Kaggle 자격증명 없음 (~/.kaggle/kaggle.json)'); process.exit(2) }
const KH = { Authorization: `Bearer ${KKEY}`, 'Content-Type': 'application/json' }
const KAPI = 'https://www.kaggle.com/api/v1'

const SCRIPT = arg('script', 'scripts/comic/examples/carol-stave1.adapted.json')
const PANELS = arg('panels') ? String(arg('panels')).split(',').map(Number) : [6, 10, 18]
const STYLE_KEY = arg('style')
const SLUG_NAME = String(arg('slug', 'vocaflow-comic-test'))
const SLUG = `${KUSER.toLowerCase()}/${SLUG_NAME}`

// status/pull 전용 모드 (push 없이 조회)
const MODE = has('status') ? 'status' : has('pull') ? 'pull' : 'run'

// Supabase (관측: comic_gen_runs + comic_gen_tests) — 한 번만 생성해 전 경로 공유
const { createClient } = await import('@supabase/supabase-js')
const DB = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }) : null

// 테스트/런 행 종료 처리 — --pull(별도 프로세스) · --poll(동일 프로세스) 양쪽에서 slug 로 조회해 갱신.
async function finalizeTest(pass, total, outDir) {
  if (!DB) return
  try {
    const { data: t } = await DB.from('comic_gen_tests').select('id, params').eq('site', 'kaggle').contains('params', { slug: SLUG_NAME }).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (t) await DB.from('comic_gen_tests').update({ status: pass > 0 ? 'done' : 'failed', result: { pass, total, sample_dir: outDir, kernel_url: t.params?.kernel_url || null } }).eq('id', t.id)
    const rid = t?.params?.run_id
    if (rid) await DB.from('comic_gen_runs').update({ status: pass > 0 ? 'done' : 'failed', panels_done: total, panels_pass: pass, panels_fail: total - pass, finished_at: new Date().toISOString() }).eq('id', rid)
    if (t) console.error(`  test/run 관측 갱신 → ${pass > 0 ? 'done' : 'failed'}`)
  } catch (e) { console.error(`  (finalize skip: ${e.message})`) }
}

async function kget(p) { const r = await fetch(`${KAPI}${p}`, { headers: KH, signal: AbortSignal.timeout(30000) }); return { status: r.status, json: await r.json().catch(() => null), text: null } }
async function kernelStatus() { const r = await fetch(`${KAPI}/kernels/status?userName=${encodeURIComponent(KUSER)}&kernelSlug=${SLUG_NAME}`, { headers: KH, signal: AbortSignal.timeout(30000) }); return r.json() }

async function pullOutput(outDir) {
  const r = await fetch(`${KAPI}/kernels/output?userName=${encodeURIComponent(KUSER)}&kernelSlug=${SLUG_NAME}`, { headers: KH, signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error(`output ${r.status}: ${(await r.text()).slice(0, 200)}`)
  const j = await r.json()
  const files = j.files || []
  fs.mkdirSync(outDir, { recursive: true })
  let got = 0
  for (const f of files) {
    const name = f.fileName || f.name || ''
    const isImg = /\.(jpg|jpeg|png)$/i.test(name)
    const isDiag = /_comfy\.log$|_manifest\.json$/i.test(name) // 진단 파일도 함께 pull(실패 원인 자가진단)
    if (!isImg && !isDiag) continue
    const url = f.url || f.downloadUrl
    if (!url) continue
    const d = await fetch(url, { headers: KH, signal: AbortSignal.timeout(120000) })
    if (!d.ok) { console.error(`  ✗ ${name} ${d.status}`); continue }
    const buf = Buffer.from(await d.arrayBuffer())
    fs.writeFileSync(path.join(outDir, path.basename(name)), buf)
    console.error(`  ${isImg ? '✓' : '·'} ${path.basename(name)} ${(buf.length / 1024).toFixed(0)}KB`); if (isImg) got++
  }
  if (j.log) fs.writeFileSync(path.join(outDir, '_kernel.log'), typeof j.log === 'string' ? j.log : JSON.stringify(j.log, null, 2))
  return { got, total: files.length }
}

// ── status/pull 조기 분기 ──
if (MODE === 'status') { const s = await kernelStatus(); console.log(JSON.stringify(s, null, 2)); process.exit(0) }
if (MODE === 'pull') {
  const outDir = path.resolve(`out/kaggle-${SLUG_NAME}`)
  const s = await kernelStatus(); console.error(`status: ${s.status}${s.failureMessage ? ' · ' + s.failureMessage : ''}`)
  const { got, total } = await pullOutput(outDir)
  await finalizeTest(got, PANELS.length, outDir)
  console.error(`\n✓ ${got} 이미지 pull · ${outDir} (총 파일 ${total})`); process.exit(got > 0 ? 0 : 1)
}

// ── 스타일 해석(DB) ──
let STYLE_OBJ = null, styleLabel = 'level-default'
if (STYLE_KEY) {
  const named = { gonick: GONICK, webtoon: WEBTOON, realistic: REALISTIC }
  if (named[STYLE_KEY]) { STYLE_OBJ = named[STYLE_KEY]; styleLabel = STYLE_KEY }
  else if (DB) {
    const { data: st } = await DB.from('comic_styles').select('key,name,art_prompt,negative_prompt').eq('key', STYLE_KEY).maybeSingle()
    if (!st) { console.error(`✗ 스타일 없음: ${STYLE_KEY}`); process.exit(1) }
    STYLE_OBJ = { register: st.key, ink: st.art_prompt, negExtra: st.negative_prompt || styleForLevel(6).negExtra }
    styleLabel = `${st.name} (${st.key})`
  } else { console.error('✗ 스타일 조회 불가(Supabase env 없음) — 명명 프리셋만 가능'); process.exit(1) }
}

// ── 각색 스크립트 + 컷별 워크플로 계산(t2i-only, noref) ──
const script = JSON.parse(fs.readFileSync(path.resolve(SCRIPT), 'utf8'))
const cast = script.cast || []
const byId = Object.fromEntries(cast.map((c) => [c.id, c]))
const VLEVEL = script.adaptation?.target_v_level ?? 6
const NEG_L = negForLevel(VLEVEL, STYLE_OBJ)
const wfTemplate = JSON.parse(fs.readFileSync(path.resolve('scripts/comic/wf/qwen-t2i-lightning.api.json'), 'utf8'))
const titleOf = (n) => (n && n._meta && n._meta.title) || ''
function fill(prompt, w, h) {
  const wf = JSON.parse(JSON.stringify(wfTemplate)); delete wf._note
  for (const n of Object.values(wf)) {
    const t = titleOf(n).toLowerCase()
    if (t.includes('prompt') && !t.includes('neg')) { if ('text' in (n.inputs || {})) n.inputs.text = prompt }
    else if (t.includes('neg')) { if ('text' in (n.inputs || {})) n.inputs.text = NEG_L }
    else if (t.includes('size')) { if ('width' in (n.inputs || {})) n.inputs.width = w; if ('height' in (n.inputs || {})) n.inputs.height = h }
    if (n.class_type === 'KSampler' && n.inputs && 'seed' in n.inputs) n.inputs.seed = Math.floor(Math.random() * 1e15)
  }
  return wf
}
const panelById = Object.fromEntries((script.panels || []).map((p) => [p.n, p]))
const manifest = []
for (const n of PANELS) {
  const p = panelById[n]; if (!p) { console.error(`! 컷 ${n} 없음 — skip`); continue }
  const ids = (p.characters || []).filter((id) => byId[id])
  const chars = ids.map((id) => byId[id])
  const d = panelDims(p)
  const text = panelPromptText(p, chars, { noref: true, vlevel: VLEVEL, style: STYLE_OBJ })
  manifest.push({ n, wf: fill(text, d.w, d.h) })
}
if (!manifest.length) { console.error('✗ 생성할 컷 없음'); process.exit(1) }
console.error(`▶ Kaggle headless 테스트 · 컷 ${manifest.map((m) => m.n).join(',')} · 스타일 ${styleLabel} · V-Level ${VLEVEL}`)

// ── 자기완결 커널(Python) 생성 ──
const b64 = Buffer.from(JSON.stringify(manifest)).toString('base64')
const KERNEL = `# vocaflow CCP headless comic test — auto-generated (do not edit)
import os, subprocess, sys, time, json, base64, urllib.request, urllib.parse
os.makedirs('/kaggle/working/out', exist_ok=True)
COMFY='/kaggle/tmp/ComfyUI'; os.makedirs('/kaggle/tmp', exist_ok=True)
def sh(*a, **k): return subprocess.run(list(a), **k)
if not os.path.isdir(COMFY):
    sh('git','clone','--depth','1','https://github.com/comfyanonymous/ComfyUI', COMFY)
if not os.path.isdir(COMFY+'/custom_nodes/ComfyUI-GGUF'):
    sh('git','clone','--depth','1','https://github.com/city96/ComfyUI-GGUF', COMFY+'/custom_nodes/ComfyUI-GGUF')
# torch 버전 스퀴즈: (a) P100(sm_60)은 torch<=2.6 필요(2.10+cu128이 sm_60 드롭) (b) Kaggle 프리인스톨
# comfy_kitchen(ComfyUI master가 import)은 list[int] custom_op = torch>=2.6 필요. 교집합 = torch 2.6.0.
sh(sys.executable,'-m','pip','-q','install','torch==2.6.0','torchvision==0.21.0','--index-url','https://download.pytorch.org/whl/cu124')
# requirements 는 torch/vision/audio 제외 설치(위 고정 torch 유지)
_lines=open(COMFY+'/requirements.txt').read().splitlines()
def _pk(r): return r.strip().split('==')[0].split('>')[0].split('<')[0].split('~')[0].split(';')[0].strip().lower()
_req=[r for r in _lines if r.strip() and not r.strip().startswith('#') and _pk(r) not in ('torch','torchvision','torchaudio')]
open('/kaggle/tmp/req.txt','w').write('\\n'.join(_req))
sh(sys.executable,'-m','pip','-q','install','-r','/kaggle/tmp/req.txt','gguf','huggingface_hub')
import torch; print('GPU:', torch.cuda.get_device_name(0), 'cc', torch.cuda.get_device_capability(0), 'torch', torch.__version__, flush=True)
from huggingface_hub import hf_hub_download, list_repo_files
def grab(repo, needle, sub, outname):
    cs=[f for f in list_repo_files(repo) if needle.lower() in f.lower() and f.lower().endswith(('.gguf','.safetensors'))]
    cs.sort(key=lambda f:(0 if 'bf16' in f.lower() else 1, len(f)))
    if not cs: print('!! no match', repo, needle); return
    f=hf_hub_download(repo, cs[0]); d=COMFY+'/models/'+sub; os.makedirs(d, exist_ok=True)
    dst=d+'/'+outname
    if os.path.lexists(dst): os.remove(dst)
    os.symlink(f, dst); print('ok', os.path.getsize(f)//1048576,'MB', cs[0],'->',outname)
grab('city96/Qwen-Image-gguf','Q3_K_S','unet','qwen-image-Q3_K_S.gguf')
grab('chatpig/qwen2.5-vl-7b-it-gguf','Q4_K_M','text_encoders','qwen2.5-vl-7b-it-q4_k_m.gguf')
grab('chatpig/qwen2.5-vl-7b-it-gguf','mmproj','text_encoders','mmproj-qwen2.5-vl-7b-it-bf16.gguf')
grab('Comfy-Org/Qwen-Image_ComfyUI','qwen_image_vae','vae','qwen_image_vae.safetensors')
grab('lightx2v/Qwen-Image-Lightning','4steps','loras','Qwen-Image-Lightning-4steps-V1.0-bf16.safetensors')
sh('pkill','-f','main.py'); time.sleep(2)
subprocess.Popen([sys.executable,'-u','main.py','--listen','127.0.0.1','--port','8188','--lowvram'],
                 cwd=COMFY, stdout=open('/kaggle/working/out/_comfy.log','w'), stderr=subprocess.STDOUT)
def up():
    try: urllib.request.urlopen('http://127.0.0.1:8188/system_stats', timeout=3); return True
    except Exception: return False
for _ in range(90):
    if up(): break
    time.sleep(5)
print('comfy up?', up())
def post(pth, data=None):
    req=urllib.request.Request('http://127.0.0.1:8188'+pth,
        data=(json.dumps(data).encode() if data is not None else None),
        headers={'Content-Type':'application/json'})
    return json.loads(urllib.request.urlopen(req, timeout=180).read())
WF=json.loads(base64.b64decode("${b64}").decode())
results=[]
for item in WF:
    n=item['n']
    try:
        pid=post('/prompt', {'prompt':item['wf'],'client_id':'kag'})['prompt_id']
        img=None; err=None
        for _ in range(240):
            time.sleep(2)
            try: h=post('/history/'+pid)
            except Exception: continue
            if pid in h:
                st=h[pid].get('status',{}) or {}
                if st.get('status_str')=='error': err=str(st.get('messages',''))[:500]; break
                outs=h[pid].get('outputs')
                if outs:
                    imgs=[im for o in outs.values() for im in o.get('images',[])]
                    if imgs: img=imgs[0]; break
        if not img: print('panel',n,'no output',err or ''); results.append({'n':n,'ok':False,'err':err}); continue
        u='http://127.0.0.1:8188/view?'+urllib.parse.urlencode({'filename':img['filename'],'subfolder':img.get('subfolder',''),'type':img.get('type','output')})
        data=urllib.request.urlopen(u, timeout=180).read()
        open('/kaggle/working/out/%02d.jpg'%n,'wb').write(data)
        print('saved panel',n,len(data),'bytes'); results.append({'n':n,'ok':True,'bytes':len(data)})
    except Exception as e:
        print('panel',n,'ERR',e); results.append({'n':n,'ok':False,'err':str(e)})
json.dump(results, open('/kaggle/working/out/_manifest.json','w'))
print('DONE', sum(1 for r in results if r['ok']),'/',len(results))
`
const kernelPath = path.resolve('scripts/comic/kaggle/_gen-kernel.py')
fs.writeFileSync(kernelPath, KERNEL)
console.error(`  커널 생성: ${kernelPath} (${(KERNEL.length / 1024).toFixed(1)}KB)`)

if (has('dry')) {
  console.error(`\n(dry) push 생략. 커널 ${(KERNEL.length / 1024).toFixed(1)}KB · 컷 ${manifest.length}개.`)
  const s0 = manifest[0]; const pn = Object.values(s0.wf).find((n) => (n._meta?.title || '').toLowerCase().includes('prompt') && !(n._meta?.title || '').toLowerCase().includes('neg'))
  console.error(`  컷 ${s0.n} PROMPT(head): ${String(pn?.inputs?.text || '').slice(0, 160)}…`)
  const sz = Object.values(s0.wf).find((n) => (n._meta?.title || '').toLowerCase().includes('size'))
  console.error(`  컷 ${s0.n} SIZE: ${sz?.inputs?.width}x${sz?.inputs?.height}`)
  process.exit(0)
}

// ── observability run 기록 ──
const BOOK_ID = script.library_book_id || '66b084a0-72a1-414a-98ea-3c27308772fc'
let runId = null
if (DB) {
  try {
    const { data } = await DB.from('comic_gen_runs').insert({
      library_book_id: BOOK_ID,
      backend: 'qwen-image-edit-2511', model: 'Qwen-Image GGUF Q3 + Lightning', site: 'kaggle-t4', style: STYLE_KEY || null,
      status: 'running', panels_total: manifest.length, panels_done: 0, note: `[Kaggle headless] ${styleLabel} · slug ${SLUG_NAME}`,
    }).select('id').single()
    runId = data?.id; if (runId) console.error(`  run ${runId.slice(0, 8)} 기록`)
  } catch (e) { console.error(`  (관측 기록 skip: ${e.message})`) }
}

// ── push (Bearer) ──
const body = {
  id: null, slug: SLUG, newTitle: SLUG_NAME, text: KERNEL, language: 'python', kernelType: 'script',
  isPrivate: true, enableGpu: true, enableTpu: false, enableInternet: true,
  datasetDataSources: [], competitionDataSources: [], kernelDataSources: [], modelDataSources: [], categoryIds: [],
}
const pr = await fetch(`${KAPI}/kernels/push`, { method: 'POST', headers: KH, body: JSON.stringify(body), signal: AbortSignal.timeout(60000) })
const pj = await pr.json().catch(() => ({}))
if (!pr.ok || pj.hasError) { console.error(`✗ push ${pr.status}: ${pj.error || JSON.stringify(pj).slice(0, 200)}`); process.exit(1) }
console.error(`✓ push OK · ${pj.url} (v${pj.versionNumber})`)

// ── comic_gen_tests 행(테스트 탭 라이브 모니터링) — kernel_url + slug + run 연결 ──
if (DB) {
  try {
    await DB.from('comic_gen_tests').insert({
      library_book_id: BOOK_ID, label: `[Kaggle] ${path.basename(SCRIPT).replace(/\.adapted\.json$/, '')} · ${styleLabel}`,
      backend: 'qwen-image-edit-2511', model: 'Qwen-Image GGUF Q3 + Lightning', site: 'kaggle', style: STYLE_KEY || null,
      status: 'running', params: { env: 'kaggle-t4', slug: SLUG_NAME, kernel_url: pj.url, panels: PANELS, run_id: runId, vlevel: VLEVEL },
      sample: { panels: PANELS }, note: `headless GPU · ${styleLabel} · 컷 ${PANELS.join(',')}`,
    })
    console.error('  test 기록(관리자 → 테스트 탭에서 모니터링) · kernel_url 링크 포함')
  } catch (e) { console.error(`  (test 기록 skip: ${e.message})`) }
}

if (!has('poll')) {
  console.error(`\n  진행 확인:  node scripts/comic/kaggle/kaggle-auto-test.mjs --status --slug ${SLUG_NAME}`)
  console.error(`  결과 pull:  node scripts/comic/kaggle/kaggle-auto-test.mjs --pull   --slug ${SLUG_NAME}`)
  process.exit(0)
}

// ── poll until complete ──
console.error('  폴링(완료까지 대기 · GPU 큐+셋업+생성으로 10~40분 소요 가능)…')
const t0 = Date.now()
let final = null
for (let i = 0; i < 240; i++) { // 최대 ~2h
  await new Promise((z) => setTimeout(z, 30000))
  let s; try { s = await kernelStatus() } catch { continue }
  const el = Math.round((Date.now() - t0) / 60000)
  process.stderr.write(`\r  [${el}m] status=${s.status}        `)
  if (['complete', 'error', 'cancelAcknowledged'].includes(String(s.status))) { final = s; break }
}
console.error('')
if (!final) { console.error('✗ 폴링 타임아웃 — 나중에 --status/--pull 로 확인'); process.exit(1) }
const outDir = path.resolve(`out/kaggle-${SLUG_NAME}`)
if (final.status !== 'complete') { console.error(`✗ 커널 ${final.status}: ${final.failureMessage || ''}`); await finalizeTest(0, manifest.length, outDir); process.exit(1) }

const { got } = await pullOutput(outDir)
await finalizeTest(got, manifest.length, outDir)
console.error(`\n✓ 완료 · ${got}/${manifest.length} 이미지 · ${outDir}`)
console.error('  → Claude Code 가 이미지를 열어 엄격 루브릭(캐릭터/화풍/텍스트-free/정본) 채점')
process.exit(got > 0 ? 0 : 1)
