# CSAT v4.0 S0 → S1 — ADAPTER_PLAN

- 2026-10-23 · T-0131 · 기존 코드 경로는 커밋 `3f437e9b6` 기준(읽기 전용 확인). 구분: **가능**(기존 코드로 충족) · **신규**(어댑터/구현 필요) · **자료 부족**(데이터가 먼저) · **미검증**(코드는 있으나 실측 없음).
- 원칙: 신규 DB 스키마 없이 기존 자료를 읽는 개념 어댑터(기준서 §8). DB 쓰기는 승인 절차.

## 1. CORE-01~12 ↔ 기존 코드

| CORE | 기존 근거 | 판정 | S1 할 일 |
|---|---|---|---|
| 01 증거 엄정성 | `InquiryV3.design.claims[].basis` official/source_observation/design_hypothesis (`inquiry/labels.ts:66`) | 가능(v3 786) · 자료 부족(그 외) | `EpistemicKind` 어댑터로 v3 basis 매핑, CONNECTED_INFERENCE 구분 신규 |
| 02 판단 의미 | `reveal-gate.ts`(근거·선지·확신 선택 후 공개) | 가능 · 미검증 | 설명 후 확인을 정상 경로로 표기 |
| 03 학습자 주도 | `page.tsx` scene/judgmentView 파라미터 | 미검증 | 근거 먼저/해설과 함께/강의 먼저 3진입 스모크 |
| 04 정보 밀도 | `depth` 파라미터 | 미검증 | CORE/EVIDENCE/ADVANCED 노출 블록 수 측정 |
| 05 사고 구조 | 유형별 `INLINE_SYMBOL_TYPES`·`VISUAL_PAPER_TYPES`만 | **신규** | TYPE_REGISTRY의 판단 기능×매체 → scene 조합표(코드 상수) |
| 06 공개 안전 | `reveal-gate.ts`, `check=1`, `lecture-no-answer-key-inference.test.ts` | 부분 · cue 위험 등급 없음 | `RevealRisk` 등급을 cue·관계선·ARIA에 부여(34 c4·38 c1 우선) |
| 07 콘텐츠 가용성 | `compare-v3.ts` staleness(units_hash/analysis_version), `V3PairView` 부재 사유 | 부분 | ResourceState 4축 어댑터; 비교 공개 필드 **자료 부족** |
| 08 학습 기록 | `learning-session.ts:15-17` HelpLevel/Completion, `csat_map` 역할 independent_check 승인 게이트 | 가능 | `LearningEvidenceClass` 매핑만, 엔진 수정 없음 |
| 09 강의 | `lecture/{player,tts,store}.ts`, `LectureStage.tsx` | 부분 · schema3 데이터 0 | cue→EvidenceRef 어댑터(schema1 `focus` 0기반 → 1기반 변환), `cueRevision` 분리 저장소 |
| 10 화면 | `/csat/item/[slug]` 단일 라우트 | 미검증 | 1280/1440 실측 |
| 11 보존 | `read-paper.ts` 로컬 처리·해시만 전송, `csat_items_public` 컬럼 ACL | 가능 · 미검증 | pdfMatch 상태 표기 |
| 12 효능 주장 | — | 신규(보고 규칙) | 보고 템플릿에 NOT_EVALUATED 고정 |

## 2. AT01~20 ↔ 기존 테스트/코드

