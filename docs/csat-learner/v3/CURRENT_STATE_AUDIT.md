# CURRENT_STATE_AUDIT — v3.0 설계 전 사실 감사

작성 2026-10-12 · 읽기 전용 감사. `implemented`와 `verified_technical`, `validated_learning`을 구별한다. 아래 코드 존재는 이번 실행 성공/출시 확인을 뜻하지 않는다.

## 1. 조사 기준과 충돌 방지

| 위치/대상 | 확인한 상태 | 이번 처리 |
|---|---|---|
| `D:/workspace/Vocaflow` | `design/replica-first`, HEAD `8cd15b7b6`, MERGE_HEAD `fbe532ae…`, 다수 staged/unstaged 및 병합 중 변경 | 현재 사용자가 열어 둔 코드로 읽기만. index/병합/다른 목적 파일은 손대지 않음 |
| 원격 main | 초기 `47ac96dbe`(PR #221). **최종 재조회 `c206b405dd0b44e54989f0bfdc6ef3c2cecac8c2`**, PR #222로 inquiry 통합 | 두 snapshot의 diff를 직접 확인. item route는 **`(app)`**. 오래된 `(main)` 경로를 그대로 구현 지시하지 않음 |
| `Vocaflow-csat-vnext2` | `feat/csat-inquiry-data`, HEAD `4cb0b32bc`, 감사 결과 JSON 2개 미커밋 | inquiry 데이터·검수·도식 자산 확인. 작성자 소유 보존, 자동 cherry-pick/폐기 금지 |
| `Vocaflow-csat-v3-design` | 초기 main `47ac96dbe`에서 분기한 `docs/csat-v3-design-20261012` | 최종 원격 main 추가 커밋은 읽기만 확인. 여섯 문서·진입 링크·CHANGELOG만 변경. T-0021 / owner `csat-v3-design`, DB read scope |

같은 HEAD여도 작업트리 내용이 다르다. 후속 M0에서 SHA와 dirty 파일을 다시 기록한다. 과거 외부 문서는 사용자 입력/이전 설계이지 구현 완료나 승인 정본의 증거가 아니다. 플랫폼 목표 정본은 `Vocaflow-AI-Control/goals/PROJECT_GOAL.md` v1.1.0이며 CSAT는 특화 환경이다. 이번 설계가 R0 전략 전체를 바꾸지 않는다.

## 2. 구현·데이터·전달의 판정

경로 접두 `src/`는 `apps/web/src/`다.

| 자산/기능 | 관찰 | 판정·조치 |
|---|---|---|
| `app/(app)/csat/item/[slug]/page.tsx` + `theater/AnalysisTheater.tsx` | main에 여섯 장면·대본 읽기·자기 설명·비교·체크 패널이 마운트됨 | 구현 유지·수정. 초안만 있는 상태가 아님 |
| `lib/csat/inquiry/scenes.ts` | essence/structure/answer/distractor/principle/compare. intent는 answer, procedure는 principle에 배정 | 기존 배정 자산 재사용. v3는 판단 통합·설계 분리·비교 선행으로 개정 |
| `lib/csat/teaching-contract.ts` | 26유형의 unit/relation/answer/lure/choiceTruth/visual/pitfalls | 구현 유지. 새 유형 레지스트리 26개를 중복 생성하지 않음 |
| `PassageMap.tsx`, `passage-skeleton.ts`, `skeleton.ts`, `design.ts`, `SceneDiagrams.tsx` | 원문 길이 막대·정답/오답 anchor·역할 사슬·표현 변환. 실제 passage_design은 부분 집합 | 구현 유지·확장. 막대/역할 라벨만으로 실제 영어 의미 이해를 대체하지 않음 |
| inquiry v1: `inquiry/labels.ts`, `data.ts`, `inquiry-data.json` | 초기 진행 브랜치에서 조사, **PR #222로 main에 통합됨**. 유지/변경/변환/내용 truth·조건부 principle, 분석 버전 일치만 조회 | 최신 main의 데이터/전달 재사용. 다시 cherry-pick/전량 재작성하지 않음. 두 도식은 SceneDiagrams.tsx의 exported 함수 |
| `compare-data.json`, `ComparePairs.tsx` | same/contrast 오답 비교. route는 같은 유형 siblings에 포함된 상대만 표시 | 구현 유지·수정. cross-type 공통 구조, 양쪽 버전/해시·원리 지지 binding은 추가 필요 |
| `SelfExplanation`, `SelfExplain.tsx`, 원리 저장 | `tempting/reject`, 해설 선행 true, 스스로 대조. 원리 저장·조건·한계 기록 경로 존재 | 구현 유지·확장. 자동 의미 채점/이해 확정 기능으로 취급하지 않음 |
| `LectureStage`, `lecture/{types,validate,player,focus,targets,store,tts}` | 큐/target/focus/언어 분리, 텍스트 탭에서 load만 수행. 역할 순서 검증이 단조 ROLE_ORDER | 구현 유지·수정. 새 장면은 큐 번호가 아님. 원문 의미와 비교 큐를 앞뒤로 재배치하려면 새 schema validator 필요 |
| `lib/csat/map/{learner-path,curriculum,prescription,lifecycle-evidence}` | 읽기 7단계, 과제 안 PROTOCOL 7절차, 관찰→확인→처방 분리 | 유지. 새 7장면과 번호/enum/진단 판정을 섞지 않음 |
| item `?check=1` + knowledge 패널 | main에 독립 확인 모드가 있으며 일반 해설 자동 reveal과 분리 | 구현 유지. 일반 탐구를 즉시 열되 독립 확인 시도는 도움 이력을 보존 |
| `/csat` 레일/Workspace·진단 | main도 기존 홈/진단/유형/함정/서가 메뉴 구조. 외부 메뉴 설계는 실행 완료 아님 | N1~N4 작업 필요. 지도 기본 홈 제안과 과제/탐구 복귀 통합 |
| 출제 사고 그래프 | 현 main의 역할·변환 도식은 있으나 아래 v3 Meaning/Claim/Pair/Principle 전 계보 그래프는 확인되지 않음 | 아직 새 계약 전체 미구현. 기존 도식을 교체하지 않고 adapter 추가 |

`loadCsatItemExplain`은 일반/RLS client로 발행 분석의 최신 버전을 선택한다. DB passage 전체를 읽지 않는다. 초기 main에는 analysis version 반환이 없었으나 **최종 main PR #222는 `analysis_version` 연결을 포함한다**. v3는 이 변경을 재사용하고 analysis ID와 content binding을 추가한다.

## 3. DB와 정적 자산 실측

2026-10-12 읽기 SQL로 `to_regclass`·information_schema를 확인했다. `csat_items`, `csat_items_public`, `csat_types`, `csat_item_analyses`, `csat_item_units`, `knowledge_applications`가 존재한다. **`csat_lectures`, `csat_review_ledger`라는 이름은 존재하지 않는다.** 강의는 현재 파일 정본이며 검수는 실제 기존 함수/원장을 찾아 사용한다.

`csat_item_analyses`: `id/version/item_id`, measured_ability/design_intent, answer_locus/choice_analysis/solve_procedure/difficulty(JSONB), required_vocab, status, analyst_run/units_version/units_hash 존재. 새로운 `reasoning_v3` 컬럼·테이블을 존재한다고 가정하지 않는다.

| in_scope 집합 | 문항 | 최신 published 분석 | passage_design 포함 | units_hash 보유 |
|---|---:|---:|---:|---:|
| 평가원 | 802 | 802 | 293 | 0 |
| 학평 고1 | 980 | 868 | 0 | 808 |
| 학평 고2 | 980 | 877 | 0 | 827 |
| 학평 고3 | 952 | 861 | 0 | 809 |

문항 정답 null은 위 집합에서 0이었다. 전체 published 분석 **6,076행/3,408 문항**, in_review **1,824행/1,212 문항**이다. 버전 행 수·검토 상태·문항 수를 혼용하지 않는다. 발행 분석 없는 학평은 306문항이며 분석이 있어도 학습자 공개/근거 정확성/독립 검수 통과를 이 집계만으로 증명할 수 없다. KICE units_hash=0은 현재 정적 골격 사용과 DB 컬럼 미부여를 뜻하며 ‘근거 0’이 아니다.

로컬 JSON을 직접 재계수: main 강의 index **796문항**, compare **500문항/1,662 방향 레코드**, 파일 선언 **831쌍**. 방향을 접기 전·후 분모를 구별하며 검수 정확도를 뜻하지 않는다. inquiry 브랜치 빌드 데이터 **786문항**. 문서의 예전 792·802 강의/전량 완료 수치를 그대로 인용하지 않는다.

DB 26유형 identity를 확인했다. 언어 이해/추론 능력 분류와 동일하지 않다. 전량 의미 검수는 이번 감사에서 수행하지 않았고 M3의 필수 작업이다. 대표 문항 DB 분석(아래 버전)은 내부 분석 설명을 읽어 UI 시나리오의 기준으로 삼았으며 원본 PDF 독립 판독 완료를 새로 주장하지 않는다.

## 4. F01~F16의 최신 판정과 v3 관계

기존 복구 수용 기준은 유지하되 **코드 존재만으로 완료 확정하거나 같은 수정을 반복하지 않는다.**

| F | 관찰 상태/v3 조치 |
|---|---|
| F01 | main은 일반 탐구에서 예측 제출 관문 대신 해설 선행 기록을 생성. 유지·회귀. 공유 구버전의 강제 PredictGate를 최신 main의 결함으로 오판하지 않음 |
| F02 | 최신 분석/신규 버전 존재. 전량 원장·needs_source/needs_review/stale 분류 유지. v3 확장 때문에 DB 전량 새 버전 발행하지 않음 |
| F03 | 대본 읽기 탭 구현. 장면/anchor 큐가 해당 설명을 항상 열고 읽을 수 있는지는 실화면 미검증. 새 binding으로 회귀 |
| F04 | 기존 target 문자열 재사용. primary와 related 중복 DOM·첫 querySelector 문제는 감사/회귀 후 필요한 곳만 교정 |
| F05 | 기존 lure 보강과 inquiry preserved/altered 자산 존재. 실제 학생 유인 효과는 미확인; 내용 조건과 설계 가설 분리 |
| F06 | skeleton 정답/오답 anchor 존재. 타입별 구문·양쪽 경계·도표 셀을 공통 evidence reference로 확장. 연결률=설명 정확성 아님 |
| F07 | passage_design/문장 분할 서로 다른 단위 가능. source/units binding과 명시 adapter. 불일치는 보류, 배열 padding/절단 금지 |
| F08 | 기존 focus/target 검증기 있음. 재배치 뒤 전 큐·구두 번호·밑줄/도표 영역 포함 범위 회귀 |
| F09 | 학평 분석 2,606 발행과 추가 검토 존재. inquiry v1은 브랜치 문서상 학평 보류. **이번 v3 설계는 학평 계약/검증을 포함하되 공개 보류·DB 승인 해제를 자동 실행하지 않음** |
| F10 | 역할/변환 도식 구현. 의미→발문→선지 인과 근거·유형 adapter를 추가하며 기존 시각 자산 보존 |
| F11 | 2026#25 최신 분석 v5에 수치 설명 있음. 도표 독립 판독 상태·visualHash 결속은 미확인. ‘도표 전부 미대조’ 또는 ‘전부 검증’ 일괄 라벨 금지 |
| F12 | Theater 전역 keydown 존재. 새 수동 선택/TTS/그래프 입력 충돌 회귀와 scope controller 적용. 전역 효과를 모르는 채 새 handler 추가 금지 |
| F13 | lecture/session/check/열람 기록 분리 자산 있음. 큐 점프·중단·무음·청취 추정을 이해/완주로 승격하지 않는 전이 검증 |
| F14 | main pickNextItem은 seen 제외/명시 revisit 지원. 유지. 구조 비교 대상은 이 일반 다음 문항 selector와 구별 |
| F15 | main knowledge 패널과 check 모드 마운트 확인. 기존 API·맹검 주석·adoption/active 게이트 보존. 새 장면 번호로 판정 기준 변경 금지 |
| F16 | 기존 unit/E2E 자산 재사용. 이번 설계에서는 실행하지 않았으며 새 실패→성공 회귀와 PC 시각 검수는 구현 단계에서 수행 |

## 5. 실질적 변경/유지/보류

유지: 분석 중심 목적, 공개 권한, 읽기와 선택적 음성, 타입 계약, 원문 기기 처리, 개인 기록·진단 독립성. 변경: essence 도입 단정→평가 질문, 실제 의미 해석 보강, 정답/오답 통합, 설계 가설 별도, compare 선행, principle 후보/일반화 구분, 원리 자기 설명. 추가: 공통 source/evidence/claim 계보·양쪽 비교 binding·공개용 의미 주석·선택적 원리 노트. 보류: 없는 원본/불명확한 밑줄·수치, 불충분한 원리 지지, 독립 확인 미승인, 학평 공개 보류, 신규 진단/자동 의미 채점/교육 효과 주장.

최종 main에도 통합된 `inquiry-drain-build.mjs`는 ‘마지막 판정이 revise가 아님’을 허용 조건으로 사용한다. 원격 main 파일을 다시 읽어 이 조건이 유지됨을 확인했다. **독립 pass가 없다는 것과 pass라는 것은 다르다.** v3 빌드 전에 명시 pass·작성자≠검수자·reviewed content hash·source/analysis binding 일치를 필수로 바꾼다. 기존 786개 모두가 결함이라는 뜻이 아니라 검수 누락 결과가 새 빌드에 들어갈 수 있는 공정 결함이다.

## 6. 미검증 범위

승인 규칙에도 버전 차이가 있다. 최신 main은 `PR_AUTOMATION_POLICY v1.1`(2026-10-11)로 DB 변경/데이터 삭제를 승인 대상으로 하고, 30파일은 추가 검증·main은 safe-merge 게이트를 따른다. 다른 출처는 **이 대화의 사용자 메시지 `AGENTS.md instructions for D:\workspace\Vocaflow`**(2026-10-12 세션에 제공, 파일을 다시 읽은 것이 아님)이다. 그 메시지의 ③에는 “항상 사용자 확인: `.env*` 커밋 · 새 키/secret 포함 · 빌드/테스트 실패 상태 push · 데이터 손실(DROP/TRUNCATE) · 파일 ≥30 변경”, “main 머지는 사용자 확인”이 있다. 두 출처를 같은 최신 저장소 규칙으로 오기하지 않는다. 이번 작업은 사용자 첨부 §8~9가 지정한 설계-only/no-main-merge 범위로 수행한다. 후속 새 task는 최신 정책을 기본으로 하고 별도 유효 사용자 지시가 있으면 그 메시지를 정확히 결속한다. 비밀값/실패 상태 push를 승인으로 우회할 수 있다는 뜻이 아니다.

main의 `agents/scripts/review.mjs`는 `--base/--goal/--print`를 읽고 커밋 diff를 검토하지만 `--plan` 인자/파일 본문을 처리하지 않는다. 옛 지시문대로 `--plan <문서>`를 붙이는 것만으로 계획 리뷰를 수행했다고 할 수 없다. 이번 문서 교차 검토는 반대 Claude에게 목적 파일과 전체 설계 문서를 읽기 전용으로 직접 제공하고 실제 결과를 REVIEW에 남긴다. 가드 스크립트 변경은 이번 docs-only 범위 밖이다.

브라우저 inventory가 apps/browsers 모두 비어 있어 localhost 렌더·PC 1280/1440·테마·TTS 청취는 이번에 확인하지 못했다. 실제 학습자 참여·교육 효과 실험도 없다. 연구 검토의 출처별 확인 범위는 [학습 프로세스](CSAT_LEARNING_PROCESS_V3.md)에 기록한다. 시행 기본 방향으로 개별 문항 의도를 공식 확인으로 승격하지 않는다.
