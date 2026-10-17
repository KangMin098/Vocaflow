# PR #281 — Codex-E R5 사전 감사 독립 수용

판정은 **ACCEPT_WITH_LIMITS / 연구 감사만 수용**이다. 실제 I2 영속 납품 적격은 **전 역할 0**, Factory 제품 공급은 **NOT_CONNECTED**다. I1 적용·FQ 부여·출시/평가 승인·주문/납품 생성·교육 효과는 수용하지 않는다. 원 보고의 한정되지 않은 노출·phase·최초 납품 시나리오는 아래와 같이 정정한다.

검증 worktree는 `D:/workspace/Vocaflow-factory-i2-review`다. 제출 #281 `b2edad0bcbd4680cd2136bf78222d1f93c488fc9`, 원 감사 I0 `6b91ae010`과 최신 #277 `4a853dca73da95df5872b7b45e28e97520be38a5`, 병합 main `edcfa5f95`를 구분했다. #280은 `e89ebac493841b6fbcd0ebf0cdda780361ae75d6` 제안본과 대조했다. #277/#280 제품·SQL 파일은 수정하지 않았다.

DB는 SELECT만 사용했다. 2026-10-17 18:38–18:44 KST의 새 조회를 [DB-REPLAY](./DB-REPLAY.json), [DB-INDEPENDENT](./DB-INDEPENDENT.json), [DB-EXPOSURE](./DB-EXPOSURE.json)에 보존했다. 학습자 ID·이메일·원문은 산출물에 내보내지 않았다. 행 수·학습자 수·독립 수행 수를 서로 바꾸지 않았다.

## 1. 요청한 10항목 판정

| 확인 | 독립 결과 | 범위·근거 |
|---|---|---|
| 1. claim-support 정본 13 / 확인 9·전이 4 | 재현 | 실제 주석 레지스트리와 DB active/B7 행의 ID 일치. 13개 모두 골격 서명·문장 수 일치, 현재 실행 TASK claim-support, 채택 사슬 live. [INSPECT](./INSPECT.json) |
| 2. 해설 113 접근·교수 검수 | 카탈로그 재현 / 교수 자격 근거 없음 | 평가원 R5 4유형 골격 115 중 공개 inquiry 113. 그 113개가 DB body_ok·공개 뷰·분석 published 113개와 ID까지 같다. 2014A#24·2014B#23 제외. FQ1/1.1 정본과 제품 스냅샷 모두 R5 자격 결과 0. published는 D 검수 증거가 아니다 |
| 3. 확인 phase=practice | 재현 / 원 보고 범위 정정 | 제품 확인은 `activity=theater`, 연습은 `activity=practice`; phase만으로는 구별 불가지만 원장 전체로는 구별 가능. DB 실제 125시도는 모두 theater/practice(실사용자 1행·합성 124행). [DB-INDEPENDENT](./DB-INDEPENDENT.json) |
| 4. 연습·독립 평가 자료 공유 | 재현 | serverPool이 같은 13개 주석·출시·골격을 사용. 9개 확인 유형은 phase=practice, 4개 전이 유형은 phase=transfer라도 연습 화면의 activity는 practice. 같은 학습자의 연습/열람 뒤 평가 재사용은 노출로 거절해야 한다 |
| 5. 2026#23 다중 역할·지문 | 출시 중복·실제 노출 재현 | claim-support 전이 + option-restate 확인 active. 그러나 currentItemTask는 claim-support를 먼저 반환하므로 후자 우선 실행은 재현하지 못함. 해설·reveal 8세션, 합성 학습자 1명; trap 1행도 있음. 같은 문항 타 TASK 노출은 항상 공유 |
| 6. B revision에 annotation hash | **없음 재현** | B는 stem/passage/choices/answer만 해시. 실제 annotationHash가 G2 content_hash. 주석 support만 바꾼 offline 대조에서 주석 해시는 변하지만 B 입력은 그대로. reader가 composite revision을 바꾸지 않으면 all-pass fixture는 최신 해결기도 적격으로 본다 |
| 7. supplyFor true vs FQ 근거 | 재현 | 실제 함수 실행에서 확인·전이는 7필드 true/available/fully_supplied. 해설은 D=null인데 fully_supplied. #280은 해설 표시만 낮추며 확인·전이 상수 true는 남는다. I0는 이 진단을 적격 reader로 쓰지 않는다 |
| 8. C/B·자격·승인 공백 | **미설치**, 적격 0 | 9표 to_regclass=false, 관련 7함수도 없음. 자격/승인 테이블의 SQL COUNT=0이 아니다. 원장 행 수는 null/not_installed, 정상 0행과 구별. 로컬 FQ1 20·FQ1.1 16 결과 중 R5 0도 원본 연구 JSON까지 대조 |
| 9. 최초 후보 2020#24 | 제한적 후보 적합 / 납품 자격 없음 | 확장 노출 7경로 0, embargo 없음, 단일 출시 역할. 내용·측정 한계는 §4. 2021#24를 전역 무노출 대안으로 추천하는 것은 철회 |
| 10. G2↔납품 결속 | **공백 재현** | G2 두 표에 delivery_id/line_id/qualification_id 없음. application_id는 제품 출시 행이고 납품 행이 아니다. 시각·item_ref만으로 과거 기록을 납품 결과로 소급 귀속할 수 없음. 최소 계약 §5 |

