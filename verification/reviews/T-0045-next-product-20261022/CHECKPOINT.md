# FINAL MISSION — 최신 목표 재평가·다음 제품 작업

2026-10-22 · 독립 수용 owner `final-independent-accept`. 기준 로컬 main `030006f6a7d9aa6b69fd35f9c348ba1f3edad6c0`, fetch 확인한 원격 main `f573ef8e5d1671d2ba9f42f04abfe695fe49a75e`.

## 즉시 실행한 작업

- **T-0084 / rev1 / P1 / owner final-product**: 실제 학습자 지표의 내부·합성·미분류 혼입 수정. [구현 계약](../../../planning/handoff/FINAL-LEARNER-METRIC-COHORT-rev1.json). Goal Alignment Gate 통과·READY 07:25:09Z → inbox QUEUED 07:25:39Z → 실제 ACK 07:28:43Z·공식 start 07:28:42Z. 기존 세션 `c513ff5b-86ef-44a3-8efd-7925a229614b` 유지.
- 현재 공식 run 및 worktree 잠금의 **실제 Claude PID13384 생존**을 doctor와 Get-Process로 확인. ACK 본문의 PID22044는 오래된 값이며 실제 실행 증거로 사용하지 않는다. 새 worker/세션을 만들지 않았다. 구현 HEAD·결과는 아직 미제출.
- T-0006의 기존 리텐션 계정 분류를 재사용한다. 명시 `external_verified`만 실사용 분자·분모에 포함하고 내부·unknown·익명·고아·명시 synthetic 활동은 분리한다. 일반 이메일이나 시험 도메인 목록 밖이라는 이유로 외부 학습자라 승인하지 않는다.
- 개인별 `practice.isSyntheticEmail`, 저장된 synthetic, TASK/G2/MAP/PLAN은 변경 범위 밖이다. 도메인 목록을 전역 확장해 기존 독립 근거를 소급 제거하지 않는다. DB/환경 registry/권한 변경·데이터 삭제0.
- [독립 최초 반례](./metric-baseline.json): 실제 `getAdminDashboardStats` 함수에 명시 외부1·내부1·미분류1의 읽기 대역을 주면 예상 외부1/활동1 대신 **3/3**을 반환. 외부1만 있는 정상 대조는1/1. 실제 DB나 인증 화면 검증으로 세지 않는다.

## 33개 UNKNOWN의 개별 재분류

[전체33개·근거·미완료 범위](./goal-reassessment.json). 기존 Goal Check의 정본 상태는 임의 PASS로 바꾸지 않았다.

| 주된 원인 | 항목 수 | 해석 |
|---|---:|---|
| 현재 구현으로 해결 완료 | 8 | CSAT 범위의 대표 기능·격리 수용. 전체 플랫폼·실제 효과 PASS가 아님 |
| 검증 증거 누락 | 9 | 구현 없음과 다름. 인증/전 범위/실제 배포 증거가 부족 |
| 외부 데이터 부족 | 7 | 외부 학습자·실제 사용·지연·효과 표본 부족 |
| 승인 대기 | 4 | 실제 개별 revision Gold/권리/출시·정책 범위 |
| 실제 기능 미구현/부분 결함 | 3 | V1 측정 도구 공백이 상·하위 두 기준에 중복 투영되고 지표 결함이 한 기준에 투영됨. **3개의 새 TASK가 아님** |
| 오래된 정본 또는 브랜치 기준 | 2 | 일반읽기/타 모듈까지 포함하는 상위 기준과 FINAL CSAT 범위를 임의1:1로 묶지 않음. UNMAPPED 유지 |

기존 FAIL `VG-L3-D1-02-AC1`은 T-0084 수정·독립 수용 전까지 유지한다. 외부 입력 `VG-L3-D2-01-AC1 / DL-0004`의 실제 배포 후 smoke도 미확인이다. T-0070~0083 완료분은 다시 구현하지 않는다.

