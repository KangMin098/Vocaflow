<!-- docs/research/final-independent-20261018/STRUCTURE_SECURITY_REVERIFY.md -->
# 구조 예측 화면·권한 경계 후속 검증

제품 고정 HEAD `7e638e63d28791dcc4f886431c0205743dc3310a`. 전체 A~H REWORK를 유지한다. 이 실행은 D의 교수 상호작용과 새 현재성 RPC의 접근 경계를 확인하며 실제 개발 DB·전체 제품 완료 증거를 대신하지 않는다.

## 구조 먼저 예측하기 · 실제 Chromium1280/1440

[실행기](../../../apps/web/scripts/final-independent/probe-structure7e.mjs)는 실제 StructurePredict/StructureDiagram/CSS와 실제 parseStructureResponse/gradeStructure를 사용했다. 주석은 두 단위의 합성 설계이며 문장 원문은 없다. API transport는 서버 채점 순수 함수로 연결한 시험 어댑터다. 실제 로그인·라우트·G2 저장·전체 theater·실제 분석 데이터는 이 검사의 범위 밖이다.

[완료된17개 관찰](./structure7e/results.json), [1280](./structure7e/1280-structure-result.png) · [1440](./structure7e/1440-structure-result.png):

- 입력 미완료는 제출 불가. 허용 대안 역할(example/support)은 실제 채점기와 화면에서 동등하게 처리된다. 잘못된 역할/패턴은 정답이 아니고 역할 개수가 다르면 파서가 거절한다.
- 오류 응답 뒤 가상 시계2초를 진행한 재시도에서 판단 시각·제출 id·세션·답을 포함한 요청 전체가 같다. G2 실제 함수와의 재시도 결속은 앞선 AuthoredRunner 검사와 별도이며 이 위젯의 운영 저장까지 확인했다고 확대하지 않는다.
- 결과는 '능력 점수 아님 · 설계 가설과의 대조'를 표시한다. `design-structure`는 현재 정본 TASK의 모든 evidenceKeysOfTask에서 제외된다. 정본 매핑 외 모든 소비자를 증명한 것은 아니며 실제 학습 효과도 아니다.
- 지문 문장 수4와 주석 단위2가 다르면 '문장1/2'를 지어내지 않고 '1/2번째 덩어리'를 표시한다.
- 예측 없이 보기에서는 채점 결과를 만들지 않고 도식을 연다. 이 합성 화면 경로의 추가 제출 호출0. skip이 다른 원장에 어떤 의미로 남는지까지 추정하지 않는다.
- 런타임 오류·외부 요청·가로 넘침0. 전체 CsatShell 또는 참조 디자인 일치 검증은 아니다.

첫 검사 시도는 label 텍스트에 select의 option 내용이 함께 포함되어 exact locator가 문장1을 찾지 못했다. 실제 select를 고르고 보이는 단위 라벨을 별도로 검증하도록 검사기를 보정했다. 제품 결함으로 제출하지 않았으며 최종 결과는17건 완주 complete=true다.

판정: **격리 위젯·순수 채점 범위 VERIFIED**. A~H D 전체 판정은 실제 콘텐츠·수행·교수 타당성·전체 theater 연결이 남아 PARTIAL이다.

## 실제 PostgreSQL17.10 ·22개 역할/권한 대조

[실행기](../../../apps/web/scripts/final-independent/probe-authored-concurrency.ts)의 `--owner-fix --rls-only`는7e 실제 보류 SQL을 사용하며 SQL SHA는 결과에 묶었다. [원본22건](./authored-owner7e-roles.json)은 전부 기대와 일치했다. 기존 b4 역할 검증의 대상 함수가 변경되어 실행했고 새 workspace_delivery_current3개 대조를 더했다.

본인 납품 읽기/현재성=true, 타인 납품 비노출/현재성=null, 익명 현재성 실행 거절을 확인했다. 학습자의 Gold/사람 결정 행 비노출, 익명 Gold 조회 거절, 학습자·service_role 직접 Gold/사람 결정 쓰기 거절, 일반 학습자의 사람 결정 RPC/내부 Gold hash 호출 거절, 타인 수요 납품/결속 거절, 직접 결속 원장 INSERT 거절을 확인했다. 관리자/서비스의 필요한 읽기 정상 대조군은 허용됐다. 모든 행·인물은 합성 fixture다.

의존 표와 JWT 설정·개발 DB에서 앞서 읽은 기본 권한의 최소 재현이므로 실제 Supabase JWT 검증/전체 스키마/실제 개발 DB E2E까지 수용하지 않는다. 앞서 확인한 FI-006 동시 공급 잔여나 FI-010 누락 기록을 이22건이 해결한 것으로 보지 않는다.

시험 PostgreSQL은 정상 종료했고 해당 클러스터 postmaster.pid 없음/일치 프로세스0을 확인했다. 자동 실행 보호 정책이 임시 폴더 삭제를 거절해 종료된 합성 클러스터 디렉터리를 ignored 영역에 보존했다. 차단을 우회하거나 실제 DB를 변경하지 않았다. 검증 진행에 필요한 동작은 차단되지 않았다.

## 실제 개발 DB의 읽기 전용 재확인

[2026-10-18T10:57:51Z 관찰](./current-db-readonly.json): transaction_read_only=on, authored 표 미설치, 자격/납품/결속0. 실제 DB 쓰기·사람 결정 기록0. 격리 위젯/권한 시험을 실제 공급이나 전체 A~H 완료로 계산하지 않는다.