확인 9개는 2016#20·2020#20·2021#20·2022#20·2025#20·2026#20·M2506#20·M2606#20·M2609#20이다. 전이 4개는 2020#24·2021#24·2026#23·M2609#23이다. 해설 두 역할은 같은 자산을 가리키며, 113+113개의 독립 자료로 합산하지 않는다. 지연 전용 적격 자료·실행기는 0이다.

113은 전체 카탈로그 수다. Workspace 연결은 `studyItemsFor`의 별도 규칙을 따른다. 확인 9개가 전부 미노출인 신규 학습자 fixture에서는 연구 사례 **4개**(2019#23·2015#32·2014B#38·2020#36), 확인/전이 보류 13개가 반환된다. 이 4개는 모두 inquiry에 있고, 일부는 R5 4유형 밖이다. 즉 113을 Workspace에 바로 납품할 수 있는 재고로 해석하면 안 된다. 브라우저 열람은 세션 기록을 만들 수 있어 실행하지 않았으며, 접근 판정은 코드·DB 상태·embargo의 읽기 전용 대조 범위다.

## 2. 원 감사 재현과 새 결함

[REPLAY](./REPLAY.json)는 제출 감사기를 변경 없이 실행한 결과다. 원 HEAD에서 2회 결정적 결과가 같고, CLI ref 표기만 정규화하면 제출 AUDIT와 전체 구조가 같다. 최신 #277에서도 I0 결과가 같았다. 새 DB 스냅샷도 측정 시각 외에는 원 스냅샷과 같고, 13개 B revision이 모두 같았다. 원장 미설치 시 필요량 null, 설치 가정/FQ 없음 시 확인 9·전이 4 모두 candidate_unreviewed다. 반례 14개 엔트리 중 1개는 정상 대조, **거절 반례는 13개**다. 소유권·goal/PLAN은 서명 분리만 시험했고 실제 RLS/재주문은 NOT_TESTED다.

다음은 실제 제품 사고를 주장하는 것이 아니라, 선행 구현/감사에 존재하는 결함이다.

| ID | 심각도 | 재현·정정 | 필요한 조치 |
|---|---|---|---|
| E01 | P1 / I2 연결 전 | 원 snapshot은 trap/session-attempt/review-queue 노출을 세지 않는다. 2021#24 trap **26행·1명**, 2025#20 **6행·1명**은 각각 기존 감사 경로에 없는 학습자 노출. 2026#23도 trap 1행 | 모든 원장과 동일 문항/정규화 지문/회차를 합친 서버 reader. 2021#24 ‘노출 0’ 추천 정정. #280 D1이 이 경로를 다루지만 미설치 |
| E02 | P1 / I2 연결 전 | 주석만 변경해도 B revision 불변. 원 반례는 currentRevision 문자열을 바꿨으므로 주석 변경 자동 탐지의 실증이 아님 | 현재 source·analysis·Gold·annotation revision/hash를 서버에서 다시 계산하고 자격/납품/채점에 결속. 저장 칸만 추가하는 것으로 끝내지 않음 |
| E03 | P2 | phase만으로 확인/연습을 구별 못함. activity가 구별하므로 ‘원장 자체에서 구별 불가’는 과도함 | TASK·audience.role·activity·phase·help·session·content_hash 함께 판정. phase 재정의는 G2 소비자 영향 검토 뒤 결정 |
| E04 | P2 | 교수 unknown/평가 근거 공백에도 supplyFor가 fully_supplied 표시 | 진단 경로와 정식 자격 공급을 명확히 구분. #280의 해설 보완만으로 평가 상수 true 문제가 해결됐다고 하지 않음 |
| E05 | P2 | B factory_order state에 NOT_NEEDED 없음. workspace_content_delivery.order_id는 재고 재사용 시 null 허용 | 최초 재고 납품은 주문 생성 없이 order_id=null. ProductionNeed의 NOT_NEEDED와 DB 주문 상태를 혼동하지 않음 |
| E06 | P2 / 교육 | reviewerBlind=true를 교수/Gold 검수 완료로 승격할 수 없음 | 전이 4개의 두 판정자는 같은 계열 AI, 일부 확인 관계 판정도 사후 합의. 판정 방법·논쟁 문장·채점 제외와 적용 한계를 E 근거에 보존 |

13문항 전체에 대해 DB의 **정규화한** 지문(lower/공백 정규화)으로도 다른 문항과의 일치는 0이다. 이 값은 동일 문항의 타 TASK 노출이나 오프라인/외부 학습 이력을 배제하지 않는다. unknown을 ‘처음 보는 지문’으로 승격하지 않는다.

## 3. I1 적용 전 차단 사항

1. 기존 [독립 SQL 감사](../factory-i0-277-independent/SQL-AUDIT.md)의 NULL 축 검사·NULL 권한 우회, 노출 누락, public+assessment 범위 불일치를 최종 실행 SQL과 검증에 반영해야 한다. #280 I1-S는 그 보완 제안이고, 이번 검증은 그 PR 전체의 보안 수용이나 적용 승인이 아니다.
2. C/B만 따로 공급 경로를 열지 않는다. 승인된 안전 묶음·정확한 hash·단일 적용 경계·checkpoint·권한/RLS·롤백을 준비해야 한다. 이번에 해당 SQL을 실행하지 않았다.
3. `readable_unreviewed`와 정식 적격 공급의 구분뿐 아니라 확인/전이 7필드 true 문제를 해결하거나, 정식 reader에서 절대로 사용하지 않는 경계를 검증해야 한다.
4. source/analysis/Gold/annotation 현재성, 세션 삭제 후 노출 보존, 문항만 열람·도움 수신·동일 지문·합성 행의 정책을 정한다. #280의 해당 제안과 테스트는 실제 적용 검증을 대신하지 않는다.
5. 납품 수량/partial, 승인 철회·자격 대체, PLAN 변경 시 옛 주문/납품 처리, 동시 공급/동시 첫 시도 정책을 확정한다. 원장 밖의 서명 차이만으로 권한 거절과 재주문이 실증되었다고 하지 않는다.

## 4. 최초 후보와 I2 최소 자격 조건

2020#24는 생물다양성과 침입 저항성의 가설을 설명하고 그 기제를 뒷받침하는 제목 문항이다. 0-based 문장 2를 주장, 3·4·5를 뒷받침, 4의 관계를 reason으로 채점하는 주석과 원문의 논증은 제한적으로 대응한다. 문장 0·1은 disputed여서 뒷받침 선택 정오에서 제외된다. 정답 control은 통과했다. 이 결과는 자유 요약·조건/범위 전체 이해·제목 선택 능력·다른 유형 일반화나 R5 숙달 전체의 Gold 검증이 아니다. 두 같은 계열 AI의 맹검 기록도 인간/실제 학생 평가 검증을 만들어 주지 않는다.

최초 후보로 유지하는 이유는 현재 확장 원장 노출 0, 동일 지문 타 문항 0, 단일 출시 역할이다. **현재 적격 1로 올리지 않는다.** 이미 trap을 푼 학습자에게 2021#24를 대체 납품하면 안 된다. 다른 학습자에게 가능한지는 공급 순간 개인별 reader로 다시 판정한다.

| 조건 | 최소 기록·증거 |
|---|---|
| A 원천·제시형 | 실제 원문/문항의 revision·hash와 계보, 정답·골격 대응. 길이 서명만으로 원문 결속을 대신하지 않음 |
| B 의미 QA / C TASK 적합 | 주체·범위·극성·관계 의미, claim/support/relation 응답이 관찰하는 처리와 전이의 정의를 해당 revision에서 검수 |
| D 교수 적합 | 설명·힌트·피드백을 교수 역할로 공급하면 D pass 근거 필수. 현재 평가 역할 contract는 D를 공통 필수로 하지 않으므로 전이와 교수 공급을 섞지 않음 |
| E 평가·Gold | 주장/뒷받침/관계·동등/부분/오답/보류 rubric, disputed 처리·도움 조건·한계를 Gold revision/hash와 결속. AI QA와 실제 평가 자격의 경계 명시 |
| F 권리·승인 | 해당 이용·배포 역할에 대한 검증 가능한 권리 근거와 권한 있는 public 및 assessment 승인. 공개 뷰나 B7 active로 대체하지 않음 |
| G 학습자별 | 모든 노출 원장·세션·회차·동일 문항 타 TASK·정규화 지문·도움·첫 응답 시각을 공급 순간 검사. 조회 실패/unknown 거절 |
| H 실행·추적 | 기존 실행기에서 올바른 TASK/역할·현재 주석으로 채점, 납품↔세션↔시도 결속·권한·멱등 실증 |

공통 A/B/C/F/H 및 평가 E, 교수 역할의 D를 역할 규칙대로 검사한다. A~H 전부 pass라는 fixture를 실제 행의 근거로 가져오지 않는다. 자격은 content_qualification 한 정체성에 TASK·역할·규칙 버전·source/analysis/Gold/annotation 현재 hash·근거 ID·판정 방법을 묶고, 승인 두 범위를 같은 자격 ID로 검증한다. 전용 annotation 열 또는 composite revision/검증 가능한 근거 결속 중 구체적 방식을 I2 전에 정해야 한다.

## 5. G2와 납품 원장의 최소 결속 계약

현재 G2 application_id/content_hash/session_id/시도 멱등은 보존한다. 추가로 납품 ID를 시도에 결속하는 서버 필드 또는 추가 전용 연결 원장이 필요하다. 연결은 인증 사용자·Workspace·수요 줄·goal/PLAN version·TASK·역할·artifact revision·qualification/승인·실제 annotation hash·세션·시도 ID를 검증해야 한다. 클라이언트가 보낸 delivery_id를 그대로 신뢰하지 않는다.

납품 후 세션을 열어 노출을 기록하고, 그 납품의 첫 수행을 같은 세션에 귀속한다. 재열람/재시도는 독립 첫 수행과 구분한다. 납품 경로 없이 스스로 연 과제는 unbound로 남긴다. 과거 G2 행을 시간/문항 추측으로 소급 결속하지 않는다. 다른 학습자 납품 ID, 역할/TASK/주석 불일치, 같은 mutation ID의 다른 본문은 거절하고 동일 재시도는 중복 행을 만들지 않아야 한다.

## 6. 최초 R5 한 줄 납품 수용 시나리오 — 아직 실행하지 않음

| 순서 | 승인 후 합성 학습자에서 볼 결과 |
|---|---|
| 0 | I1 최종 승인 묶음 적용·전후 checkpoint·실제 권한/RLS/동시성 검증. 미설치/조회 실패는 정상 재고 0과 다르게 표시 |
| 1 | 새 학습자의 active Workspace·goal/PLAN·definition에 결속한 r.central_meaning/transfer/1문항 수요. 변경 revision은 새 수요로 구분 |
| 2 | 2020#24의 실제 역할별 자격과 권리·Gold 근거 확보. 미확인 축은 보류. public+assessment 승인 두 행을 실제 자격에 결속 |
| 3 | reader가 B 내용과 annotation/source/analysis/Gold 현재성, embargo, 전체 노출·동일 지문을 다시 검사해 정확히 한 후보 eligible_existing |
| 4 | 기존 재고이므로 **factory_order 생성 없이 order_id=null인 납품 1행**, 같은 요청 재시도는 같은 행. 새 생산은 하지 않음 |
| 5 | 인증된 납품 진입 → claim-support/transfer 실행 → 실제 annotation hash로 서버 채점 → G2 session/attempt와 납품 연결. 도움·시각·첫 수행 조건 보존 |
| 6 | 같은 학습자 재납품 거절. 같은 문항 타 TASK·동일 지문 타 문항/역할/수요 줄도 재공급 예약·노출 정책에 따라 차단. 동시에 두 요청해도 한 번만 적격 처리 |
| 7 | 해설만 열람·연습·trap만 수행·세션 삭제·문항만 열람·도움 수신 각각의 대조군에서 공급 거절. public/assessment 하나 누락·철회·주석만 변경·Gold 변경·조회 실패도 거절 |
| 8 | 타 학습자 납품 읽기/제출 거절, goal/PLAN 개정 뒤 과거 수요 오인/중복 귀속 거절. 납품 뒤 첫 시도와 동시 노출의 순서도 별도 실증 |
| 9 | 같은 학습자-줄의 유효 납품 1 / 결속 시도 1 / 중복·타인·stale 승인 0을 실제 원장에서 대조. 이 한 줄만 수용하고 전체 R5 공급·학습 효과로 일반화하지 않음 |

## 7. 재현·변경 범위·PR 정리

재현 명령(저장소 의존성 설치 뒤 PowerShell):

```powershell
$env:NODE_OPTIONS='--conditions=react-server'
pnpm.cmd exec tsx --tsconfig apps/web/tsconfig.json scripts/research/factory-i2-independent/inspect.mts
node scripts/research/factory-i2-independent/replay.mjs
node agents/scripts/check.mjs
git diff --check
```

inspect는 실제 정본·DB 저장 증거·원본 FQ JSON·실제 순수 함수를 대조하고, 누락된 trap 노출과 최초 후보 범위를 assertion으로 고정한다. DB 증거 파일이 없으면 통과하지 않는다. replay는 연구 입력/출력을 임시 사용한 뒤 기존 파일을 바이트 동일하게 복구한다. SQL은 `independent.sql`·`exposure.sql`, 원 보고의 `snapshot.sql`·`revisions.sql`이며 결과 세트를 각각 저장해야 한다. 원 제출 AUDIT/DB 스냅샷은 덮어쓰지 않았다.

검증: 독립 inspect PASS, 제출/최신 I0 및 새 DB replay PASS(failures=[]), 설정 검사 15/15 PASS. 목적 대조 리뷰의 수동 Git 참조 의존 P2를 고정 커밋 SHA로 바꾼 뒤 replay를 재실행했고, 재리뷰는 NO_FINDINGS/exit 0이었다([원장](./PURPOSE-REVIEW.json)). 앱·SQL 코드를 바꾸지 않아 앱 빌드/전체 테스트/실제 E2E는 로컬에서 실행하지 않았다. 임시 실행 환경 문제(server 조건·앱 cwd·대용량 FQ stdout buffer)는 독립 실행기에 반영한 뒤 재실행했다.

PR #281의 CHANGELOG 충돌은 최신 main의 #277 기록과 사전 감사 기록을 모두 남겨 해결한다. 이 보고와 원 REPORT 정정을 같은 연구 PR에 묶는다. 실제 DB 적용·납품·main 병합은 이번 작업에 포함하지 않는다. 새 HEAD의 필수 CI와 PR 상태는 GitHub 원장이 정본이며 과거 HEAD의 초록 체크를 새 HEAD에 상속하지 않는다.
