<!-- docs/methodology/VNEXT_MERGE.md -->
# 학습 원리 vNext — 두 구현 통합 명세

작성 2026-10-08 · 결정(사용자): **DB 스키마 정본 = `feat/methodology-vnext`**(개발 DB에 `20261008120000_knowledge_vnext` 적용됨) · `feat/knowledge-vnext`(이 브랜치)는 **학습자 기능 이식 원천**. 정본은 하나만 남기고, 이 브랜치는 더 키우지 않는다.
근거: 정본 브랜치 HEAD `c9db07e52` + 작업 트리(미커밋 학습자 조각) 코드 읽기 · 개발 DB 스키마 직접 조회(2026-10-08).
DB 쓰기 담당: 정본 세션 한 곳. 이 문서는 그 세션이 이식할 때 쓰는 명세다.

## 0. 결정(2026-10-08 사용자)

- 이식 담당: `vocaflow-b5`(정본 세션). 지금 단위(「한 문항만·새 이름 금지」)를 마친 뒤 **새 목적 파일로 별도 단위**를 시작한다 — 자동 시작하지 않는다.
- 다음 단위 순서: ① `/csat/practice/[slug]` 를 정본 스키마에 연결 ② 연습 기록 멱등성 + 실제 PostgreSQL 두 세션 동시성 ③ 5회 완료 시 다른 유형 추천(완료 횟수 ≠ 화면 표시 횟수) ④ 효과 검증 기반(연습/평가 기록 분리 · 미리보기·골격 문항 제외) ⑤ 브라우저 E2E.
- 골격 115문항: 삭제하지 않고 개발·연습용 후보로 격리. 출처·권리·정답·해설·근거·난도 확인 전에는 운영 학습·효과 검증에 쓰지 않는다.
- 새 SQL 은 새 번호·전체 sha256 으로 준비하고 승인 없이 적용하지 않는다. DB 쓰기 담당은 한 세션.
- 「효과 검증 기반 구축」과 「실제 학습 효과 입증」은 별개 완료 기준 — 후자는 실학습자 데이터 전까지 미완료.
- 이 브랜치(`feat/knowledge-vnext`)는 동결 — 이식 원천 전용.
- **공유 SQL 통합 방향(2026-10-08 추가)** — 학습 원리와 기출(CSAT)이 같이 쓰는 수행 기록·이벤트 제약은 **하나의 통합 SQL 변경 세트**로 설계한다(작성·승인은 다음 단위, 현재 b5 단위에는 소급하지 않음). 근거 제안: `origin/docs/csat-vnext-audit` 09d09e98a `docs/csat-learner/vnext-audit/03-PARALLEL.md` §5.
  - `learning_task_attempts` 공통 규격 채택 방향 — `client_attempt_id` 유일 범위(전역 / 학습자 / 세션)는 실제 데이터 모델로 정한다 · `mode` 와 `phase` 분리 · `item_ref` 가 모든 과제에서 `csat_items.id` 를 가리킬 수 있는지 확인(비기출 과제를 같은 표에 넣으면 별도 식별 전략) · 기존 데이터·호출 코드 호환성 검증.
  - 이벤트 CHECK 제약: **브랜치별 독립 재작성 금지**. 기존 값 + 양쪽 신규 이벤트의 합집합으로 한 번에 만들고, 기존 행이 새 제약을 통과하는지 검사.
  - `lib/csat/skeleton` 을 옮기거나 고칠 때 `/csat/practice` 채점 회귀를 필수 검사로 묶는다. 골격 문항은 검증 전까지 효과 계산 제외.

## 1. 기능 비교

판정: ● 정본에 있고 동작 · ◐ 양쪽에 있으나 차이 · ○ 이 브랜치에만 · ✕ 어느 쪽에도 없음

