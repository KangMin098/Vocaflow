# C-D — 확정 원문 오류 3건 정정 패키지 (2026-10-25 · 작성·검증만 승인 · DB 미적용)

사용자 결정 6(2026-10-25): 「원문 정정 후보 3건의 SQL 작성·검증만 승인」. 실행은 별도 승인 + 승인형 러너로만(dev-mode `db_apply` 2026-10-25).
M2606#27(표 읽기 순서)은 표 구조 별도 설계 대상으로 남긴다 — 이 패키지에 없다.

## 대상 — `public.csat_items.passage` (PK `id`) 만. choices · answer · 다른 열 불변

| PK | 바꿀 것(현재 DB) | 정정 후 | passage md5 전 → 후 | 공식 문제지(정본 폴더 PDF · sha256 앞 12) |
|---|---|---|---|---|
| 2023#32 | `… not unlike trans-missible disease …`(1회) | `transmissible` | `03a62be1…` → `839326bf…` | 2023_영어영역_문제지.pdf — 줄 끝 「trans-」 + 다음 줄 「missible」(줄바꿈 하이픈) |
| 2014B#36 | 지문 끝 ` [3점] (A) (B) (A) (B)` | 꼬리 제거 · 끝 「… might have eased it.」 | `4910c6d0…` → `0b6a803c…` | 2014_영어B-홀수형_문제.pdf `748517837…` — 배점·선지 표 머리, 빈칸 표지 (A)(B)는 지문 안에 그대로 |
| 2017#42 | 지문 끝 `\n\n(A) (B) (A) (B)` | 꼬리 제거 · 끝 「… is (B) for batter number one.」 | `5bb996e4…` → `ac52fa4a…` | 2017_영어_짝.pdf `659ded02a…` — 선지 표 머리 |

- 수능·모평 지문 중 끝에 `(A) (B) (A) (B)` 가 붙은 행은 이 둘뿐, `[3점]` 이 든 지문은 2014B#36 하나(SELECT 2026-10-25) — 저장 규칙상 예외 잔여물이다.
- 2014B#36 이전 판정의 「빈칸 표지 누락」은 PDF 대조로 재현되지 않았다(DB · PDF 모두 「in the (A) direction」).

## 검증 (모두 SELECT · 쓰기 없음)

- 현재 3행 md5 = before 3/3 · 바꿀 문자열이 각 지문에 정확히 1회 · 꼬리 2건은 지문 끝.
- forward 결과 md5 = 기대 after 3/3 · 되돌리기 왕복(after → before) md5 3/3.
- 정답 · 선지 불변(passage 만). 정답: 2014B#36 ② · 2017#42 ④ · 2023#32 ②.

## 영향

- **2023#32 분석 v4(published)** `choice_analysis` ③ 의 `lure_quote` 가 `in a manner not unlike trans-missible disease` 를 인용한다. 정정 뒤 이 인용은 지문에서 글자 그대로 찾을 수 없다 → 끌리는 구절 자리(`passage-skeleton.ts` lure_quote 드레인)가 그 구절을 못 찾을 수 있다. **2023#32 를 적용하려면 분석 v5(인용만 `transmissible` 로) 를 같은 승인 범위에 넣어야 한다**(발행 게이트 3 페르소나 검수 필요). 2014B#36 · 2017#42 는 분석 · 강의 · 탐구가 꼬리를 인용하지 않는다.
- 학습자 화면은 공식 PDF 를 쓴다 — 지문 표시는 바뀌지 않는다. 결속 감사 · 동기화 원장만 영향.

## 원장 수리 기록 — `recipe-D-three.json`

- 2014B#36 · 2017#42: before = 현재 재생성 원장 값, after = DB 정정 값. `applySourceRepair` 로 원장 → 정정 값 확인.
- 2023#32: 원장이 이미 `transmissible`(정정 뒤 값과 같음) → 수리 기록 불필요.
- 적용 승인 뒤 `scripts/csat/data/kice-source-repairs.json` 에 `mergeSourceRepair` 로 합친다(동기화 가드가 정정 값을 지킨다).

## 파일 · 전체 SHA-256

| 파일 | sha256 |
|---|---|
| `forward.sql` | `a2bf4abe43e7246dafbe1b6e9548a1686314233c571d138a7720f0f5153cb84f` |
| `recovery.sql` | `20a35bcf226c8d7f23a120a8b0f6a4c4bee75359b9b25d78b386400ba70aaeee` |
| `check.sql` | `4cfe0c74b63dec0fe334a85a74582bcd79ce741732728ea4879b2965052f9cc1` |
| `recipe-D-three.json` | `db4514e17337a9bc7703974f30c694cd2bc225fa448ee33203f1b3b1531ca2ff` |
| `manifest.json` | `61db9e08aee2ae86e0183060604dd6bdd4764f09d32d7e3ed91168ebd7a1b67a` |
| `make-package.mjs`(생성기) | `3c4b0498544866c9347fabd19bdb0c17aa2e7192d22dd1cdd71803ddcce2ede2` |

- forward: 한 DO 블록, 각 행 compare-and-set(md5), 바뀐 행이 3 이 아니면 예외 → 전부 롤백.
- recovery: 정정 뒤 md5 일 때만 원래 문자열 복원(하이픈 되돌림 · 꼬리 다시 붙임). 행 삭제 · DDL 없음.

## 실행 경로(승인 뒤) — 아직 없음

승인형 러너는 단계별 전용 스크립트(`scripts/db/<id>/deploy.mjs apply --stage <s> --confirm-sha <sha>`, db-approval 티켓)다. 이 패키지용 단계는 아직 만들지 않았다 — 실행 승인과 함께 러너 단계(forward sha 고정 · check 전후 · 실행 기록)를 추가한다. MCP 로는 실행하지 않는다(전역 훅이 막는다).
