<!-- docs/csat-learner/vnext-audit/03-PARALLEL.md -->
# 03. knowledge-vnext / methodology-vnext 와의 병행

## 근거 (2026-10-08 기준)
- [사실·코드] `git show`로 원격 브랜치를 읽었습니다. 다른 워크트리는 읽기만 했습니다.
- [사실·DB] `learning_task_attempts`가 개발 DB에 있습니다. 행은 0개입니다.
- 그 브랜치를 담당하는 세션(vocaflow-6a)이 확정·검토 상태를 직접 알려 줬습니다.

| 상태 | 대상 |
|---|---|
| **확정·정본** | `origin/feat/methodology-vnext`의 마이그레이션 `20261008120000_knowledge_vnext.sql`(개발 DB 적용분) · `docs/methodology/VNEXT_ARCHITECTURE.md` |
| **확정·결정** | `origin/feat/knowledge-vnext:docs/methodology/VNEXT_MERGE.md` §0. 이식은 vocaflow-b5 세션이 맡음. 골격 115문항은 개발·연습용으로 격리. DB 쓰기는 한 세션만 |
| **검토 중 (동결 · 이식 원천)** | knowledge-vnext의 `/csat/practice/[slug]` · `lib/knowledge/{practice,learner-practice,vnext}.ts` · 이벤트 2종. 그 브랜치의 VNEXT.md와 마이그레이션은 **폐기(미적용)** |
| **진행 중 (미확정)** | methodology-vnext 워크트리의 `/api/csat/item/[slug]/task` (커밋 전) |

## 1. 영역 담당표

| 영역 | 담당 |
|---|---|
| 학습 원리·지식 체계 | knowledge / methodology-vnext |
| `/csat/practice` 이관 | vocaflow-b5 (VNEXT_MERGE §0) |
| 기출 학습 전체 UX 재설계 | 이번 조사 (명세) → 구현 담당은 미확정 |
| 공통 학습 세션 설계 | 이번 조사에서 제안. 구현 담당 미확정 |
| 완료·복습·전이 데이터 계약 | 양쪽 설계를 비교한 뒤 확정 (§5) |
| DB 마이그레이션·시드 | 이번 조사 범위 밖. 쓰기 담당은 한 세션 |

## 2. 충돌 매트릭스

| 대상 | 기출 학습 (main·map-vnext) | knowledge-vnext (동결) | methodology-vnext (정본) | 위험 | 조치 |
|---|---|---|---|---|---|
| 라우트 `/csat/practice/[slug]` | 없음 | `(main)/csat/practice/[slug]/page.tsx` 새 파일 | (이식 대상) | 낮음. 경로 충돌 없음 | 기출 쪽은 이 경로를 쓰지 않음 |
| `lib/csat/skeleton` | 소유 (골격 로더) | **읽어서 의존** (`loadItemSkeleton`, `skeletonSiblings`) | 이식하면 같은 의존 | **중간.** 평가원 단위로 옮겨 번호 기준이 바뀌면 practice 채점(`keySentences`)이 깨짐 | 골격 API를 바꿀 때 practice 회귀 테스트를 함께 돌림 |
| `lib/analytics/events.ts` | csat 이벤트 24종 | `knowledge_task_*` 2종 추가 (위치가 `csat_dx_*` 주석 블록 사이) | 이식 예정 | 중간. 같은 파일 동시 수정과 주석이 엉뚱한 줄에 붙는 문제 | 추가는 파일 끝 블록에. 이벤트 사양 v1과 한 PR로 묶지 않음 |
| `funnel_events` CHECK | 마지막 `20261002120100` | 미적용 마이그레이션 안에만 | 「새 번호 SQL 필요」 | **높음.** 허용 목록 SQL을 두 쪽이 따로 만들면 나중 것이 앞 것을 덮음 (CHECK 재정의) | **허용 목록 SQL은 한 세션이 합쳐서 하나로** |
| 학습 시도 표 | `csat_learner_state.record` jsonb | `knowledge_task_runs` (폐기) | `learning_task_attempts` (적용됨) | **높음.** 이중 정본 | 정본을 확장 (02 §0 A) |
| 정답 키·채점 | 클라이언트 props (극장) | 서버 `scoreClaim` | 정본 `gradeClaimSupport` 예정 | 중간. 같은 문항을 두 방식으로 채점 | 효과 검증 문항은 서버 채점으로 통일 |
| `lib/framework/learner-routes.ts` | `/csat/space` (리다이렉트) 잔존 | 「주장과 근거」 추가 | 이식 예정 | 낮음 | 같은 파일에서 한 줄씩 |
| 골격 115문항 (R-CLAIM·GIST·TOPIC·TITLE) | 극장·해부에 노출 중 | practice 문항 풀 | **개발·연습용으로 격리** | 중간. 같은 문항이 극장에서 해설로 노출되면 전이 평가가 오염됨 | manifest의 모드 자격에서 transfer용 문항을 극장 노출과 분리 |
| `/api/csat/item/[slug]/task` | 없음 | — | 진행 중 (커밋 전) | 미확정 | 확정 뒤 다시 대조 |

