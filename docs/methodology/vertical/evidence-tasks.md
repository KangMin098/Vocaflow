# E축 확인 과제 — 「선지가 다시 말한 본문 문장」 · 「빈칸을 정하는 근거 문장」(2026-10-10)

> 상태: **사용자 승인(2026-10-10) · 맹검 검토 2건 adopt([evidence-tasks-review](./evidence-tasks-review.md))** · **2026-10-10 개발 DB 적용 완료** — 사슬 4 채택(과제 2 제품 적용) · 적용 13 active · 화면 확인 `scripts/csat/map/e2e-evidence-live.mts` 13/13.
> 빌드 실행 여부는 CHANGELOG 와 DB(knowledge_applications)로 확인한다.

## 코드(이미 있음 · DB 없이 동작)

| 무엇 | 어디 |
|---|---|
| 과제 · 채점 · 화면 모양 | `apps/web/src/lib/knowledge/evidence-locate.ts`, 레지스트리 `item-tasks.ts`(`option-restate` · `evidence-locate`) |
| 합의 주석 11문항 | `apps/web/src/lib/knowledge/annotations/evidence-tasks.v1.json` — 근거 · 갈린 문장 · 빈칸 문장(문장 번호만) |
| 문항 화면 | `components/csat/theater/EvidencePanel.tsx`(문항 페이지 `#principle`) |
| 지도 기준 | `lib/csat/map/curriculum.ts` — option 단계 = option-restate · evidence 단계 = evidence-locate |
| 검증 | 단위 `vertical-evidence-locate.test.ts` · 역할 학습자 시뮬레이션 [ROLE_LEARNER_SIM_2026-10-10](../../csat-learner/ROLE_LEARNER_SIM_2026-10-10.md) |

## 활성화에 필요한 DB 쓰기(승인 대상)

cohesion-link 와 같은 절차다(`scripts/knowledge/vertical-cohesion-link-build.mts`). 순서는 다음과 같다.
1. 관리자 화면으로 항목을 만든다.
2. 맹검 검토 두 건이 adopt 한다.
3. 「학습자에게 켜기」 를 누른다.
채택 게이트를 건너뛰는 직접 INSERT 는 하지 않는다.

1. 지식 사슬(knowledge_items · knowledge_links `implements`)

| 층 | slug(안) | 제목(안) | 문장 요지 |
|---|---|---|---|
| principle(processing_mechanism) | `semantic-correspondence` | 의미 대응 | 정답 선지는 본문의 한 문장 · 명제를 다른 말로 다시 말하고, 오답 선지는 그 말을 비튼다(정본 §13 6 · 7). 효과 미확인 |
| method | `method-option-correspondence` | 선지와 본문 문장 맞대기 | 선지마다 다시 말한 본문 문장을 찾아 번호를 적고, 찾지 못하거나 어긋나면 지운다 |
| practice | `task-option-restate` | 정답이 다시 말한 본문 문장 고르기 | 주제 · 제목 · 요지 문항에서 정답 선지가 재진술한 문장 번호 하나 — 합의 주석으로만 채점 |
| practice | `task-evidence-locate` | 빈칸을 정하는 근거 문장 고르기 | 빈칸 문항에서 빈칸 내용을 정하는 근거 문장 번호 하나 — 빈칸 문장 자체는 근거가 아님 |

2. 적용(knowledge_applications)

| surface | surface_ref | audience |
|---|---|---|
| `csat_item_task` | `option-restate:2026-22` · `2026-23` · `2026-24` · `2025-22` · `2025-23` · `2025-24` | `{ item, exam: 'suneung', type }` |
| `csat_item_task` | `evidence-locate:2026-31` · `2026-32` · `2026-33` · `2026-34` · `2025-32`(2025-31 은 검토로 제외) | 같음 |
| `learning_map_find` | `a4-4`(본문↔선지 · 바뀐 표현 대응 찾기) | `{ step: 'option', line: 'A4', item: '2026#22', items: [나머지] }` |
| `learning_map_find` | `a5-4`(근거 판단 · 고른 이유 출처 확인) | `{ step: 'evidence', line: 'A5', item: '2026#31', items: [나머지] }` |

3. 되돌리기: 적용을 `paused` 로 돌린다. 마지막 active 가 멈추면 항목이 in_review 로 자동 회귀한다. 재개 전에는 다시 채택해야 한다(B7).

## 켠 뒤 확인

- 문항 화면 `/csat/item/2026-31#principle` 에 `data-task="evidence-locate"` 패널이 보여야 한다.
- 지도 단계 시트 「근거 판단」 에 확인 문항 링크 5개(본문↔선지 6개)가 보여야 한다.
- 직접 확인 → 처방 개방은 실제 계정에서만 열린다(합성 계정은 제외). 열린 경로는 렌더 테스트와 시뮬레이션이 맡는다.
