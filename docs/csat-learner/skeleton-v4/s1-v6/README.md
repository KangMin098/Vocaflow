# T-0131 · CSAT v6.0 S0 정정 수용 / S1 목표 적합성 설계

**현재 S1: DRAFT / NOT_ACCEPTED.** T-0131은 문서 제출 범위의 행정 COMPLETED이며 목표 적합 설계 확정과 다르다. 완료 이력은 보존했고, 공식 reopen 전이가 없어 사용자 지시로 연결 후속 **T-0134** 하나를 같은 owner·브랜치에서 수행한다. [완료 상태·커밋·S0 독립성 감사](./goal-fit/STATUS_AUDIT.md).

2026-10-23. 최상위 입력: 사용자 제공 v6.0 목표 우선 기준서(파일명·SHA256은 [MANIFEST](./MANIFEST.json)). 기존 시스템 보존/재사용은 선정 기준이 아니다. O1~O7 판단 지원이 우선이고 검증된 적격 대안 사이에서만 비용을 비교한다. 이 산출물은 설계/판단 자료이며 제품 UI 구현·내용 감수·학습 효과 완료가 아니다.

## 1. R01~R08 수정 전후

| ID | 이전 오류/누락 | 정정 |
|---|---|---|
| R01 |186 중183이 이전 공개판 있음 | 반대: 이전 published3 / 없음183;실제3ID 명시 |
| R02 |DB듣기0=자료없음 | 로컬248문항·18유형·14회와 원음/권리 공백 구분 |
| R03 |유형별 표본이 조건 설명뿐 | DB26·로컬18 실제 정상/경계ID; 단일표본 경계는 DATA_GAP |
| R04 |서버 차단 없음/새API필수 단정 | 실제 page 서버 projectV3Pairs·held/missing·양쪽 결속 확인 |
| R05 |교수 모형·자동장면 누락 |26teaching models 사실 및 자동selectScene 충돌 기록; 재사용 결정 제거 |
| R06 |20/6,21/5,cue sec 등 |19/7,22/4,listening_end합2288·2014A/B22, est_sec/total_sec_est |
| R07 |의미 구조/내용 혼동·유형 조인 누락 |27 SCHEMA_VERIFIED와 CONTENT_VALIDATED 분리, DB type_id 조인 |
| R08 |허용 경로 불일치 |CLI amend로 skeleton-v4 추가;원owner 보존 |

원5문서의 수용 스냅샷은 68633c195e9745ff3d913499db2b1ec6990dc90e. 정정 이전6781f80d8→7bef988f3/87b888ac9→9d559e3ab/68633c195. 독립 검토에서 로컬630분류 mismatch0, 유형별 표본/ready표 대조, 실제 코드·필드 및 권한 공백을 재확인했다. 새 문서로 원5문서를 대체하지 않았다.

## 2. S0 독립 수용

**S0_ACCEPTED**, 독립 reviewer의 실제 read-only 재검증 PASS 및 AI-Control **DL-0201**. [수용 영수증](../s0/S0_ACCEPTANCE.md). 메타 등록·미매핑/공백·기존 계약 충돌의 정직한 보고에 한정한다. 원문 전체/전선지/PDF/RLS/TTS/내용 감수/학생 효과 PASS가 아니다. S1 설계 입력으로만 사용한다.

## 3. F01~F10 네 대안과 결정

[기능별 비교](./FEATURE_DECISIONS.md) · [기계판독 기록](./FEATURE_DECISIONS.json). 40개 후보, 최종 SELECTED0. 연결 후속에서는 동일 부분 분석의 격리 시연24조건·캡처14개로 G1~G5를 보완했다. F01/F03/F05/F07은 IMPROVE, F04/F08은 REPLACE를 **다음 검증 후보**로 권고한다. F02/F06/F09/F10은 각 최소 증거 부족으로 미정이다. F07/F08 현행 그대로 재사용은 **ELIMINATED**. [실제 비교와 한계](./goal-fit/FIT_REPORT.md). 코드 존재·기존 투자·새로움·재사용률은 성과가 아니다.

## 4. 실제34/22/38 판단·강의

[판단 시나리오](./JUDGMENT_SCENARIOS.md), [강의·모드·공개 계약](./LECTURE_CONTRACT.md), [37cue 원본/차례별 계약/별도6수정안](./LECTURE_CUES.json). 34는 If/Ideally/cannot be·①/③·②unknown·pair0,22는③부분참/요지미충족과조동사,38은넓은these/④기존연결단절/⑤양방향접합을 구별한다. 원본·정답·전문 선지·비교짝을 변경/생성하지 않았다.

현재 제품 소스 3f437e9b65e06c00a96f64890402500417377c92의 1280/1440 캡처10장을 [evidence](./evidence/browser-results.json)에 보존했다. 정상 사용자 화면은 로그인으로 차단되어 익명gate2장, 실제컴포넌트 격리판8장이다. 직접 관찰상34강의 다수cue 대본과38판단 장문이 동시에 보인다. 새 대안의 정상 인증 화면 검증이 아니다.

## 5. AT01~AT26

[실행/차단/미실행 표](./ACCEPTANCE_AT01_26.md). PASS7(명시한 문서/메타·기술검사 범위),FAIL1(현행 자동장면 정적 반례),BLOCKED12,NOT_RUN6. AT26 [다섯 관점 검사](./ROLE_CHECKS.md)는 에이전트 기술 대조이며 실제5인 참여가 아니다. 기존 동일제품커밋 순수25테스트는 재사용; 정상계정 통합은 Invalid login credentials로실패,blind전수함수timeout은미검증유지. 새로운 전체CI/빌드는실행하지않았다.

## 6. S2 착수

[착수 조건](./S2_READINESS.md). **전체 수직 S2는 BLOCKED_EVIDENCE**. 제한된 비공개 대안 시연 준비는 가능하나 최적안 선정·정상권한/자료/내용/매체 검증을 먼저 확보해야 한다. 이번 변경은 문서/증거뿐이며 UI/DB/시드/원문/강의원본 수정 없음. 학습지도 숙달 자동 승격·필수 퀴즈·자유서술 자동 채점은 도입하지 않는다.