## 3. `/csat/practice` 통합 방안

**흡수하지 않고 역할로 나눕니다.**

| | 기출 학습 (극장·해부) | Practice (원리 연습) |
|---|---|---|
| 목적 | 실제 기출의 근거와 출제 원리를 이해하고 적용 | 이해한 원리를 별도 과제에서 연습하고 전이 |
| 단위 | 문항 1개 또는 세트 3개 | 역량 과제 (예: 주장과 근거) 5회마다 전이 |
| 채점 | 지금: 클라이언트 비교 → 제안: 효과 문항만 서버 | 서버 (정본) |
| 원문 | 기기 reflow | 문장 번호와 길이 막대만 (원문 없음) |
| 공통 | **학습 시도 기록 (정본 표), 완료 수준, 복습·전이 일정, 합성 분리, 이벤트 규칙** | 같음 |

연결 방식 [가설]:
1. 기출 학습을 마치면 화면 3에서 「같은 원리 연습」으로 practice 과제를 추천합니다(역량 키로 연결).
2. practice 전이 결과가 기출 복습 일정을 앞당기거나 미룹니다.
3. 둘은 같은 `learning_task_attempts`에 `mode`만 다르게 기록합니다.

**최종 통합 여부는 구현 감사 뒤에 결정합니다**(사용자 지시).

## 4. 통합 순서 (제안)
1. **(지금)** 이 조사 문서를 머지합니다. 다른 브랜치는 건드리지 않습니다.
2. vocaflow-b5: practice 이식의 ①–② 단계(정본 연결, 멱등성)를 진행합니다. 이때 **`client_attempt_id`가 §5의 합의안대로** 들어가야 기출 쪽이 재사용할 수 있습니다.
3. 기출 1주차: 기기 레코드만으로 완료·재개 루프를 닫습니다(DB 변경 없음). 이 단계는 2와 병행할 수 있습니다.
4. 허용 목록 SQL 하나(knowledge 2종과 기출 사양 v1 신규)를 한 세션이 만들고 사용자 승인을 받습니다.
5. 기출 4주차: 정본 표에 이중 기록을 시작합니다.
6. map-vnext Workspace는 세션 계약이 생긴 뒤에 main에 들입니다.

## 5. 공통 스키마 전 합의 사항
1. **멱등 키**: `client_attempt_id uuid`와 유일 제약 `(user_id, client_attempt_id)`. 정본에는 지금 없습니다(멱등 키 없음 확인).
2. **`phase`와 `mode`의 분리**: phase는 효과 프로토콜(pre/practice/post/delayed/transfer)만 나타냅니다. 학습 모드(theater/dissect/practice/review)는 별도 열로 둡니다.
3. **완료 수준 열거형**: viewed / completed_guided / completed_independent / transfer_passed. review_due는 저장하지 않고 파생합니다(`memory_state` 저장 금지 규칙과 같은 원리).
4. **`content_hash`의 정의**: 분석 버전 id와 자산 해시를 쓸지, 문항 입력 해시를 쓸지. 이것이 과거 기록 결속의 기준입니다.
5. **`item_ref` 형식**: `csat_items.id` (`2026#34`)로 통일합니다(practice는 문항 id, 극장은 slug).
6. **합성·내부 계정 판정**: `synthetic` 열 (정본에 있음)을 누가 언제 세우는지. 검증 계정 목록은 서버가 관리합니다.
7. **쓰기 경로**: 정본은 service_role insert만 허용합니다(서버 채점). 극장처럼 클라이언트가 판단하는 시도를 기록할 때도 서버 API를 거칩니다.
8. **이벤트 허용 목록 SQL을 한 번에**: 두 브랜치의 이벤트를 합친 단일 마이그레이션 하나로 만듭니다.
9. **격리 문항**: 골격 115문항을 transfer·post 측정에서 빼는 규칙의 위치(manifest인지 practice 풀인지).
10. **DB 쓰기 담당**: 공통 스키마 SQL을 적용할 세션 하나와 sha256 승인 절차.
