# T-0162 · b21-v24 독립 검증 (Codex · owner goal-data-independent · 읽기 전용 검증)

작업 위치: D:/workspace/vocaflow-goal-data-review-b5 (브랜치 review/goal-data-b5-20261023 유지). 한국어로 쓴다.
쓰기 허용: docs/research/goal-data-batches/review-b21/** · scripts/research/goal-data/review-b21/** 만. git 조작 · DB 접속 · 다른 경로 쓰기 금지.
입력(읽기만): D:/workspace/Vocaflow-goal-data @ 3cf2b8cbb (data/goal-batches-20261023). 이전 검증 형식은 docs/research/goal-data-batches/review-b20/{review.md,verdict.json} 와 scripts/research/goal-data/review-b20/*.mjs 를 참고해 같은 수준으로 한다.

## 대상

b21-v24 = 2014A 9 + M1809 7 + M2006 24 = 40문항 · 계약 v2.4 · TASK 6(R5 · R6 · E1 · E3 · R4 · E2) · A/B 두 트랙 · 청크 4.
- 입력: scripts/research/goal-data/local/b21-v24/{input.json,chunk-*.json,chunk-*.out.json,prompts/,history/,sources/}
- 생성물: docs/research/goal-data-batches/D2-task-mapping/b21-v24-*.json(l) · 결합 item-task-links.jsonl · disputed-links.jsonl · mapping-coverage.json · D3-principles/*
- 기록: docs/research/goal-data-batches/D2-task-mapping/mapping-review.md §25(b21 결과 · 빈칸 표시 소실 13건) · README.md
- 실행기: scripts/research/goal-data/{d2-run.mjs,d2-validate.mjs,d2-validate.check.mjs,source-gaps.mjs,d3-build.mjs,d2-combine.mjs}

## 수용 기준(각각 confirmed / refuted / unclear 로 판정)

AC0 재조립 재현: 네 청크 손 원본(local/b21-v24/sources/{A-01,A-02,B-01,B-02})의 assemble 을 **허용 폴더 아래 임시 복사본에서만** 실행해 최종 chunk-*.out.json 과 바이트 일치. 입력 폴더에서 assemble 을 돌리지 않는다(출력 경로에 직접 쓴다). 최초 snapshot(history/*-first) 대비 최종 diff 로 출력 직접 수정 0 확인.
AC1 A-02 경위: 분석자가 세션 종료로 손 원본 4 · assemble 까지 쓰고 멈춤 → 오케스트레이터가 그 assemble(형식 변환)만 실행 · 첫 snapshot · validate 결함 0. assemble 이 판정 필드를 만들거나 바꾸지 않는지(손 원본 대비 출력 필드 동일), 「A-02 최종 보고(읽은 파일 · source_gap_suspected) 미수집」 이 mapping-review §25 에 정확히 표시됐는지.
AC2 독립성 · 재계산: B 트랙 눈가림 · 프롬프트 보존본(prompts/manifest.json) 해시와 실제 지시 일치 · 선정 40 · 제외 41 · 해시 · κ .867 · 주 TASK 35/40 · TASK별 κ(R4 .665) · 경보 재계산 · b2–b21 validate 회귀 · d2-validate.check 통과.
AC3 미확정 · R3/R4: 주 TASK 갈림 5(2014A#38 · 2014A#40 · M2006#19 · M2006#28 · M2006#35)가 미확정으로 기록됐는지, 무관한 문장 · 순서 문항의 R3/R4 경계 적용이 CONTRACT_V2_1 · V2_3 과 맞는지 원문 대조(R4 갈림 8 중심).
AC4 원천 결손 · 승격 금지: source_gap_suspected 2건(2014A#41 · M1809#41) 실제 결손 판정을 원문(D:/workspace/Vocaflow/scripts/csat/data/columns/2014A.txt · columns2/M1809.txt)과 대조 · §25 의 13건 범위 주장(같은 시험 · 빈칸 제거 · 공백 무시 동일 지문인데 한쪽만 빈칸 없음)의 재현 가능 범위 판단 · **후보 링크(R1)가 확정 전이 관계 · 학생 숙달 증거 · 확정 출제 원리로 승격된 곳이 없는지**(README 인계 문구 · 결합 산출물 · D3).
AC5 산출: docs/research/goal-data-batches/review-b21/verdict.json(+ review.md) — 각 AC 판정 · 근거 파일:줄 · 새 P0/P1 목록 · 다음 배치 가부 · unclear 유지.

## 하지 말 것

D2 산출물 수정 · DB 쓰기 · 다른 owner 의 TASK 상태 변경 · 결과를 추정으로 채우기(실행 못 한 검사는 unclear 로).
