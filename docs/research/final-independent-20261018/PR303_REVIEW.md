<!-- docs/research/final-independent-20261018/PR303_REVIEW.md -->
# PR303 독립 검토 체크포인트

**판정: REWORK. 병합 수용 전 수정 필요.** [PR303](https://github.com/KangMin098/Vocaflow/pull/303)의 첫 고정 검토 HEAD는 `c4b9f434e7125638af56de414607a4870d652c89`다. 검토 중 HEAD가 `de5065b51e6e0c98c119fdc02afc7142dbd68167`(형식 레지스트리 확장)로 바뀌었다. 아래 결과를 새 형식 전체의 수용으로 확대하지 않는다.

## 확인한 개선

- FI-001의 최신 납품 추측이 제거됐다. 명시 deliveryId가 없으면 no_provenance, 역할 불일치는 거절 후 올바른 납품으로 복구 가능하며 재전송은 첫 결속을 보존한다. 서버도 소유자/문항/역할/활성 Workspace를 재검사한다.
- 독립 추출한 c4b9f434e에서 실제 SQL+서버의 authored-flow10, FI-001 다중 Workspace/같은 역할/복구6, binder 단위10 — **26건 통과**했다. 실제 DB 환경값은 복사하지 않았고 쓰기 차단 preload를 적용했다. 같은 G2를 올바른 A 납품에 보존하는 낮은 층위의 수정은 확인됐다.
- 목록과 학습 링크가 deliveryId를 유지하고 서버/Runner/결속 복구 API로 전달된다. UI/실제 Supabase E2E 및 같은 Workspace/PLAN의 다음 행동까지 수용은 아직 보류다. 복구 버튼은 현재 화면의 mutation 상태에 의존하며 기존 #291의 영속 재시도 한계가 자동 해소된 것으로 세지 않는다.
- 창작 v2의 4문항 선택지 수정(개별 선택지5개)과 Gold 설명 수정을 검토했다. [판독](./authored-v2-codex-reading.json)을 새 Gold/검토 D 열람 전에 [봉인](./authored-v2-seal.json)했다. v1 Gold를 이미 아는 검토자이므로 신규 맹검 인원으로 세지 않는다. [실제 채점 대조](./authored-v2-grader-comparison.json)는 선택9/9 일치·주요 중심 문장9/9 수용이다. 사람 Gold/권리 승인은 아니다.

## 병합 수용을 막는 현재 계약 오류

| ID · 이슈 | 현재 증거와 상태 |
|---|---|
| FI-002 [#294](https://github.com/KangMin098/Vocaflow/issues/294) | 등록 TASK/역할과 다른 FQ/유효 공급 허용. SQL 바이트 동일, 미수정 |
| FI-003 P1 [#295](https://github.com/KangMin098/Vocaflow/issues/295) | 동일 본문의 그룹명 변경으로 교수 선행 노출을 새 독립 지문으로 계산. SQL 동일, 미수정 |
| FI-004 [#296](https://github.com/KangMin098/Vocaflow/issues/296) | licensed 권리의 assess 누락을 평가 공급에서 검증하지 않음. SQL 동일, 미수정 |
| FI-005 [#297](https://github.com/KangMin098/Vocaflow/issues/297) | ind-1의 아동/독창성 연구 서술은 v2도 동일. 선택지 합의와 별개인 콘텐츠 REWORK |
| FI-006 [#298](https://github.com/KangMin098/Vocaflow/issues/298) | 실제 PostgreSQL 같은 지문 묶음 동시 공급2행. SQL 동일, 미수정 |
| FI-007 [#299](https://github.com/KangMin098/Vocaflow/issues/299) | 새 deliveryId 계약을 사용해 c4b9f434e에서 재실행: DB valid=false 뒤 open=ok/현재 수요충족/대체 주문 없음. [현재 로그](./pr303-authored-currentness.log) |
| FI-008 [#300](https://github.com/KangMin098/Vocaflow/issues/300) | 같은 답 재시도에서 answeredAt을 새 Date로 만드는 경로가 c4와 de5065b51에도 남음. 기존 실제 브라우저→G2 conflict 증거 유지 |
| FI-009 [#301](https://github.com/KangMin098/Vocaflow/issues/301) | 교수 자유 서술 번호가 여전히 저장 인덱스다. v2의 Gold 오답 설명에도 0번/저장 인덱스 참조가 남아 같은 UI 번호 계약과 어긋남 |
| FI-010 [#302](https://github.com/KangMin098/Vocaflow/issues/302) | 새 deliveryId로 c4b9f434e 재실행: 본문 열기2회/세션0/exposure none 뒤 first_exposure/evidence=true. [현재 로그](./pr303-authored-view-exposure.log) |
| FI-011 [#304](https://github.com/KangMin098/Vocaflow/issues/304) | authored 확인 링크/전이 후 요구/지문 정체성→전이량 환류 누락. To-Be/Workspace/관련 로더는 첫 검토 이후 변경 없음 |

보류 SQL의 SHA-256은 최초 b4fbf4d5c와 c4b9f434e 모두 `9b205b4bed725c5bfdd164757e9656587248fbd9c5617858ddf7160adcec00aa`다. 바뀌지 않은 SQL 반례/동시성/역할 검사는 다시 돌리지 않고 원본 증거를 재사용했다. FI-007/010은 새 API 출처 계약이 바뀌어 각1건만 재실행했고 기존10건은 의도적으로 필터 SKIPPED다.

## CI · 목적 · 실제 적용의 경계

[체크포인트](./pr303-checkpoint.json)는 de5065b51의 CI 시작 상태다. c4에서 성공한 build/verify/typecheck 등을 새 HEAD의 성공으로 세지 않는다. `e2e`/`e2e-gate-faultclosed`의 실행 핸들을 추적 중이며 e2e-shared-dev SKIPPED는 실제 DB PASS가 아니다. safe-merge와 병합 SHA는 아직 없다.

CI의 새 브라우저 spec은 로컬 Supabase에 합성 관리자/학습자/승인 fixture를 만들고 납품 ID 결속과 목록 복귀를 확인하려는 범위다. 시험 기록/목표 설정부터 시작하거나 PLAN 요구·양의 전이량 변경을 단언하지 않는다. 독립 확인이 없으면 첫 다른 역할 자료로 대체하는 경로도 있으므로, 통과하더라도 모든 역할/독립 근거의 종단 성공을 증명한 것으로 확대하지 않는다. 실제 실행 결과는 도착 후 확인한다.

PR 목적의 「교수/평가 혼용 차단」「적격 공급」「지도·PLAN 환류」가 위 반례로 아직 충족되지 않는다. 전체30 TASK 확장이나 실학생 효과를 이 중간 PR의 새 필수 기능 게이트로 만들지는 않는다. 대신 [전체 A~H 현황](./ACCEPTANCE.md)과 [TASK 범위](./TASK_RUNTIME_COVERAGE.md)에서 미완성을 유지한다.

실제 개발 DB에 authored 표가 아직 없음을 읽기 전용으로 확인했다. 코드 병합/CI fixture/사람 Gold·권리 승인/실제 공급은 별도 상태다. 이 세션은 실제 DB 쓰기나 사람 승인을 수행하지 않았다. GitHub 작성자와 검토 CLI 계정이 모두 KangMin098이므로 형식적인 타 계정 승인 대신 독립 검토 내용을 PR comment로 기록한다. 승인으로 표시하거나 required review를 우회하지 않는다.

## 후속 독립 확인 · 2026-10-18

- FI-009 문장 번호: 4655e9be4에서 FIX_VERIFIED_IN_CANDIDATE. 교수7단계/오답 설명36건과1280/1440 실제 렌더링 근거는 [형식 검토](./AUTHORED_FORMATS_REVIEW.md). 과거 HEAD의 OPEN을 최신 수정 상태로 적용하지 않는다.
- FI-012: [#305](https://github.com/KangMin098/Vocaflow/issues/305)에 대체 결정 근거 오답을 인계했다. 기존 중심문장 재진술과 다른 choice_evidence 계약 문제다.
- CI run39114115991(HEAD e91377575) 격리 e2e 성공을 확인했다. shared-dev SKIPPED다. 추가 TASK/형식이 들어간 최신22b5e43c5의 CI 성공·내용 수용으로 대신 계산하지 않는다.
- FI-001의 확인된 결속 개선 및 FI-009 수정은 인정하며, 미해결 P1/핵심 P2·전체 TASK·실제 개발 DB·사람 승인·학습 효과 근거가 남아 전체 REWORK를 유지한다. 병합하지 않았다.

실제 CI artifact12131229870을 내려받아 내부 Playwright report를 독립 판독했다([범위](./PR303_BROWSER_EVIDENCE.md)). 전체6/6 중 R5는1280/1440의2건이며 passing screenshot은0이다. 출처/결속/재열기/타인 접근 차단/지도 표기는 확인했으나 positive evidence·전이·후속 PLAN 의미 갱신은 단언하지 않는다. FI-013 문법 내용은 #306으로 인계했고 신규957c27211의 추가10세트는 별도 검증 대기다.

3c15ba23c 후속: [추가10 TASK/60문항·새4형식 독립 결과](./EXPANSION2_CONTENT_REVIEW.md)를 d1a782394로 게시했다. FI-014는 #307이며 기존 FI-012/013과 구별한다. CI39115796299는 verify/build/e2e/e2e-gate-faultclosed 실패(Runner83 unused DEMAND_LABEL)다. 앞선 e913 성공과 구별한다. 세트는17 TASK/105초안으로 늘었지만 source/rights/Gold·전이/PLAN 의미 환류의 미해결 조건이 남아 REWORK를 유지한다.

후속7e 서버/RSC 독립 재검증: FI-007은 권리 철회 뒤 열기 거절·현재 공급량 제외/부족분 주문·역사적 evidence 보존을 확인해 FIX_VERIFIED_IN_CANDIDATE다. FI-010은 정상 별도 열기 기록 뒤 evidence=false로 개선됐지만, 첫 기록 실패 시에도 실제 페이지가 본문6문장을 전달하고 재열기 후 first_exposure/evidence=true가 되어 PARTIAL_FIX / OPEN이다. [범위와 원본](./SERVER_REPAIR_REVERIFY.md). 전체 A~H REWORK, 실제 DB 쓰기/사람 승인/병합0.

7e 앱·환류 후속: FI-008 AuthoredRunner 재시도는 두 폭의 동일 의미 요청과 G2 duplicate/변경시각 conflict로 수정 확인, FI-012 대체 결정 근거도 실제 채점기/두 폭 UI에서 수정 확인했다. FI-005 원래 모집단/측정 오기와 FI-013 단수 ditch 대안은 후보 수정 확인이며 사람 내용/Gold 승인은 아니다. FI-011 중심 의미3반례는 개선됐지만 기존 추론·어법·문맥 어휘 Workspace가 적격 링크에도 목록에서 제외돼 PARTIAL_FIX / OPEN이다. [통합 후속 근거](./APP_REPAIR_REVERIFY.md).689 CI9형식 timeout은 trace의 trial 대기이며9bd 수정 후 새 run39120198955는 관찰 시 진행 중이다. 전체 A~H REWORK 유지.

후속 구조/권한:7e StructurePredict/실제 도식·순수 채점기의 두 폭17관찰과 실제 PostgreSQL 역할22건을 확인했다. 설계 가설 대조의 능력 근거 제외·허용 대안·단위 불일치·재시도 및 현재성 RPC 본인/타인/익명 경계를 구별한다. [범위와 결과](./STRUCTURE_SECURITY_REVERIFY.md). 전체 A~H REWORK와 실제 DB/사람 승인 제한을 유지한다.

PR250 후속: [독립 검토](./PR250_REVIEW.md)는 REWORK다. 실제 위젯 두 폭21관찰은 확인했지만 서로 다른 노트의 동시 저장200/200 뒤 서버1건 누락을 FI-015(#308)로 재현했다. 새 보류 처리 경계 FI-016(#309)은 비공개 재현/DL-0165로 인계했다. 민감한 세부는 공개 원장에 싣지 않는다. PR303 [9bd CI 도달 범위·4a 수정](./PR303_4A_REVERIFY.md)은9형식 정상 경로와 실패한 지도 복귀를 구분하고, FI-011 확장3 Workspace는4a 후보에서 수정 확인했다. 전체 A~H REWORK와 실제 DB 쓰기/사람 승인 제한은 유지한다.

4a CI 종료 후속: [실제 로더/두 폭 실패](./PR303_4A_REVERIFY.md)를 확인해 FI-011 전체는 PARTIAL_FIX / OPEN으로 유지한다. 계산 함수의 확장3 Workspace 개선은 유효하지만, 실제 로더가 기존 정본 TASK 슬롯이 없는 창작 납품을 누락한다. 실제 병합 블록의17 TASK 합성 입력은 모두0개로 사라졌고 미리 슬롯을 만든 대조군만 보존됐다. CI39121633640의 두 폭은9형식·재시도·비근거·철회·키보드 뒤 지도 복귀에서 실패했다. 기존 #304로 인계하며 중복 이슈를 만들지 않는다. PR250은 [27개 해시/5문항 내용 한정 대조](./PR250_CONTENT_REVIEW.md)를 추가했고22문항 전체 의미 수용·사람 승인·효과는 미검증이다. 전체 A~H REWORK, 실제 DB 쓰기/사람 승인/병합0.

전체 제품 후속: [A~H 통합 보고서](./INTEGRATED_REPORT.md)를 현재 관찰과 PR/CI/병합 SHA·미완성/사람 조건으로 연결했다. [두 PR 통합 타입 결함 FI-017](./PR250_PR303_INTEGRATION.md)은 #310이며, 무시되는 스냅샷의 최소 후보만 타입 exit0을 확인했다. 실제 제품 수정은 아니다. FI-018(#311)의 민감한 병합 안전 재현은 비공개 DL-0168로 인계했다.27개 교수 설명의 원문/배포 해시·현재 분석 버전과 실제 형식/범위 검증은 일치/오류0, 직접 내용 판독은8문항이며19개는 미검증이다. 실제 DB11:53:47Z READ ONLY는 authored 미설치/FQ·납품·결속0. 전체 REWORK와 임무 진행을 유지한다.
