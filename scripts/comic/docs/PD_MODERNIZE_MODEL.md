# PDCP 현대화 — 모델 트랙 설계

> 기존 CPU/ffmpeg 트랙(`page-modern` · `page-letter` · `webtoon`)을 **대체하지 않는다.**
> 원작 작화를 그대로 두는 트랙과, 작화를 다시 그리는 트랙은 결과물의 성격이 다르다.
> 둘을 나란히 두고 호마다 고른다.

## 0. 전제 정정 — "텍스트 보존"은 우리 문제가 아니다

참고 자료는 모델 선정의 승부처를 **말풍선 텍스트가 살아남는가**로 잡았다.
Qwen-Image-Edit 을 1순위로 민 근거의 절반이 그것이다.

우리 파이프라인에서는 그 기준이 성립하지 않는다. 이미:

- OCR 단계가 **말풍선 좌표(`bubbles[].box`)와 텍스트를 따로 갖고 있고**
- 현대화 트랙이 **비파괴 대사 레이어**(HTML/SVG 오버레이)로 문구를 다시 얹는다
  (`page-letter.mjs` — 원작 말풍선 자리를 존중해 재식자)

즉 **모델에 글자를 맡길 이유가 없다.** 오히려 맡기면 안 된다 —
어떤 모델도 1940년대 손레터링을 재현하면서 읽기 좋게 만들지는 못한다.

그래서 이 트랙의 순서는 이렇게 뒤집힌다:

```
컷 이미지 ──① 말풍선 지우기(inpaint) ──② 모델 재작화 ──③ 대사 레이어 재부착
             (box 좌표 이미 있음)        (글자 걱정 없음)   (기존 page-letter)
```

**결과**: 모델은 그림만 다루면 되고, 글자는 벡터/HTML 로 선명하게 남는다.
모델 선정 기준에서 `text_control` 가중치가 빠지고 **구도 보존력**만 남는다.

## 1. 트랙 비교 — 언제 무엇을 쓰나

| | CPU 트랙 (기존) | 모델 트랙 (신규) |
|---|---|---|
| 하는 일 | 디스크린·화이트포인트·평면컬러 양자화 | 컷을 **다시 그린다** |
| 원작 충실도 | 100% (같은 그림) | 구도만 유지, 붓질은 새것 |
| 비용 | 0 | 호당 $1~2 (4090) 또는 0 (Kaggle) |
| 속도 | 컷당 1초 미만 | 컷당 30~60초 (fp8) |
| 실패 양상 | 과보정(색 날아감) — 되돌리기 쉬움 | 구도 붕괴·인물 변형 — 컷 폐기 |
| 저작권 | 원작 PD 그대로 | 파생물 — PD 근거는 그대로 유효 |
| 적합 | 스캔 상태가 괜찮은 호 | 스캔이 심하게 상한 호 · 화풍 자체를 바꾸고 싶을 때 |

**기본값은 CPU 트랙이다.** 모델 트랙은 "이 호는 CPU 로 안 된다"가 확인된 뒤 켠다.

## 2. 모델·환경은 CCP 것을 그대로 쓴다

새로 고르지 않는다. CCP 가 이미 카탈로그와 러너를 갖고 있다:

- `comic_gen_models` (DB) — 키·호스팅·`run_envs`·`min_vram_gb`·라이선스·`comic_fit`
- `scripts/comic/model-runners.mjs` — backend → gen 스크립트 + 워크플로 + 지원 환경 + argv 조립

PDCP 는 **여기에 질의만 한다.** 모델 지식을 복제하면 즉시 어긋난다.

현재 카탈로그 상위(실측 기록):

| 키 | comic_fit | 환경 | 라이선스 | edit |
|---|---|---|---|---|
| `qwen-image-edit-2511` | 90 | runpod-4090 · kaggle-t4 | **Apache 2.0** | RunPod 만 (2511 Q5 = VRAM↑) |
| `qwen-image-edit-2509` | 85 | runpod-4090 · kaggle-t4 | Apache 2.0 | 〃 |
| `flux2-dev` | 78 | runpod-4090 | 비상업 | — |

**모델 트랙에는 `edit` 워크플로가 필수다.** t2i 는 원본 컷을 입력으로 받지 못해
"현대화"가 아니라 "새로 생성"이 된다. `model-runners` 의 `wfEdit` + `wfEditEnvs` 로 게이팅한다.

