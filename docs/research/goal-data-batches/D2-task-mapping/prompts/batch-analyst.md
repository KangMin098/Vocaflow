# 범위 배치 분석자 프롬프트 틀(v2.4 · A/B 공용)

> `scripts/research/goal-data/mk-prompts.mjs <batch>` 가 아래 본문의 `{BATCH}` · `{TRACK}` · `{CHUNK}` · `{NN}` · `{LABEL}` · `{TRACK_RULE}` 만 치환해 청크마다 실행 프롬프트를 만들고 전문 · sha256 · 허용/금지 목록을 `scripts/research/goal-data/local/{BATCH}/prompts/` 에 남긴다(T-0118 B11-P1-01). 실행은 저장된 전문을 그대로 쓴다.
> TRACK_RULE — A: 「입력의 prior_analysis_unverified 는 검증 전 참고용 — 원문으로 확인」 · B: 「원문만 · 눈가림 — 기존 분석 · DB · 다른 판정 파일을 읽지 않는다」.

---

너는 Vocaflow 문항↔TASK 매핑 분석자다(트랙 {TRACK} · {LABEL}). 한국어로 작성. 작업 디렉터리 D:/workspace/Vocaflow-goal-data. 이 작업은 새 대화다.

1. 계약 정독(순서대로 모두 적용): docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md → docs/research/goal-data-batches/D2-task-mapping/CONTRACT_V2.md → CONTRACT_V2_1.md → CONTRACT_V2_2.md → CONTRACT_V2_3.md → CONTRACT_V2_4.md(봉인). **CONTRACT_V2_5.md · V2_5_* · prereg-* · v2_5-* 파일은 열지 않는다**(미봉인 · 사용 금지). 핵심: 청크 tasks 6개(R5 · R6 · E1 · E3 · R4 · E2)만 · E2 는 v2.4 §1 고정표 · 빈칸 R5/R6 는 v2.4 §2 · E3 낱말쌍만으로 direct 금지 · 주 TASK 는 문항마다 직접 판단(다중 direct 면 v2.4 §4 반사실 검사) · 모든 행에 문항 고유 primary_reason · 스크립트로 primary 를 고르지 않는다 · main_performance_outside_subset 은 문항마다 판단 · v2.4 에서 primary 가 null 이면 secondary_tasks 는 [] 이다.
2. {TRACK_RULE}
3. **읽어도 되는 파일(전부)**: 위 계약 파일 · docs/csat-learner/v4/codebook.json · 입력 `scripts/research/goal-data/local/{BATCH}/{CHUNK}.json` · 자기 트랙 검증 명령(아래 6)의 출력. **그 밖은 읽지 않는다** — 특히 같은 배치의 다른 청크 · 다른 트랙 파일 · input.json · history/ · prompts/ · 다른 배치 폴더 · docs 의 *-agreement* · *-links* · *-sample* · *-corrections* · *-comparison* · *-prereg* · mapping-review.md · 검증기 · 실행기 소스(scripts/research/goal-data/*.mjs).
4. 입력 문항마다 원문을 읽고 직접 판정한다. 인용은 원문 그대로 · 정답은 공식 정답과 동일 · indirect 는 counterfactual 필수 · 오답 선지 전수(정답 선지는 오답 목록에 넣지 않는다).
5. 출력: `scripts/research/goal-data/local/{BATCH}/{CHUNK}.out.json` {"rows":[...]} 이 파일 하나만. 손 원본(판정을 손으로 쓴 파일)과 조립 스크립트는 `scripts/research/goal-data/local/{BATCH}/sources/{TRACK}-{NN}/` 에만 둔다(검증자가 같은 원본으로 재조립을 재현한다 · 다른 청크의 sources 는 읽지 않는다). 조립 스크립트는 **형식 변환만**(JSON 묶기 · id · sha · status 붙이기) — 판정 문장 · primary · relevance · 왜곡 유형 등 판정 내용을 만들거나 바꾸지 않는다(첫 출력 전에도). **수정 경로는 하나** — 검증 뒤에도 손으로 쓴 판정 원본을 문항별로 고치고 조립을 다시 돌린다(출력 파일을 직접 고치지 않는다 · 원본과 출력이 갈리면 재현이 안 된다). 여러 행을 스크립트 · 일괄 치환으로 고치지 않는다(관측 필드 · 설명 문장 포함). 조립 스크립트 없이 출력을 직접 손으로 썼다면 그 출력 파일이 원본이다. 다른 파일 수정 · git 금지. 출력을 처음 다 쓴 직후 **고치기 전에** `node scripts/research/goal-data/d2-run.mjs {BATCH} snapshot {LABEL}-first` 를 한 번 실행한다.
6. 검증은 자기 청크만: `node scripts/research/goal-data/d2-run.mjs {BATCH} validate {TRACK} {NN}` — 이 청크 결함 0 까지(다른 청크의 결함은 보이지 않는다 · 「다른 청크 … 배제됨」 안내만 나오면 이 청크는 끝난 것). 수정 시도는 최대 2회.
최종 보고: 통과 수 · 남은 결함 · outside=true 행과 근거 · 읽은 파일 목록(전부) · 어려운 경계 2개.
