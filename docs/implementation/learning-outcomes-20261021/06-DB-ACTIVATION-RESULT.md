<!-- docs/implementation/learning-outcomes-20261021/06-DB-ACTIVATION-RESULT.md -->
# 승인된 DB 활성화 — 실제 적용 결과

2026-10-22 · **개발 DB 적용·사후 검증 완료**. 이번 대화에서 사용자가 직전 7단계 SQL·신규 원장9개·관련 RPC·기존 해설2건 수정 요청에 직접 `승인`했다. 별도 기존 FINAL MISSION A 승인으로 갈음하지 않았다. 콘텐츠 등록·발행·실제 개인 공급은 이번 적용에 포함하지 않았다.

## 적용 이력과 승인 결속

`20261021175340_learning_outcomes_ai_factory_activation_approved_20261022` · 적용 시각 2026-10-22 02:53:40 KST. [저장소 정본 SQL](../../../supabase/migrations/20261021175340_learning_outcomes_ai_factory_activation_approved_20261022.sql)의 SHA-256은 승인본과 DB 이력 statements 모두 `e84a960723766efc6c798ae09307d8a9e776e46b4d3e7d6f937966a54b312d8d`다. 서버 이력 statements는 1개이며 7단계가 단일 트랜잭션으로 적용됐다. 원래 승인 SQL/manifest를 변경하지 않았다.

첫 도구 요청은 승인 훅이 일치하는 `supabase/migrations/*.sql` 파일을 찾지 못해 **DB 실행 전에 차단**했다. 소유 작업공간에 동일 SQL과 사용자 승인 SHA를 기록해 정상 훅을 통과했고, 서버가 부여한 실제 version으로 파일명을 맞췄다. 훅/리뷰 설정을 끄지 않았다. 차단 뒤 새 표·이력이 없는 것도 SELECT로 확인했다.

## 실제 사후 검증

[휴대 가능한 before/after·권한·해설·미리보기 증거](./evidence/activation-20261022/activation-verification.json).

| 항목 | 실제 결과 |
|---|---|
| 새 원장9개 | 모두 존재·0행·RLS ON |
| 표 직접 쓰기 | anon SELECT 불가, authenticated/service_role 직접 INSERT/UPDATE/DELETE/TRUNCATE 불가 |
| 표 보호 | 각 표 writer/append-only 트리거2개, 미검증 제약0 |
| 관련 함수35개 | anon EXECUTE 모두 false; 인증/관리자/본인 경계를 갖는 RPC만 기존 계약에 따라 허용 |
| 기존 이벤트 | 기존 이름89개 모두 새 CHECK에서 보존 |
| 기존 기록 | 주문1·공용 제품주문3·링크3·수요1·납품/자격/승인/G2 0행 그대로 |
| 기존 두 문항 | id·원문·발문·선지·정답·시도 보존, `rationale_ko`만 독립 검수안과 완전 일치 |
| 원천·핵심 함수 | 원문 내용 SHA 및 목표계획 저장/개인계보/원천 적격 함수 SHA 불변 |
| 실제 현재 행 재사용 | 두 독립 AI 검토의 대상 해시와 현재 DB 행 일치, 실제 순수 계획기 미리보기2회 통과 |

입고 가능 상태로 승격하지 않았다. 기존 패킷의 합성 계보와 F/H 등 보류는 남아 있으며 `real_admissible=false`다. 실제 새 주문·새 검수 결속과 자격/출시 승인 없이는 학습자에게 공급하지 않는다.

checkpoint 스킬로 `learning-outcomes-20261022-e84a9607` before(02:50:46 KST)/after(02:54:17 KST)를 찍었다. DB 크기 +0.7MB, 인증 실행 가능한 SECURITY DEFINER 지표 +16은 새 RPC 경계 추가와 함께 점검했다. 함수 anon 실행0·익명 표 노출 지표 불변·mutable search_path 지표 불변이다. bloat 표본의 appeared/disappeared는 서로 다른 표의 회전 표본으로 수집 실패가 아니다. 기존 함수 정의/ACL·제약·두 행 원본은 제어공간 `runtime/learning-outcomes-20261021/activation-20261022`에 보존했다.

## 회귀와 이력 재생의 한계

적용 뒤 관련6파일53개 PASS: 적용 SQL 해시/빈 DB 원자 거절3·해설 수정/복구5·기존 문항 재사용18·실제 재계획15·최신 main의 유지 상태6·공장 복귀6. 웹 타입 검사와 변경 파일 ESLint도 통과했다. 이 검증은 이전 전체1,356개·PC8개·빌드 통과 기록과 구분한다.

이 이력 SQL은 승인된 기존 함수/원천/두 행의 preimage에 묶였다. 빈 DB에서는 가드로 거절하고 전체 롤백하는 것이 정상이며, 재실행도 신규 표 부재 가드로 거절한다. CI의 기존 known-migration-failures 원장에 이 파일과 이유를 명시했다. 실제 성공한 개발 DB 적용을 빈 DB 전체 재생 성공으로 보고하지 않는다. 기존 CI 격리 창작 스키마 fixture 경로는 유지한다. 전체 GitHub CI는 이번에 실행하지 않았다.

`pnpm docs:db-stats`는 소유 작업공간에서 환경 키 부재로 종료2였고, 정본 main-serving에서 다시 실행해 정상 종료·AGENTS 자동 갱신을 완료했다. 수치를 손으로 고치지 않았다. 생성된 전체 활동 수치는 다른 세션의 활동도 포함하며 이번 마이그레이션 효과로 귀속하지 않는다. 이번 변경의 실제 변경/보존 값은 전후 MCP SELECT로 별도 확인했다.

## 미실행 범위

콘텐츠 등록·AI 결정 기록·출시·실제 납품·학습자 계정 조작은 0건이다. 실제 인증 사용자 HTTP 학습 종단과 두 연결 동시성도 NOT_RUN이다. 사람 모집은 선행조건이 아니다. 다음 데이터 작업은 실제 주문 계보·현재 검수 바이트·적격성·구체적 쓰기 범위를 확정해 진행해야 한다. AI A/B의 우위 판정 불가와 SIMULATED_DELAY 한계는 그대로다.

복구는 별도 승인 대상이다. 두 해설 역방향 SQL은 자격/입고 전의 정확한 현재 행에만 쓸 수 있다. 원장에 데이터가 생기면 지우지 않고 쓰기 진입을 중지한 뒤 별도 복구안을 마련한다.
