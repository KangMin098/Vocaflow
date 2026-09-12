// scripts/comic/model-runners.mjs
// CCP 모델 → 러너 매핑 (환경별 실행 오케스트레이션 SSoT).
//   backend prefix 로 gen 스크립트 + 워크플로 + 지원 환경 + argv 조립을 해석.
//   adapter 별 CLI 계약이 다르므로(gen-comfy: --wf-gen/--wf-edit/--vlevel · gen-flux2: --style ·
//   gen-gptimage: --api) argv 조립을 러너가 소유한다 → 오케스트레이터는 buildRunnerArgs 만 호출.

export const RUNNERS = [
  {
    key: 'flux2', // flux2-dev / flux2-pro(pro는 API 별도)
    match: /^flux2/,
    adapter: 'flux2', // gen-flux2.mjs (인라인 FLUX.2 로더 하드코딩 — 외부 wf 미로드)
    script: 'scripts/comic/gen-flux2.mjs',
    workflow: 'scripts/comic/wf/flux2-dev.api.json',
    envs: ['runpod-4090'], // FLUX.2 dev 19GB > Kaggle T4 16GB → RunPod 전용
    note: 'GGUF Q4 + Turbo LoRA + mistral + flux2-vae. FLUX.2 dev 19GB → RunPod 전용',
  },
  {
    key: 'qwen', // qwen-image-edit-2511/2509
    match: /^qwen/,
    adapter: 'comfy', // gen-comfy.mjs 범용 ComfyUI 어댑터(노드타이틀 주입 PROMPT/NEG/SIZE/REFIMAGE)
    script: 'scripts/comic/gen-comfy.mjs',
    wfGen: 'scripts/comic/wf/qwen-t2i-lightning.api.json',   // t2i(레퍼런스 시트 + noref 컷) — Q3 base + 4step
    wfEdit: 'scripts/comic/wf/qwen-edit-lightning.api.json', // edit(레퍼런스 조건부 — REFIMAGE 노드) — 2511 edit + 8step
    wfEditEnvs: ['runpod-4090'], // edit 모델(2511 Q5)은 VRAM·용량↑ → 4090 만 프로비저닝. Kaggle T4 = t2i-only(검증됨).
    envs: ['runpod-4090', 'kaggle-t4'],
    note: 'Qwen-Image GGUF Q3 + Lightning. Kaggle=t2i-only(검증) · RunPod=참조 시트→edit 캐릭터락.',
  },
  {
    key: 'zimage',
    match: /^z-?image/,
    adapter: 'comfy',
    script: 'scripts/comic/gen-comfy.mjs',
    wfGen: 'scripts/comic/wf/zimage-turbo.api.json',
    wfEdit: null, // t2i only(edit 워크플로 없음 → 전 컷 noref)
    envs: ['runpod-4090', 'kaggle-t4'],
    note: 'Z-Image Turbo t2i(경량). edit 미지원 → noref 전용. 스타일/캐릭터 LoRA 권장.',
  },
  {
    key: 'sd35',
    match: /^(sd35|hidream)/,
    adapter: 'comfy',
    script: 'scripts/comic/gen-comfy.mjs',
    wfGen: null, // 모델별 wf 추가 필요(미구현)
    wfEdit: null,
    envs: ['runpod-4090', 'kaggle-t4'],
    note: '자가호스트 ComfyUI. 워크플로(api.json) 추가 필요 — wfGen 미정의 시 실행 차단.',
  },
  {
    key: 'gpt', // gpt-image-1/2
    match: /^gpt/,
    adapter: 'api',
    script: 'scripts/comic/gen-gptimage.mjs',
    workflow: null,
    envs: ['api'],
    note: 'OpenAI images.edits 다중참조 (API)',
  },
]

/** backend → 러너 해석. 없으면 null. */
export function resolveRunner(backend) {
  if (!backend) return null
  return RUNNERS.find((r) => r.match.test(backend)) ?? null
}

/**
 * 러너별 CLI argv(스크립트 이후 인자) 조립. adapter 계약 차이를 여기서 흡수.
 * ctx: { script, outDir, env?, panels?, comfy?, vlevel?, styleInk?, styleNeg?, styleName? }
 * comfy adapter 는 wfGen 필수(미정의 시 throw) — 오케스트레이터가 잡아 명확히 실패시킨다.
 * wfEdit 는 wfEditEnvs 로 환경 게이팅(예: edit 모델 미프로비저닝 Kaggle 에선 t2i-only).
 */
export function buildRunnerArgs(runner, ctx) {
  const { script, outDir, env, panels, comfy, vlevel, styleInk, styleNeg, styleName, styleFormat } = ctx
  const a = ['--script', script, '--out', outDir]
  if (runner.adapter === 'comfy') {
    if (!runner.wfGen) throw new Error(`${runner.key} 러너 워크플로(wfGen) 미정의 — wf/*.api.json 추가 필요`)
    a.push('--wf-gen', runner.wfGen)
    const editOk = runner.wfEdit && (!runner.wfEditEnvs || !env || runner.wfEditEnvs.includes(env))
    if (editOk) a.push('--wf-edit', runner.wfEdit)
    if (vlevel != null) a.push('--vlevel', String(vlevel))
    // 선택 화풍: DB comic_styles art_prompt/negative_prompt 를 ink/negExtra 로 직접 주입.
    if (styleInk) { a.push('--style-ink', styleInk); if (styleNeg) a.push('--style-neg', styleNeg) }
    if (styleName) a.push('--style', styleName)
    if (styleFormat) a.push('--format', styleFormat) // 구성 방식 → 컷 종횡비
  } else if (runner.adapter === 'flux2') {
    // gen-flux2 는 인라인 프리셋만(gonick/webtoon) — DB 임의 스타일 키는 gonick 로 폴백(오작동 방지).
    a.push('--style', ['gonick', 'webtoon'].includes(styleName) ? styleName : 'gonick')
  }
  if (panels && panels.length) a.push('--panels', panels.join(','))
  if (runner.adapter !== 'api' && comfy) a.push('--comfy', comfy)
  return a
}

/** 환경별 ComfyUI URL 힌트(자가호스트). api 는 벤더 REST. */
export const ENV_INFO = {
  'runpod-4090': { vramGb: 24, connect: 'COMFY_URL(.comfy-url) — ai-dock 폼로그인 :8188' },
  'kaggle-t4': { vramGb: 16, connect: 'COMFY_URL = cloudflared 터널 공개 URL (setup-comfyui-comic.py)' },
  api: { vramGb: null, connect: '벤더 REST(.openai-token 등)' },
}
