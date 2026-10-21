# 하위 메뉴 이행 시 액션·권한 경계

2026-10-19 · **정적 조사, 권한 실행 시험 아님** · [설계 본문](../admin-submenu-redesign.md)

메뉴 소속을 옮겨도 기존 권한을 확대하지 않는다. 페이지의 접근 검사와 직접 호출 가능한 액션/API/RPC의 검사는 별도로 보존한다. [action-guard-index.json](./action-guard-index.json)에 **서버 액션 모듈 24개·exported 함수 선언 101개**를 이름·행·검사 호출·RPC로 색인했다. 수집 범위는 `app/admin/**` 전체와 572개 소스 색인에 포함된 `lib/**`에서 **모듈 수준 `'use server'` 지시문이 있는 파일**이다. 파일 이름을 `actions.ts`로 제한하지 않는다. 모듈 안 helper는 깊이 6까지 추적했고 import한 함수 내부·모든 브라우저 RPC·모든 API까지 전량 실행 검증한 것은 아니다. 이 import 범위 밖의 학습자·교사 서버 액션은 조사 대상 밖이다.

## 화면 접근

- [admin/layout.tsx](../../apps/web/src/app/admin/layout.tsx)의 `requireAdmin()`과 [middleware.ts](../../apps/web/src/middleware.ts)의 세션·프로필 역할 검사를 유지한다.
- [require-admin.ts](../../apps/web/src/lib/auth/require-admin.ts)와 [require-admin-api.ts](../../apps/web/src/lib/auth/require-admin-api.ts)의 역할 검사·오류 처리·개발 전용 우회와 production 구분을 유지한다.
- 페이지가 차단된다는 사실만으로 내부 액션의 직접 호출도 같은 정책이라고 단정하지 않는다. 별도 메뉴를 추가해 RPC가 허용한 역할을 확대하지 않는다.

## 액션별 검사 위치와 이행 계약

| 모듈 / 함수 수 | 확인한 검사 위치 | 이행 계약·미확인 |
|---|---|---|
| 도서 `curation/actions.ts` / 8 | 각 exported 액션의 `requireAdmin` | RPC의 상태·발행본·사용자 진도 보호를 유지. 삭제 후 재수집과 상태 변경 구분 |
| CCP `comic/actions.ts` / 8 | 각 exported 액션의 `requireAdmin`; 발행은 별도 RPC | menu 변경이 QC·발행 보호를 대체하지 않음 |
| Compose `compose/actions.ts` / 17 | 명시적 requireAdmin 호출 없음. 소스는 요청 사용자 클라이언트와 RLS(`is_admin_or_curator`) 의존을 설명 | **추가 확인 대상.** 함수별 DB 쓰기·RLS·RPC와 외부 fetch를 구별. 실제 설치 정책과 import한 helper는 미검증. 즉시 권한 누수라고 판정한 것은 아님 |
| 영어 진단 `csat/diagnosis/actions.ts` / 5 | `requireAdmin`, admin ID/버전 액션 | service 권한 쓰기 전 사람 확인·설정 버전·시험 검토 규칙 유지 |
| 지문 제작 `csat/sourcing/actions.ts` / 1 | `requireAdmin` | 선택 조건 재검증과 기존 실행 주체 유지 |
| 교재 승인 `csat/press/actions.ts` / 1 | `requireAdmin`, release gate | 승인자·렌더·검수·버전 결속 유지. 다른 대상 승인으로 대체 금지 |
| 연구 `knowledge/actions.ts` / 6 | 모듈 내 helper의 `requireAdmin` 뒤 관리자 클라이언트 | 낙관적 버전 검사·채택/trial·적용 gate 유지 |
| 연구 적용·trial `knowledge/vnext-actions.ts` / 10 | `actor()` helper의 `requireAdmin` | 탐구·근거·적용·trial 입력 검사와 DB 최종 gate, 낙관적 상태 검사 보존 |
| VCB `lib/vcb/server/*.ts` / 13모듈·38함수 | Studio·seed·보강·QA·큐레이션·발행 등 각 함수의 직접/모듈 내 `requireAdmin` | 단어장 생산의 핵심 액션을 포함. 상세 함수별 위치는 JSON. 특히 `runPublish`는 admin 확인 뒤 기존 publishRun 실행 |
| 사전 보강 `pending-words/actions.ts` / 1 | 서버 액션은 RPC 호출. `update_pending_word_status` SQL 본문이 `user_profiles.role=admin` 검사 | [복원 SQL](../../supabase/migrations/20260812133000_restore_pending_words.sql)에서 확인. 현재 설치된 정의·ACL은 DB 조회 안 함 |
| 품질 검사 `quality/gates/actions.ts` / 1 | `requireAdmin` 뒤 검사 RPC | 명시적인 검사 실행 권한·기존 scope 유지 |
| 영상 `video/actions.ts` / 5 | 각 exported 액션의 `requireAdmin`, 요청·회수 RPC | 취소/retire/restore의 대상·상태·기존 role 정책 유지 |

101개 중 83개 함수 선언은 직접 또는 모듈 내 helper의 명시적 가드 호출, 1개는 RPC SQL 본문 검사, 나머지 17개는 Compose의 추가 확인 대상으로 기록했다. 이 수는 함수를 정적으로 분류한 수이며 보안 검증 통과율이 아니다.

## 별도로 읽은 API·브라우저 RPC

| 진입점 | 확인한 위치 | 남은 검증 |
|---|---|---|
| TCP enqueue/drain/promote | 각 route의 `requireAdminApi()` | 작업·승격 범위/동시 실행/일괄 선택 회귀 |
| ACP·LCP 개발 처리 | production 차단 및 API admin 검사 | 운영 worker 가동 증거, 실제 정책별 거부 시험 |
| PDCP drain | production 차단 및 `requireAdminApi()` | 브라우저 중단과 in-flight 처리, 재진입 상태 |
| 추출 판정 get/save RPC | [하네스 SQL](../../supabase/migrations/20260718100020_judgment_harness_rpcs.sql)의 `is_admin_or_curator()` | 설치된 최종 정의·grant·호출 정책 확인. 관리자 화면 접근과 RPC 자체 역할의 차이를 임의 통일하지 않음 |
| VCB/VRL·DB 등 다른 route·RPC | 화면과 도움말의 처리 경계 조사 | **직접 호출 권한 전량 시험 미실행.** 실제 구현 단계에서 해당 entry별 검사와 RLS를 추가 확인 |

API 및 SQL 근거 파일의 해시도 JSON에 고정했다. SQL 파일을 읽었을 뿐 실행하지 않았다. guard는 명세의 모듈 누락·근거 파일 변경을 검출하며 권한 정책의 의미나 배포 상태를 자동 증명하지 않는다.

## 적용 단계의 확인 기준

동일 작업의 허용 계정·거부 계정으로 페이지와 액션/API/RPC를 각각 직접 검증한다. 기존보다 넓은 역할이 쓰기·발행·개인 기록에 접근하면 해당 이행을 수용하지 않는다. 개발 우회 환경의 화면 통과를 production 권한 시험으로 대체하지 않는다. 선택한 학습자의 결과는 서버에서 인물·범위가 일치하는지 확인해야 한다.

이 항목은 v2 구현의 완료 조건이며 이번 연구에서 권한 회귀가 없음을 이미 검증했다는 뜻은 아니다.
