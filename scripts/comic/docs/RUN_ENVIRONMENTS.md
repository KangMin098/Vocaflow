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

각 러너는 `adapter`(계약 종류) + argv 조립(`buildRunnerArgs`)을 소유 — 오케스트레이터는 조립만 호출.

| backend(prefix) | adapter · 러너 | 워크플로우 | 비고 |
|---|---|---|---|
| `flux2-*` | `flux2` · `gen-flux2.mjs` | `wf/flux2-dev.api.json` | 인라인 FLUX.2 로더. dev 19GB → **RunPod 전용**(`run_envs`) |
| `qwen-*` | `comfy` · `gen-comfy.mjs` | `wf/qwen-t2i-lightning`(+`qwen-edit-lightning`) | Qwen-Image GGUF Q3 + Lightning. 노드타이틀 주입(PROMPT/NEG/SIZE/REFIMAGE) |
| `z-image` | `comfy` · `gen-comfy.mjs` | `wf/zimage-turbo.api.json` | t2i-only(edit wf 없음 → 전 컷 noref) |
| `sd35`,`hidream` | `comfy` · `gen-comfy.mjs` | (wfGen 추가 필요) | wfGen 미정의 시 `buildRunnerArgs`가 실행 차단 |
| `gpt-*` | `api` · `gen-gptimage.mjs` | — | API (images.edits 다중참조) |

### 화풍(edit) 게이팅 — `wfEditEnvs`
`gen-comfy` 는 `--wf-edit` 가 있으면 캐릭터 **레퍼런스 시트→edit 조건화**(동일 얼굴 락), 없으면 **t2i-only**(인라인 묘사).
edit 모델(qwen 2511 Q5)은 VRAM·용량이 커 **RunPod 4090 만 프로비저닝** → `qwen` 러너 `wfEditEnvs:['runpod-4090']`.
따라서 `buildRunnerArgs` 가 **Kaggle=t2i-only, RunPod=edit** 로 자동 분기(`--wf-edit` 부착 여부).

### 스타일 주입
DB `comic_styles.art_prompt`/`negative_prompt` → 오케스트레이터가 `--style-ink`/`--style-neg` 로 전달 →
`gen-comfy` 가 선행 아트 클로즈(ink)+negExtra 로 주입(`comic-prompt.mjs` panelPromptText/refPromptText/negForLevel).
미지정 시 `styleForLevel(vlevel)` 레벨 적응형 기본.

## Kaggle 셋업 (자가호스트 무료 · 검증됨 2026-08)

**경로 A(권장·검증)** — `scripts/comic/kaggle/qwen-lightning-cell.py` 전체를 Kaggle 노트북 셀 1개에 붙여 실행
(Settings: GPU **T4 x2** + Internet **On**):
1. ComfyUI + ComfyUI-GGUF 설치
2. Qwen-Image GGUF **Q3_K_S**(t2i base) + qwen2.5-vl-7b Q4(text enc) + mmproj + vae + **Lightning 4-step LoRA** 다운로드
   — 파일명을 워크플로 참조명으로 **강제 심링크**(대소문자·변형 불일치 → 500 방지)
3. ComfyUI `--lowvram` 기동 + **cloudflared 터널** → 공개 `https://…trycloudflare.com` 출력
4. 로컬: `echo <URL> > scripts/comic/.comfy-url`

> Kaggle T4 16GB = **t2i-only**(검증됨, ~1.5분/컷, API급 flat B&W, $0). 레퍼런스 얼굴 락(edit)은 RunPod 4090.
> 구형 `setup-comfyui-comic.py` 는 다중 모델 프로필용 generic 셋업(qwen 프로필은 경로 A 셀로 대체 권장).

## 경로 A 실행 레시피(라이브)

```bash
# 1) Kaggle: qwen-lightning-cell.py 실행 → 터널 URL 확보
echo https://<xxxx>.trycloudflare.com > scripts/comic/.comfy-url
# 2) 오케스트레이터: 모델×환경×스타일 → 샘플 생성 + 관측 기록
node scripts/lcp/test-comic-model.mjs \
  --model qwen-image-edit-2511 --env kaggle-t4 \
  --style edu-factual-cartoon-bw \
  --script scripts/comic/examples/carol-stave1.adapted.json \
  --panels 6,10,18 --run
# 3) 생성물 out/test-…/ → Claude Code 가 엄격 루브릭 채점 → comic_gen_tests 갱신
```

## 자동 테스트 오케스트레이터

`scripts/lcp/test-comic-model.mjs <test_id|--model KEY --env ENV --book UUID>`:
1. `comic_gen_tests` 레코드/인자 로드 → 환경·모델·샘플 확인
2. 러너 매핑으로 gen 스크립트 dispatch (샘플 컷 subset 생성)
3. `comic_gen_runs`+`comic_panel_events` 기록(관측 연동)
4. 생성 샘플 경로 출력 → **엄격 사용성 루브릭**(캐릭터/화풍 일관·텍스트-free·정본·해부·비용, pass≥80)을 Claude Code가 채점 → `comic_gen_tests.result`/`status` 갱신

> 이미지 품질 채점은 vision 판단이 필요해 Claude Code(드레인 오퍼레이터)가 수행. 스크립트는 생성·기록·집계까지.
