# PDCP — AI 리스타일 트랙 (GPU 모델, 선택)

> PDCP 현대화 **선택 트랙**. 원작을 **다시 그린다**(화풍 변경, 구도·인물 유지). 기본 트랙(작화 보존, `page-modern`/`page-html`)과 **별개**이며 콘솔에서 명시 선택해야 돈다. (지침 2026-08-10)

## 왜 2단 로켓 (Kaggle → RunPod)

| | Kaggle 무료 (파일럿) | RunPod (양산) |
|---|---|---|
| 비용 | **$0** (주 30 GPU시간) | 4090 $0.34/hr · 호당 ~$1.5 |
| GPU | T4x2 / P100 (구세대, fp8 불가) | 4090/5090/6000 Pro (최신) |
| 모델 | **SDXL + ControlNet Lineart**(쾌적) · QIE Q4(수 분/패널, 비현실) | **Qwen-Image-Edit 2511 fp8**(쾌적) |
| 자동화 | Kaggle API 배치(반자동) | Serverless(완전 자동) |
| 용도 | 품질·코드 검증 | QIE 양산 |

**전략**: Kaggle 파일럿으로 $0 검증 → SDXL 품질이 기준 미달이면 **동일 코드**를 RunPod QIE 로 이식. 돈은 품질 차이가 확인된 뒤에만.

## 처리 단위 = 패널 크롭 (+레터링 오버레이 폴백)

- **패널 크롭**: 텍스트 뭉개짐 차단 + GPU 메모리 적합 (연구 근거). `segment` 산출 `panels/` 사용.
- **레터링 폴백**: 리스타일은 텍스트를 뭉개므로, 대사는 리스타일된 그림 **위에 클린 오버레이**로 다시 얹는다(`refined` 대사). 노트북이 컷 아래 클린 캡션으로 실증.

## 사용법

```bash
# ① 입력 준비(콘솔/CLI) — 패널 크롭 + job.json(모델·프롬프트·대사)
node scripts/comic/pd/ai-restyle/prep.mjs --workdir work/<slug> --engine kaggle-sdxl [--limit N]

# ② work/<slug>/ai-restyle/inputs 폴더를 zip → Kaggle Dataset 업로드(Add Data)

# ③ Kaggle 노트북 업로드 → Accelerator=GPU T4 x2 → Run All
#    scripts/comic/pd/ai-restyle/kaggle_pilot.ipynb
#    (SDXL + ControlNet Canny 로 구도 고정 + 프롬프트로 화풍 변경 → 비교 그리드)

# ④ /kaggle/working/restyled.zip 다운로드 → 회수(모니터 적재)
node scripts/comic/pd/ai-restyle/ingest.mjs --workdir work/<slug> --zip restyled.zip

# ⑤ 원작|리스타일 비교 후 판정 기록(타임라인)
node scripts/comic/pd/oplog.mjs --slug <slug> --phase ai-restyle --action adopt|reject \
  --title "..." --verdict "..." --next "..."
```

## 엔진 프리셋 (`prep.mjs`)

- `kaggle-sdxl` (기본·파일럿): SDXL 1.0 + `controlnet-canny-sdxl-1.0`, controlScale 0.9 / strength 0.72 / 26 steps.
  프롬프트 = "modern digital comic, clean flat vibrant colors, crisp linework, webtoon style".
- `runpod-qie` (양산): Qwen-Image-Edit 2511 fp8, instruction 편집(구도·인물 유지 지시). RunPod Serverless 로 감싼다.

## 콘솔 (`/admin/pd-comics`)

테스트·모니터 탭 → **현대화 방법 (2트랙)** 카드에 실행법, 이슈행 **라이브 진행 → 현대화 산출물**에 `AI 리스타일 · GPU 재작화 (원작|결과)` 비교 프리뷰 + verdict. GPU 실행은 외부(Kaggle/RunPod)이므로 콘솔은 **준비·회수·비교·판정**을 담당한다.

## 주의

- **발행 기본은 작화 보존 트랙.** AI 리스타일은 2차 변형이라 원작 훼손·저작권 재검토 여지가 있어 선택·검증용.
- 모델 가중치: Kaggle Datasets(무료) 또는 RunPod Network Volume. 팟/볼륨 미사용 시에도 스토리지 과금 주의.
- QIE 를 Kaggle(T4)에서 Q4 로 돌리면 패널당 수 분 → 양산 비현실적. Kaggle 은 SDXL 트랙, QIE 는 RunPod.
