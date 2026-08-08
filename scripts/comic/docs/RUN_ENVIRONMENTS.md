# CCP 실행 환경(Run Environments) — 자가호스트 우선

> 모든 모델은 자가호스트(RunPod/Kaggle)에서 우선 실행. 모델별 `run_envs` 화이트리스트로 선택 제약.
> 레지스트리: `comic_gen_models.run_envs` = {'runpod-4090','kaggle-t4','api'} · `min_vram_gb`.

## 환경 매트릭스

| 환경 | GPU/VRAM | 비용 | 연결 방식 | 러너 |
|---|---|---|---|---|
| `runpod-4090` | RTX 4090 24GB | ~$0.34-0.69/hr | ComfyUI HTTP(:8188) + ai-dock 폼로그인 | `gen-*.mjs` (COMFY_URL) |
| `kaggle-t4` | T4 16GB (주당 30h 무료) | 무료 | ComfyUI + **cloudflared 터널** → 공개 URL | 동일 `gen-*.mjs` (COMFY_URL=터널) |
| `api` | — | 유료/장 | 벤더 REST | `gen-gptimage.mjs` 등 |

> **핵심**: Kaggle도 ComfyUI를 띄우고 **cloudflared 터널로 공개 URL**을 만들면 RunPod과 **동일한 `gen-*.mjs`가 그대로** 동작(COMFY_URL만 교체). 즉 자가호스트 두 환경이 드롭인 호환.

## 모델 → 러너 매핑 (`scripts/comic/model-runners.mjs`)

| backend(prefix) | 러너 스크립트 | 워크플로우 | 비고 |
|---|---|---|---|
| `flux2-*` | `gen-flux2.mjs` | `wf/flux2-dev.api.json` | GGUF Q4 + Turbo LoRA + mistral + flux2-vae (디폴트) |
| `qwen-*` | `gen-flux2.mjs`(-호환) / 전용 | `wf/qwen-2512.api.json` | Qwen-Image-Edit fp8/GGUF + ControlNet |
| `sd35`,`hidream`,`z-image` | (ComfyUI 워크플로 추가) | `wf/*.api.json` | 자가호스트, LoRA 스타일락 |
| `gpt-*` | `gen-gptimage.mjs` | — | API (images.edits 다중참조) |

## Kaggle 셋업 (자가호스트 무료)

`scripts/comic/kaggle/setup-comfyui-comic.py` 를 Kaggle 노트북 셀에 붙여 실행:
1. ComfyUI + custom nodes(GGUF·ControlNet) 설치
2. 디폴트 모델(flux2-dev-Q4 + Turbo LoRA + mistral fp4 + flux2-vae) 다운로드
3. ComfyUI 서버 기동 + **cloudflared 터널** → 공개 URL 출력
4. 로컬에서 `echo <URL> > scripts/comic/.comfy-url` → `gen-flux2.mjs` 그대로 실행

> Kaggle T4 16GB 제약: flux2-dev Q4(19GB)는 빠듯 → **Kaggle에선 min_vram≤15GB 모델**(Qwen-Edit Q4·SD3.5 Med·Z-Image·HiDream NF4) 권장. FLUX.2 dev(19GB)는 RunPod 4090 전용(`run_envs`가 이미 반영).

## 자동 테스트 오케스트레이터

`scripts/lcp/test-comic-model.mjs <test_id|--model KEY --env ENV --book UUID>`:
1. `comic_gen_tests` 레코드/인자 로드 → 환경·모델·샘플 확인
2. 러너 매핑으로 gen 스크립트 dispatch (샘플 컷 subset 생성)
3. `comic_gen_runs`+`comic_panel_events` 기록(관측 연동)
4. 생성 샘플 경로 출력 → **엄격 사용성 루브릭**(캐릭터/화풍 일관·텍스트-free·정본·해부·비용, pass≥80)을 Claude Code가 채점 → `comic_gen_tests.result`/`status` 갱신

> 이미지 품질 채점은 vision 판단이 필요해 Claude Code(드레인 오퍼레이터)가 수행. 스크립트는 생성·기록·집계까지.