→ 실질 선택지는 **RunPod 4090 + qwen-image-edit-2511**. Kaggle T4 는 edit 워크플로가
프로비저닝돼 있지 않아(검증됨: t2i-only) 이 트랙에서는 **제외**된다.
참고 자료의 "Kaggle 1단 파일럿"은 SDXL+ControlNet 을 전제한 것으로, 우리 러너 구성과 다르다.
Kaggle 을 쓰려면 `wf/qwen-edit-*.api.json` 을 T4 용으로 따로 만들어 `wfEditEnvs` 에 추가해야 한다.

**라이선스가 결정적이다.** 학습자에게 배포하는 산출물이므로 `flux*-dev`(비상업)는 쓸 수 없다.
Apache 2.0 인 Qwen 계열만 이 트랙에 노출한다 — 코드가 라이선스로 필터링한다.

## 3. 단계 배치

기존 상태 기계에 **한 단계를 끼운다**:

```
queued → acquired → restored → segmented → ocr → [modernized] → review → published
                                                   ↑ 선택 단계
```

- 건너뛸 수 있다. `ocr → review` 직행이 여전히 기본 경로다.
- 되돌릴 수 있다. 산출물은 `panels/` 를 덮지 않고 `modern/` 에 따로 쓴다.
  실패하면 폴더만 지우고 `ocr` 로 되돌린다(`PATCH /api/pdcp/issue`).

## 4. 컷 단위 처리 (호 단위 아님)

한 호 = 약 300컷. 이걸 한 요청에 넣을 방법은 없다.

- 드레인 1회 = **컷 N개**(기본 8). 나머지는 다음 호출.
- 진행은 `modern.manifest.json` + 기존 `progress.mjs` 로 기록 → admin 모니터가 그대로 읽는다.
- 중단·재개가 자유롭다. 이미 처리된 컷은 건너뛴다(멱등).

## 5. 비용 게이트

승인 없이 GPU 를 태우지 않는다. 적재 시점에 **예상 비용을 계산해 보여주고**,
사람이 확인한 뒤에만 시작한다.

```
컷 수 × 컷당 초 ÷ 3600 × 시간당 요금
300컷 × 45초 ÷ 3600 × $0.34 = 약 $1.3/호
```

`comic_gen_runs` 에 run 행을 만들어 `cost_usd` 를 누적한다 — CCP 와 같은 테이블,
같은 관측 화면을 쓴다(`backend`/`model`/`site`/`panels_*`).
PDCP 행은 `library_book_id` 가 없으므로 **nullable 로 완화하고 `pd_issue_id` 를 추가**한다(§7).

## 6. 실패를 어떻게 다루나

모델 트랙의 실패는 CPU 트랙과 성격이 다르다 — **그럴듯한데 틀린 그림**이 나온다.

- 컷별 **원본 대비 썸네일**을 매니페스트에 남긴다. 검수 화면이 나란히 보여준다.
- 자동 판정은 하지 않는다. 구도 붕괴를 픽셀 지표로 잡으려던 시도는
  컷분할 자기발전에서 이미 한 번 실패했다(프록시 지표는 과분할을 골랐다).
  사람이 보고 컷 단위로 원본/재작화를 고른다.
- 컷 단위 되돌리기: `modern/<page>-c<NN>.jpg` 를 지우면 그 컷만 원본을 쓴다.

## 7. 필요한 스키마 변경

```sql
-- 새 단계
ALTER TABLE pd_comic_issues DROP CONSTRAINT pd_issues_status_chk;
ALTER TABLE pd_comic_issues ADD CONSTRAINT pd_issues_status_chk CHECK (
  status IN ('queued','acquired','restored','segmented','ocr',
             'modernized',            -- 신규(선택 단계)
             'review','published','archived','failed')
);

-- 어떤 트랙·모델로 현대화했는지 (검수·재현·라이선스 감사)
ALTER TABLE pd_comic_issues
  ADD COLUMN IF NOT EXISTS modernize_track text
    CHECK (modernize_track IS NULL OR modernize_track IN ('cpu','model')),
  ADD COLUMN IF NOT EXISTS modernize_model text,   -- comic_gen_models.key
  ADD COLUMN IF NOT EXISTS modernize_env   text;   -- runpod-4090 등

-- CCP run 관측 테이블을 PDCP 도 쓰게 (도서 앵커 없음)
ALTER TABLE comic_gen_runs ALTER COLUMN library_book_id DROP NOT NULL;
ALTER TABLE comic_gen_runs
  ADD COLUMN IF NOT EXISTS pd_issue_id uuid REFERENCES pd_comic_issues(id) ON DELETE CASCADE;
ALTER TABLE comic_gen_runs ADD CONSTRAINT comic_gen_runs_anchor_chk
  CHECK (library_book_id IS NOT NULL OR pd_issue_id IS NOT NULL);
```

