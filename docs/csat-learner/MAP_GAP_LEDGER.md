# 학습 지도 rev2.1 — Gap Ledger(2026-10-10)

> 정본: [LEARNING_MAP_VNEXT](./LEARNING_MAP_VNEXT.md) rev2.1. 기준 표: [MAP_COMPLETION_CONTRACT](./MAP_COMPLETION_CONTRACT.md) MC-01–16.
> 분류: **VERIFIED**(근거 있음) · **PARTIAL** · **UNKNOWN**(측정 안 함) · **BLOCKED**(승인 · 외부 조건) · **CANON_DEFERRED**(정본이 의도적으로 미룸 — 결함 아님).
> 판정 두 가지를 따로 둔다.
> - MAP_FUNCTIONALLY_COMPLETE: 모든 필수 기능 기준 VERIFIED.
> - MAP_EDUCATIONALLY_VALIDATED: MC-12 실제 학습자 효과.
> **현재 두 판정 모두 아니다.**
> 담당은 학습 지도 세션(feat/map-* · 워크트리 `Vocaflow-map-feedback`)이다. DB 쓰기는 사용자 승인 뒤 이 세션만 한다.

| MC | 기준 | 분류 | 실제 근거 | 남은 조건 | 다음 작업 | 의존 · 승인 |
|---|---|---|---|---|---|---|
| 01 | 6축 · 11단계를 학생 지도에 | PARTIAL | `curriculum.ts` 11단계 기준 · 테스트. 확인 과제가 열린 단계 3(구조 · 선지 · 근거) | V · S 확인 과제. X · L 은 CANON_DEFERRED | V `vocab-context` 합의 주석(VS_DIRECT_CHECK_DESIGN) | 활성화는 승인 |
| 02 | LP1–7 · 듣기 4 단계 표시 | VERIFIED | `learner-path.ts` · 렌더 테스트 · 화면 E2E | — | — | — |
| 03 | 학년별 권장 경로 | PARTIAL | 학교급 선택 · 권장 노출 표시(잠금 아님) · E2E | 학년 저장 · 초등 · 중등 확인 자료 0 | 비기출 후보 조사(D-10 · 권리 · 난도 · 원천 등급) | D-10 사용자 결정 |
| 04 | 관찰 → 직접 확인 → 처방 | PARTIAL | `skill-diagnosis.ts`(원리 단위) · 3단계에서 동작 · 렌더 · 격리 기록 테스트 | 다른 축 · 원인 판정(EC 경로)과의 연결 | V · S 과제 뒤 같은 엔진 재사용 | — |
| 05 | 원인 판정 세 단위 | PARTIAL | verified_diagnosis(원리 단위) 구현 | cause_adjudicated · cause_confirmed 는 EC/Pilot 브랜치 | EC 담당과 통합 계약 | EC 세션 · 사용자 |
| 06 | Evidence Anchor | **PARTIAL(올라감)** | 계약 B 순수 함수 + **E축 합의 주석 11문항을 원문 텍스트 해시 · 문자 범위에 결속**(`anchor-bind.mts`) · **런타임 관문**(`anchorGate` — 채점 · 기록 · 지도 링크 · 문항 패널) · 변이 테스트 12 | 주장과 근거(9) · 이어 주는 단서(1) 주석은 경계 서명만(boundary_only) · DB 저장 없음(파일 결속) | 기존 두 과제 주석 결속(같은 스크립트 확장) | — |
| 07 | FIND → REPAIR → TRANSFER → CHECK | **PARTIAL(올라감)** | 바로잡기 · 적용을 **실제 수행 기록**으로 판정(`lifecycle-evidence.ts`) · 막힌 뒤 재바로잡기 · 지금 할 일 하나 · 격리 기록 E2E 8 단계 | E축 적용(TRANSFER) 대상 문항이 없다(확인 묶음 밖 활성 문항 0 — 같은 유형 다른 기출에는 과제가 없다) | 전이 문항 풀 활성화(합의 주석 · 맹검 · 승인) | 활성화 승인 |
| 08a | 행동 · 순서 환류 | PARTIAL | 결과 환류 줄 · 다음 칸 · 지금 할 일(생애주기) | find-feedback 화면 연결 일부 | — | — |
| 08b | 진단 상태 환류 | PARTIAL | 원리 단위로 반영. 확인 · 다시 확인 · 해소 · 기한, 바로잡기 · 적용 기록이 4칸 · 처방을 바꾼다 | 축 관찰(rule_proxy)은 정본상 바꾸지 않는다 | — | — |
| 09 | 원문 · 기출 · 분석 근거 정합 | PARTIAL | E축 원문 결속 · 원천 등급(A · B · G) 확인 | 기존 과제 주석 결속 | MC-06 과 같이 | — |
| 10 | 권한 · 기록 무결성 | VERIFIED(조건부) | G2 · M8 · F7 smoke · 제출 라우트 Reveal Gate · 지도 보류 문항 제외 | **새 환경 재현성**: 관문 RPC 3종 마이그레이션 누락(#191) | #191 — EC 담당 | DB 마이그레이션 승인 |
| 11 | 브라우저 · 기록 E2E | PARTIAL | 화면 13/13 · 합성 게이트 5/5 · **격리 기록 E2E**(실기록 모양 8단계 — 확인 → 처방 → 바로잡기 → 적용 → 재확인 → 해소) | 실제 브라우저로 열린 경로: 비합성 계정이 필요하다. 공유 DB 에 비합성 테스트 데이터를 만들지 않는다 → 격리 DB 필요 | 격리 DB(Supabase 브랜치 · 로컬) 준비 | 비용 · 사용자 |
| 12 | 실제 학습자 효과 | UNKNOWN | 실제 학습 기록 0. 역할 학습자 시뮬레이션은 프로세스 검증만 | 파일럿 실행 | [MAP_PILOT_PROTOCOL](./MAP_PILOT_PROTOCOL.md) 승인 | 동의 · 모집 승인 |
| 13 | (부분) 글 구조 수직 경로 | VERIFIED(부분) | 기존 10기준 | — | — | — |
| 14 | 듣기 세부 | CANON_DEFERRED | §20-5 | — | — | 정본 개정 시 |
| 15 | X 실행 모델 · 처리 속도 | CANON_DEFERRED + 문구 결함 | §20-4 · `core.ts:40` 「처리 속도」 문구(Codex P3) | 문구 정합 | 문구 수정(작음) | — |
| 16 | 정본 참조 무결성 | PARTIAL | ERROR_EVIDENCE_DESIGN · codebook 은 EC 브랜치 | main 링크 | EC 통합 때 | EC 세션 |

## 최종 조건 A–J 대응

| 조건 | 상태 |
|---|---|
| A. 6축 · 11단계 기능 | PARTIAL — 3/7 읽기 단계 직접 확인, 듣기 · X 보류 |
| B. 학년별 실제 경로 | PARTIAL — 표시만, 자료 0 |
| C. 관찰 → 직접 확인 → 근거 있는 처방 | PARTIAL(3단계) |
| D. Evidence Anchor | PARTIAL — E축 결속 · 관문, 기존 과제 미결속 |
| E. FIND → REPAIR → TRANSFER → CHECK | PARTIAL — 기록 판정 완성, E축 전이 문항 없음 |
| F. 진단 환류 | PARTIAL(원리 단위) |
| G. 권한 · 기록 무결성 | VERIFIED(개발 DB) · 새 환경 #191 |
| H. 브라우저 · 기록 E2E | PARTIAL — 격리 기록 E2E는 있다. 브라우저 열린 경로는 격리 DB 필요 |
| I. 실제 학습자 검증 | UNKNOWN |
| J. 보류 기능 표시 | VERIFIED — 듣기 · X 「정본 보류」 화면 · 기준 표시 |
