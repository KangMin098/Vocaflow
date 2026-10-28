<!-- docs/implementation/learning-outcomes-20261021/prompts/01A-DEMAND-ORDER-CLAUDE.md -->
# 새 Claude Code 세션 — 단계 1A 저장 수요와 실제 공장 설계기 연결 구현

사용자가 교재공장 우선순위 분석을 설계→새 Claude 세션 구현→검증→다음 설계 순서로 끝까지 진행하라고 요청했다. 사람의 검수/학습자/채점 역할은 모두 Claude·Codex가 맡으라는 추가 지시가 있다.

작업공간 `D:/workspace/Vocaflow-learning-outcomes-20261021-work`, branch `feat/learning-outcomes-20261021`. 이전 세션을 resume/continue하지 않는다.

먼저 AGENTS.md, CLAUDE.md, apps/web/CLAUDE.md, dev-mode.json development_policy, 00-ROADMAP.md, **01A-DEMAND-ORDER-SPEC.md**를 읽어라. 01-E2E-SPEC.md와 그 지시문은 Codex가 목적 이탈로 반려했으므로 실행하지 않는다. 기존 조사 결과는 참고하되 넓은 탐색·subagent는 추가하지 않는다.

1. 현재 HEAD와 변경을 확인한다. 기존 campaign 문서는 Codex/이전 조사 결과이므로 자기 코드처럼 바꾸거나 되돌리지 않는다.
2. SPEC의 새 관리자 API·서비스를 구현하고 기존 공장 `buildStructuredProductOrderDraft`를 실제 호출한다. mock sealer나 새 독해 목표 시스템으로 대체하지 않는다. 현재 DB 수요와 canonical·버전·소유·수량을 검증한다. 모든 조회 오류는 fail closed다.
3. AC A1~A10의 정상·반례·API 통합 시험을 만들고 실제 실행한다. 권한 가드 전에 DB를 부르지 않는다. 가짜 승인·대응 validated·생산/납품 완료를 만들지 않는다.
4. 알려진 Vitest 환경 해결: `--pool=forks --maxWorkers=1 --minWorkers=1`로 worker를 1개만 사용하면 기존 47개 시험이 통과했다. 불필요한 package 설치·설정 변경을 하지 않는다. 타입·lint·관련 회귀를 실행하고 원시 로그를 결과에 연결한다.
5. ROUTES.md와 01A-DEMAND-ORDER-RESULT.md를 갱신한다. 실제 변경, AC별 상태, 명령·출력·남은 하위 단계, 데이터 쓰기 0, 브라우저 E2E 및 생산/납품 미실행을 명시한다.
6. 커밋하지 말고 종료한다. Codex가 실제 diff와 시험을 검토한 뒤 논리적 milestone을 커밋한다. 원격 push/PR/merge/배포/로컬 통합 금지.

타임스탬프를 로직 내부 시계로 읽지 말고 주입한다. 파일 첫 줄 경로 주석, 코드 완성형, 사용자·비밀 보호를 지킨다. 허용 경로와 검증 L3를 준수한다. 신규 migration·공유 DB 테스트·데이터 변경·삭제·계보 등록·생산·발행·납품은 이번에 실행하지 않는다. 단순 계약만 적고 실제 handler 호출·시험을 빼놓지 않는다.

최종 답: 실제 구현 파일, 수용 기준별 결과, 실패·미실행·반례와 다음 1B 작업에 필요한 입력. 제품 초안을 만든 사실과 학습효과/E2E 전체 성공을 구분한다.