## 8. Admin 에 붙는 것

`/admin/pd-comics` **현대화** 탭:

- 트랙 선택 — CPU(기본) / 모델
- 모델 선택 — `comic_gen_models` 중 **edit 워크플로가 있고 상업 이용 가능한 것만** 노출.
  나머지는 이유와 함께 비활성(왜 못 쓰는지 안 보이면 다음 사람이 다시 시도한다).
- 환경 선택 — 러너의 `wfEditEnvs` 로 제한. ComfyUI URL 미설정이면 시작 불가 + 안내.
- 컷 수 · 예상 비용 · 예상 시간 표시 → **확인 후 시작**
- dry-run — 실행할 CLI 명령을 그대로 보여준다
- 진행 — 기존 모니터 재사용(`progress.mjs` 기록)

## 8.5 지우기 — 실측과 한계 (2026-08-09)

`balloons.mjs` 가 OCR 텍스트 조각을 감싸는 밝은 연결 영역으로 확장한다.
순수 검출(밝은 blob 찾기)이 아니라 **두 신호를 합친다** — 하늘·눈밭도 밝지만 글자가 없다.

Classics Illustrated #27, 8컷 실측:

| 컷 | 텍스트 조각 | → 영역 |
|---|---|---|
| 0003-c01 (표지 캡션) | 6 | **1** |
| 0004-c02 | 5 | 2 |
| 0004-c04 (나란한 두 풍선) | 5 | **2** |

평균 지움 면적 **7.8%/컷** · 풍선 미검출 후퇴 **0건**.
조각 6개가 캡션 박스 1개로 정확히 합쳐지고, 나란한 두 풍선은 2개로 갈린다.

### 밝기 임계값을 왜 200 으로 두나

| BRIGHT | 지움 면적 |
|---|---|
| **200 (채택)** | **10.3%/컷** |
| 185 | 26.1% |
| 170 | 26.6% |
| 140 | 39.7% (풍선 1개 유실) |

185 아래로 내리면 풍선이 밝은 배경과 이어져 지움 면적이 2.5배로 뛴다.
분홍 캡션 박스(luma≈178)를 잡으려면 낮춰야 하지만, 그 대가로 그림을 지운다.
**덜 지우는 쪽을 택했다** — 남은 글자는 검수에서 보이지만, 지워진 그림은 되돌릴 수 없다.
`--bright` 로 호마다 조정할 수 있다.

### 남은 한계

- **지우기 재현율은 OCR 재현율에 묶인다.** OCR 이 못 찾은 대사는 지워지지 않는다
  (실측: 0004-c02 의 "Yassuh, yassuh!" 풍선이 OCR 미검출로 남음).
  OCR 이 현재 그대로 쓸 수 있음 55% 수준이라, 이 트랙은 **OCR 품질이 올라간 뒤**가 제격이다.
- **유색 캡션 박스**(분홍 등)는 기본 임계값에서 후퇴 박스로 처리된다.
- **어두운 배경의 흰 효과음**은 잡지 못한다.

그래서 GPU 를 태우기 전에 `--erase-only` 로 지우기 결과를 먼저 본다.
모델 트랙의 유일한 비가역 비용은 GPU 시간이고, 남은 글자는 모델이 **가짜 글자로 재현**한다.

```bash
node scripts/comic/pd/modernize.mjs --workdir work/pdcp/<slug> --erase-only
```
## 9. 하지 않을 것

- **모델에 글자를 맡기지 않는다** (§0).
- **CPU 트랙을 걷어내지 않는다.** 원작 작화 보존이 필요한 호가 여전히 다수다.
- **자동 품질 판정을 만들지 않는다** (§6).
- **비상업 라이선스 모델을 학습자 산출물에 쓰지 않는다** (§2).
- **모델 목록을 PDCP 에 복제하지 않는다** — `comic_gen_models` + `model-runners.mjs` 가 SSoT (§2).
