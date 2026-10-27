<!-- docs/implementation/learning-outcomes-20261021/00-AUDIT-SPEC.md -->
# 단계 0 — 구현 현황과 첫 E2E 설계 확정

## 목적

분석 자료를 실제 코드에 대조하여 중복 개발을 막고, 단계 1을 구현 가능한 파일·함수·테스트 수준으로 만든다. 보고서의 과거 숫자·상태를 현황으로 복사하지 않는다.

## 범위

제품 코드는 읽기 전용. 이 디렉터리의 00-AUDIT-RESULT.md 및 01-E2E-SPEC.md, prompts/01-E2E-CLAUDE.md만 작성한다. 새 규칙·제품 정본·DB·진행 중 중앙 작업·다른 worktree는 바꾸지 않는다.

## 조사할 실제 경로

일반 독해 R0 진입/목표/계획/학습/평가/기록과 CSAT 특화 경로를 분리해 확인한다. packages/library-pipeline/src/textbook 및 scripts/textbook의 실제 생산 호출, apps/web/src/lib/csat/map/v62/factory-bridge, delivery-binding, assessment-exposure, exposure-ledger, knowledge/protocol.ts와 실제 API/UI 호출부를 찾는다. 계보 타입만 있고 제품 호출이 없는 경우를 명시한다.

## 필수 산출물

1. 실제 파일/심벌/호출부별 재사용·부분 연결·미구현 표. 코드 존재/실행 검증/실DB 반영 상태를 구분한다.
2. 단계 1의 최소 대표 학습목표와 실제 지원되는 활동을 선정한다. 중등 일반 독해 정본을 바꾸지 않으며 CSAT 경로는 재사용 자산으로 분리한다.
3. 학습목표·goal/plan revision·요청 idempotency·Product Order revision·artifact/content revision·delivery·attempt·assessment·next-plan의 연결 계약과 서버 신뢰 경계를 정의한다.
4. 01-E2E-SPEC.md: 수정할 파일/함수, 데이터 모델, 상태 전이, API/UI 호출, 실제 시험 명령, 오류/미노출/도움/타인/오래된 판본/중복 재시도 수용 기준, 비목표, DB 승인 의존성. 설계 없는 신규 공통 프레임워크를 만들지 않는다.
5. prompts/01-E2E-CLAUDE.md: 구현 가능한 명령형 작업 지시. 실제 경로만 허용하고 제품 호출·검증까지 요청한다. 순수 함수·mock 성공만으로 E2E 완료 보고 금지.
6. DB 확인이 실행 불가면 DB 현황은 UNKNOWN. SQL 승인 없이 조회 스크립트의 숨은 쓰기·공유 DB 테스트를 실행하지 않는다.

## 검증

출력은 파일 참조·근거·남은 불확실성이 일치해야 한다. 기존 관련 테스트가 준비돼 있으면 소수 실행하고 명령/로그/실행 여부를 기록한다. 설치나 비밀 출력은 하지 않는다. 발견되지 않은 파일이나 실행되지 않은 시험을 근거로 쓰지 않는다.
