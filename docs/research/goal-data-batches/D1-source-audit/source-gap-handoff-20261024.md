# 원천 결손 인계 — G · 데이터 담당 (2026-10-24 · DB 쓰기 없음)

> 받는 쪽: 대량작업 G(기출 원문 · 근거 · 선지 결속 · owner `csat-evidence-binding-g`) · 데이터 정정 담당. 2014A#29 는 대량작업 C(`csat-lecture-audit-c`)의 단계 경로가 이미 맡고 있다.
> **승인 전 실행 금지.** 아래 수리 계획은 기존 수리 경로(`scripts/csat/source-repair.mjs` — 로컬 main `2b0ec8484`)의 입력 형식이다. 미리보기만 확인했다.

## 1. 대상과 처리 경로

| 문항 | 결손 | 판정 영향 | 처리 경로 |
|---|---|---|---|
| 2014A#29 | 안내문 각주 첫 줄 소실(「month.」 만 남음) | 오답 ③ 근거 일부 | **C 단계 경로**(`vocaflow-csat-lecture-audit-c` `docs/csat-learner/lecture-audit-c-20261024/g/db-fix/B-2014A29/` — stage1 지문 정정 + 분석 v6 draft · 선지 잔여물 3건 · 강의 v3 판본 결속). 지문 치환 문자열은 goal-data 패키지와 같다 → goal-data 쪽 2014A#29 SQL 은 **철회**(중복 적용 방지) |
| M1809#26 | 각주 「* No cash donations will be accepted.」 소실 | **정답 ③ 의 유일한 근거** | 수리 계획(아래) |
| 2014A#41 · 2014B#41 · 2016#41 · M1809#41 | 장문 제목 문항 지문에서 빈칸 표시 「______」 만 소실(같은 세트 #42 에는 있음) | 없음(제목 문항은 빈칸 내용이 정답 근거 아님) — 학습자 화면에서는 문장이 붙어 읽힘 | 수리 계획(아래) |
| 학평 9건(H1803G1 · H1803G3 · H1804G3 · H1806G1 · H1806G2 · H1807G3 · H1809G1 · H1811G1 · H1811G2 의 #41) | 위와 같은 빈칸 표시 소실 | 위와 같음 | **목록만** — 학평 검수 일정(학평 무관 작업 우선 지침)에 맞춰 학평 수리 목록으로. 이번에 계획 미작성 |

범위 근거: DB 전체 읽기 전용 대조(같은 시험 · 빈칸 제거 · 공백 무시로 같은 지문인데 한쪽만 「__」 없음) 13건. 각주 소실은 추출 텍스트 `* ` 줄 대조(platform-goal) 2건.

## 2. 평가원 수리 계획 (5건)

- 파일: `docs/research/goal-data-batches/D1-source-audit/repair-plan-kice-20261024.json` · 생성기 `scripts/research/goal-data/repair-plan-kice.mjs`(DB 읽기만).
- 각 행: `item_id` · 공식 문제지 `pdf_file` · `pdf_sha256` · `before.passage`(현재 DB 그대로) · `after.passage` · `note`.
- 고친 뒤 값 만들기: #41 은 같은 세트 #42 지문의 빈칸 앞뒤 40자 문맥으로 자리를 하나로 찾아 「______」 만 넣음 · M1809#26 은 「small electronics」 와 「How to donate」 사이에 각주 한 줄만 넣음. **넣은 문자열을 빼면 고치기 전 지문과 바이트가 같다**는 검사를 생성기가 통과(5/5).

| 문항 | 공식 문제지 | 고치기 전 md5 | 길이 변화 |
|---|---|---|---|
| 2014A#41 | 2014_영어A-홀수형_문제.pdf | ab51615258c689b48f6982d975b80315 | +7 |
| 2014B#41 | 2014_영어B-홀수형_문제.pdf | 7e992414a44f80b443ba01f92ae92808 | +7 |
| 2016#41 | 2016_영어영역-홀수.pdf | 8a3c6648ce8baa499d2b1d73056d5cb8 | +7 |
| M1809#41 | 201809_영어영역_문제지.pdf | 49e1e45e68dc9f437f33301b64c12aa3 | +7 |
| M1809#26 | 201809_영어영역_문제지.pdf | 22e3bb81089a8be369e6da1e0627fb7a | +38 |

### 미리보기 결과(기존 도구 · 쓰기 없음)

`node --tls-max-v1.2 scripts/csat/source-repair.mjs --file <계획>`(Vocaflow-main-serving, `--commit` 없음): 5건 모두 `applySourceRepair` 통과(공식 PDF 해시 일치 · 고치기 전 값이 현재 DB 와 정확히 같음 · 빈 지문 아님). 그 다음 단계에서 로컬 원장 `scripts/csat/data/corpus.json` 이 없어 멈춤 — **원장 재생성(build-corpus)은 담당 쪽 절차**라 여기서 하지 않았다. 원장을 만든 뒤 같은 명령으로 미리보기 → 사용자 승인 → `--commit`(DB 정정 + `kice-source-repairs.json` 기록 · compare-and-set).

**미확인**: PDF 본문을 사람이 눈으로 대조하지는 않았다(해시 결속만). 각주 문장은 추출 텍스트(`columns2/M1809.txt:299`)와, 빈칸 표시는 같은 세트 #42 지문과 일치한다.

## 3. 승인 뒤 할 일

1. 분석 · 강의: M1809#26 의 `csat_item_analyses` v1–v5(published)는 잘린 지문으로 만들어졌다 — 정답 근거 서술 재검토 대상(C 의 2014A#29 단계 경로와 같은 방식 권장: 지문 정정 → 분석 draft → 사람 승인 → 발행).
2. 연구 데이터(goal-data): M1809#26 을 A/B 두 트랙으로 재판정 뒤 `scripts/research/goal-data/source-gaps.mjs` 에서 뺀다. 2014A#29 는 C 단계 1 적용 뒤 같은 절차.
3. 근본 수정: 지문 조립 파서가 `* ` 로 시작하는 영어 문장 각주 줄과, 세트 공유 지문의 빈칸 표시를 문항마다 보존하게 고친 뒤 전체 재추출 대조.
