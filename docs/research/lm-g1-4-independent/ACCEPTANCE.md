# LM-G1.4 PR #275 독립 T4 수용

**판정: ACCEPT_WITH_LIMITS — 지원 R5의 수행 증거 주장 계약을 수용한다.** 검토 제출은 `68b1541fff7dd0dd880e6bd51e1ba091d770786c`, 기준 main은 `8ee927dcee80a9b19d70b2d4c86869e8ea013813`이다. 최소 수정된 제품 소스는 `c72740368dbba7b9c12b2fc7e3c1b9a386aea7a1`이다. 문서·검증 자료 revision과 실제 실행 소스를 구별한다. 최종 보고 HEAD의 핵심 PC 재실행·목적 리뷰·필수 CI 통과를 확인한 뒤에만 safe-merge한다. 최종 HEAD와 실제 병합 SHA·CI 링크는 [PR #275 실행 기록](https://github.com/KangMin098/Vocaflow/pull/275)에 남기며 이 문서에서 병합을 선취하지 않는다.

| 게이트 | 판정 | 근거 |
|---|---|---|
| A 증거 계보 정확성 | PASS | 실제 DB 선출 SQL·ID DTO·동일 ID/TASK/문항/phase·충돌 반례 |
| B 첫 시도/도움·독립성 | PASS | 첫 오답/후속 정답·도움/시각/연습·phase/key·합성 경계. 실제 DB/화면 I01/I02/V08 |
| C 현재 도구·조건 성공 | PASS | UNKNOWN/STALE 승격 차단·기존 골격/본문 gate·문항별 실패 격리. 실제 원문 변경 UI는 아래 NOT_TESTED |
| D 수행/전이/CHECK/지연 범위 | PASS | 기존 판정 유지·전이 운영량 분리·지연 NOT_ESTABLISHED·공유 집계 한계 명시 |
| E 팝업·드로어·Workspace | PASS | PC1280/1440 각14/14·동일 칩 값·오답/성공 분리·경계/키보드/focus/가로 넘침 |
| F T1/T2/T3·기존 경로 | PASS | 단계9·수직26×2·목표20×2·Workspace36·복귀7·해부6·공급6 |
| G 권한·성능·저장 보존 | PASS | A/B18·2,505행 paging·12,001입력 호출 계측·오류 격리·상위 PLAN hash 보존. 부하/SLA 보장 아님 |

이 PASS는 각 행의 검증 범위에 한정한다. P1~P7 정책과 실제 교육 효과를 PASS로 바꾼 것이 아니다.

## 독립 확인한 결함과 수정

최초 제출의 첫 20개 반례는 **6 PASS / 14 FAIL**이었다. 이후 누락 원장의 정상0건 오인과 도움받은 재시도의 부적격을 명시한 같은20개 fixture를 고정해 제출 코드에 재실행하면 **5 PASS / 15 FAIL**이다. 최초 원장을 고치거나 이 차이를 숨기지 않는다. 수정본의 동일 반례와 추가 경계는 별도 결과로 남긴다. [발견 원장](./FINDINGS.md) · [절차](./PROTOCOL.md).

- **첫 시도:** `learning_first_attempts.attempt_id`와 수행 원장 `id`를 DTO에 보존하고 ID·TASK key·문항·phase가 모두 일치할 때 연결한다. DB가 이미 `answered_at,id`로 선출한 첫 시도를 내림차순 activity에서 다시 뽑지 않는다. 누락/충돌 UNKNOWN이다. 첫 오답 후 정답 재시도가 첫 독립 성공을 빌리지 않는다.
- **정오와 자격:** `correct: CONFIRMED`는 정오가 기록됐다는 뜻이며 맞혔다는 뜻이 아니다. 원장 `outcome`과 독립 첫 관찰의 맞힘/틀림을 표시한다. 연습 화면·도움/해설 확정은 INELIGIBLE, 불명확한 순서·도움 누락은 UNKNOWN이다. 합성 첫 시도/세션 자격을 다른 행의 false로 덮지 않는다. 효과는 계속 NOT_EVALUATED이다.
- **현재 도구:** UNKNOWN/STALE을 현행 조건 성공으로 승격하지 않는다. 기존 `currentItemTask`의 골격 서명·문장 수·선택 과제와 `anchorGate`의 현재 본문 결속을 재사용한다. 연습/확인의 서로 다른 grader key를 합치지 않는다. 예외는 해당 문항만 null이며 건강한 문항의 해시를 지우지 않는다.
- **실패와 기간:** 연결·첫 시도·전체 수행 조회 실패를 정상0건·미시작·바로잡기 없음으로 표시하지 않는다. 과거 asof에 현재 주석을 당시 도구의 증명으로 사용하지 않는다. 기존 resolved/verified_need·lifecycle·120일·전이 운영량은 바꾸지 않는다.
- **공유 원문:** 기존 문항별 집계는 보존한다. 실제 현행 독립 주장에 포함된 공유 문항 수만 표시하고 별개 글의 독립 관찰로 해석하지 않는다. 도움받은 공유 문항0을 모두 포함됐다고 안내하지 않는다. P7 정책을 새로 결정하지 않는다.

P0는 발견하지 않았다. 재현된 P1 1종·P2 9종을 최소 수정했고, 도구 범위 disclosure의44px·키보드·focus를 기존 UI 안에서 보완했다. [목적 리뷰](./PURPOSE-REVIEW.md)의 마지막 제품 소스 결과는 NO_FINDINGS이다. 독립 AI 리뷰를 인간 전문가 검수로 표현하지 않는다.

기존 작성자21개 테스트의 기대 assertion은 바꾸지 않았다. fixture에 첫/재시도의 서로 다른 ID만 추가해 실제 계보를 표현했다. 새20개 반례는 제출 adapter에 그대로 재실행하고, 누락 ID를 임의로 보충하는 제품 fallback을 만들지 않았다. 실제 개발 DB 첫 시도 ID와의 대조도 별도로 수행했다.

## 원장·성능·상위 계산

읽기 전용 DB catalog에서 실제 테이블/뷰 존재, 첫 시도 선출 SQL, `security_invoker=true`, 원장 RLS와 실제 열을 확인했다. 정책/루브릭 버전 열은 없다. 합성 표시가 없다는 사실만으로 실제 학습자나 효과 표본이라고 하지 않는다. 소유 합성 테스트 실행 중의 DB 행 수를 모집단 baseline으로 공개하지 않는다.

실제 loader 함수에 고정 query 응답을 주입한 **2,505행/3페이지**에서 보류 문항을 제외한2,088행과 정확한 ID를 확인했다. 둘째 페이지 오류는 거부되며 정상0건과 다르다. **12,001입력/4 TASK key/24조합/6문항**에서 제출 경로 annotationFor24회, 수정 경로6회·hash6회였다. 한 문항 실패 시6회·hash5회이며 나머지는 보존된다. 기존 source gate는 문항당 한 번, 동시 최대8개로 한정한다. 호출 수는 고정 fixture의 측정이며 실제 DB 대량 적재나 네트워크 부하 시험이 아니다.

실제 브라우저에서 수능80점·6월 모평90점 목표 snapshot을 각각 저장·조회하고 상위 compose에 넣었다. 같은 수행 기록의 증거 hash가 같았다. 같은 실제 입력에서 main·제출·수정 compose의 As-Is/To-Be/PLAN/taskPlans hash도 같았다. 목표별 PLAN이 서로 같다는 뜻이 아니다. 과거 asof의 현재 도구 자격은 제출CONFIRMED→수정UNKNOWN이었다. 100회 warm 순수 계산의 중앙값/p95는 JSON에 보존하며 제품 지연시간 SLA나 인과적 속도 향상으로 주장하지 않는다.

해시 결과 map의24개 key가 모두 현재 도구라는 뜻은 아니다. 실제 선택된 도구6개만 해시가 있고 나머지는 UNKNOWN이며, 한 문항 실패 시5개만 남는다. source gate의 실제 네트워크 비용에 대한 통제 A/B benchmark는 NOT_TESTED이다. 순수 계산 측정과 실제 브라우저 기능 통과를 근거로 전체 서비스의 부하/SLA까지 보장하지 않는다.

## 실제 PC와 회귀

1280×900·1440×900 Chromium의 T4 핵심은 각각14/14였다. 팝업·근거 드로어·Workspace가 같은 evidenceView의 확인/적용/지연 값을 표시했다. FIND 첫 오답2개와 뒤 정답 재시도의 원장 ID를 실제 DB/API/렌더 데이터로 대조했고, 독립 첫 오답은 관찰2·맞힘0·틀림2로 구분했다. TRANSFER0/2→1/2→2/2, 새 CHECK2개 뒤 기존 통과, 도움받은 첫 시도 부적격, 팝업/모달 경계·Esc·focus 복귀·가로 넘침0·44px disclosure를 확인했다.

관련 단위 테스트는 **208파일·2,504 PASS / 0 FAIL / 0 pending**이다. 타입·lint·설정15/15도 통과했다. 브라우저 전체 회귀와 최종 HEAD 재실행/필수 CI는 실행 원장에 별도로 결속한다. 소유 계정 부재와 소유 서버 종료를 확인하지 않은 실행은 PASS로 세지 않는다.

| 완료 실행 | 통과 |
|---|---:|
| T4 1280 / 1440 (`final-v5`) | 14 / 14 |
| T1 (`final-v5`) | 9 |
| T2 1280 / 1440 (`final-v6`) | 26 / 26 |
| T3 1280 / 1440 (`final-v6`) | 20 / 20 |
| A/B 권한·버전 (`final-v6`) | 18 |
| Workspace / 복귀 / 해부 / 공급 (`final-v6`) | 36 / 7 / 6 / 6 |

완료된12개 묶음은 합계202 PASS/0 FAIL이며 전후 제품 hash가 같다. 각 실행의 소유 계정 부재와 서버 종료를 확인했다. 추가 정리 감사에서 이 작업장이 기록한36개 계정이 모두 이미 부재였다. 실제 학생 기록·스키마/RPC/RLS를 변경하지 않았다. 합성 계정의 기존 API 작성/삭제와 읽기 전용 DB 감사를 구별한다.

실행기는 기존 assertions를 유지하고 worktree 위치·PC 높이900·로그인 hydration 대기·계정 정리 계측을 적용했다. T3의 목표일 fixture는 실행일90일 후로 맞췄다. 생성된 runner의 hash도 남긴다. Next가 전용 dist의 타입 include를 tsconfig에 생성해 `dirtyTree=true`가 남았으며 깨끗한 트리 실행으로 표현하지 않는다. 제품 코드 hash를 실행 전후 대조하고 생성된 tsconfig 변경은 제출하지 않는다.

`final-v5`의 T2 1280은18개 PASS 뒤 종료3221226505로 중단됐다. 원인이 확정되지 않은 비정상 종료이며 PASS가 아니다. 계정 부재·소유 서버 종료를 확인했고, 같은 제품 소스의 `final-v6` T2 1280 재실행은26/26으로 완료됐다. 이전 sourceStable=false 실행도 보존하며 최종 수용 분모에서 제외한다.

## 검증 한계와 승인 대기

| 범위 | 상태·한계 |
|---|---|
| 실제 DB 원문 변경·주석 오류·조회 장애의 UI | NOT_TESTED. 실제 DB를 훼손하지 않고 고정 응답·실제 함수 및 component로 반증 |
| 공유 원문 묶음의 실제 DB 브라우저 | NOT_TESTED. 순수/loader/component 검증과 실제 일반 R5 브라우저를 구별 |
| 역사 재생 | asof 이후 기록 배제·현행 도구 증명 보류. DB/원문/도움 metadata 전체의 시간 여행 아님 |
| 현행 instrument CONFIRMED | 기존 채점 경로 통과·기록 해시 일치. legacy boundary-only 결속은 완전한 원문/전문가 타당도 증명 아님 |
| 효과 표본 자격 | 기록 metadata의 적격성. 합성false도 실제 학습 효과 실험의 증거가 아님 |
| P1~P7 | BLOCKED_APPROVAL. 지연 간격/도구, 버전 저장, 전문가R3, C2, G, 새phase, 공유 지문 집계 정책 미적용 |
| 지연·효과·전체 지원 | NOT_ESTABLISHED / NOT_EVALUATED 유지. 전체30 TASK·V2/S5·실제 Factory 연결·점수 상승은 수용 범위 밖 |

기존 판정 창의 지금 확인과 연결된 과제·전체 기간의 원장 집계는 다른 분모다. 화면에서 이를 구별하며 원장이 완전하지 않으면 집계를 보류한다. 현재 정규 원문의 identity는 운영 전이량 기준이고 불변 역사 원문의 검증이 아니다.

LM-G1.5는 이 증거 계약을 재사용해 V2/S5의 별도 instrument·지원 자료·저장 적격성 및 E3 경계를 검토할 수 있다. 이번 수용으로 그 도구·콘텐츠·교육 효과가 완성되지는 않는다. 승인 대기 정책과 DB 변경은 별도 결정 후 진행한다. 학습지도 전체 목표의 T4 평가/교수 지원은 V2/S5 확대 등이 남은 부분 완료이며, 이번 판정은 지원 R5의 수행 증거 주장 계약에 한정한다.

## 소스·증거 원장과 종료 조건

원래 제출의 실제 diff는156파일이다(제품10·테스트1·스크립트1·문서4·PNG129·JSON11). 사용자 지시문의141이나 GitHub의100파일 제한 목록을 분모로 쓰지 않았다. 원 작성자의 회귀 소스 `b6b818231`, 마지막 문구 `b6e8b93cb`, 제출68을 구별하며 마지막 문구→제출의 제품 코드 차이는 없다. 그 이전 실행을 최종 수정 코드의 실행으로 바꾸지 않는다.

Codex 최소 수정은 load/DTO·증거 adapter/현재 도구 helper·compose의 과거 자격 차단·공통 증거 표시/44px 및 해당 테스트다. 별도 검증 worktree/소유권 안에서 작업했고 다른 작업장의 변경을 초기화하지 않았다. 기존 원본 실패·제출 스크린샷은 보존했다. 기존 As-Is/PLAN/skillDiagnosis 정책을 재구현하지 않았다.

- [EVIDENCE.json](./EVIDENCE.json): 환경·단위·실행별 소스/검사/정리·반례·compose 비교·이전 중단/불안정 실행.
- [INITIAL-FAILS.json](./INITIAL-FAILS.json): 최초6/14 및 고정 fixture의 제출5/15, 예상/실제 실패·hash.
- [SOURCE-AUDIT.json](./SOURCE-AUDIT.json), [DB-AUDIT.json](./DB-AUDIT.json): 파일 분류·실제 코드 hash·DB 선출/열/RLS 확인.
- [SCREENSHOTS.json](./SCREENSHOTS.json): 두 PC×세 표면의 선정6장과 hash. 원문/계정/runtime 전문은 ignored local에만 보존.

이 보고 revision의 필수 CI와 PC 두 핵심 재실행이 모두 통과하고 최종 목적 리뷰 차단이 없을 때만 `safe-merge.mjs`를 쓴다. 필수8종 외 `e2e-shared-dev`의 PR skip은 통과로 세지 않는다. 해당 조건이 실패하면 병합하지 않고 실패 기록과 함께 REWORK/BLOCKED로 재판정한다. 실제 병합 결과는 PR 기록과 최종 사용자 보고에서 확인한다.
