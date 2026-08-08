// scripts/comic/model-runners.mjs
// CCP 모델 → 러너 매핑 (환경별 실행 오케스트레이션 SSoT).
//   backend prefix 로 gen 스크립트 + 워크플로 + 지원 환경을 해석.

export const RUNNERS = [
  {
    match: /^flux2/, // flux2-dev / flux2-pro(pro는 API 별도)
    script: 'scripts/comic/gen-flux2.mjs',
    workflow: 'scripts/comic/wf/flux2-dev.api.json',
    envs: ['runpod-4090', 'kaggle-t4'],
    note: 'GGUF Q4 + Turbo LoRA + mistral + flux2-vae. FLUX.2 dev 19GB→RunPod 권장',
  },
  {
    match: /^qwen/, // qwen-image-edit-2511/2509
    script: 'scripts/comic/gen-flux2.mjs', // ComfyUI 공통 러너(워크플로 교체)
    workflow: 'scripts/comic/wf/qwen-2512.api.json',
    envs: ['runpod-4090', 'kaggle-t4'],
    note: 'Qwen-Image-Edit fp8/GGUF + ControlNet. 다중참조 캐릭터락',
  },
  {
    match: /^(sd35|hidream|z-image)/,
    script: 'scripts/comic/gen-flux2.mjs',
    workflow: null, // 모델별 wf 추가 필요
    envs: ['runpod-4090', 'kaggle-t4'],
    note: '자가호스트 ComfyUI. 스타일/캐릭터 LoRA 권장(워크플로 추가 필요)',
  },
  {
    match: /^gpt/, // gpt-image-1/2
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

/** 환경별 ComfyUI URL 힌트(자가호스트). api 는 벤더 REST. */
export const ENV_INFO = {
  'runpod-4090': { vramGb: 24, connect: 'COMFY_URL(.comfy-url) — ai-dock 폼로그인 :8188' },
  'kaggle-t4': { vramGb: 16, connect: 'COMFY_URL = cloudflared 터널 공개 URL (setup-comfyui-comic.py)' },
  api: { vramGb: null, connect: '벤더 REST(.openai-token 등)' },
}
