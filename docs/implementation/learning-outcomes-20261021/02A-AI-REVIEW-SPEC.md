<!-- docs/implementation/learning-outcomes-20261021/02A-AI-REVIEW-SPEC.md -->
# 2A — AI 검수 기반 공급 · DB 설치 완료 · 콘텐츠 적격 판정 별도

**2026-10-22 후속 직접 승인·설치:** 이 대화에서 사용자 직접 지침 “모든 실제 사람이 검증하는 부분은 모두 클코, codex로 대체하여 진행”과 7단계 SQL 적용 요청에 대한 `승인`을 확인했다. AI 검토 원장/관련 정책 래퍼를 포함한 정확한 승인 SQL이 개발 DB에 적용됐다([결과](./06-DB-ACTIVATION-RESULT.md)). 실제 콘텐츠 등록·Gold/권리·출시·공급은 0건이다. 이 사실을 FINAL MISSION 전체 완료나 개별 콘텐츠의 권리 부여로 확대하지 않는다. 아래 문단의 미확인은 독립 수용 정정 당시 기록으로 보존한다.

2026-10-21 · 선행 1A–1D. 전달된 세션 지시에는 사람 검증 역할을 Claude Code/Codex로 대체한다는 문구가 있다. FINAL MISSION 독립 대조에서는 B/B2 Gold·C 권리·출시 승인까지 위임한 사용자 직접 원문이나 채택된 정본은 확인하지 못했다. 이 문서의 종전 「사용자 지침」 재진술을 그 승인 근거로 사용하지 않는다.

목적은 AI 검토 영수증을 분리해 기록하는 소프트웨어 제안을 구현·격리 검증하는 것이다. 사람 검토를 했다는 진술은 생성하지 않는다. 기존 FINAL MISSION의 A(DB 적용)·B/B2(Gold)·C(권리) 승인 경계는 유지한다. AI 기반 공급 허용은 정책 채택이 확인되지 않은 별도 제안이며, 코드 병합·격리 시험·DB 스키마 승인을 해당 정책이나 실제 콘텐츠 출시 승인으로 계산하지 않는다.

## 범위

기존 `_pending_authored_supply.sql`의 창작 등록·노출 차단·G2·공급 판정은 재사용한다. 별도 보류 SQL과 서비스로 AI 결정 원장·철회·조회·공급 판정을 연결한다. 과거 사람 원장은 보존하되 이번 경로의 사람 결정 건수는 0이다. AI 결정은 외부 권리의 부여가 아니며 기존 선언/근거에 대한 검토라는 한계를 보존한다. 자체 창작 원본과 명시적 라이선스 원천을 구분한다.

실제 두 AI가 수락한 파일은 외부 runtime의 `r5-central-meaning.v3-candidate-r2.json`, SHA-256 `682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846`이다. 기존 `r5-central-meaning.v1.json` 경로에 정확한 바이트를 복사한다. set 버전은 v3, 전체 11개 중 검수 범위는 guided-1, ind-2, ind-3, transfer-1, delayed-1의 **5개**다. `authored-final-ai-review.json`이 파일·문항·body·Gold·두 세션·응답 해시를 결속한다. 나머지 6개는 자동 승인하지 않는다. legacy humanGold pending 메타데이터는 사람 승인으로 바꾸지 않는다.

## 구현 계약

1. AI 검토 증거 스키마와 순수 검증기: 대상 ref/TASK/role/revision/body/Gold, 실제 Claude·Codex 세션, 입력/출력 해시, 수락 범위, 검토 판본을 확인한다. 임의 문자열/미상/단일 AI/동일 세션/다른 문항/바뀐 내용은 차단한다. JS canonical hash와 PostgreSQL jsonb hash는 다르므로 명시적으로 변환·결속하고 같다고 가정하지 않는다.
2. 관리자 본인 세션으로만 AI 결정 기록/철회. `human-reviewed` 호출 금지. 추후 authenticated admin 요청을 통한 실행을 준비하되 현재 공유 DB에는 쓰지 않는다. append-only, writer trigger, RLS, default service_role 권한까지 명시적으로 제한. 재시도는 같은 입력만 멱등, 다른 입력은 conflict. 철회·revision/Gold/권리 근거 변화는 현재 공급 무효. 학습자에게 정답/검수 원장 직접 노출 금지.
3. 기존 `supply_human_decisions_ok`와 자격/납품/현재유효성에서 실제 AI 검토를 허용하는 호환 경로. 기존 사람 이력의 의미는 유지한다. DCP 원천은 authored로 위장하지 않는다. 1C 승인 없는 후보를 승격시키지 않는다. 근거 없는 qualification axes 검증 값을 생성하지 않는다.
4. 기존 `lib/csat/authored/server.ts`의 등록/후보 선택/자격/승인/납품/열기/실제 채점/G2 연결에 실제 호출부를 둔다. AI 검수가 요구되면 이번 5개만 선택된다. 코드만 만들어 미호출 상태로 남기지 않는다.
5. 결합 설치 순서를 명시하고 실제 PGlite에 이 순서 그대로 적용한다: 기존 C/B/I1/I2/G2/D3/lineage 기반 → authored pending → AI overlay → 1C admission → 1D learning. 동일 함수 rename/덮어쓰기로 검사가 사라지면 수정한다. 단독 SQL 시험 통과를 결합 설치 통과로 대신하지 않는다.

## 수용 기준

- 격리 SQL에서 실제 5개 중 하나를 등록 → AI 결정 → 실제 자격/승인/주문 → 납품 → 열기 → 실제 기존 채점/학습기록 → G2 결속까지 실행한다. 사람 결정 행 수 0을 단언한다.
- 검토 없는 6개, 한 AI 누락/불일치, Gold 변경, 본문 변경, 철회, 과거 노출 지문 평가 재사용, 잘못된 역할/사용자, 직접 INSERT/UPDATE/DELETE, 반복 요청을 반례로 시험한다.
- 기존 DCP 실제 채점/배송완료 후 열기·낡은 plan 차단 회귀가 결합 설치에서도 통과한다.
- 관련 vitest, web/scripts 타입, 변경 lint를 실제 실행. 공유 DB 적용/실제 RLS/두 연결 동시성/실로그인 E2E는 실행하지 않았다면 NOT_RUN.
- 같은 작업에서 DB_SCHEMA/LEARNING_MODEL/MODULES/CHANGELOG/로드맵 및 02A 결과 갱신. 자동 효과 검증 성공/전체 R0 완료/권리 확보로 표현하지 않는다.

다음 2B는 원천 기반 교수 활동 및 새 평가 결과의 실제 다음 계획 저장이다. 여기서는 새 목표 테이블·평가 알고리즘·모집·실데이터 발행을 추가하지 않는다. DB 적용은 SQL/영향/복구안을 제시한 뒤 사용자 승인 대상이다.
