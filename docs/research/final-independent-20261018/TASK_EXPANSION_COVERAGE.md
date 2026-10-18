<!-- docs/research/final-independent-20261018/TASK_EXPANSION_COVERAGE.md -->
# TASK 확장 후보와 실제 공급 증거

후보 3c15ba23c5c60d51fd035a00a5ec3eef2b442b5f, main c3a03d168. [기존30 TASK](./task-support.json)의 정의 바이트가 후보에서도 동일함을 확인했다. A~H를 TASK와 일대일 대응시키지 않는다. 이전 [0bd 관찰](./TASK_RUNTIME_COVERAGE.md)은 이력으로 보존한다.

[현재 READ ONLY 집계](./task-runtime-expansion-snapshot.json) 시각 2026-10-18T09:27:28.046586+00:00: authored 표 미설치, FQ/납품/결속 근거0. [기계 대조 결과](./task-expansion-coverage.json)에 세트별 실제 SHA/작성 출처/역할 개수를 기록했다. 실제 학습자 ID나 응답은 읽거나 저장하지 않았다.

| TASK | 직접확인 메타 | 명시 근거 키 | 창작 초안 수 | 세트 형식 | 자격/납품/결속근거 |
|---|---|---|---:|---|---:|
| v.core_meaning | content_needed | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| v.contextual_sense | content_needed | authored-vocab-context | 6 | contextual_sense | 0/0/0 |
| v.multiword | content_needed | authored-multiword | 6 | contextual_sense | 0/0/0 |
| v.semantic_relation | content_needed | authored-semantic-relation | 6 | equivalence | 0/0/0 |
| s.sentence_core | content_needed | authored-sentence-core | 6 | segment_choice | 0/0/0 |
| s.chunk_boundary | content_needed | authored-chunk-boundary | 6 | segment_choice | 0/0/0 |
| s.attachment | content_needed | authored-attachment | 6 | segment_choice | 0/0/0 |
| s.structural_relation | content_needed | authored-structural-relation | 6 | segment_choice | 0/0/0 |
| s.form_scope | content_needed | authored-grammar-scope | 6 | form_scope | 0/0/0 |
| s.o.sentence_meaning_model | content_needed | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| r.reference | ready | authored-reference | 6 | choice_evidence | 0/0/0 |
| r.relation | ready | cohesion-link, authored-cohesion | 6 | sentence_relation | 0/0/0 |
| r.discourse_function | live | authored-discourse-function | 6 | discourse_roles | 0/0/0 |
| r.discourse_structure | live | authored-discourse-structure | 6 | discourse_roles | 0/0/0 |
| r.central_meaning | live | claim-support, authored-central-meaning | 9 | central_meaning | 0/0/0 |
| r.inference | content_needed | authored-inference | 6 | choice_evidence | 0/0/0 |
| r.o.global_meaning_model | content_needed | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| e.task_demand | content_needed | authored-task-demand | 6 | demand_choice | 0/0/0 |
| e.evidence_location | live | evidence-locate, authored-evidence-locate | 6 | choice_evidence | 0/0/0 |
| e.option_correspondence | live | option-restate, authored-option-match | 6 | option_correspondence | 0/0/0 |
| e.o.final_judgment | content_needed | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| l.sound | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| l.sentence | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| l.retain | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| l.respond | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| x.time_allocation | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| x.sequence | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| x.recovery_adaptation | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| x.attention_stamina | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |
| x.o.whole_test_stability | blocked | UNMAPPED | 0 | UNMAPPED | 0/0/0 |

후보는17 TASK의105문항(R5 9 + 확장16세트 각6)이다. 첫 확장36문항은 [1차 내용 검토](./EXPANSION_CONTENT_REVIEW.md), 후속60문항은 [2차 내용 검토](./EXPANSION2_CONTENT_REVIEW.md)에 연결한다. 초안/AI 일치/정적 형식 레지스트리는 사람 Gold·권리·출시·실제 전이·PLAN 환류 증거가 아니다. 새4형식의 세트 등록과 독립 컴포넌트/채점 검사는 [2차 검토](./EXPANSION2_CONTENT_REVIEW.md)로 확인한다. 등록/기본 상호작용은 전체 능력 수용을 증명하지 않는다.

나머지 비보류4 TASK에는 창작 세트가 없다. 이들은 v.core_meaning 및 s.o.sentence_meaning_model/r.o.global_meaning_model/e.o.final_judgment다. 세트 부재만으로 TASK 전체 미구현이라고 단정하거나 산출 TASK마다 별도 세트를 새 필수 게이트로 요구하지 않는다. 기존 조합/산출 근거는 별도로 대조해야 한다. L/X blocked9개도 지원 완료로 세지 않는다. 기존 legacy 직접 근거는 이름 추정으로 확장하지 않으며 UNMAPPED를 유지한다. claim-support 독립 모양125행 중124 synthetic, 나머지1행은 실제 학생/효과로 확정하지 않는다. viewed_first 4행은 독립 근거가 아니다. 전체 A~H PARTIAL/BLOCKED_EXTERNAL 및 REWORK를 유지한다.
