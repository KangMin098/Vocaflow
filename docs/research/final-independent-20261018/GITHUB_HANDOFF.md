<!-- docs/research/final-independent-20261018/GITHUB_HANDOFF.md -->
# 최종 독립 검증 인계

현재 후속: [변경분 원장](./REWORK_DELTA_REVERIFY.md)의01c/1ee·bcc/92ea 실제 HEAD 결과가 아래 과거 인계보다 우선한다. FI-006/010/014/015/016/017은 명시 범위의 후보 수정 확인, FI-018은 PR312에서도 잔여가 있어 REWORK다. 실제 DB/사람 승인·전체 A~H 수용은 별도다.

2026-10-18 · Codex-VOCAFLOW-FINAL-ACCEPT. 사용자 후속 게시 명시 승인에 따라 아래 이슈와 증거 브랜치를 게시했다. **전체 제품 REWORK · 새 수정 HEAD로 재검증 재개**. 최신 결과는 [변경분 원장](./REWORK_DELTA_REVERIFY.md)을 따른다. 전체 목표 완료/수용 선언이 아니다.

증거 브랜치: `review/final-independent-20261018`. 최신 고정 [PR303](https://github.com/KangMin098/Vocaflow/pull/303)은 `4a42b2b65eaaa164cc12a487dfcb806657ef9399`, [PR250](https://github.com/KangMin098/Vocaflow/pull/250)은 `f6f74eb3831866380eb60b41e8aacea561d177cd`이며 둘 다 OPEN이다.250 HEAD를 포함한 실제303 통합 소스를 확인했다. 양쪽 최신 CI의 build/e2e/faultclosed는 성공했지만 verify 쓰기 예산은 실패했다. 실제 DB 적용·전체 수용·병합 완료를 주장하지 않는다. 아래 후속 기록은 시간순 이력이다.

| 기존 ID | 이슈 | 수정/독립 재검증 상태 |
|---|---|---|
| FI-001 | [#293](https://github.com/KangMin098/Vocaflow/issues/293) | 후보에서 명시 납품/복구 개선 확인 · 전체 환류 수용 전 |
| FI-002 | [#294](https://github.com/KangMin098/Vocaflow/issues/294) | FIX_VERIFIED_IN_CANDIDATE ·7e SQL 공급 차단 확인 |
| FI-003 | [#295](https://github.com/KangMin098/Vocaflow/issues/295) | FIX_VERIFIED_IN_CANDIDATE ·7e SQL 양방향 정체성 확인 |
| FI-004 | [#296](https://github.com/KangMin098/Vocaflow/issues/296) | FIX_VERIFIED_IN_CANDIDATE ·7e SQL assess 권리 별도 확인 |
| FI-005 | [#297](https://github.com/KangMin098/Vocaflow/issues/297) | FIX_VERIFIED_IN_CANDIDATE · 원래 모집단/측정 오기, 사람 내용 검수 별도 |
| FI-006 | [#298](https://github.com/KangMin098/Vocaflow/issues/298) | FIX_VERIFIED_IN_CANDIDATE ·4a42 실제 PostgreSQL 두 연결4사례/역사 영수증·본문 불일치/기존 행 불변 확인 |
| FI-007 | [#299](https://github.com/KangMin098/Vocaflow/issues/299) | FIX_VERIFIED_IN_CANDIDATE ·7e 서버 열기/충족/목록 확인 |
| FI-008 | [#300](https://github.com/KangMin098/Vocaflow/issues/300) | FIX_VERIFIED_IN_CANDIDATE · 두 폭 Runner/G2 재생 |
| FI-009 | [#301](https://github.com/KangMin098/Vocaflow/issues/301) | FIX_VERIFIED_IN_CANDIDATE ·4655 수정/두 폭 독립 대조 |
| FI-010 | [#302](https://github.com/KangMin098/Vocaflow/issues/302) | FIX_VERIFIED_IN_CANDIDATE · 실제 RSC/SQL4검사: 공개 전 기록·실패·commit/ack 유실·최초/완료 복귀. 실제 JWT/개발 DB 별도 |
| FI-011 | [#304](https://github.com/KangMin098/Vocaflow/issues/304) | FIX_VERIFIED_IN_CANDIDATE ·71a 로더17 TASK 및 실제 CI 두 폭 Workspace 복귀/결과 표시 확인. 전체 PLAN 의미 갱신은 별도 미검증 |
| FI-012 | [#305](https://github.com/KangMin098/Vocaflow/issues/305) | FIX_VERIFIED_IN_CANDIDATE · 대체 집합/불완전 대조/두 폭 UI |
| FI-013 | [#306](https://github.com/KangMin098/Vocaflow/issues/306) | FIX_VERIFIED_IN_CANDIDATE · 단수 ditch 제거 |
| FI-014 | [#307](https://github.com/KangMin098/Vocaflow/issues/307) | FIX_VERIFIED_IN_CANDIDATE ·4a42 제품이 독립 후보의 채점/Gold/UI 바이트를 채택, 기존 조합/브라우저 재사용. 사람 승인은 별도 |

각 이슈에 고정 대상 커밋, 재현 조건/관찰, 기대 동작, 원본 결과/화면 링크를 포함했다. 수정 HEAD/PR이 오면 같은 ID에서 정상 대조군과 반례를 독립 확인한다. 동일 이슈를 다시 만들지 않는다.

현재 공개 자료는 합성 fixture의 계약/무결성·교육·UX 검증이다. 비밀값·실제 학습자 데이터·권리 미확인 기출 원문을 포함하지 않는다. 실제 권한 침해를 가능하게 하는 민감한 취약점 재현은 이 공개 디렉터리에 넣지 않고 비공개 보안 경로로 전달한다. 실제 DB 쓰기/데이터 삭제/배포/권한 변경이나 PR 병합은 게시 승인에 포함하지 않는다.

[통합 A~H 현황](./ACCEPTANCE.md) · [전체 결함 원장](./FINDINGS.md) · [SQL 검토](./AUTHORED_SQL_REVIEW.md) · [콘텐츠 검토](./AUTHORED_CONTENT_REVIEW.md) · [종단/브라우저 검토](./AUTHORED_INTEGRATION_REVIEW.md).

후속: [PR303](https://github.com/KangMin098/Vocaflow/pull/303)이 제출됐다. 첫 c4b9f434e의 명시 납품/복구 낮은 층위26건은 통과했고 검토 중 de5065b51 형식 확장이 추가됐다. [HEAD별 독립 검토](./PR303_REVIEW.md)는 REWORK다. FI-011은 [#304](https://github.com/KangMin098/Vocaflow/issues/304)로 추가했으며 Workspace/다음 요구/전이량 환류 누락을 같은 ID로 추적한다. 기존 표의 OPEN은 수정 전 보고 또는 전체 수용 대기이며, FI-001의 확인된 부분 개선을 취소하는 뜻은 아니다.

후속 게시: FI-012는 [#305](https://github.com/KangMin098/Vocaflow/issues/305)로 추적한다. FI-009는 4655e9be4 수정과 두 폭 독립 화면 대조로 FIX_VERIFIED_IN_CANDIDATE이며 [형식 검토](./AUTHORED_FORMATS_REVIEW.md)에 연결했다. 새 이슈를 만들지 않는다. PR303은 22b5e43c5까지 확장됐고 전체 제품 REWORK를 유지한다.

FI-013은 [#306](https://github.com/KangMin098/Vocaflow/issues/306)에 게시했다(증거0813144bd). FI-012의 실제 inf-guided-1 사례는 기존 #305에 추가했다. FI-009 수정 확인 댓글은 #301 issuecomment-6248205960, PR303 후속은 issuecomment-6248206150이다. 공용 VFC DL-0158에도 상태를 전달했다. [CI 브라우저 독립 판독](./PR303_BROWSER_EVIDENCE.md)은6건 중 R5 두 폭2건을 구별한다.


최신 후속: 추가10 TASK/60문항 및 새4형식 검토를 d1a782394에 push했다. FI-014는 #307, PR303 인계 댓글은 issuecomment-6248394108, 공용 상태 DL-0159다. 동일3c15 CI39115796299 실패 원인은 Runner83 unused DEMAND_LABEL이며 수정 HEAD의 필수 체크 재확인이 필요하다. 실제 DB 쓰기/사람 승인/병합은 수행하지 않았다.

후속 SQL 재검증 게시: #294 issuecomment-6248673835, #295 issuecomment-6248674062, #296 issuecomment-6248674203, #298 issuecomment-6248674365, PR303 issuecomment-6248674507. 공동 인계 DL-0160. [실제7e SQL](./SQL_REPAIR_REVERIFY.md)과 [서버/RSC](./SERVER_REPAIR_REVERIFY.md)를 함께 보며 과거 HEAD의 미수정 판단을 최신에 그대로 적용하지 않는다. 전체 A~H REWORK는 유지한다.

## 지속 자동 승인 기준

2026-10-18 사용자 「방금 같은 승인은 자동 승인으로 기준 변경해」에 따라 이번 임무의 검증·관련 GitHub 이슈/PR 검토 게시·검증 브랜치 commit/push·Claude 총괄 인계를 추가 확인 없이 진행한다. 신규 결함과 수정 후 재검증에도 적용한다. 공동 원장 DL-0162와 로컬 목적 파일에 기록했다. 비밀값/실제 학습자 개인정보·응답/권리 미확인 기출 원문 제외, 민감한 보안 재현의 비공개 전달, 실제 DB 쓰기·삭제·배포·권한 변경·사람 Gold/권리 승인 제한, 기존 CI·safe-merge 조건은 유지한다. 시스템 차단을 우회하지 않는다.

7e 앱·환류 후속: FI-008 AuthoredRunner 재시도는 두 폭의 동일 의미 요청과 G2 duplicate/변경시각 conflict로 수정 확인, FI-012 대체 결정 근거도 실제 채점기/두 폭 UI에서 수정 확인했다. FI-005 원래 모집단/측정 오기와 FI-013 단수 ditch 대안은 후보 수정 확인이며 사람 내용/Gold 승인은 아니다. FI-011 중심 의미3반례는 개선됐지만 기존 추론·어법·문맥 어휘 Workspace가 적격 링크에도 목록에서 제외돼 PARTIAL_FIX / OPEN이다. [통합 후속 근거](./APP_REPAIR_REVERIFY.md).689 CI9형식 timeout은 trace의 trial 대기이며9bd 수정 후 새 run39120198955는 관찰 시 진행 중이다. 전체 A~H REWORK 유지.

후속 앱 게시174696498: #300 issuecomment-6248955969, #305 issuecomment-6248956129, #304 issuecomment-6248956308, #297 issuecomment-6248956488, #306 issuecomment-6248956655, PR303 issuecomment-6248956851. 공동 원장 DL-0163. [구조 위젯/실제 역할 검사](./STRUCTURE_SECURITY_REVERIFY.md)와 최신 READ ONLY 관찰을 추가했다. PR250은 OPEN(HEAD4fdc7ba76ac5f50493da668b85c1735e09a208ff)이며 총괄 관련 기능으로 다음 독립 검증 범위를 확인한다. PR303 새 CI run39120198955/e2e job117654074932는 현재 실행 중이다.

| 후속 ID | 이슈 | 상태 |
|---|---|---|
| FI-015 | [#308](https://github.com/KangMin098/Vocaflow/issues/308) | FIX_VERIFIED_IN_CANDIDATE · 실제 HTTP/PG13검사와 두 실제 browser store 경합/자동 재시도로 노트 보존 |
| FI-016 | [#309](https://github.com/KangMin098/Vocaflow/issues/309) | FIX_VERIFIED_IN_CANDIDATE · 비공개 HTTP/PG4검사, 합성 인증 경계. 실제 JWT 별도 / DL-0177 |
| FI-017 | [#310](https://github.com/KangMin098/Vocaflow/issues/310) | FIX_VERIFIED_IN_CANDIDATE · 실제 통합256f가2502549 포함, 불변 검사 재사용·변경 store5검사/3브라우저 컨텍스트 통과. 최신 CI 별도 |
| FI-018 | [#311](https://github.com/KangMin098/Vocaflow/issues/311) | PARTIAL_FIX / OPEN · PR312cefc 독립 경계 미충족, 비공개 DL-0177. safe-merge/실제 병합0 |

PR250 후속: [독립 검토](./PR250_REVIEW.md)는 REWORK다. 실제 위젯 두 폭21관찰은 확인했지만 서로 다른 노트의 동시 저장200/200 뒤 서버1건 누락을 FI-015(#308)로 재현했다. 새 보류 처리 경계 FI-016(#309)은 비공개 재현/DL-0165로 인계했다. 민감한 세부는 공개 원장에 싣지 않는다. PR303 [9bd CI 도달 범위·4a 수정](./PR303_4A_REVERIFY.md)은9형식 정상 경로와 실패한 지도 복귀를 구분하고, FI-011 확장3 Workspace는4a 후보에서 수정 확인했다. 전체 A~H REWORK와 실제 DB 쓰기/사람 승인 제한은 유지한다.

4a CI 종료 후속: [실제 로더/두 폭 실패](./PR303_4A_REVERIFY.md)를 확인해 FI-011 전체는 PARTIAL_FIX / OPEN으로 유지한다. 계산 함수의 확장3 Workspace 개선은 유효하지만, 실제 로더가 기존 정본 TASK 슬롯이 없는 창작 납품을 누락한다. 실제 병합 블록의17 TASK 합성 입력은 모두0개로 사라졌고 미리 슬롯을 만든 대조군만 보존됐다. CI39121633640의 두 폭은9형식·재시도·비근거·철회·키보드 뒤 지도 복귀에서 실패했다. 기존 #304로 인계하며 중복 이슈를 만들지 않는다. PR250은 [27개 해시/5문항 내용 한정 대조](./PR250_CONTENT_REVIEW.md)를 추가했고22문항 전체 의미 수용·사람 승인·효과는 미검증이다. 전체 A~H REWORK, 실제 DB 쓰기/사람 승인/병합0.

전체 제품 후속: [A~H 통합 보고서](./INTEGRATED_REPORT.md)를 현재 관찰과 PR/CI/병합 SHA·미완성/사람 조건으로 연결했다. [두 PR 통합 타입 결함 FI-017](./PR250_PR303_INTEGRATION.md)은 #310이며, 무시되는 스냅샷의 최소 후보만 타입 exit0을 확인했다. 실제 제품 수정은 아니다. FI-018(#311)의 민감한 병합 안전 재현은 비공개 DL-0168로 인계했다.27개 교수 설명의 원문/배포 해시·현재 분석 버전과 실제 형식/범위 검증은 일치/오류0, 직접 내용 판독은8문항이며19개는 미검증이다. 실제 DB11:53:47Z READ ONLY는 authored 미설치/FQ·납품·결속0. 전체 REWORK와 임무 진행을 유지한다.

최신 인계: [71a 수정/964 CI](./PR303_4A_REVERIFY.md), [FI-010 독립 후보](./SERVER_REPAIR_REVERIFY.md), [PR25027문항 전량 대조](./PR250_CONTENT_REVIEW.md)를 구분한다. 새 필수 게이트나 중복 이슈는 만들지 않으며 기존 ID의 수정/검증을 이어간다. 실제 DB 쓰기·사람 승인·병합0.

e46de4983 게시 영수증: [#304 후보 수정 확인](https://github.com/KangMin098/Vocaflow/issues/304#issuecomment-6249957751), [PR303144 고정 COMMENTED 검토](https://github.com/KangMin098/Vocaflow/pull/303#pullrequestreview-5563001973), 공동 원장 DL-0171. 후속144 CI39127042596도 verify/build/e2e/faultclosed 성공, shared-dev SKIPPED다. 두 주요 격리 spec 바이트가71a와 같아 기존 직접 report 판독을 재사용했다.144 artifact12135699816의 새 시각/내부 report를 판독했다고 주장하지 않는다.

후속 인계: FI-014 선택 후보0a06b5d11은 [기존 #307](https://github.com/KangMin098/Vocaflow/issues/307#issuecomment-6250039995)과 DL-0172로 전달했다. 제품 미적용·사람 미승인으로 OPEN이다.144의 [통합 관찰 Inspector22건](./OBSERVATION_UI_REVERIFY.md)은 새 화면의 격리 표시 범위를 확인했으며 전체 실학습/DB/PLAN을 대신하지 않는다.

통합 관찰 게시480a2e82b는 [PR303 코멘트](https://github.com/KangMin098/Vocaflow/pull/303#issuecomment-6250086205)와 DL-0173로 인계했다.2026-10-18T12:47:57Z [실제 DB 재확인](./completion-db-readonly.json)도 자격/출시 승인/납품/결속0, authored/사람 결정 표 미설치다. 최신 main/PR HEAD는 그대로이며 CI는 종료됐다. [원래 요구별 종료 대조](./INTEGRATED_REPORT.md)로 전체 미완성을 명시했다. 추가 게시 승인 질문은 하지 않는다.

3회 연속 외부 의존 재확인 뒤12:52Z 자동 실행은 외부 입력 대기로 전환한다. [마지막 실제 DB](./blocked-db-readonly.json)와 [전체 대기 조건/재개 입력](./INTEGRATED_REPORT.md)을 보존했다. 제품 경로/DB/사람 승인 권한을 대신 쓰지 않으며 기존 이슈에 전달한 수정을 새 이슈로 반복하지 않는다. 새 수정/실제 적용·revision 검수/수행 증거가 재검증 입력이다.