| 영역 | 정본(methodology-vnext) | 이 브랜치(knowledge-vnext) | 판정 → 처리 |
|---|---|---|---|
| 지식 종류 | `knowledge_items.kind` 6종 + 층 대응 CHECK · 153행 백필 | `facet` 2종(원리만) | ● 정본 채택 · facet 폐기 |
| 근거 축 | `evidence_level`(10) · `applicability` · 연구 서지 표(설계 불변) · 수준 자동 동기화 | `research_level` · `fit` | ● 정본 채택 · 폐기 |
| 근거 축 변경 → 재검토 | **없음**(상태 변경 때만 적용 중단) | 축이 바뀌면 채택 항목 재검토(트리거, 잠금 선행) | ○ **이식 후보(SQL 필요)** |
| 탐구 질문 | inquiries + inquiry_links(candidate/support/counter/uncertain) · 결론=항목 | inquiries + positions(4 태도) | ◐ 정본 채택 |
| 설계·배포 | applications(surface·version·audience·exclusions·active/paused/rolled_back) · 채택 항목만 · trial 1개 이상 | designs + deployments(snapshot·롤백) | ◐ 정본 채택. 학습자 노출 문구(추천 이유·절차)는 정본에 칸이 없다 → 코드 상수 또는 audience jsonb |
| 효과 판정 가드 | efficacy 를 연구(준실험 이상·적용 가능) 또는 비합성 분석 trial 로만 · 최소 표본 트리거 | 합성은 판정 금지 CHECK | ● 정본이 더 강함 |
| 수행 기록 표 | `learning_task_attempts`(phase pre/practice/post/delayed/transfer · synthetic · content_hash) | knowledge_task_runs | ● 정본 표 사용 · 새 표 안 만듦 |
| **중복 집계 방지** | **없음** — 유일 키·멱등 키 없음, 수가 그대로 센다 | 학습자·문항마다 첫 시도만(집계·프로토콜) · 제출 중 전환 잠금 | ○ **이식(코드)** + 멱등 키는 SQL 후보 |
| 학습자 화면 | **없음**(백엔드만: `POST /api/csat/item/[slug]/task`, 미커밋) | `/csat/practice/[slug]` 막대·번호 UI · 상태 판정 · 절차 · 결과·다음 행동 | ○ **이식(코드)** — 채점은 정본 방식으로 |
| 채점 | 주장 정확 일치 + 근거 집합 + 관계(relationProbe) · 맹검 이중 주석(Claude+Codex) · 이견 문장 제외 | 정답 근거 앵커 문장 1개 적중 | ◐ **정본 채점 채택**(더 엄밀). 이 브랜치의 앵커 채점은 폐기 |
| 문항 풀 | 주석 1문항(2022#20) | 골격 115문항 | ◐ **결정 필요**: 주석 문항만 실험(trial)에 쓰고, 골격 문항은 쓰지 않거나 「연습(효과 계산 제외)」로만 |
| 전이 추천 | **없음** | 5회마다 전이 유형(`pickNext`) | ○ **이식(코드)** — 정본은 phase=transfer 를 명시 기록 |
| 미리보기 | **없음** | 관리자 `?preview=1` · 기록은 효과 계산 제외 | ○ **이식(코드)** — 기록은 `synthetic=true` 로(정본 의미: 효과 계산 제외) |
| 효과 프로토콜 계산 | **없음**(DB 최소 표본만) | `evaluateProtocol` 사전·사후·지연·전이 · 학습자당 첫 시도 · 버전 혼합 거부 · 20명 문턱 + 단위 테스트 | ○ **이식(코드)** — phase 열을 그대로 쓰도록 조정, 지연 14일(정본 문서) |
| 학습자 역량 판정 | 없음 | `judgeCapability`(5회 미만 판정 안 함) | ○ 이식(코드) |
| 저작권 경계 | 문장 번호만 · 지문 글자 없음 | 같음 | ● |
| 관리자 5 공간 | 운영실·지도·연구소·설계·**적용(product)** · 브라우저 21/21 | 운영실·지도·연구소·설계·품질 | ● 정본 채택 · 이 브랜치 화면 폐기 |
| 이벤트 | — | `knowledge_task_viewed/submitted` + DB 허용 | ○ 이식 시 DB CHECK 마이그레이션 필요(SQL) |
| 스키마 시험 | embedded-postgres 36/36 · dev DB 롤백 스모크 | PGlite 24/24 | ● 정본 |
| 학습자 E2E | **없음** | `40-knowledge-practice.spec.ts`(5문항·중복 클릭·전이·새로고침·다른 세션) | ○ **이식(정본 경로로 고쳐서)** |
| 실제 두 세션 동시성 | ? (정본 문서 확인 필요) | 미실행 | ✕ 통합 뒤 실행 |
| 실제 학습 효과 | ✕ | ✕ | 실학습자 없음 — 별도 상태 |

## 2. 이식 목록(코드 — SQL 없이)

이 브랜치 커밋에서 파일 단위로 가져가 정본 스키마에 맞춘다. 재구현하지 않는다.

1. `apps/web/src/lib/knowledge/vnext.ts` 중 `evaluateProtocol` · `judgeCapability` · `RunRecord`(→ attempts 의 phase 를 그대로: pre/practice/post/delayed/transfer) · 테스트 `__tests__/vnext.test.ts` 의 해당 블록 — 이름 충돌 주의(정본에도 `vnext.ts` 가 있다 → `protocol.ts` 로 옮긴다).
2. `apps/web/src/lib/knowledge/practice.ts` 중 `pickNext` · `parseClaimResponse` 의 범위 검사 패턴 — 채점(`buildClaimTask`·`scoreClaim`)은 버리고 정본 `gradeClaimSupport` 를 쓴다.
3. `apps/web/src/components/knowledge/ClaimPractice.tsx` + `practice.module.css` — 3단계(주장 → 근거 → 관계)로 고친다. 제출 중 전환 잠금·응답 문항 대조·「다음 문항」 합집합 집계(Codex 지적 3건 반영분)를 유지한다.
4. 학습자 기록 읽기: `learner-practice.ts loadMyRuns` 의 **문항별 첫 시도·현재 버전·미리보기 분리** 규칙을 정본 `product-server` 의 집계에 넣는다(지금 정본은 시도 수를 그대로 센다).
5. 미리보기: 관리자만, 기록은 `synthetic=true`. 실학습 경로는 `loadLiveApplication` 그대로.
6. E2E `tests/e2e/40-knowledge-practice.spec.ts` — 경로를 정본 화면으로, 정리 대상을 `learning_task_attempts`(테스트 계정·synthetic)로.

## 3. SQL 이 필요한 것(새 번호 · 해시 승인 뒤)

`20261008120000` 은 쓰지 않는다. 버전은 만들기 직전 DB 이력과 모든 워크트리의 `supabase/migrations` 를 보고 고른다.

| 후보 | 이유 | 영향 |
|---|---|---|
| `learning_task_attempts.client_attempt_id uuid` + 유일 (user_id, client_attempt_id) | 「맞춰 보기」 두 번·재전송이 행을 두 개 만들지 않게(DB 수준 멱등) | 열 1 · 인덱스 1 · 기존 행 0 |
| 근거 축 변경 → 채택 항목 재검토 트리거(`evidence_level`·`applicability`) | 「근거 변화 → 추천 중단」의 축 경로가 정본에 없다. 항목 행을 먼저 FOR UPDATE(커밋 전 채택을 지나치지 않게) | 트리거 1 |
| funnel 이벤트 2종 허용 | 학습자 화면 진입·제출 계측(AGENTS D2) | CHECK 재생성(기존 값 보존) |

## 4. 폐기(이 브랜치에서 더 쓰지 않음)

- 마이그레이션 `20261008120000_knowledge_vnext.sql`(미적용 · 승인 해시 `dda60e0e…0186` 은 실패 기록으로만 보존) · 시드 `vnext-pilot-seed.sql`(내용 중 연구 서지 5건은 정본 `knowledge_research_sources` 로 관리자 경로 입력 후보)
- 관리자 화면(`admin/knowledge/{page,map,lab,design,quality}` · `vnext-actions.ts` · `vnext-server.ts` · `RelationTree` · `VnextForms`)
- PGlite 시험 스크립트 2개

## 5. 연구 서지(정본 입력 후보 · 서지 확인됨)

Crossref 로 확인: Hebert 외 2016(J. Educ. Psychol. 108(5) 609–629, doi 10.1037/edu0000082, 메타분석) · Pyle 외 2017(RRQ 52(4) 469–501, 10.1002/rrq.179, 메타분석) · Bisra 외 2018(EPR 30(3) 703–725, 10.1007/s10648-018-9434-x, 메타분석) · Adesope 외 2017(RER 87(3) 659–701, 10.3102/0034654316689306, 메타분석). 발행처 초록 확인: Jiang 2012(RFL 24(1), 준실험, EFL 대학생 — 지연 측정에서 일반 독해 효과 사라짐 → 「조건부」). 모두 본문 대조 전(B).