## 첫 실제 적격 공급 후보

[R5 개별 문항·SHA·결정 양식 패키지](./first-r5-review-package.json). 현재 파일은 [R5 primary](D:/workspace/Vocaflow-main-serving/apps/web/src/lib/knowledge/authored/r5-central-meaning.v1.json), 내부 revision `r5-central-meaning.v3`, SHA `682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846`. 기존 전체 manifest와 정확히 일치한다.

| 역할 | 첫 범위 |
|---|---|
| 원리 설명 | r5-cm-teach-1 |
| 안내 연습 | r5-cm-guided-1 |
| 첫 독립 확인 | r5-cm-ind-1, r5-cm-ind-2 |
| 다른 지문 전이 | r5-cm-transfer-1, r5-cm-transfer-2 |
| 새 독립 재확인 | r5-cm-ind-3, r5-cm-ind-4 |
| 별도 지연 확인 후보 | r5-cm-delayed-1 — 즉시 실행/역할 메타만으로 시간 지연·유지 성공을 만들지 않음 |

기본8문항은 서로 다른8개 passageGroup이며 기존 R5 실제 서버/PGlite 순환 fixture가 이 독립·새 독립·전이 ID를 사용한다. 새 콘텐츠 작성이나 supplement 등록 없이 첫 단기 순환의 재고를 마련할 수 있다. 초기 성공/실패 경로의 실제 계정별 노출 이력과 재시도·이전 PLAN 불변은 납품 후 따로 검증한다.

AI 사전 확인은 파일/문항/역할/해시·구조·채점 반례 검증이다. 사람 B(Gold)는 선택 평가6문항과 필요 시 지연1문항을 해당 revision/hash로 검토해야 한다. C는 교수2문항을 포함한 모든 선택 문항의 store/display/transmit 및 평가 assess 권리 근거·범위를 확인해야 한다. public/assessment 출시와 구체적 DB 등록/공급 쓰기는 별개다. 이 패키지의 모든 결정은 PENDING이고 실데이터 쓰기 권한을 부여하지 않는다.

## 실제 DB와 공급 정책

읽기 전용 관찰 **2026-10-22 16:26:37 KST**: authored_item·human_decision·ai_decision·qualification·release_approval·delivery·binding·factory_attempt **각0행**. 설치와 실제 콘텐츠 공급은 별개다.

- A: migration `20261021175340`, statements1개, 승인 패키지/파일/서버 SQL SHA `e84a960723766efc6c798ae09307d8a9e776e46b4d3e7d6f937966a54b312d8d` 일치. 설치 결과 아티팩트는 사용자 직접 승인 범위를 신규 원장9개·관련RPC·기존 해설2행으로 기록한다. 원 대화의 사용자 입력을 이번 검토에서 새로 재현하지는 않았다.
- 실제 현재 함수 `supply_human_decisions_ok`는 **human OR AI+first-party declaration OR source_policy**다. 함수명만 보고 사람 Gold/권리가 무조건 필요하다고 보고하면 틀리다. `authored_supply_decision_state`도 human/ai/source_policy/none을 구분한다.
- 앱의 `recordAiReviewedSupply`는 별도 AI 결정→자격→public/assessment 출시 RPC까지 호출할 수 있다. AI receipt는 human_review_claimed=false/rights_grant=false이며 사람 승인 사실을 만들지 않는다. 하지만 이 구현이 있다는 사실은 FINAL B/C 또는 해당 경로의 운영 승인 증거가 아니다.
- 따라서 **설치 A는 완료**, 현재 콘텐츠 결정·등록·실납품·그 정책에 대한 실제 사용 허용은 **BLOCKED_EXTERNAL_CONTENT_DECISIONS_AND_POLICY_SCOPE**. 승인 확인 없는 실제 공급/승격 쓰기를 실행하지 않았다. 설치 SQL을 재적용하거나 AI 행을 사람 결정으로 기록하지 않는다.

