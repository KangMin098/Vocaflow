# GPT Image 2 최적화 파이프라인 (별도 라인)

기존 Qwen/ComfyUI 라인(`gen-comfy`)과 **독립**된 GPT Image 2 전용 생성기 `gen-gptimage.mjs`.
전수 게이트가 드러낸 결함(2차 캐릭터 드리프트·중복·노화 연속성·faceless)을 GPT Image 2의 강점
(강한 지시 준수 + 다중 참조)으로 구조적으로 잡는 것이 목적.

## 기존 프로세스 → GPT Image 2 매핑

| 기존 자산 | GPT Image 2 라인에서 |
|---|---|
| 각색 스크립트 `carol-stave*.adapted.json` | 그대로 입력(scene/captions/cast) |
| `comic-prompt.mjs`(styleForLevel·refLines·**propLines**·**sceneClauses**·NEG) | 그대로 재사용. NEG 는 음성필드 부재라 **"Absolutely AVOID: …" 절**로 접어 넣음 |
| 참조시트(캐릭터 앵커) | `images.generations` 로 캐릭터별 시트 생성 → `refs/<id>.png` |
| 단일 참조(Qwen 한계) | **다중 참조(≤16장)** — 패널의 모든 캐릭터 시트를 한 번에 주입(드리프트·중복 차단) |
| HTML 레터링(no baked text) | 유지 — `NOTXT` 절 + 텍스트 안 구움 |
| QC 게이트(`qc-comfy`·`release-gate`) | **동일 재사용**(백엔드 무관, NN.jpg 만 봄) |
| 조립 `03-assemble.mjs` | 동일(출력 규약 NN.jpg 동일) |

## 두 실행 모드

### [sync] Image API — 검증·소량 교정
`images.generations`(참조) + `images.edits`(패널, 다중참조). **형태 확정·즉시 응답.** 동시성 풀.
```
node scripts/comic/gen-gptimage.mjs --script scripts/comic/examples/carol-stave1.adapted.json \
  --out out/gptimage-stave1 --panels 15,18 --quality high --concurrency 4
```
- `input_fidelity` 는 gpt-image-2에서 **금지 파라미터**라 보내지 않음(고정 high).
- A/B·하드패널 교정에 사용.

### [batch] Responses API — 전권 50% 할인·24h
`images.edits` 는 multipart라 **JSONL 배치 불가** → 참조 배치가 되는 **유일 경로는 Responses**
(`/v1/responses`, `image_generation` 툴 + `input_image` file_id). 참조시트를 Files API에 1회 업로드
(file_id) → 패널별 `/v1/responses` 요청 JSONL → `/v1/batches`(endpoint `/v1/responses`, 24h).
```
# 제출
node scripts/comic/gen-gptimage.mjs --script …carol-stave1.adapted.json --out out/gptimage-stave1 \
  --batch --responses-model gpt-5.1
# 완료 후 회수(배치 id는 out/batch.json)
node scripts/comic/gen-gptimage.mjs --script … --out out/gptimage-stave1 --collect <batchId>
```
- `--responses-model` 은 image_generation 툴을 호스팅하는 Responses 모델(라이브 계정서 정확 모델명 확인 필요).
- 회수 시 각 응답의 `output[].type=="image_generation_call"` → `result`(b64) → NN.jpg.

## 비용(대략)
- 품질 high ≈ $0.165/장, medium ≈ $0.041, 해상도별 $0.03~0.06.
- 90패널 + 캐스트 시트 ≈ sync $15 / **batch $7.5**(−50%).
- 검증 단계(A/B, 하드패널 7 + 캐스트) ≈ $1~3.

## 권장 흐름
1. **크레딧 반영 확인**(현재 429 대기) → `--dry-run` 없이 1¢ 프로브.
2. **A/B(sync)**: 7 하드페일 패널을 Qwen 결과와 나란히 — GPT가 캐스트 시트로 드리프트/중복/노화/faceless를 잡는지.
3. GPT 우세 확인 시 → **batch 로 전권** 생성(또는 하이브리드: 통과 79패널 Qwen 유지 + 하드케이스만 GPT).
4. `release-gate.mjs` 로 **전수 재게이트**(백엔드 무관) → SHIP/HOLD.

## 상태
- ✅ `gen-gptimage.mjs` 구현(sync 다중참조 + batch Responses + collect) · dry-run 검증 완료.
- ⏳ 라이브 검증(크레딧 반영 후): sync 프로브 → A/B → 필요시 batch. Responses 모델명 확정.
