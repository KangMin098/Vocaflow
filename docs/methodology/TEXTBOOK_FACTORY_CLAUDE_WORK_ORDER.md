# Claude Code 작업 지시 — Textbook Factory 최종 완성

작성일: 2026-10-11. 이 파일은 실행 지시이며 완료 증거가 아니다.

## 최우선 목표

초등 고학년~고3의 단일·복수 학년 및 다양한 목적·유형 교재가 하나의 Product Order와 evidence revision을 유지하며 생산되는 파이프라인을 완성한다.

`기획 → 주문 → 원천/각색 → 문항 → 해설 → 검수 → 단원 → 권 → 조판 → 게시 simulation → revision impact/복구`

설명·계획만 제시하지 말고 현재 코드에서 단절을 찾아 구현·실행 검증·문서·커밋·push까지 진행한다. 작은 확인마다 멈추지 않는다. 전체 목표는 유지하되 완료 판정은 실제 증거에 근거한다.

## 시작 위치와 현재 기준선

- 작업공간: `D:\workspace\Vocaflow-benchmark-admission-integration-20261006`
- 작성 시 직접 확인한 브랜치: `feat/textbook-factory-main`
- 작성 시 직접 확인한 HEAD: `dcc3bb43f`
- 작성 전 working tree: clean
- 공유 작업공간 `D:\workspace\Vocaflow`의 다른 작업은 보존한다.

이전 채팅의 `feat/textbook-factory-phase1 / d431fd82b`는 과거 기준선이다. 그 상태로 reset하거나 되돌리지 않는다. 시작 시 HEAD·branch·working tree·remote·lock을 다시 확인하고 `AGENTS.md`, `.agent-goal.md`, 인수인계 파일을 읽는다. 안전장치와 memory 점검은 저장소 규칙에 따른다. 쓰기 전에 자기 잠금을 획득하고 자기 파일만 커밋한다.

## 범위 — 목표 집중

공정 연결, 실제 adapter, 상태 전이, evidence lineage, 합성 E2E, 실패 복구, 핵심 관리자 관측을 우선한다. 기존 자산을 재사용하고 현재 E2E에 필요 없는 새 계약·gate를 계속 추가하지 않는다.

다음은 이번 완료의 blocker가 아니며 후속 backlog로 둔다:

- 실제 권한 확보·출판사 연락·상업 교재 admission
- 실제 corpus·한국 학년 benchmark·학생 검증
- 실제 Gold-S 발급·실제 DB seed·외부 출판/판매
- 교사용 별도 출력
- UI 미세 디자인·선택적 편의 기능·장기 확장·비필수 최적화

실제 데이터가 0이어도 synthetic fixture/trust root로 파이프라인을 검증한다. 합성 결과를 실제 학년 타당성·운영 검증으로 주장하지 않는다. 기존 안전장치와 테스트 기준을 낮추라는 뜻은 아니다.

## 먼저 읽고 사실 확인할 자료

- `docs/reports/textbook-factory-completion-audit-20261009.md` — 마지막 업데이트까지 읽는다.
- `docs/textbook-factory-recovery.md`
- `.agent-goal.md`
- `docs/ACADEMIC_READING_ENGINE.md` 및 통합 공장 관련 문서 — 감사 문서에서 연결된 정본을 따른다.
- `packages/library-pipeline/src/textbook/product-capability-status.ts`

최근에는 이전 채팅 이후 추가 구현이 진행됐다. 감사 문서에는 order-run 관리자 상태, 일자별 atomic volume, order-run→atomic bridge, specialized family 실행, 일자별 revision 재생산과 hash-chain journal이 기록돼 있다. 이 기록을 무조건 완료로 믿지 말고 코드·테스트로 확인한다. 이미 구현된 기능을 다시 만들지 않는다.

주요 실행 파일:

```text
scripts/textbook/order-production-run.mjs
scripts/textbook/run-atomic-bridge.mjs
scripts/textbook/atomic-volume.mjs
scripts/textbook/run-revision.mjs
scripts/textbook/production-revision-journal.mjs
scripts/textbook/planned-volume-run.mjs
scripts/textbook/reading-promotion/synthetic-master.mjs
scripts/textbook/synthetic-master-production.mjs
scripts/textbook/synthetic-master-run.mjs
packages/library-pipeline/src/textbook/product-planning.ts
packages/library-pipeline/src/textbook/multi-grade-production.ts
packages/library-pipeline/src/textbook/reading-family-unit.ts
packages/library-pipeline/src/textbook/specialized-reading-unit.ts
```