## 로컬·원격 통합

[65커밋별 분류와 파일 목록](./remote-inventory.json). 원격은 로컬의 조상이며 뒤처진 커밋0·앞선 커밋65다. 비병합 커밋 중 patch-equivalent 원격 중복은0이다. 이65개는65개 새 기능이 아니며 통합 merge·검증·문서·개발정책·승인 SQL 기록이 섞여 있다.

T-0074~0083의 기존 수용은 재사용한다. 교재공장/FAST/학습성과 코드에는 소유자의 범위 검증 증거가 있으나 이를 최신 전체 보호 CI 통과로 바꾸지 않는다. 최종 원격 범위에는 제품 의존 코드·테스트·설치 이력/권한 검증·정확한 승인 문서가 함께 필요한지 심사해야 하며 개별 커밋 수로 무조건 병합하지 않는다.

현재 main-serving의 CSAT 스킨·CSS·디자인 문서는 **다른 owner의 미커밋 작업**이다. 이를 보존하고 여기서 재병합/커밋/원격 push하지 않았다. 원격 반영은 기존 일일 main-sync의 범위/HEAD·필수 CI·safe-merge 경로로만 진행한다. REMOTE_INTEGRATION_COMPLETE는 false다.

## 완료 게이트

| A~H | 현재 수용 범위 | 실제 미완료 |
|---|---|---|
| A 시험 기록·현재 능력 | 시험과 직접 TASK 근거·미측정/조회실패 분리 구현·범위 검증 | 실사용 지표 혼입 T0084, 실제 외부 학습자 관측 |
| B 목표 설정 | 시험·점수/등급·목표 버전 및 변경 뒤 재확정 | 실제 사용 계정의 종단 확인 |
| C 개인화 지도 | 목표 필요 TASK·이번 단계량·저장/제안·도달 조건·다음 행동 연결 | 모든 영역의 측정 도구, 실제 학습량/효과 타당성 |
| D 출제 원리 교수 | 교수·지문 이해·자기 설명 대조/수정·공장 원문 안내 연습 연결 | 적격 승인 콘텐츠의 실제 교수 수행 검증 |
| E 적격 공급 | 스키마/공급/자격/현재성/철회 코드·격리 검증 | 현재revision Gold·권리·등록·출시·실납품0 |
| F Workspace 수행 | 교수/안내 연습/노트/복귀·수식관계 학습 전용 진입 수용 | 최신 결합판의 실제 인증 DB 종단 |
| G 독립 확인·전이 | 서로 다른 지문·첫노출·G2·실패/성공 순환의 격리 증거 | 실제 지연 유지, V1 등 미준비 측정, 실제 학습자 수행 |
| H MAP·PLAN 환류 | 같은 학습자·목표/계획 버전·첫 근거·이력 불변·재계산·복구 구현 | 실제 적격 공급 후 dev DB 수행 환류·효과 검증 |

위 표는 기존 VG/LM/TASK를 대체하는 새 정본이나 임의1:1 매핑이 아니다. A~H의 제품 관점에서 확인된 범위와 미확인 범위를 구분한 것이다.

| 게이트 | 현재 판정 |
|---|---|
| PRODUCT_CODE_COMPLETE | PARTIAL — T-0084 및 기존 미측정/유지 계약·전 범위 공백 남음 |
| LOCAL_VALIDATION_COMPLETE | 변경별 SCOPED_VERIFIED, 전체 제품 최종 수용 아님 |
| REMOTE_INTEGRATION_COMPLETE | false |
| DEV_DB_E2E_VERIFIED | false |
| CONTENT_RELEASE_APPROVED | false |
| EDUCATIONAL_EFFECT_VALIDATED | false |

다음 독립 수용 입력은 T-0084 실제 구현 HEAD다. 코드 작업은 콘텐츠 승인 대기와 독립적으로 진행 중이며, 최종 제품 완료를 선언하지 않는다.
