<!-- docs/implementation/learning-outcomes-20261021/02C-REASSESS-PLAN-SPEC.md -->
# 2C — 독립 확인 결과에서 실제 다음 계획 저장까지

2026-10-21 · 기준 `1f9804f12`. 2B의 교수 저장은 완료했지만 필수4·5는 남았다. 새 기능을 넓히기 전에 이 종단을 끝낸다. 사람 검증은 Claude/Codex가 대체하며, 테스트용 응답을 실제 학생 성과로 적재하지 않는다.

## 구현과 수용 기준

1. **저장한 설명 재진입**: 현재 원장은 보존되지만 새로 열면 다시 선택 답을 제출해야만 패널이 열리고 저장된 설명을 읽지 못한다. 현재 납품/교수 판본/본인 설명을 안전하게 읽어 페이지·Runner에 복원한다. 이미 설명이 있으면 새 채점·새 설명 INSERT 없이 저장된 비교/관계/절차와 다음 단계를 읽는다. 타인·철회·구원천·구계획이면 현재 학습 가능으로 보이지 않는다. 저장 이력 조회와 새 학습 허용은 구별한다. 본인 자유 설명을 읽는 것이 Gold 유출이 되지 않는다.
2. **독립 자료로 실제 연결**: 같은 Workspace의 기존 authored 공급/열기/Runner를 사용한다. 검토된 ind-2·ind-3 중 미노출 자료만 공급한다. 설명 완료 후 화면의 계속하기가 현재 공급/다음 행동에 맞게 독립 확인으로 이어지는지 확인한다. 없는 자료/승인/미설치는 준비 중이며 빈 성공으로 만들지 않는다. source guided/reflection 기록을 직접 확인/성취 근거에 넣지 않는다.
3. **기존 계산과 실제 저장**: 새 실제 G2 결속 응답을 읽어 기존 load/composeV4→asIsMap→planWorkspaces/repairGate→nextActionOf를 사용한다. 기존 `/api/csat/diagnosis/map/plan`·`buildCommitPayload`·`commitPlan`·`learner_workspace_plan_commit`으로 현재 goal/plan 기대 버전에 `check_result`의 **새 계획 버전이 DB에 저장**되어야 한다. 화면이나 순수 함수의 다음 행동만 확인하는 시험은 완료가 아니다. 새 점수 임계값·새 목표 표·별도 계획 엔진을 만들지 않는다. 저장 확인 전에는 재계획 완료가 아니다.
4. **결합 설치 종단 시험**: 기존 기반 C/B/I1/I2/G2/D3/실제 grade 정의→authored pending→AI overlay→1C→1D→2B를 한 PGlite DB에 적용한다. 실제 소스 안내 기록/설명→실제 AI 검수5개 등록(사람결정0)→같은 학습자 미노출2개 공급→기존 실제 채점/learning_task_attempts/G2→실제 계획 함수의 버전 저장을 연결한다. 나머지 도메인 입력을 대역으로 쓴다면 명시하고 결과 근거·계획 저장을 대역으로 바꾸지 않는다.
5. 반례: 낡은 goal/plan, 동일 키 재전송·다른 본문, 응답 유실 복구, 도움/노출 재사용/철회/다른 학습자, 같은 source의3문항을 독립3지문으로 세지 않음. 실패/없음/미설치/미상 구분. source 교수 저장이 G2에 섞이지 않음. 긍정 시험에 Gold 답안을 쓰는 경우 합성 회귀임을 쓰고 AI 학습자 관측으로 주장하지 않는다.
6. 실제 PC3B 컴포넌트·CSS 브라우저에서 재진입 복원/같은 Workspace/평가 계속하기/계획 저장 오류와 재시도를 확인한다. 인증/HTTP 응답 대역과 실제 SQL 검증 범위를 분리해 적는다. 실제 Supabase 인증/RLS/두 연결 동시성은 실행하지 않았다면 NOT_RUN. 관련 시험·타입/lint와 docs/LEARNING_MODEL/MODULES/DB_SCHEMA/ROUTES/CHANGELOG/로드맵·02C 결과를 갱신한다.

## 이미 수정된 경계

2B SQL 함수는 `source_lesson_reflect(uuid,text,jsonb,uuid,uuid)`다. 마지막 `p_delivery`는 직접 영수증 RPC 호환용 기본 null이지만 HTTP 경로에서는 반드시 전달하며 저장/멱등 응답 전에 검사한다. root 반례가 수정 전 실제 저장 성공을 재현했고 이후 거절·행0증가를 확인했다. 원본 함수/시범 해시를 임의 변경하지 않는다. 소스 교수 JSON은 authored 디렉터리에 있지만 AUTHORED_SETS에 없고 창작 등록 금지다.

공유 DB 변경·계정 생성·마이그레이션 적용·발행·원격 push/merge는 하지 않는다. 새 SQL이 필요하면 pending으로 둔다. 일반 개발 dev-minimal-20261020. 파일30개 이상으로 커지지 않게 이 범위만 처리한다. 다음은 3 FAST 제작이며 이번 종단이 끝나기 전에 신규 화면 범위를 늘리지 않는다.