| AT | 기존 근거 | 판정 |
|---|---|---|
| AT01 출처 정직성 | v3 basis 필드 | 부분(테스트 신규) |
| AT02 버전/인덱스 | `meaning-support/model.ts:65` 1→0 변환, `passage-skeleton.ts:21` | 부분 · 삽입 위치 타입 **신규** |
| AT03 첫 화면 | — | 신규 |
| AT04 경로 자유 | scene 파라미터 | 미검증 |
| AT05 공개 매트릭스 | reveal-gate, 강의 무정답 추론 테스트 | 부분 · 34 c4 직접 정답 실재(실패 예상) |
| AT06/07 34 조건·② | v3 2026#34 | 자료 있음 · 테스트 신규 |
| AT08 22 ③ | v3 2026#22 | 자료 있음 · 테스트 신규 |
| AT09 38 ④/⑤ | v3 2026#38 | 자료 있음 · 위치 타입 신규 |
| AT10 강의 37 | `lecture-data/2026.json` | 자료 있음 · revision 분리 신규 |
| AT11 재생 장애 | `tts.ts` | 미검증 |
| AT12 자료 결손 | `V3PairView` 부재 사유 | 부분 |
| AT13 비교 | 34 pairs=0 실측 | 자료 있음 · 공개 필드 자료 부족 |
| AT14 학습지도 | `csat_map` 승인 게이트, `map-return.ts` | 가능 · 회귀 테스트 재사용 |
| AT15 PC·접근성 | 기존 격리 E2E(`playwright.isolated.config.ts`) | 미검증 |
| AT16 듣기 | — | **자료 부족(DATA_GAP)** |
| AT17 전체 유형 | 본 TYPE_REGISTRY | S0 완료(99.57% 독해, 듣기 0) |
| AT18 효과 주장 | — | 보고 규칙 |
| AT19 기본 자료 규모 | READINESS §0 | S0 완료 |
| AT20 역할별 반증 | — | 신규(시나리오 문서) |

## 3. S1 최소 구현 순서

1. **타입 계약 파일** `apps/web/src/lib/csat/skeleton-v4/contract.ts` — 기준서 §8 타입 + `EvidenceRef.kind`(SENTENCE_NUMBER_1/INDEX_0/INSERTION_SLOT 분리). 순수 타입·변환 함수, DB 무변경.
2. **준비도 어댑터** `skeleton-v4/readiness.ts` — 문항 id → {analysis, v3, meaning, lecture, compare}별 `ResourceState/ReviewState/AccessState`. 입력: 기존 JSON + 분석 status/units_hash. 단위 테스트에 34(compare 0)·22·38·학평 R-INSERT mismatch 1건.
3. **유형 장면 조합표** `skeleton-v4/type-scenes.ts` — TYPE_REGISTRY 판단 기능×매체 상수. 미분류/듣기 → `UNMAPPED` 폴백.
4. **강의 cue 어댑터** `skeleton-v4/cue-adapter.ts` — schema1 cue → `cueId/originalScript/displayedTarget/evidenceRefs(1기반)/disclosureRisk`; 수정 후보는 별도 revision 파일(원본 JSON 불변).
5. **공개 위험 검사** — 34 c4 `direct_answer`, 38 c1 `answer_implying`이 `reveal<OFFICIAL_ANSWER`에서 노출되지 않는 회귀(AT05).
6. **학습지도 이벤트 어댑터** — 기존 HelpLevel/Completion → `LearningEvidenceClass`; 숙달 엔진 무수정(AT14 회귀 재사용).
7. G2 스모크: `/csat/item/2026-34|22|38` 1280/1440 격리 E2E.

DB가 필요한 후속(승인 대상, S1에서 SQL 제안만): L-* `csat_types` 시드(GAP-D02), 네모 어법 유형 행(GAP-D04), 비교 공개 필드(GAP-P01).

## 4. 기존 계약과의 충돌 요인

- C1 `csat_items_public.answer` 노출 vs CORE-06 공개 제어 — 서버 측 정답 노출은 기존 G2 계약. 화면 공개 제어로만 해결할지 결정 필요.
- C2 강의 schema1 `focus`(0기반) vs v3 evidence(1기반) — 어댑터에서만 변환, 데이터 불변.
- C3 기존 v3 7장면 강의 타입(task…explain) vs v4 "6단계는 상태 기계 아님" — 장면 순서 강제 여부 확인.
- C4 T-0091(내 설명→학습 정리, 진행 중 BLOCKED)이 theater/inquiry를 수정 중 — S1은 해당 파일을 피하고 `lib/csat/skeleton-v4/`에 신규로 둔다.
- C5 비교 데이터가 정적 import → CORE-07 "비공개 본문 미전송"은 서버 API 경유 전환 없이는 불가.
