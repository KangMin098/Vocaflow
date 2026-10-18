# LM-G1.3a PR #274 — 독립 T3 검증 프로토콜

고정 제출 HEAD: 305ad246863a473a8332b6e42141299c62247f13. 기준 main: 4cba17a36884eb6bc59bfb19baf6845eee7cc064. 제출 화면 소스: 085040e64. 독립 브랜치: review/lm-g1-3a-t3-acceptance. 최초 관찰을 수정 후 PASS로 덮지 않는다.

## 수용 기준

- 같은 요청키는 하나의 불변 목표에 결속한다. 서로 다른 본문에 저장 성공을 반환하지 않는다. 사전 조회 두 개가 모두 miss하는 C 반례를 강제한다.
- A 동일 키/본문 순차, B 다른 본문 순차, C 다른 본문 동시, D 같은 본문 동시, E 응답 소실 재시도, F 옛 키 재전송, G 두 탭, H 응답/저장 행 대조, I 조회/RPC 실패를 구별한다.
- 신규 날짜는 Asia/Seoul 오늘 이상. 형식은 실제 달력 검증. 저장된 정확한 재전송은 날짜 경과와 무관하다. 목표일은 시간대 없는 달력 문자열이다.
- 목표 점수·시험·PLAN goal_version_id는 한 목표 snapshot을 사용한다. 최신 값 읽기→이력 읽기→저장 PLAN 읽기 사이 목표 변경을 실제 함수/개발 DB에서 주입한다. 응답 지연 중 입력값을 옛 계산과 결합하지 않는다.
- 수능 종류와 시행 월은 다르다. 평가원/교육청 분리, 정답45·배점100, 오답률 관측/미관측, reveal 보류/실패를 구별한다. 학평 일부 관측을 전체 적격으로 승격하지 않는다.
- 80/90 미지정·수능, 90 수능/6월/9월/학평을 비교한다. 순위 변화는 필수 조건이 아니다. 실제 렌더링 입력으로 기존 composeV4/ranksOf를 재실행해 근거를 보존한다.
- PLAN append-only·현재 목표로 복원·목표 불변·20개 초과 옛 목표의 명시적 상세 확인 불가·본인 권한을 확인한다.
- 실제 Chromium 1280×900/1440×900에서 LM-W1 구조와 R5/T1/복귀/기출/공급을 보존한다.

## 층위와 중단 규칙

순수 함수/정확한 소스 격리, 실제 개발 DB 함수/API, 실제 Chromium, 학습 효과를 분리한다. 모의 hook scheduler는 브라우저 증거가 아니다. 실제 합성 계정도 학생 효과가 아니다. 오류·skip·중단을 PASS로 계산하지 않는다.

DB schema/RPC/RLS 적용, 실제 학생 수정, 교육 콘텐츠 생성, grade-only 및 근거 없는 점수/학습량, 화면 확장은 제외한다. SQL 초안은 감사만 한다. 합성 계정은 자기 ID를 즉시 ignored local에 기록하고 삭제 후 정확한 user_not_found/404로 부재 확인한다. 사용자·원문 전문·자격 증명은 공개 증거에 넣지 않는다.

## 재현

- 순수: pnpm --filter web exec vitest run src/lib/csat/map/v62/__tests__/goal-save-safety.test.ts src/lib/csat/map/v62/__tests__/target-goal.test.ts src/lib/csat/map/v4/__tests__/plan-store.test.ts
- 실제 함수: node --tls-max-v1.2 --env-file=<private> scripts/research/lm-g1-3a-independent/live-race.mjs revised
- snapshot: 같은 옵션으로 snapshot-race.mjs original/revised. original은 제출 load.ts만 git show로 읽고 의존 함수는 현재 검증 소스를 사용한다.
- hook: node scripts/research/lm-g1-3a-independent/goal-hook-probe.mjs
- PC: checks.mjs browser는 자기 서버/계정만 소유한다. 독립 browser와 제출 회귀를 구별한다. source-loader는 TS 모듈을 변경 없이 실행하며 실제 렌더링 data만 재계산한다.

원문·DB 개별 기록·raw runtime/flight·계정 식별자는 local에만 보존한다. 공개 보고서는 hash·집계·안전한 사례·스크린샷과 실행 버전을 보존한다.