관리자 시작 화면은 `/admin/csat/new`다. 해당 API·도움말·주문 등록·run 조회 구현도 함께 대조한다.

## 다음 큰 작업 단위

먼저 현재 완료 감사를 업데이트해 아래를 `DONE / PARTIAL / MISSING / DEFERRED_REAL_DATA`로 분류한다. 이전 감사의 미완성을 그대로 반복하지 말고 최신 구현으로 재판정한다.

1. **등록 주문의 연속 생산**: 실제 주문/기획 입력이 production run, 일자별 생산, 단원·권·조판·게시 simulation까지 이어지는가? 고정 예행 preset의 성공만으로 일반 주문 연결을 주장하지 않는다.
2. **P01~P20 adapter**: 각 제품의 지문·문항·활동·조판이 해당 목적을 실제로 구현하는가? generic wrapper를 semantic adapter 완료로 표시하지 않는다. specialized 자료·시험 목표와 관리자 입력까지 확인한다.
3. **독해 외 제품**: 어휘·구문·문법·듣기·받아쓰기·카드·진단 등 기존 자산이 같은 주문/생산 계보에 들어오는가? 원래 목표 범위를 임의로 제외하지 않는다.
4. **전체 학년과 권 조립**: 단일 학년, 연속 범위, 비연속 조합, 공통 지문+학년별 문항, 학년별 각색, 학년별 단원 혼합을 실제 실행한다. 여러 일자·지문이 한 권으로 연결되는지도 확인한다.
5. **상태 관측·복구**: 현재 공정, blocker, stale, 산출물, revision 영향과 재시도를 관리자/CLI에서 확인한다. 중단·부분 실패가 성공으로 남지 않아야 한다.

미완성 중 최종 목표를 직접 막는 연결부터 한 덩어리로 구현한다. 실제 데이터 부재나 부수적인 발견 때문에 멈추지 않는다.

## 검증과 완료 기준

제품/학년 지원 범위에 맞는 master E2E를 실행하고 실제 HTML·manifest·run 기록을 확인한다. 필수 실패 주입은 주문/학년 혼합, source/adaptation/item/explanation 변경, benchmark/policy revision 변경, stale·철회·만료 증거, snapshot/output 변조·replay, 중단 후 재시도다. 이미 있는 테스트와 실행기를 재사용한다.

합성 실행에서도 모든 공정의 주문·revision·evidence 결속을 확인한다. capability 표시는 실행 증거와 일치해야 한다. 최종 완료 시 fresh 전체 검사와 유용한 교차 리뷰를 수행하고 발견된 결함을 해결한다.

```powershell
pnpm.cmd turbo run lint typecheck test --force
node agents/scripts/check.mjs
```

LLM 판단은 Claude Code/Codex drain 방식으로 수행한다. API 키를 기다리거나 요구하지 않는다. 관리자 변경에는 같은 커밋에서 도움말을 갱신한다. 관련 문서·CHANGELOG·복구 절차도 함께 갱신한다.

## 승인 및 작업 종료

합의된 구현 범위는 중간 승인 없이 진행한다. 새 DB migration은 정확한 SQL을 제시하고 저장소 규칙에 따라 승인받는다. 과거 SQL 해시 승인을 새 SQL에 재사용하지 않는다. 남의 수정·미추적 파일을 삭제하거나 커밋하지 않는다. 실패 상태 push 등 별도 승인 경계는 AGENTS.md를 따른다.

큰 단위는 구현 → 실행/실패 주입 → 검증 → 필요한 리뷰 → 문서 → 자기 파일 커밋·현재 브랜치 push까지 닫는다. main 직접 push·force push·검사 우회는 하지 않는다. 다른 에이전트에게 넘길 때는 저장소 인수인계 절차를 따른다.

현재 목표의 최종 판정은 아직 미완료다. 모든 원래 요구의 직접 실행 증거가 확보된 뒤에만 `TEXTBOOK_FACTORY_PIPELINE_COMPLETE=true`로 변경한다. 실제 운영 E2E가 없으면 `TEXTBOOK_FACTORY_PRODUCTION_VERIFIED=false`는 별도로 유지한다.

최종 보고는 완료한 공정 연결, 실제 실행한 검증, 남은 필수 작업, 후속 제외 항목, commit/push 상태를 분리한다. 작은 subset의 성공을 전체 목표 완료로 확대하지 않는다.
